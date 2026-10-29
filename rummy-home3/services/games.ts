import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { MIGRATION_007_HINT, playersService } from '@/services/players';
import { GameType, ProfileDefaults, ScoreType } from '@/types/database';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { canEnterScores, gameVisibleToUser, SeatRole } from '@/utils/gameAccess';
import { createViewToken } from '@/utils/shareLink';
import { calculateDealerId, legacySettingsForGameType, RoundScoreInput, settingsForGameType, validateRoundScores } from '@/utils/scoring';
import { storage } from '@/utils/storage';
import { createUuid, isUuid } from '@/utils/uuid';
import { REQUEST_TIMEOUT_MS, withTimeout } from '@/utils/withTimeout';
import { GAME_SIZE_MESSAGE, MAX_SEATED_PLAYERS, SEATED_PLAYER_LIMIT } from '@/constants/limits';

type CreateGameInput = {
  playerIds: string[];
  gameType: GameType;
  expenseEnabled: boolean;
  expenseAmount?: number;
  createdBy: string;
  settings?: ProfileDefaults;
};

type AddRoundInput = {
  gameId: string;
  roundNumber: number;
  scores: RoundScoreInput[];
  createdBy: string;
};

type CompleteGameInput = {
  prize?: number | null;
  prizeShares?: Record<string, number> | null;
};

const missingRpc = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  const message = ((error as { message?: string })?.message ?? '').toLowerCase();
  return code === 'PGRST202' || message.includes('could not find the function') || message.includes('schema cache');
};

const missingColumn = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  const message = ((error as { message?: string })?.message ?? '').toLowerCase();
  return code === '42703' || code === 'PGRST204' || message.includes('column') && (message.includes('view_token') || message.includes('prize'));
};

export const MIGRATION_006_HINT =
  'This needs the latest database update. Run supabase/migrations/006_friday_game_night.sql in the Supabase SQL editor, then try again.';

export { MIGRATION_007_HINT };

/** Reserved column key for table expenses, which have no owning player. */
export const EXPENSE_PLAYER_ID = 'EX';

const SHARE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const makeShareCode = () =>
  Array.from({ length: 6 }, () => SHARE_CODE_ALPHABET[Math.floor(Math.random() * SHARE_CODE_ALPHABET.length)]).join('');

const legacyGameFromServer = (
  game: any,
  scores: any[] = [],
  gamePlayers: any[] = [],
): Game => {
  const memberships = [...gamePlayers].sort((a, b) => (a.player_order ?? 0) - (b.player_order ?? 0));
  const seated = memberships.filter((membership) => membership.role !== 'spectator' && membership.seated !== false);
  const playerIds = seated.map((membership) => membership.profile_id);

  const scoreMap = playerIds.reduce<Record<string, number[]>>((acc, playerId) => {
    acc[playerId] = [];
    return acc;
  }, {});

  scores.forEach((score) => {
    if (score.rounds?.undone_at) return;

    // Expenses belong to the table, not a player, so they are stored without a
    // profile and surface under the reserved EXPENSE_PLAYER_ID column.
    const key = score.profile_id ?? (score.score_type === 'expense' ? EXPENSE_PLAYER_ID : null);
    if (!key) return;

    const index = Math.max((score.rounds?.round_number ?? 1) - 1, 0);
    if (!scoreMap[key]) scoreMap[key] = [];
    scoreMap[key][index] = score.value;
  });

  return {
    id: game.id,
    date: game.created_at,
    isComplete: game.status === 'completed',
    players: playerIds,
    scores: scoreMap,
    currentRound: game.current_round,
    gameType: game.game_type,
    settings: legacySettingsForGameType(
      game.game_type,
      game.settings?.expenseEnabled ?? true,
      game.settings?.expenseAmount,
    ),
    shareCode: game.share_code ?? undefined,
    viewToken: game.view_token ?? undefined,
    createdBy: game.created_by ?? undefined,
    prize: game.prize ?? null,
    prizeShares: (game.prize_shares as Record<string, number> | null) ?? null,
    spectators: memberships.filter((membership) => membership.role === 'spectator').map((membership) => membership.profile_id),
    adminIds: memberships.filter((membership) => membership.role === 'game_admin').map((membership) => membership.profile_id),
    unseatedAdminIds: memberships
      .filter((membership) => membership.role === 'game_admin' && membership.seated === false)
      .map((membership) => membership.profile_id),
    gameNumber: game.game_number ?? null,
    closedAt: game.closed_at ?? null,
  };
};

export const gamesService = {
  async createGame(input: CreateGameInput): Promise<Game> {
    const seated = input.playerIds.filter((id) => id && id !== EXPENSE_PLAYER_ID);
    if (seated.length < 2 || seated.length > MAX_SEATED_PLAYERS) {
      throw new Error(GAME_SIZE_MESSAGE);
    }

    const baseSettings = input.settings ?? settingsForGameType(input.gameType);
    const settings = {
      ...baseSettings,
      expenseEnabled: input.expenseEnabled,
      expenseAmount: input.expenseAmount ?? baseSettings.expenseAmount,
      gameType: input.gameType,
    };

    if (!isSupabaseConfigured) {
      const existingGames = await storage.getGames();
      const creatorGames = existingGames.filter((g) => g.createdBy === input.createdBy);
      const nextNumber = creatorGames.length > 0
        ? Math.max(...creatorGames.map((g) => g.gameNumber ?? 0)) + 1
        : 1;
      const legacyGame: Game = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        players: input.playerIds,
        scores: Object.fromEntries(input.playerIds.map((playerId) => [playerId, []])),
        currentRound: 1,
        isComplete: false,
        gameType: input.gameType,
        settings: legacySettingsForGameType(
          input.gameType,
          input.expenseEnabled,
          settings.expenseAmount,
        ),
        createdBy: input.createdBy,
        viewToken: createViewToken(),
        shareCode: makeShareCode(),
        adminIds: [input.createdBy],
        unseatedAdminIds: input.playerIds.includes(input.createdBy) ? [] : [input.createdBy],
        spectators: [],
        gameNumber: nextNumber,
        closedAt: null,
      };
      await storage.addGame(legacyGame);
      await playersService.rememberTogether(input.createdBy, input.playerIds).catch(() => {});
      return legacyGame;
    }

    const shareCode = makeShareCode();
    const gameId = createUuid();
    if (!isUuid(gameId)) {
      throw new Error('Failed to generate a valid game id.');
    }

    const { error: gameError } = await supabase
      .from('games')
      .insert({
        id: gameId,
        created_by: input.createdBy,
        game_type: input.gameType,
        settings,
        share_code: shareCode,
      });

    if (gameError) throw gameError;

    const memberships = input.playerIds.map((profileId, index) => ({
      game_id: gameId,
      profile_id: profileId,
      player_order: index,
      display_number: index + 1,
      role: profileId === input.createdBy ? 'game_admin' as const : 'player' as const,
      color_code: null,
    }));

    const { error: playersError } = await supabase.from('game_players').insert(memberships);
    if (playersError) throw playersError;

    if (!input.playerIds.includes(input.createdBy)) {
      const unseated = await supabase.from('game_players').insert({
        game_id: gameId,
        profile_id: input.createdBy,
        player_order: 900,
        role: 'game_admin',
        seated: false,
      });
      if (unseated.error && !missingColumn(unseated.error)) {
        // The creator still runs the game through created_by when this row cannot be stored.
      }
    }

    await playersService.rememberTogether(input.createdBy, input.playerIds).catch(() => {});

    const created = await this.getGame(gameId);
    if (!created) {
      return legacyGameFromServer(
        {
          id: gameId,
          created_at: new Date().toISOString(),
          status: 'active',
          current_round: 1,
          game_type: input.gameType,
          settings,
          share_code: shareCode,
        },
        [],
        memberships,
      );
    }
    return created;
  },

  async listGamesForCurrentUser(currentUserId: string, options: { limit?: number; includeScores?: boolean; email?: string | null } = {}): Promise<Game[]> {
    const limit = options.limit ?? 50;
    const includeScores = options.includeScores ?? false;

    if (!isSupabaseConfigured) {
      const games = await storage.getGames();
      return games
        .filter((game) => gameVisibleToUser(game, { id: currentUserId, email: options.email }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, limit);
    }

    const gameIds = await this.visibleGameIds(currentUserId);
    if (gameIds.length === 0) return [];

    const gamesQuery = () => supabase
      .from('games')
      .select('*, game_players(profile_id, player_order, role, seated)')
      .in('id', gameIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    let { data: games, error } = await withTimeout(gamesQuery(), REQUEST_TIMEOUT_MS, 'Couldn’t load your games.');
    if (error && missingColumn(error)) {
      ({ data: games, error } = await supabase
        .from('games')
        .select('*, game_players(profile_id, player_order, role)')
        .in('id', gameIds)
        .order('created_at', { ascending: false })
        .limit(limit));
    }
    if (error) throw error;
    const rows = games ?? [];

    if (!includeScores) {
      return rows.map((game: any) => legacyGameFromServer(game, [], game.game_players ?? []));
    }

    const ids = rows.map((game) => game.id);
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select('*, rounds(round_number, undone_at)')
      .in('game_id', ids);
    if (scoresError) throw scoresError;

    const scoresByGame = new Map<string, any[]>();
    (scores ?? []).forEach((score) => {
      const bucket = scoresByGame.get(score.game_id) ?? [];
      bucket.push(score);
      scoresByGame.set(score.game_id, bucket);
    });

    return rows.map((game: any) =>
      legacyGameFromServer(game, scoresByGame.get(game.id) ?? [], game.game_players ?? []),
    );
  },

  async visibleGameIds(_currentUserId: string): Promise<string[]> {
    const rpc = await withTimeout(
      supabase.rpc('list_visible_game_ids'),
      REQUEST_TIMEOUT_MS,
      'Couldn’t load your games.',
    );
    if (!rpc.error) {
      return [...new Set((rpc.data ?? []) as string[])];
    }
    if (missingRpc(rpc.error)) throw new Error(MIGRATION_006_HINT);
    throw rpc.error;
  },

  async getGame(gameId: string): Promise<Game | null> {
    if (!isSupabaseConfigured) {
      const games = await storage.getGames();
      return games.find((game) => game.id === gameId) ?? null;
    }

    const [{ data: game, error: gameError }, { data: gamePlayers, error: playersError }, { data: scores, error: scoresError }] =
      await Promise.all([
        supabase.from('games').select('*').eq('id', gameId).maybeSingle(),
        supabase.from('game_players').select('*').eq('game_id', gameId).order('player_order', { ascending: true }),
        supabase.from('scores').select('*, rounds(round_number, undone_at)').eq('game_id', gameId),
      ]);

    if (gameError) throw gameError;
    if (playersError) throw playersError;
    if (scoresError) throw scoresError;
    if (!game) return null;

    return legacyGameFromServer(game, scores ?? [], gamePlayers ?? []);
  },

  async listGamePlayers(gameId: string): Promise<Player[]> {
    if (!isSupabaseConfigured) {
      const [game, players] = await Promise.all([this.getGame(gameId), storage.getPlayers()]);
      if (!game) return [];
      const byId = new Map(players.map((player) => [player.id, player]));
      const seatFor = (playerId: string): SeatRole =>
        game.spectators?.includes(playerId)
          ? 'spectator'
          : game.adminIds?.includes(playerId) || game.unseatedAdminIds?.includes(playerId)
            ? 'game_admin'
            : 'player';
      const ids = [...game.players, ...(game.spectators ?? []), ...(game.unseatedAdminIds ?? [])];
      return ids
        .map((playerId) => {
          const known = byId.get(playerId);
          const base = known ?? { id: playerId, name: 'Rummy Player', role: 'player' as const };
          return {
            ...base,
            email: undefined,
            phone: undefined,
            seatRole: seatFor(playerId),
            seated: !game.unseatedAdminIds?.includes(playerId) && !game.spectators?.includes(playerId),
          };
        });
    }

    const withSeat = await supabase
      .from('game_players')
      .select('profile_id, role, seated, player_order, profiles(display_name, player_code, email)')
      .eq('game_id', gameId)
      .order('player_order', { ascending: true });

    const loaded = withSeat.error && missingColumn(withSeat.error)
      ? await supabase
        .from('game_players')
        .select('profile_id, role, player_order, profiles(display_name, player_code, email)')
        .eq('game_id', gameId)
        .order('player_order', { ascending: true })
      : withSeat;
    if (loaded.error) throw loaded.error;

    return (loaded.data ?? []).map((membership: any) => ({
      id: membership.profile_id,
      name: membership.profiles?.display_name ?? 'Rummy Player',
      playerCode: membership.profiles?.player_code ?? undefined,
      email: membership.profiles?.email ?? undefined,
      role: membership.role === 'game_admin' ? 'admin' as const : 'player' as const,
      seatRole: (membership.role ?? 'player') as SeatRole,
      seated: membership.seated !== false && membership.role !== 'spectator',
    }));
  },

  async accessFor(gameId: string, userId: string | null) {
    const game = await this.getGame(gameId);
    if (!game || !userId) {
      return { game, canScore: false, isCreator: false, seatRole: null as SeatRole | null, rolesKnown: true };
    }

    const seats = isSupabaseConfigured ? await this.listGamePlayers(gameId) : [];
    const mine = seats.find((seat) => seat.id === userId);
    const seatRole = mine?.seatRole
      ?? (game.adminIds?.includes(userId) ? 'game_admin' as const
        : game.spectators?.includes(userId) ? 'spectator' as const
          : game.players.includes(userId) ? 'player' as const
            : null);
    const rolesKnown = isSupabaseConfigured || Boolean(game.createdBy) || Boolean(game.adminIds?.length);
    const isCreator = game.createdBy === userId;
    return {
      game,
      isCreator,
      seatRole,
      rolesKnown,
      canScore: canEnterScores({ isCreator, seatRole, rolesKnown }),
    };
  },

  async addRound(input: AddRoundInput) {
    const validation = validateRoundScores(input.scores);
    if (!validation.valid) throw new Error(validation.error ?? 'Invalid round scores.');

    if (!isSupabaseConfigured) {
      const game = await this.getGame(input.gameId);
      if (!game) throw new Error('Game not found.');

      const roundIndex = input.roundNumber - 1;
      const updatedScores = { ...game.scores };
      game.players.forEach((playerId) => {
        if (!updatedScores[playerId]) updatedScores[playerId] = [];
        while (updatedScores[playerId].length <= roundIndex) updatedScores[playerId].push(0);
      });
      input.scores.forEach((score) => {
        const key = score.playerId ?? (score.scoreType === 'expense' ? EXPENSE_PLAYER_ID : null);
        if (!key) return;
        if (!updatedScores[key]) updatedScores[key] = [];
        updatedScores[key][roundIndex] = score.value;
      });

      const updatedGame = { ...game, scores: updatedScores, currentRound: input.roundNumber + 1 };
      await storage.updateGame(updatedGame);
      return updatedGame;
    }

    const game = await this.getGame(input.gameId);
    if (!game) throw new Error('Game not found.');

    const dealerId = calculateDealerId(game.players, input.roundNumber);
    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .insert({
        game_id: input.gameId,
        round_number: input.roundNumber,
        dealer_profile_id: dealerId,
        created_by: input.createdBy,
      })
      .select('*')
      .single();

    if (roundError) throw roundError;

    const { error: scoresError } = await supabase.from('scores').insert(
      input.scores.map((score) => ({
        round_id: round.id,
        game_id: input.gameId,
        profile_id: score.playerId,
        score_type: score.scoreType,
        value: score.value,
      })),
    );

    if (scoresError) throw scoresError;

    const { error: gameError } = await supabase
      .from('games')
      .update({ current_round: input.roundNumber + 1 })
      .eq('id', input.gameId);

    if (gameError) throw gameError;
    return this.getGame(input.gameId);
  },

  async undoLastRound(gameId: string, undoneBy: string) {
    if (!isSupabaseConfigured) {
      const game = await this.getGame(gameId);
      if (!game) return null;
      const maxRounds = Math.max(...Object.values(game.scores).map((scores) => scores.length), 0);
      if (maxRounds === 0) return game;
      // Columns can be shorter than the round count (e.g. expense cleared in the
      // last round), so trim to the round being undone rather than popping each.
      const updatedGame = {
        ...game,
        scores: Object.fromEntries(
          Object.entries(game.scores).map(([playerId, scores]) => [playerId, scores.slice(0, maxRounds - 1)]),
        ),
        currentRound: Math.max(1, maxRounds),
      };
      await storage.updateGame(updatedGame);
      return updatedGame;
    }

    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .select('*')
      .eq('game_id', gameId)
      .is('undone_at', null)
      .order('round_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (roundError) throw roundError;
    if (!round) return this.getGame(gameId);

    const { error } = await supabase
      .from('rounds')
      .update({ undone_at: new Date().toISOString(), undone_by: undoneBy, undo_reason: 'admin undo' })
      .eq('id', round.id);

    if (error) throw error;
    return this.getGame(gameId);
  },

  async completeGame(gameId: string, settlement?: CompleteGameInput) {
    if (!isSupabaseConfigured) {
      const game = await this.getGame(gameId);
      if (!game) return null;
      const updatedGame = {
        ...game,
        isComplete: true,
        prize: settlement?.prize ?? game.prize ?? null,
        prizeShares: settlement?.prizeShares ?? game.prizeShares ?? null,
      };
      await storage.updateGame(updatedGame);
      return updatedGame;
    }

    const completedAt = new Date().toISOString();
    const patch: {
      status: 'completed';
      completed_at: string;
      prize?: number | null;
      prize_shares?: Record<string, number> | null;
    } = { status: 'completed', completed_at: completedAt };
    if (settlement) {
      patch.prize = settlement.prize ?? null;
      patch.prize_shares = settlement.prizeShares ?? null;
    }

    const { error } = await supabase.from('games').update(patch).eq('id', gameId);
    if (error && settlement && missingColumn(error)) {
      const retry = await supabase
        .from('games')
        .update({ status: 'completed', completed_at: completedAt })
        .eq('id', gameId);
      if (retry.error) throw retry.error;
      return this.getGame(gameId);
    }
    if (error) throw error;
    return this.getGame(gameId);
  },

  async ensureViewToken(gameId: string): Promise<string> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found.');
    if (game.viewToken) return game.viewToken;

    const token = createViewToken();
    if (!isSupabaseConfigured) {
      await storage.updateGame({ ...game, viewToken: token });
      return token;
    }

    const { error } = await supabase.from('games').update({ view_token: token }).eq('id', gameId);
    if (error) {
      if (missingColumn(error)) throw new Error(MIGRATION_006_HINT);
      throw error;
    }
    return token;
  },

  async setSeatRole(gameId: string, profileId: string, role: SeatRole) {
    if (!isSupabaseConfigured) {
      const game = await this.getGame(gameId);
      if (!game) throw new Error('Game not found.');
      const adminIds = new Set(game.adminIds ?? []);
      const spectators = new Set(game.spectators ?? []);
      const unseated = new Set(game.unseatedAdminIds ?? []);
      if (role === 'spectator') {
        if (game.players.includes(profileId)) {
          throw new Error('Someone already on the scorecard stays in the game. Add a different person as view-only.');
        }
        adminIds.delete(profileId);
        unseated.delete(profileId);
        spectators.add(profileId);
      } else if (role === 'game_admin') {
        spectators.delete(profileId);
        adminIds.add(profileId);
      } else {
        spectators.delete(profileId);
        adminIds.delete(profileId);
        unseated.delete(profileId);
      }
      const updated = { ...game, adminIds: [...adminIds], spectators: [...spectators], unseatedAdminIds: [...unseated] };
      await storage.updateGame(updated);
      return updated;
    }

    if (role === 'spectator') {
      const { data: existing, error: existingError } = await supabase
        .from('game_players')
        .select('id, role')
        .eq('game_id', gameId)
        .eq('profile_id', profileId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing && existing.role !== 'spectator') {
        throw new Error('Someone already on the scorecard stays in the game. Add a different person as view-only.');
      }
      if (!existing) {
        const { data: orders, error: orderError } = await supabase
          .from('game_players')
          .select('player_order')
          .eq('game_id', gameId);
        if (orderError) throw orderError;
        const next = Math.max(-1, ...(orders ?? []).map((row) => row.player_order)) + 1;
        const { error } = await supabase.from('game_players').insert({
          game_id: gameId,
          profile_id: profileId,
          player_order: next,
          display_number: next + 1,
          role: 'spectator',
        });
        if (error) throw error;
      }
      return this.getGame(gameId);
    }

    const { error } = await supabase
      .from('game_players')
      .update({ role })
      .eq('game_id', gameId)
      .eq('profile_id', profileId);
    if (error) throw error;
    return this.getGame(gameId);
  },

  async addSeatedPlayer(gameId: string, profileId: string) {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found.');
    if (game.players.includes(profileId) || game.spectators?.includes(profileId) || game.unseatedAdminIds?.includes(profileId)) {
      throw new Error('They are already in this game.');
    }
    const seated = game.players.filter((id) => id !== EXPENSE_PLAYER_ID);
    if (seated.length >= MAX_SEATED_PLAYERS) {
      throw new Error(SEATED_PLAYER_LIMIT);
    }

    if (!isSupabaseConfigured) {
      const updated = { ...game, players: [...game.players, profileId] };
      if (!updated.scores[profileId]) updated.scores = { ...updated.scores, [profileId]: [] };
      await storage.updateGame(updated);
      await playersService.rememberTogether(game.createdBy ?? profileId, [profileId]).catch(() => {});
      return updated;
    }

    const { data: orders, error: orderError } = await supabase.from('game_players').select('player_order').eq('game_id', gameId);
    if (orderError) throw orderError;
    const next = Math.max(-1, ...(orders ?? []).map((row) => row.player_order)) + 1;
    const { error } = await supabase.from('game_players').insert({
      game_id: gameId,
      profile_id: profileId,
      player_order: next,
      display_number: next + 1,
      role: 'player',
      seated: true,
    });
    if (error) {
      if (missingColumn(error)) {
        const retry = await supabase.from('game_players').insert({
          game_id: gameId,
          profile_id: profileId,
          player_order: next,
          display_number: next + 1,
          role: 'player',
        });
        if (retry.error) throw retry.error;
      } else {
        throw error;
      }
    }
    if (game.createdBy) await playersService.rememberTogether(game.createdBy, [profileId]).catch(() => {});
    return this.getGame(gameId);
  },

  async addNonPlayerAdmin(gameId: string, profileId: string) {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found.');
    if (game.players.includes(profileId)) {
      throw new Error('They are already a score column. Promote them instead.');
    }

    if (!isSupabaseConfigured) {
      const adminIds = new Set([...(game.adminIds ?? []), profileId]);
      const spectators = (game.spectators ?? []).filter((id) => id !== profileId);
      const unseated = new Set([...(game.unseatedAdminIds ?? []), profileId]);
      const updated = { ...game, adminIds: [...adminIds], spectators, unseatedAdminIds: [...unseated] };
      await storage.updateGame(updated);
      return updated;
    }

    const { data: orders, error: orderError } = await supabase.from('game_players').select('player_order').eq('game_id', gameId);
    if (orderError) throw orderError;
    const next = Math.max(900, ...(orders ?? []).map((row) => row.player_order)) + 1;
    const { error } = await supabase.from('game_players').insert({
      game_id: gameId,
      profile_id: profileId,
      player_order: next,
      role: 'game_admin',
      seated: false,
    });
    if (error) {
      if (missingColumn(error)) throw new Error(MIGRATION_007_HINT);
      throw error;
    }
    return this.getGame(gameId);
  },

  async moveSeat(gameId: string, profileId: string, direction: -1 | 1) {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found.');
    const index = game.players.indexOf(profileId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= game.players.length) return game;

    if (!isSupabaseConfigured) {
      const players = [...game.players];
      const [moved] = players.splice(index, 1);
      players.splice(target, 0, moved);
      const updated = { ...game, players };
      await storage.updateGame(updated);
      return updated;
    }

    const { data: rows, error } = await supabase
      .from('game_players')
      .select('id, profile_id, player_order, seated, role')
      .eq('game_id', gameId)
      .order('player_order', { ascending: true });
    if (error) throw error;
    const seated = (rows ?? []).filter((row) => row.role !== 'spectator' && (row as { seated?: boolean }).seated !== false);
    const from = seated.findIndex((row) => row.profile_id === profileId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= seated.length) return game;
    const a = seated[from];
    const b = seated[to];
    const park = 10000 + a.player_order;
    const first = await supabase.from('game_players').update({ player_order: park }).eq('id', a.id);
    if (first.error) throw first.error;
    const second = await supabase.from('game_players').update({ player_order: a.player_order }).eq('id', b.id);
    if (second.error) throw second.error;
    const third = await supabase.from('game_players').update({ player_order: b.player_order }).eq('id', a.id);
    if (third.error) throw third.error;
    return this.getGame(gameId);
  },
};

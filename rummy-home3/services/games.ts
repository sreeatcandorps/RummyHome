import { nextLocalGameLabel } from '@/utils/gameLabel';
import { NOT_READY_MESSAGE } from '@/utils/notReady';
import { displayPlayerId } from '@/utils/playerIdentity';
import { PointsRules, withStoredPointsRules } from '@/utils/gameSettings';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { MIGRATION_007_HINT, playersService } from '@/services/players';
import { RETIRED_ROUND_OFFSET, retiredRoundNumber } from '@/utils/editRound';
import { isRoundConflict, toRoundConflictError } from '@/utils/roundConflict';
import { zerosForJoiner } from '@/utils/gamePlayers';
import { SEAT_REMOVAL_NOT_READY, seatRemovalProblem } from '@/utils/seatRemoval';
import { GameType, ProfileDefaults, ScoreType } from '@/types/database';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { canEnterScores, gameVisibleToUser, SeatRole } from '@/utils/gameAccess';
import { gameCache } from '@/utils/gameCache';
import { canReopenGame, REOPEN_BLOCKED_MESSAGE } from '@/utils/gameStatus';
import { createViewToken } from '@/utils/shareLink';
import { calculateDealerId, legacySettingsForGameType, RoundScoreInput, settingsForGameType, validateRoundScores } from '@/utils/scoring';
import { storage } from '@/utils/storage';
import { createUuid, isUuid } from '@/utils/uuid';
import { REQUEST_TIMEOUT_MS, withTimeout } from '@/utils/withTimeout';
import { GAME_SIZE_MESSAGE, MAX_SEATED_PLAYERS, SEATED_PLAYER_LIMIT } from '@/constants/limits';
import { localGameGuard, localRoundsGuard } from '@/utils/guardrails';
import { BundleSeatRow, dealerIdsFrom, GameBundle, isGameBundle, legacyScoreRows, ResultCandidate, totalsAsScoreRows } from '@/utils/bundles';
import { nextDealer, withDealer } from '@/utils/dealerRotation';
import { queryCache } from '@/utils/queryCache';
import { normalizeInitials } from '@/utils/initials';

type CreateGameInput = {
  playerIds: string[];
  gameType: GameType;
  createdBy: string;
  settings?: ProfileDefaults;
  /** Drop, Middle drop, and Full count for this game. */
  rules?: PointsRules;
  /**
   * Column label per seated player, decided before Start game (the creator's My players
   * initials, clashes resolved). Stored on the seat so every phone and every later
   * game shows the same letters. Seats without one get the database default (022).
   */
  labels?: Record<string, string>;
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

export const missingRpc = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  const message = ((error as { message?: string })?.message ?? '').toLowerCase();
  return code === 'PGRST202' || message.includes('could not find the function') || message.includes('schema cache');
};

const missingColumn = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  const message = ((error as { message?: string })?.message ?? '').toLowerCase();
  return code === '42703' || code === 'PGRST204' || message.includes('column') && (message.includes('view_token') || message.includes('prize'));
};

export const MIGRATION_006_HINT = NOT_READY_MESSAGE;

export { MIGRATION_007_HINT };

/** Older saved games may still store this column id. It is not a player. */
const LEGACY_COLUMN_ID = 'EX';

function withoutLegacyColumn(game: Game): Game {
  const hasColumn = game.players.includes(LEGACY_COLUMN_ID) || Boolean(game.scores[LEGACY_COLUMN_ID]) || game.settings.expense;
  if (!hasColumn) return game;
  const scores = { ...game.scores };
  delete scores[LEGACY_COLUMN_ID];
  return {
    ...game,
    players: game.players.filter((id) => id !== LEGACY_COLUMN_ID),
    scores,
    settings: { ...game.settings, expense: false },
  };
}

const SHARE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const makeShareCode = () =>
  Array.from({ length: 6 }, () => SHARE_CODE_ALPHABET[Math.floor(Math.random() * SHARE_CODE_ALPHABET.length)]).join('');

export const legacyGameFromServer = (
  game: any,
  scores: any[] = [],
  gamePlayers: any[] = [],
  dealers?: Record<string, string | null> | null,
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

    if (score.score_type === 'expense' || !score.profile_id) return;
    const key = score.profile_id as string;

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
    settings: withStoredPointsRules(legacySettingsForGameType(game.game_type, false), game.settings),
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
    dealerIds: dealerIdsFrom(dealers, scores),
    gameNumber: game.game_number ?? null,
    gameLabel: game.game_label ?? null,
    closedAt: game.closed_at ?? null,
    completedAt: game.completed_at ?? null,
    deletedAt: game.deleted_at ?? null,
  };
};

/** The 023 answer for a deleted game: id, number and the stamp only, so the screen can say so and offer Restore. */
export const deletedGameFromServer = (row: Record<string, any>): Game => ({
  id: row.id,
  date: row.deleted_at ?? '',
  isComplete: true,
  players: [],
  scores: {},
  currentRound: 0,
  gameType: 'stake',
  settings: legacySettingsForGameType('stake', false),
  gameNumber: row.game_number ?? null,
  gameLabel: row.game_label ?? null,
  deletedAt: row.deleted_at ?? null,
  canRestore: row.can_restore === true,
});

/** Live games only: a deleted game (023) is out of every list and count. */
export const liveGames = <T extends { deletedAt?: string | null }>(games: T[]): T[] => games.filter((game) => !game.deletedAt);

/** A seat row (game_players + its profiles embed, or a bundle seat) as the app's Player. */
export const seatFromMembership = (membership: any): Player => ({
  id: membership.profile_id,
  name: membership.profiles?.display_name ?? 'Rummy Player',
  playerCode: displayPlayerId(membership.profiles),
  email: undefined,
  status: membership.profiles?.player_status ?? undefined,
  managedBy: membership.profiles?.managed_by ?? undefined,
  playerNo: membership.profiles?.public_player_no ?? undefined,
  firstName: membership.profiles?.first_name ?? undefined,
  lastName: membership.profiles?.last_name ?? undefined,
  role: membership.role === 'game_admin' ? 'admin' as const : 'player' as const,
  seatRole: (membership.role ?? 'player') as SeatRole,
  seated: membership.seated !== false && membership.role !== 'spectator',
  label: membership.label ?? undefined,
});

/** A game bundle (020) as the Game the mapper builds from the three legacy selects. */
export const gameFromBundle = (bundle: GameBundle): Game =>
  legacyGameFromServer(bundle.game, legacyScoreRows(bundle.scores), bundle.game_players ?? [], bundle.dealers);

/** Seats of a bundle, in player_order, as listGamePlayers returns them. */
export const seatsFromBundle = (rows: BundleSeatRow[] | null | undefined): Player[] =>
  [...(rows ?? [])].sort((a, b) => (a.player_order ?? 0) - (b.player_order ?? 0)).map(seatFromMembership);

/** PostgREST's "function does not exist" code: the migration is not applied yet. */
const MISSING_FUNCTION = 'PGRST202';

/**
 * get_game_bundle (020) is tried first; a database without it answers PGRST202 once
 * and the app then uses the pre-020 requests for the rest of the session.
 */
let gameBundleAvailable = true;
const GAME_KEY = (gameId: string) => `game:${gameId}`;

/**
 * One request for game + seats + live scores, shared by every caller asking for the
 * same game at the same moment (getGame and listGamePlayers are called together on
 * every screen). Resolves to null when the game is not there or not visible, and to
 * `undefined` when the RPC is missing so callers fall back to the legacy selects.
 */
async function loadGameBundle(gameId: string): Promise<{ game: Game; seats: Player[] } | null | undefined> {
  if (!gameBundleAvailable) return undefined;
  return queryCache.read(GAME_KEY(gameId), async () => {
    const { data, error } = await supabase.rpc('get_game_bundle', { p_game_id: gameId });
    if (error) {
      if (missingRpc(error)) {
        gameBundleAvailable = false;
        return undefined;
      }
      throw error;
    }
    if (!data) return null;
    if ((data as { deleted?: boolean }).deleted === true && (data as { game?: Record<string, any> }).game?.id) {
      const game = gameCache.putGame(deletedGameFromServer((data as { game: Record<string, any> }).game)) as Game;
      return { game, seats: gameCache.putSeats(gameId, []) };
    }
    if (!isGameBundle(data)) return undefined;
    const game = gameCache.putGame(gameFromBundle(data)) as Game;
    const seats = gameCache.putSeats(gameId, seatsFromBundle(data.game_players));
    return { game, seats };
  });
}

/**
 * Writes one round (Add or Edit) to Supabase.
 *
 * Preferred path: the atomic `save_round` RPC (migration 014; serialised per game
 * since 019). Fallback, used until that migration is applied: the original
 * request sequence, made self-healing so an interrupted save can no longer
 * leave a blank round:
 *  - a live round that already has scores is a duplicate submit → only advance the game;
 *  - a live round with no scores (an earlier interrupted save) is reused;
 *  - on Edit, if the new scores fail to land, the old round is put back.
 *
 * A race with another admin (019's PT409, or a raw unique violation from an
 * older server) is thrown as RoundConflictError so the screen can show the
 * message and refresh instead of surfacing a database error.
 */
async function writeRound(input: AddRoundInput, replace: boolean): Promise<void> {
  const payload = input.scores
    .filter((score) => score.scoreType !== 'expense' && score.playerId)
    .map((score) => ({ playerId: score.playerId, scoreType: score.scoreType, value: score.value }));

  const { error: rpcError } = await supabase.rpc('save_round', {
    p_game_id: input.gameId,
    p_round_number: input.roundNumber,
    p_scores: payload,
    p_replace: replace,
  });
  if (!rpcError) return;
  if (isRoundConflict(rpcError)) throw toRoundConflictError(rpcError);
  if (rpcError.code !== MISSING_FUNCTION) throw rpcError;

  const { data: live, error: liveError } = await supabase
    .from('rounds')
    .select('id, round_number, scores(count)')
    .eq('game_id', input.gameId)
    .eq('round_number', input.roundNumber)
    .is('undone_at', null)
    .maybeSingle();
  if (liveError) throw liveError;
  const liveScoreCount = (live?.scores as { count: number }[] | undefined)?.[0]?.count ?? 0;

  const retire = async (roundId: string, reason: string) => {
    let result: { error: { code?: string } | null } = { error: null };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      result = await supabase
        .from('rounds')
        .update({
          undone_at: new Date().toISOString(),
          undone_by: input.createdBy,
          undo_reason: reason,
          round_number: retiredRoundNumber(input.roundNumber, attempt),
        })
        .eq('id', roundId);
      if (!result.error || result.error.code !== '23505') break;
    }
    if (result.error) throw result.error;
  };

  const advance = async () => {
    const { error } = await supabase
      .from('games')
      .update({ current_round: input.roundNumber + 1 })
      .eq('id', input.gameId)
      .lte('current_round', input.roundNumber);
    if (error) throw error;
  };

  let reusableRoundId: string | null = null;
  if (live) {
    if (replace) {
      await retire(live.id, `edited round ${input.roundNumber}`);
    } else if (liveScoreCount > 0) {
      await advance();
      return;
    } else {
      reusableRoundId = live.id;
    }
  }

  const insertRound = async (): Promise<string> => {
    const players = (await gamesService.getGame(input.gameId))?.players ?? [];
    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .insert({
        game_id: input.gameId,
        round_number: input.roundNumber,
        dealer_profile_id: calculateDealerId(players, input.roundNumber),
        created_by: input.createdBy,
      })
      .select('id')
      .single();
    if (roundError) throw isRoundConflict(roundError) ? toRoundConflictError(roundError) : roundError;
    return round.id as string;
  };
  const targetRoundId = reusableRoundId ?? (await insertRound());

  const { error: scoresError } = await supabase.from('scores').insert(
    payload.map((score) => ({
      round_id: targetRoundId,
      game_id: input.gameId,
      profile_id: score.playerId,
      score_type: score.scoreType,
      value: score.value,
    })),
  );
  if (scoresError) {
    if (replace && live) {
      // Best effort: park the empty new row and bring the old scores back.
      try {
        await retire(targetRoundId, `edit of round ${input.roundNumber} failed`);
        await supabase
          .from('rounds')
          .update({ undone_at: null, undone_by: null, undo_reason: null, round_number: input.roundNumber })
          .eq('id', live.id);
      } catch {
        // The next Edit round reuses or retires whatever is left.
      }
    }
    throw scoresError;
  }

  if (!replace) await advance();
}

export const gamesService = {
  async createGame(input: CreateGameInput): Promise<Game> {
    const seated = input.playerIds.filter((id) => id && id !== LEGACY_COLUMN_ID);
    if (seated.length < 2 || seated.length > MAX_SEATED_PLAYERS) {
      throw new Error(GAME_SIZE_MESSAGE);
    }

    const baseSettings = input.settings ?? settingsForGameType(input.gameType);
    const settings = {
      ...baseSettings,
      expenseEnabled: false,
      gameType: input.gameType,
      ...(input.rules ? {
        stakeDrop: input.rules.drop,
        stakeMiddleDrop: input.rules.middleDrop,
        dropAmount: input.rules.drop,
        mdAmount: input.rules.middleDrop,
        maxCount: input.rules.fullCount,
      } : {}),
    };

    if (!isSupabaseConfigured) {
      const existingGames = await storage.getGames();
      const refused = localGameGuard(existingGames.map((g) => ({ createdBy: g.createdBy, status: g.isComplete ? 'completed' : 'active', closedAt: g.closedAt, deletedAt: g.deletedAt, createdAt: g.date })), input.createdBy);
      if (refused) throw new Error(refused);
      const nextLabel = nextLocalGameLabel(existingGames, input.createdBy, input.gameType);
      const legacyGame: Game = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        players: seated,
        scores: Object.fromEntries(seated.map((playerId) => [playerId, []])),
        currentRound: 1,
        isComplete: false,
        gameType: input.gameType,
        settings: withStoredPointsRules(legacySettingsForGameType(input.gameType, false), settings),
        createdBy: input.createdBy,
        viewToken: createViewToken(),
        shareCode: makeShareCode(),
        adminIds: [input.createdBy],
        unseatedAdminIds: seated.includes(input.createdBy) ? [] : [input.createdBy],
        spectators: [],
        gameNumber: Number(nextLabel.slice(1)),
        gameLabel: nextLabel,
        closedAt: null,
        labels: input.labels,
      };
      await storage.addGame(legacyGame);
      await playersService.rememberTogether(input.createdBy, seated).catch(() => {});
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

    // Before the seats, so a player new to the creator's My players has a row (and
    // initials) there when the seat trigger looks one up.
    await playersService.rememberTogether(input.createdBy, seated).catch(() => {});

    const memberships = seated.map((profileId, index) => ({
      game_id: gameId,
      profile_id: profileId,
      player_order: index,
      display_number: index + 1,
      role: profileId === input.createdBy ? 'game_admin' as const : 'player' as const,
      color_code: null,
    }));
    const labelled = memberships.map((row) => ({ ...row, label: input.labels?.[row.profile_id] ?? null }));

    const withLabels = await supabase.from('game_players').insert(labelled);
    // A pre-022 database has no label column; the app then derives labels from names.
    const playersError = withLabels.error && missingColumn(withLabels.error)
      ? (await supabase.from('game_players').insert(memberships)).error
      : withLabels.error;
    if (playersError) throw playersError;

    if (!seated.includes(input.createdBy)) {
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
      const games = liveGames(await storage.getGames());
      return games
        .map(withoutLegacyColumn)
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
      const game = games.find((item) => item.id === gameId) ?? null;
      if (game?.deletedAt) {
        const me = await storage.getCurrentPlayer();
        const canRestore = Boolean(me) && (game.deletedBy === me || game.createdBy === me || (game.adminIds ?? []).includes(me as string));
        return gameCache.putGame({ ...withoutLegacyColumn(game), players: [], scores: {}, canRestore });
      }
      return gameCache.putGame(game ? withoutLegacyColumn(game) : null);
    }

    const bundled = await loadGameBundle(gameId);
    if (bundled !== undefined) return bundled?.game ?? null;

    const [{ data: game, error: gameError }, { data: gamePlayers, error: playersError }, { data: scores, error: scoresError }] =
      await Promise.all([
        supabase.from('games').select('*').eq('id', gameId).maybeSingle(),
        supabase.from('game_players').select('*').eq('game_id', gameId).order('player_order', { ascending: true }),
        supabase.from('scores').select('*, rounds(round_number, undone_at, dealer_profile_id)').eq('game_id', gameId),
      ]);

    if (gameError) throw gameError;
    if (playersError) throw playersError;
    if (scoresError) throw scoresError;
    if (!game) return null;

    return gameCache.putGame(legacyGameFromServer(game, scores ?? [], gamePlayers ?? []));
  },

  /** Last-known copy from this session, or null. Screens show it at once, then refresh. */
  peekGame(gameId: string | null | undefined): Game | null {
    return gameCache.peekGame(gameId);
  },

  peekSeats(gameId: string | null | undefined): Player[] | null {
    return gameCache.peekSeats(gameId);
  },

  /** Warm the cache for a game the user is likely to open next (e.g. a live game on Home). */
  async prefetchGame(gameId: string): Promise<void> {
    try {
      // One bundle request fills both caches; the legacy path needs the two calls.
      const bundled = await loadGameBundle(gameId);
      if (bundled === undefined) await Promise.all([this.getGame(gameId), this.listGamePlayers(gameId)]);
    } catch {
      // Best effort only; the screen will load normally.
    }
  },

  /** Game settings: change Drop, Middle drop, and Full count any time, even mid-game. */
  async updateGameRules(gameId: string, rules: PointsRules): Promise<Game | null> {
    if (!isSupabaseConfigured) {
      const game = await this.getGame(gameId);
      if (!game) return null;
      const next = {
        ...game,
        settings: { ...game.settings, dropAmount: rules.drop, mdAmount: rules.middleDrop, maxCount: rules.fullCount, expense: false },
      };
      await storage.updateGame(next);
      return next;
    }
    const { data: row, error: readError } = await supabase.from('games').select('settings').eq('id', gameId).maybeSingle();
    if (readError) throw readError;
    const current = (row?.settings ?? {}) as Record<string, unknown>;
    const { error } = await supabase
      .from('games')
      .update({
        settings: {
          ...current,
          expenseEnabled: false,
          stakeDrop: rules.drop,
          stakeMiddleDrop: rules.middleDrop,
          dropAmount: rules.drop,
          mdAmount: rules.middleDrop,
          maxCount: rules.fullCount,
        } as any,
      })
      .eq('id', gameId);
    if (error) throw error;
    return this.getGame(gameId);
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
      return gameCache.putSeats(gameId, ids
        .map((playerId) => {
          const known = byId.get(playerId);
          const base = known ?? { id: playerId, name: 'Rummy Player', role: 'player' as const };
          return {
            ...base,
            email: undefined,
            phone: undefined,
            seatRole: seatFor(playerId),
            seated: !game.unseatedAdminIds?.includes(playerId) && !game.spectators?.includes(playerId),
            label: game.labels?.[playerId],
          };
        }));
    }

    const bundled = await loadGameBundle(gameId);
    if (bundled !== undefined) return bundled?.seats ?? [];

    const seatProfile = 'profiles(display_name, player_code, public_player_no, player_status, managed_by, first_name, last_name)';
    const withLabel = await supabase
      .from('game_players')
      .select(`profile_id, role, seated, player_order, label, ${seatProfile}`)
      .eq('game_id', gameId)
      .order('player_order', { ascending: true });
    const withSeat = withLabel.error && missingColumn(withLabel.error)
      ? await supabase
        .from('game_players')
        .select(`profile_id, role, seated, player_order, ${seatProfile}`)
        .eq('game_id', gameId)
        .order('player_order', { ascending: true })
      : withLabel;

    const loaded = withSeat.error && missingColumn(withSeat.error)
      ? await supabase
        .from('game_players')
        .select('profile_id, role, player_order, profiles(display_name, player_code)')
        .eq('game_id', gameId)
        .order('player_order', { ascending: true })
      : withSeat;
    if (loaded.error) throw loaded.error;

    return gameCache.putSeats(gameId, (loaded.data ?? []).map(seatFromMembership));
  },

  /**
   * Results picker: every visible game with its seated players' names, in one request
   * (list_result_candidates, 020). Before 020: the visible games with their scores, then
   * one seat list per game, exactly what the screen used to do itself.
   */
  async listResultCandidates(currentUserId: string, email?: string | null): Promise<{ games: Game[]; names: Record<string, string> }> {
    const seatedNames = (players: Player[], names: Record<string, string>) => {
      players.forEach((player) => {
        if (player.id === LEGACY_COLUMN_ID || player.seated === false || player.seatRole === 'spectator') return;
        if (player.name?.trim()) names[player.id] = player.name.trim();
      });
    };

    if (isSupabaseConfigured) {
      const { data, error } = await withTimeout(
        supabase.rpc('list_result_candidates', { p_limit: 50 }),
        REQUEST_TIMEOUT_MS,
        'Couldn’t load your games.',
      );
      if (!error && Array.isArray(data)) {
        const names: Record<string, string> = {};
        const games = (data as ResultCandidate[]).map((entry) => {
          const seats = seatsFromBundle(entry.game_players);
          gameCache.putSeats(entry.game.id, seats);
          seatedNames(seats, names);
          return legacyGameFromServer(entry.game, totalsAsScoreRows(entry.totals), entry.game_players ?? []);
        });
        return { games, names };
      }
      if (error && !missingRpc(error)) throw error;
    }

    const visible = await this.listGamesForCurrentUser(currentUserId, { includeScores: true, email });
    const listed = await Promise.all(visible.map((game) => this.listGamePlayers(game.id).catch(() => [] as Player[])));
    const names: Record<string, string> = {};
    listed.forEach((players) => seatedNames(players, names));
    return { games: visible, names };
  },

  /**
   * Who may score. Pass `preloaded` when the screen already fetched the game and
   * its seats: that saves the second copy of the same four requests per open.
   */
  async accessFor(gameId: string, userId: string | null, preloaded?: { game: Game | null; seats?: Player[] }) {
    const game = preloaded ? preloaded.game : await this.getGame(gameId);
    if (!game || !userId) {
      return { game, canScore: false, isCreator: false, seatRole: null as SeatRole | null, rolesKnown: true };
    }

    const seats = preloaded?.seats ?? (isSupabaseConfigured ? await this.listGamePlayers(gameId) : []);
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
      const liveRounds = Math.max(0, ...game.players.map((id) => game.scores[id]?.length ?? 0));
      if (roundIndex >= liveRounds) {
        const refused = localRoundsGuard(liveRounds);
        if (refused) throw new Error(refused);
      }
      const updatedScores = { ...game.scores };
      game.players.forEach((playerId) => {
        if (!updatedScores[playerId]) updatedScores[playerId] = [];
        while (updatedScores[playerId].length <= roundIndex) updatedScores[playerId].push(0);
      });
      input.scores.forEach((score) => {
        if (score.scoreType === 'expense' || !score.playerId) return;
        const key = score.playerId;
        if (!updatedScores[key]) updatedScores[key] = [];
        updatedScores[key][roundIndex] = score.value;
      });

      // A new round is dealt by the seat after the last dealer; an edited round keeps its dealer.
      const dealerIds = roundIndex >= liveRounds || !game.dealerIds?.[roundIndex]
        ? withDealer(game.dealerIds, roundIndex, nextDealer(game, roundIndex))
        : game.dealerIds;
      const updatedGame = { ...game, scores: updatedScores, currentRound: input.roundNumber + 1, dealerIds };
      await storage.updateGame(updatedGame);
      return updatedGame;
    }

    await writeRound(input, false);
    return this.getGame(input.gameId);
  },

  /**
   * Edit a finished round. No table changes needed: the old round row is
   * retired (marked undone and moved to a spare number) and a fresh row with
   * the corrected scores takes its place. Every reader already skips undone rounds.
   */
  async replaceRound(input: AddRoundInput) {
    const validation = validateRoundScores(input.scores);
    if (!validation.valid) throw new Error(validation.error ?? 'Invalid round scores.');

    if (!isSupabaseConfigured) {
      const game = await this.getGame(input.gameId);
      if (!game) throw new Error('Game not found.');
      const roundIndex = input.roundNumber - 1;
      const liveRounds = Math.max(0, ...game.players.map((id) => game.scores[id]?.length ?? 0));
      if (roundIndex >= liveRounds) {
        const refused = localRoundsGuard(liveRounds);
        if (refused) throw new Error(refused);
      }
      const updatedScores = { ...game.scores };
      game.players.forEach((playerId) => {
        const column = [...(updatedScores[playerId] ?? [])];
        while (column.length <= roundIndex) column.push(0);
        column[roundIndex] = 0;
        updatedScores[playerId] = column;
      });
      input.scores.forEach((score) => {
        if (score.scoreType === 'expense' || !score.playerId) return;
        const column = [...(updatedScores[score.playerId] ?? [])];
        while (column.length <= roundIndex) column.push(0);
        column[roundIndex] = score.value;
        updatedScores[score.playerId] = column;
      });
      const updatedGame = { ...game, scores: updatedScores };
      await storage.updateGame(updatedGame);
      return updatedGame;
    }

    await writeRound(input, true);
    return this.getGame(input.gameId);
  },

  async undoLastRound(gameId: string, undoneBy: string) {
    if (!isSupabaseConfigured) {
      const game = await this.getGame(gameId);
      if (!game) return null;
      const maxRounds = Math.max(...Object.values(game.scores).map((scores) => scores.length), 0);
      if (maxRounds === 0) return game;
      // Columns can be shorter than the round count, so trim to the round being
      // undone rather than popping each.
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

    // The undone number is the next one to play again. Left alone, current_round pointed one
    // past it, the next save skipped a number, and the scorecard showed an empty row for the gap.
    const { error: counterError } = await supabase
      .from('games')
      .update({ current_round: round.round_number })
      .eq('id', gameId)
      .gt('current_round', round.round_number);
    if (counterError) throw counterError;

    return this.getGame(gameId);
  },

  async completeGame(gameId: string, settlement?: CompleteGameInput) {
    if (!isSupabaseConfigured) {
      const game = await this.getGame(gameId);
      if (!game) return null;
      const updatedGame = {
        ...game,
        isComplete: true,
        completedAt: game.completedAt ?? new Date().toISOString(),
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

  /**
   * Undo an accidental Complete game. Only a game that is Completed and not yet
   * Closed (not part of a declared result) can go back to Active.
   */
  async reopenGame(gameId: string): Promise<Game | null> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found.');
    if (!canReopenGame(game)) throw new Error(REOPEN_BLOCKED_MESSAGE);

    if (!isSupabaseConfigured) {
      const updatedGame = { ...game, isComplete: false, completedAt: null };
      await storage.updateGame(updatedGame);
      return updatedGame;
    }

    const { data, error } = await supabase
      .from('games')
      .update({ status: 'active', completed_at: null })
      .eq('id', gameId)
      .eq('status', 'completed')
      .is('closed_at', null)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) throw new Error(REOPEN_BLOCKED_MESSAGE);
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

  async addSeatedPlayer(gameId: string, profileId: string, label?: string) {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found.');
    if (game.players.includes(profileId) || game.spectators?.includes(profileId) || game.unseatedAdminIds?.includes(profileId)) {
      throw new Error('They are already in this game.');
    }
    const seated = game.players.filter((id) => id !== LEGACY_COLUMN_ID);
    if (seated.length >= MAX_SEATED_PLAYERS) {
      throw new Error(SEATED_PLAYER_LIMIT);
    }

    if (!isSupabaseConfigured) {
      const updated: Game = { ...game, players: [...game.players, profileId] };
      // Joining mid-game: every round already played is an explicit 0 for them.
      updated.scores = { ...updated.scores, [profileId]: zerosForJoiner(game.scores, seated) };
      if (label) updated.labels = { ...(game.labels ?? {}), [profileId]: label };
      await storage.updateGame(updated);
      await playersService.rememberTogether(game.createdBy ?? profileId, [profileId]).catch(() => {});
      return updated;
    }

    const { data: orders, error: orderError } = await supabase.from('game_players').select('player_order').eq('game_id', gameId);
    if (orderError) throw orderError;
    const next = Math.max(-1, ...(orders ?? []).map((row) => row.player_order)) + 1;
    const seat = { game_id: gameId, profile_id: profileId, player_order: next, display_number: next + 1, role: 'player' as const };
    // Newest shape first; each missing column (label 022, seated 006) drops one step back.
    const attempts = [{ ...seat, seated: true, label: label ?? null }, { ...seat, seated: true }, seat];
    let error: unknown = null;
    for (const attempt of attempts) {
      error = (await supabase.from('game_players').insert(attempt)).error;
      if (!error || !missingColumn(error)) break;
    }
    if (error) throw error;
    await this.backfillZeroScores(gameId, profileId);
    if (game.createdBy) await playersService.rememberTogether(game.createdBy, [profileId]).catch(() => {});
    return this.getGame(gameId);
  },

  /**
   * A game admin changes one column's initials in this game. Letters only, 2–3, unique
   * in the game. When the caller created the game their My players entry follows, so
   * the next game they create agrees (set_seat_label, 022).
   */
  async setSeatLabel(gameId: string, profileId: string, label: string, actorId: string): Promise<string> {
    const value = normalizeInitials(label);
    if (!/^[A-Z]{2,3}$/.test(value)) throw new Error('Initials are 2 or 3 letters, A to Z.');

    if (!isSupabaseConfigured) {
      const [game, seats] = await Promise.all([this.getGame(gameId), this.listGamePlayers(gameId)]);
      if (!game) throw new Error('Game not found.');
      const clash = seats.find((seat) => seat.id !== profileId && (game.labels?.[seat.id] ?? seat.label) === value);
      if (clash) throw new Error(`${value} is already ${clash.name} in this game.`);
      await storage.updateGame({ ...game, labels: { ...(game.labels ?? {}), [profileId]: value } });
      gameCache.forget(gameId);
      if (game.createdBy === actorId) {
        await playersService.setInitials(actorId, profileId, value).catch(() => {});
      }
      return value;
    }

    const { data, error } = await supabase.rpc('set_seat_label', { p_game_id: gameId, p_profile_id: profileId, p_label: value });
    if (error) {
      if (missingColumn(error) || (error as { code?: string }).code === MISSING_FUNCTION) throw new Error(NOT_READY_MESSAGE);
      throw new Error(error.message || 'Couldn’t save the initials.');
    }
    gameCache.forget(gameId);
    queryCache.invalidate(GAME_KEY(gameId));
    playersService.forgetMyPlayers();
    return (data as string) || value;
  },

  /**
   * Take a seated player out of a game. Allowed only when they have no scores or
   * every one of their round scores is exactly 0 (checked per round, never the total).
   * On Supabase the rule is enforced again by `remove_seat_if_no_scores` (016). When
   * that function is not on the server yet: a player with no score rows is removed
   * with a plain delete (admins may manage game_players); one with zero rows cannot
   * be, because clients may not delete scores, so a "not available yet" message is thrown.
   */
  async removeSeatIfNoScores(gameId: string, profileId: string): Promise<Game | null> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Game not found.');
    if (!game.players.includes(profileId)) throw new Error('That player is not in this game.');
    if (game.closedAt) throw new Error('This game is closed. Its players cannot change.');
    const problem = seatRemovalProblem(game.scores[profileId]);
    if (problem) throw new Error(problem);
    if (game.players.filter((id) => id !== LEGACY_COLUMN_ID && id !== profileId).length < 2) {
      throw new Error('A game needs at least two players. Add someone else before removing this player.');
    }

    if (!isSupabaseConfigured) {
      const { [profileId]: _gone, ...scores } = game.scores;
      const updated: Game = { ...game, players: game.players.filter((id) => id !== profileId), scores };
      await storage.updateGame(updated);
      return updated;
    }

    const rpc = await supabase.rpc('remove_seat_if_no_scores', { p_game_id: gameId, p_profile_id: profileId });
    if (!rpc.error) return this.getGame(gameId);
    if (!missingRpc(rpc.error)) throw rpc.error;

    // 016 not applied yet. Without rounds there is nothing but the seat row to delete.
    if ((game.scores[profileId] ?? []).length > 0) throw new Error(SEAT_REMOVAL_NOT_READY);
    const { error } = await supabase.from('game_players').delete().eq('game_id', gameId).eq('profile_id', profileId);
    if (error) throw error;
    return this.getGame(gameId);
  },

  /** A player who joins mid-game gets an explicit 0 in every round already played. */
  async backfillZeroScores(gameId: string, profileId: string) {
    const { data: rounds, error } = await supabase
      .from('rounds')
      .select('id')
      .eq('game_id', gameId)
      .is('undone_at', null)
      .lt('round_number', RETIRED_ROUND_OFFSET);
    if (error) throw error;
    if (!rounds || rounds.length === 0) return;
    const { error: insertError } = await supabase.from('scores').insert(
      rounds.map((round) => ({ round_id: round.id, game_id: gameId, profile_id: profileId, score_type: 'count', value: 0 })),
    );
    if (insertError) throw insertError;
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

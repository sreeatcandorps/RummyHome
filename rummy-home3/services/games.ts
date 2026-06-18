import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { GameType, ProfileDefaults, ScoreType } from '@/types/database';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { calculateDealerId, legacySettingsForGameType, RoundScoreInput, settingsForGameType, validateRoundScores } from '@/utils/scoring';
import { storage } from '@/utils/storage';

type CreateGameInput = {
  playerIds: string[];
  gameType: GameType;
  expenseEnabled: boolean;
  createdBy: string;
  settings?: ProfileDefaults;
};

type AddRoundInput = {
  gameId: string;
  roundNumber: number;
  scores: RoundScoreInput[];
  createdBy: string;
};

const SHARE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const makeShareCode = () =>
  Array.from({ length: 6 }, () => SHARE_CODE_ALPHABET[Math.floor(Math.random() * SHARE_CODE_ALPHABET.length)]).join('');

const legacyGameFromServer = (
  game: any,
  scores: any[] = [],
  gamePlayers: any[] = [],
): Game => {
  const playerIds = gamePlayers
    .sort((a, b) => a.player_order - b.player_order)
    .map((membership) => membership.profile_id);

  const scoreMap = playerIds.reduce<Record<string, number[]>>((acc, playerId) => {
    acc[playerId] = [];
    return acc;
  }, {});

  scores.forEach((score) => {
    if (!score.profile_id) return;
    if (score.rounds?.undone_at) return;
    const index = Math.max((score.rounds?.round_number ?? 1) - 1, 0);
    if (!scoreMap[score.profile_id]) scoreMap[score.profile_id] = [];
    scoreMap[score.profile_id][index] = score.value;
  });

  return {
    id: game.id,
    date: game.created_at,
    isComplete: game.status === 'completed',
    players: playerIds,
    scores: scoreMap,
    currentRound: game.current_round,
    gameType: game.game_type,
    settings: legacySettingsForGameType(game.game_type, game.settings?.expenseEnabled ?? true),
  };
};

export const gamesService = {
  async createGame(input: CreateGameInput): Promise<Game> {
    if (input.playerIds.length < 2 || input.playerIds.length > 20) {
      throw new Error('A game must have between 2 and 20 players.');
    }

    const settings = {
      ...(input.settings ?? settingsForGameType(input.gameType)),
      expenseEnabled: input.expenseEnabled,
      gameType: input.gameType,
    };

    if (!isSupabaseConfigured) {
      const legacyGame: Game = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        players: input.playerIds,
        scores: Object.fromEntries(input.playerIds.map((playerId) => [playerId, []])),
        currentRound: 1,
        isComplete: false,
        gameType: input.gameType,
        settings: legacySettingsForGameType(input.gameType, input.expenseEnabled),
      };
      await storage.addGame(legacyGame);
      return legacyGame;
    }

    const { data: game, error: gameError } = await supabase
      .from('games')
      .insert({
        created_by: input.createdBy,
        game_type: input.gameType,
        settings,
        share_code: makeShareCode(),
      })
      .select('*')
      .single();

    if (gameError) throw gameError;

    const memberships = input.playerIds.map((profileId, index) => ({
      game_id: game.id,
      profile_id: profileId,
      player_order: index,
      display_number: index + 1,
      role: profileId === input.createdBy ? 'game_admin' as const : 'player' as const,
      color_code: null,
    }));

    const { error: playersError } = await supabase.from('game_players').insert(memberships);
    if (playersError) throw playersError;

    return legacyGameFromServer(game, [], memberships);
  },

  async listGamesForCurrentUser(currentUserId: string): Promise<Game[]> {
    if (!isSupabaseConfigured) {
      const games = await storage.getGames();
      return games
        .filter((game) => game.players.includes(currentUserId))
        .sort((a, b) => b.date.localeCompare(a.date));
    }

    const { data: memberships, error: membershipError } = await supabase
      .from('game_players')
      .select('game_id')
      .eq('profile_id', currentUserId);

    if (membershipError) throw membershipError;
    const gameIds = [...new Set((memberships ?? []).map((membership) => membership.game_id))];
    if (gameIds.length === 0) return [];

    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .in('id', gameIds)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return Promise.all((games ?? []).map((game) => this.getGame(game.id))).then((items) =>
      items.filter((game): game is Game => Boolean(game)),
    );
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
      return players.filter((player) => game.players.includes(player.id));
    }

    const { data, error } = await supabase
      .from('game_players')
      .select('profile_id, role, profiles(*)')
      .eq('game_id', gameId)
      .order('player_order', { ascending: true });

    if (error) throw error;

    return (data ?? []).map((membership: any) => ({
      id: membership.profile_id,
      name: membership.profiles?.display_name ?? 'Rummy Player',
      email: membership.profiles?.email ?? undefined,
      phone: membership.profiles?.phone ?? undefined,
      role: membership.role === 'game_admin' ? 'admin' : 'player',
    }));
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
        if (!score.playerId) return;
        if (!updatedScores[score.playerId]) updatedScores[score.playerId] = [];
        updatedScores[score.playerId][roundIndex] = score.value;
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
      const updatedGame = {
        ...game,
        scores: Object.fromEntries(
          Object.entries(game.scores).map(([playerId, scores]) => [playerId, scores.slice(0, -1)]),
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

  async completeGame(gameId: string) {
    if (!isSupabaseConfigured) {
      const game = await this.getGame(gameId);
      if (!game) return null;
      const updatedGame = { ...game, isComplete: true };
      await storage.updateGame(updatedGame);
      return updatedGame;
    }

    const { error } = await supabase
      .from('games')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', gameId);

    if (error) throw error;
    return this.getGame(gameId);
  },
};

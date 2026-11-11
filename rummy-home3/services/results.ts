import { RESULTS_PLAYER_LIMIT } from '@/constants/limits';
import { NOT_READY_MESSAGE } from '@/utils/notReady';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { Game } from '@/types/game';
import { canSeeResult, ResultAccessGame } from '@/utils/resultsAccess';
import {
  canDeclareResults,
  RESULTS_PAGE_SIZE,
  GameResult,
  GameResultSummary,
  gameResultName,
  presentResults,
  ResultSheet,
  ResultStanding,
  summaryFrom,
  withinResultsPlayerLimit,
  winnerLineFromNames,
  gameLabelFor,
} from '@/utils/results';

const LOCAL_KEY = 'gameResults';

export const MIGRATION_008_HINT = NOT_READY_MESSAGE;

const missingRpc = (error: unknown) => {
  const message = ((error as { message?: string })?.message ?? '').toLowerCase();
  const code = (error as { code?: string })?.code;
  return code === 'PGRST202' || message.includes('could not find the function') || message.includes('schema cache');
};

async function readLocal(): Promise<GameResult[]> {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  const raw = await AsyncStorage.getItem(LOCAL_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as GameResult[];
  return Array.isArray(parsed) ? parsed : [];
}

async function writeLocal(results: GameResult[]) {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(results));
}

function standingFrom(value: unknown): ResultStanding | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as { id?: unknown; name?: unknown; points?: unknown; games?: unknown; place?: unknown };
  if (typeof row.id !== 'string') return null;
  const points = Number(row.points);
  const place = Number(row.place);
  const games = Number(row.games);
  if (!Number.isFinite(points) || !Number.isFinite(place)) return null;
  return {
    id: row.id,
    name: typeof row.name === 'string' && row.name.trim() ? row.name : 'Player',
    points,
    games: Number.isFinite(games) ? games : 0,
    place,
  };
}

function numberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const scores: Record<string, number> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
    const points = Number(raw);
    if (Number.isFinite(points)) scores[key] = points;
  });
  return scores;
}

function roundsRecord(value: unknown): Record<string, number[]> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const rounds: Record<string, number[]> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
    if (Array.isArray(raw)) rounds[key] = raw.map((item) => Number(item) || 0);
  });
  return rounds;
}

function sheetFrom(value: unknown, standings: ResultStanding[]): ResultSheet {
  const fallback: ResultSheet = {
    players: standings.map((row) => ({ id: row.id, name: row.name })),
    games: [],
  };
  if (!value || typeof value !== 'object') return fallback;
  const row = value as { players?: unknown; games?: unknown };
  const players = Array.isArray(row.players)
    ? row.players.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const player = item as { id?: unknown; name?: unknown; playerNo?: unknown };
      if (typeof player.id !== 'string') return [];
      const playerNo = Number(player.playerNo);
      return [{
        id: player.id,
        name: typeof player.name === 'string' && player.name.trim() ? player.name : 'Player',
        ...(Number.isFinite(playerNo) && playerNo > 0 ? { playerNo } : {}),
      }];
    })
    : fallback.players;
  const games = Array.isArray(row.games)
    ? row.games.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const game = item as { id?: unknown; name?: unknown; label?: unknown; date?: unknown; scores?: unknown; rounds?: unknown };
      if (typeof game.id !== 'string') return [];
      const rounds = roundsRecord(game.rounds);
      return [{
        id: game.id,
        name: typeof game.name === 'string' && game.name.trim() ? game.name : game.id.slice(-6).toUpperCase(),
        ...(typeof game.label === 'string' && game.label.trim() ? { label: game.label.trim() } : {}),
        date: typeof game.date === 'string' ? game.date : '',
        scores: numberRecord(game.scores),
        ...(rounds ? { rounds } : {}),
      }];
    })
    : [];
  return { players: players.length > 0 ? players : fallback.players, games };
}

function resultFrom(value: unknown): GameResult | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as {
    id?: unknown;
    declaredAt?: unknown;
    declaredBy?: unknown;
    gameIds?: unknown;
    standings?: unknown;
    sheet?: unknown;
    reusedGameIds?: unknown;
  };
  if (typeof row.id !== 'string') return null;
  let standingsRaw = row.standings;
  let sheetRaw = row.sheet;
  if (standingsRaw && !Array.isArray(standingsRaw) && typeof standingsRaw === 'object') {
    const blob = standingsRaw as { standings?: unknown; players?: unknown; games?: unknown };
    sheetRaw = sheetRaw ?? { players: blob.players, games: blob.games };
    standingsRaw = blob.standings;
  }
  const standings = Array.isArray(standingsRaw)
    ? standingsRaw.map(standingFrom).filter((item): item is ResultStanding => Boolean(item))
    : [];
  const gameIds = Array.isArray(row.gameIds) ? row.gameIds.filter((id): id is string => typeof id === 'string') : [];
  return {
    id: row.id,
    declaredAt: typeof row.declaredAt === 'string' ? row.declaredAt : new Date().toISOString(),
    declaredBy: typeof row.declaredBy === 'string' ? row.declaredBy : '',
    gameIds,
    standings,
    sheet: sheetFrom(sheetRaw, standings),
    ...(Array.isArray(row.reusedGameIds)
      ? { reusedGameIds: row.reusedGameIds.filter((id): id is string => typeof id === 'string') }
      : {}),
  };
}

function assertDeclarable(games: Game[], names: Record<string, string>, userId: string) {
  if (games.length === 0) throw new Error('Pick at least one finished game.');
  if (games.some((game) => !game.isComplete)) throw new Error('Only finished games can be declared.');
  if (!withinResultsPlayerLimit(games.map((game) => ({ players: game.players, scores: game.scores, names })))) {
    throw new Error(RESULTS_PLAYER_LIMIT);
  }
  if (!canDeclareResults(games, userId)) {
    throw new Error('Only an admin of every selected game can declare results.');
  }
}

/** Who is looking: the signed-in account, or the chosen player in the local store. */
async function viewer(): Promise<{ id: string | null; isAppAdmin: boolean }> {
  const { authService } = await import('@/services/auth');
  if (!isSupabaseConfigured) {
    const { storage } = await import('@/utils/storage');
    const id = await storage.getCurrentPlayer();
    const player = id ? await authService.getCurrentPlayer().catch(() => null) : null;
    return { id, isAppAdmin: player?.role === 'admin' };
  }
  const id = await authService.getCurrentUserId().catch(() => null);
  const profile = id ? await authService.getCurrentProfile().catch(() => null) : null;
  return { id: id ?? null, isAppAdmin: profile?.role === 'app_admin' };
}

/** Games in the result the viewer can read. Unreadable games (RLS) simply drop out. */
async function readableGames(gameIds: string[]): Promise<(ResultAccessGame | null)[]> {
  const { gamesService } = await import('@/services/games');
  return Promise.all(gameIds.map((id) => gamesService.getGame(id).catch(() => null)));
}

async function visibleTo(result: GameResult, who: { id: string | null; isAppAdmin: boolean }, games?: (ResultAccessGame | null)[]) {
  const playerIds = [...new Set([...(result.sheet?.players ?? []).map((p) => p.id), ...result.standings.map((row) => row.id)])];
  if (canSeeResult({ declaredBy: result.declaredBy, playerIds }, who.id, who)) return true;
  const loaded = games ?? await readableGames(result.gameIds);
  return canSeeResult({ declaredBy: result.declaredBy, playerIds, games: loaded }, who.id, who);
}

export const resultsService = {
  /** Past results, newest first, one page at a time. Only results the viewer is part of. */
  async list(offset = 0, limit = RESULTS_PAGE_SIZE): Promise<GameResultSummary[]> {
    if (!isSupabaseConfigured) {
      const who = await viewer();
      const all = await readLocal();
      const { storage } = await import('@/utils/storage');
      const games = await storage.getGames();
      const byId = new Map(games.map((game) => [game.id, game]));
      const results: GameResult[] = [];
      for (const result of all) {
        if (await visibleTo(result, who, result.gameIds.map((id) => byId.get(id) ?? null))) results.push(result);
      }
      return results
        .map(summaryFrom)
        .sort((a, b) => b.declaredAt.localeCompare(a.declaredAt))
        .slice(offset, offset + limit);
    }

    let { data, error } = await supabase.rpc('list_game_results_page', { p_limit: limit, p_offset: offset });
    if (error && missingRpc(error)) {
      // Database without 010: fall back to the full 008 list and page it here.
      const old = await supabase.rpc('list_game_results');
      if (old.error) {
        if (missingRpc(old.error)) throw new Error(MIGRATION_008_HINT);
        throw old.error;
      }
      data = Array.isArray(old.data) ? old.data.slice(offset, offset + limit) : [];
      error = null;
    }
    if (error) throw error;
    const rows = (Array.isArray(data) ? data : []) as {
      id?: string; declaredAt?: string; gameCount?: number; playerCount?: number;
      firstNames?: string[]; top?: { name?: string; points?: number; place?: number }[]; reusedGameIds?: unknown[];
    }[];
    return rows
      .filter((row) => typeof row.id === 'string')
      .map((row) => ({
        id: row.id as string,
        declaredAt: row.declaredAt ?? '',
        gameCount: Number(row.gameCount) || 0,
        playerCount: Number(row.playerCount) || 0,
        // Servers before 018 send no reusedGameIds; the card then shows no flag.
        ...(Array.isArray(row.reusedGameIds) ? { reusedCount: row.reusedGameIds.length } : {}),
        top: (Array.isArray(row.top) ? row.top : []).map((item) => ({
          name: typeof item.name === 'string' ? item.name : 'Player',
          points: Number(item.points) || 0,
          place: Number(item.place) || 0,
        })),
        winnerLine: winnerLineFromNames(Array.isArray(row.firstNames) ? row.firstNames : []),
      }));
  },

  /**
   * One result, or null when it does not exist or is not the viewer's to see. The server
   * (013_results_privacy.sql) already returns null for strangers; the client check repeats
   * the same rule so an older database cannot leak a result to an unrelated account.
   */
  async get(resultId: string): Promise<GameResult | null> {
    const who = await viewer();
    let result: GameResult | null;
    if (!isSupabaseConfigured) {
      const results = await readLocal();
      result = results.find((item) => item.id === resultId) ?? null;
    } else {
      const { data, error } = await supabase.rpc('get_game_result', { p_id: resultId });
      if (error) {
        if (missingRpc(error)) throw new Error(MIGRATION_008_HINT);
        throw error;
      }
      result = data ? resultFrom(data) : null;
    }
    if (!result) return null;
    return (await visibleTo(result, who)) ? result : null;
  },

  async declare(input: { games: Game[]; names: Record<string, string>; userId: string }): Promise<GameResult> {
    assertDeclarable(input.games, input.names, input.userId);
    const presented = presentResults(input.games.map((game) => ({
      id: game.id,
      name: gameResultName(game),
      label: gameLabelFor(game),
      date: game.date,
      players: game.players,
      scores: game.scores,
      names: input.names,
    })));

    if (!isSupabaseConfigured) {
      const declaredAt = new Date().toISOString();
      const result: GameResult = {
        id: `result-${Date.now()}`,
        declaredAt,
        declaredBy: input.userId,
        gameIds: input.games.map((game) => game.id),
        standings: presented.standings,
        sheet: presented.sheet,
        // Already Closed when saved: an earlier result had these; their points count twice.
        reusedGameIds: input.games.filter((game) => Boolean(game.closedAt)).map((game) => game.id),
      };
      const existing = await readLocal();
      await writeLocal([result, ...existing]);
      await this.closeGames(input.games.map((g) => g.id), declaredAt);
      return result;
    }

    const { data, error } = await supabase.rpc('declare_game_result', {
      p_game_ids: input.games.map((game) => game.id),
    });
    if (error) {
      if (missingRpc(error)) throw new Error(MIGRATION_008_HINT);
      throw error;
    }
    const result = resultFrom(data);
    if (!result) throw new Error('Results were declared but could not be opened.');
    return result;
  },

  async closeGames(gameIds: string[], closedAt: string): Promise<void> {
    if (!isSupabaseConfigured) {
      const { storage } = await import('@/utils/storage');
      const games = await storage.getGames();
      const updated = games.map((game) =>
        gameIds.includes(game.id) && !game.closedAt
          ? { ...game, closedAt }
          : game
      );
      await storage.saveGames(updated);
    }
  },
};

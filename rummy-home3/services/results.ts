import { RESULTS_PLAYER_LIMIT } from '@/constants/limits';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { Game } from '@/types/game';
import {
  canDeclareResults,
  GameResult,
  GameResultSummary,
  gameResultName,
  presentResults,
  ResultSheet,
  ResultStanding,
  summaryFrom,
  withinResultsPlayerLimit,
  winnerLineFromNames,
} from '@/utils/results';

const LOCAL_KEY = 'gameResults';

export const MIGRATION_008_HINT =
  'This needs the latest database update. Run supabase/migrations/008_results.sql in the Supabase SQL editor, then try again.';

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
      const player = item as { id?: unknown; name?: unknown };
      if (typeof player.id !== 'string') return [];
      return [{ id: player.id, name: typeof player.name === 'string' && player.name.trim() ? player.name : 'Player' }];
    })
    : fallback.players;
  const games = Array.isArray(row.games)
    ? row.games.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const game = item as { id?: unknown; name?: unknown; date?: unknown; scores?: unknown };
      if (typeof game.id !== 'string') return [];
      return [{
        id: game.id,
        name: typeof game.name === 'string' && game.name.trim() ? game.name : game.id.slice(-6).toUpperCase(),
        date: typeof game.date === 'string' ? game.date : '',
        scores: numberRecord(game.scores),
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

export const resultsService = {
  async list(): Promise<GameResultSummary[]> {
    if (!isSupabaseConfigured) {
      const results = await readLocal();
      return results
        .map(summaryFrom)
        .sort((a, b) => b.declaredAt.localeCompare(a.declaredAt));
    }

    const { data, error } = await supabase.rpc('list_game_results');
    if (error) {
      if (missingRpc(error)) throw new Error(MIGRATION_008_HINT);
      throw error;
    }
    const rows = (Array.isArray(data) ? data : []) as { id?: string; declaredAt?: string; gameCount?: number; firstNames?: string[] }[];
    return rows
      .filter((row) => typeof row.id === 'string')
      .map((row) => ({
        id: row.id as string,
        declaredAt: row.declaredAt ?? '',
        gameCount: Number(row.gameCount) || 0,
        winnerLine: winnerLineFromNames(Array.isArray(row.firstNames) ? row.firstNames : []),
      }));
  },

  async get(resultId: string): Promise<GameResult | null> {
    if (!isSupabaseConfigured) {
      const results = await readLocal();
      return results.find((result) => result.id === resultId) ?? null;
    }
    const { data, error } = await supabase.rpc('get_game_result', { p_id: resultId });
    if (error) {
      if (missingRpc(error)) throw new Error(MIGRATION_008_HINT);
      throw error;
    }
    if (!data) return null;
    return resultFrom(data);
  },

  async declare(input: { games: Game[]; names: Record<string, string>; userId: string }): Promise<GameResult> {
    assertDeclarable(input.games, input.names, input.userId);
    const presented = presentResults(input.games.map((game) => ({
      id: game.id,
      name: gameResultName(game),
      date: game.date,
      players: game.players,
      scores: game.scores,
      names: input.names,
    })));

    if (!isSupabaseConfigured) {
      const result: GameResult = {
        id: `result-${Date.now()}`,
        declaredAt: new Date().toISOString(),
        declaredBy: input.userId,
        gameIds: input.games.map((game) => game.id),
        standings: presented.standings,
        sheet: presented.sheet,
      };
      const existing = await readLocal();
      await writeLocal([result, ...existing]);
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
};

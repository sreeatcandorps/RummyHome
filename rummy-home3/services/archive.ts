import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { gameCache } from '@/utils/gameCache';
import { queryCache } from '@/utils/queryCache';
import { NOT_READY_MESSAGE } from '@/utils/notReady';
import { GameResult, withoutGames } from '@/utils/results';
import { storage } from '@/utils/storage';
import { Game } from '@/types/game';

/**
 * Hide and soft delete (migration 023).
 *
 * - Hide is per person and touches Home only; the game still counts everywhere.
 * - Delete game (creator / game admin) and Delete result (declarer / admin of its games)
 *   are soft: a stamp on the row, gone for everyone, restorable by the deleter or an admin.
 * - A deleted game inside a saved result is removed from that result for good; the result
 *   is totalled again without it. Restoring the game never puts it back.
 *
 * Without Supabase the same rules run on the local store so the prototype behaves alike.
 */

export type HiddenGameRow = {
  id: string; gameNumber: number | null; gameLabel?: string | null; createdAt: string; status: string; creatorName: string; hiddenAt: string; playerCount: number;
};
export type DeletedGameRow = {
  id: string; gameNumber: number | null; gameLabel?: string | null; createdAt: string; status: string; creatorName: string; deletedAt: string;
  deletedByMe: boolean; deletedByName: string; playerCount: number; removedFromResults: number;
};
export type DeletedResultRow = {
  id: string; declaredAt: string; deletedAt: string; deletedByMe: boolean; deletedByName: string; gameCount: number; playerCount: number;
};
export type HiddenAndDeleted = { hidden: HiddenGameRow[]; deletedGames: DeletedGameRow[]; deletedResults: DeletedResultRow[] };

/** A saved result that still holds a game, for the warning before Delete game. */
export type HoldingResult = { resultId: string; declaredAt: string; resultNo: number };

const MISSING = (error: unknown) => {
  const message = ((error as { message?: string })?.message ?? '').toLowerCase();
  return (error as { code?: string })?.code === 'PGRST202' || message.includes('could not find the function') || message.includes('schema cache');
};

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    if (MISSING(error)) throw new Error(NOT_READY_MESSAGE);
    throw error;
  }
  return data as T;
}

/** The game and Home caches must forget a game whose state just changed. */
function forget(gameId?: string) {
  if (gameId) gameCache.forget(gameId);
  queryCache.clear();
}

// ---------- local store ----------
const LOCAL_RESULTS_KEY = 'gameResults';
const hiddenKey = (userId: string) => `hiddenGames:${userId}`;

async function readLocalResults(): Promise<GameResult[]> {
  const raw = await AsyncStorage.getItem(LOCAL_RESULTS_KEY);
  const parsed = raw ? (JSON.parse(raw) as GameResult[]) : [];
  return Array.isArray(parsed) ? parsed : [];
}
const writeLocalResults = (results: GameResult[]) => AsyncStorage.setItem(LOCAL_RESULTS_KEY, JSON.stringify(results));

async function localHidden(userId: string): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(hiddenKey(userId));
  const parsed = raw ? JSON.parse(raw) : {};
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

/** A game's Closed stamp follows the live results that still hold it (local copy of sync_closed_at). */
function syncClosed(games: Game[], results: GameResult[]): Game[] {
  return games.map((game) => {
    const holding = results.filter((r) => !r.deletedAt && r.gameIds.includes(game.id)).sort((a, b) => a.declaredAt.localeCompare(b.declaredAt));
    const closedAt = holding[0]?.declaredAt ?? null;
    return (game.closedAt ?? null) === closedAt ? game : { ...game, closedAt };
  });
}

const localUserCanManage = (game: Game, userId: string) => game.createdBy === userId || (game.adminIds ?? []).includes(userId);

export const archiveService = {
  /** Local prototype: ids this person hid, so Home can leave them out. */
  async hiddenGameIds(userId: string | null): Promise<Set<string>> {
    if (isSupabaseConfigured || !userId) return new Set();
    return new Set(Object.keys(await localHidden(userId)));
  },

  async hideGame(gameId: string, userId: string | null): Promise<void> {
    if (isSupabaseConfigured) {
      await rpc('hide_game', { p_game_id: gameId });
      forget();
      return;
    }
    if (!userId) return;
    const hidden = await localHidden(userId);
    hidden[gameId] = new Date().toISOString();
    await AsyncStorage.setItem(hiddenKey(userId), JSON.stringify(hidden));
  },

  async unhideGame(gameId: string, userId: string | null): Promise<void> {
    if (isSupabaseConfigured) {
      await rpc('unhide_game', { p_game_id: gameId });
      forget();
      return;
    }
    if (!userId) return;
    const hidden = await localHidden(userId);
    delete hidden[gameId];
    await AsyncStorage.setItem(hiddenKey(userId), JSON.stringify(hidden));
  },

  /** Live saved results that hold this game: the app warns about each before Delete game. */
  async resultsHoldingGame(gameId: string): Promise<HoldingResult[]> {
    if (isSupabaseConfigured) {
      const rows = await rpc<{ result_id: string; declared_at: string; result_no: number }[] | null>('results_holding_game', { p_game_id: gameId });
      return (rows ?? []).map((row) => ({ resultId: row.result_id, declaredAt: row.declared_at, resultNo: Number(row.result_no) || 0 }));
    }
    const results = (await readLocalResults()).filter((r) => !r.deletedAt);
    return results
      .filter((r) => r.gameIds.includes(gameId))
      .map((r) => ({
        resultId: r.id,
        declaredAt: r.declaredAt,
        resultNo: results.filter((x) => x.declaredBy === r.declaredBy && x.declaredAt <= r.declaredAt).length,
      }));
  },

  /** Soft-deletes a game and removes it from every saved result that held it. */
  async deleteGame(gameId: string, userId: string | null): Promise<{ removedFromResults: string[] }> {
    if (isSupabaseConfigured) {
      const data = await rpc<{ removedFromResults?: string[] }>('delete_game', { p_game_id: gameId });
      forget(gameId);
      return { removedFromResults: data?.removedFromResults ?? [] };
    }
    const games = await storage.getGames();
    const game = games.find((g) => g.id === gameId);
    if (!game) throw new Error('This game is not available.');
    if (!userId || !localUserCanManage(game, userId)) throw new Error('Only the creator or a game admin can delete this game.');
    const results = await readLocalResults();
    const removedFrom: string[] = [];
    const nextResults = results.map((r) => {
      if (r.deletedAt || !r.gameIds.includes(gameId)) return r;
      removedFrom.push(r.id);
      return withoutGames(r, [gameId]);
    });
    await writeLocalResults(nextResults);
    const stamped = games.map((g) => (g.id === gameId ? { ...g, deletedAt: new Date().toISOString(), deletedBy: userId } : g));
    await storage.saveGames(syncClosed(stamped, nextResults));
    gameCache.forget(gameId);
    return { removedFromResults: removedFrom };
  },

  /** Brings a deleted game back. Results it was removed from stay as they are. */
  async restoreGame(gameId: string, userId: string | null): Promise<{ removedFromResults: { resultId: string; declaredAt: string }[] }> {
    if (isSupabaseConfigured) {
      const data = await rpc<{ removedFromResults?: { resultId: string; declaredAt: string }[] }>('restore_game', { p_game_id: gameId });
      forget(gameId);
      return { removedFromResults: data?.removedFromResults ?? [] };
    }
    const games = await storage.getGames();
    const game = games.find((g) => g.id === gameId);
    if (!game) throw new Error('This game is not available.');
    if (!userId || !(game.deletedBy === userId || localUserCanManage(game, userId))) {
      throw new Error('Only the person who deleted this game or a game admin can restore it.');
    }
    const results = await readLocalResults();
    const removedFrom = results.filter((r) => !r.deletedAt && (r.removedGameIds ?? []).includes(gameId)).map((r) => ({ resultId: r.id, declaredAt: r.declaredAt }));
    const restored = games.map((g) => (g.id === gameId ? { ...g, deletedAt: null, deletedBy: null } : g));
    await storage.saveGames(syncClosed(restored, results));
    gameCache.forget(gameId);
    return { removedFromResults: removedFrom };
  },

  /** Soft-deletes a saved result. Its games become uncounted again (not Closed) and can go into a new result. */
  async deleteResult(resultId: string, userId: string | null): Promise<{ gameIds: string[] }> {
    if (isSupabaseConfigured) {
      const data = await rpc<{ gameIds?: string[] }>('delete_result', { p_result_id: resultId });
      forget();
      return { gameIds: data?.gameIds ?? [] };
    }
    const results = await readLocalResults();
    const result = results.find((r) => r.id === resultId);
    if (!result) throw new Error('This result is not available.');
    const games = await storage.getGames();
    const admin = userId && (result.declaredBy === userId || result.gameIds.every((id) => {
      const game = games.find((g) => g.id === id);
      return game ? localUserCanManage(game, userId) : false;
    }));
    if (!admin) throw new Error('Only the person who saved this result or an admin of its games can delete it.');
    const next = results.map((r) => (r.id === resultId ? { ...r, deletedAt: new Date().toISOString(), deletedBy: userId } : r));
    await writeLocalResults(next);
    await storage.saveGames(syncClosed(games, next));
    return { gameIds: result.gameIds };
  },

  /** Which of these saved results the viewer may delete (023 `can_manage_result`): for the Delete chip on Past results rows. */
  async manageableResults(resultIds: string[], userId: string | null): Promise<Set<string>> {
    if (resultIds.length === 0) return new Set();
    if (isSupabaseConfigured) {
      const flags = await Promise.all(resultIds.map(async (id) => {
        try {
          const { data, error } = await supabase.rpc('can_manage_result', { p_result_id: id });
          return !error && data === true;
        } catch {
          return false;
        }
      }));
      return new Set(resultIds.filter((_, index) => flags[index]));
    }
    if (!userId) return new Set();
    const [results, games] = await Promise.all([readLocalResults(), storage.getGames()]);
    const can = (result: GameResult) => result.declaredBy === userId || result.gameIds.every((id) => {
      const game = games.find((g) => g.id === id);
      return game ? localUserCanManage(game, userId) : false;
    });
    return new Set(results.filter((result) => resultIds.includes(result.id) && can(result)).map((result) => result.id));
  },

  async restoreResult(resultId: string, userId: string | null): Promise<void> {
    if (isSupabaseConfigured) {
      await rpc('restore_result', { p_result_id: resultId });
      forget();
      return;
    }
    const results = await readLocalResults();
    const result = results.find((r) => r.id === resultId) as (GameResult & { deletedBy?: string | null }) | undefined;
    if (!result) throw new Error('This result is not available.');
    if (!userId || !(result.deletedBy === userId || result.declaredBy === userId)) {
      throw new Error('Only the person who deleted this result or an admin of its games can restore it.');
    }
    const next = results.map((r) => (r.id === resultId ? { ...r, deletedAt: null, deletedBy: null } : r));
    await writeLocalResults(next);
    await storage.saveGames(syncClosed(await storage.getGames(), next));
  },

  /** Settings > Hidden & deleted: the three lists for this person. */
  async list(userId: string | null): Promise<HiddenAndDeleted> {
    const empty: HiddenAndDeleted = { hidden: [], deletedGames: [], deletedResults: [] };
    if (isSupabaseConfigured) {
      const data = await rpc<Partial<HiddenAndDeleted> | null>('list_hidden_and_deleted', {});
      return {
        hidden: data?.hidden ?? [],
        deletedGames: data?.deletedGames ?? [],
        deletedResults: data?.deletedResults ?? [],
      };
    }
    if (!userId) return empty;
    const [games, players, results, hidden] = await Promise.all([storage.getGames(), storage.getPlayers(), readLocalResults(), localHidden(userId)]);
    const nameOf = (id?: string | null) => players.find((p) => p.id === id)?.name ?? 'Rummy Player';
    const seatCount = (game: Game) => game.players.filter((id) => id !== 'EX').length;
    return {
      hidden: games
        .filter((g) => hidden[g.id] && !g.deletedAt)
        .map((g) => ({ id: g.id, gameNumber: g.gameNumber ?? null, gameLabel: g.gameLabel ?? null, createdAt: g.date, status: g.isComplete ? 'completed' : 'active', creatorName: nameOf(g.createdBy), hiddenAt: hidden[g.id], playerCount: seatCount(g) }))
        .sort((a, b) => b.hiddenAt.localeCompare(a.hiddenAt)),
      deletedGames: games
        .filter((g) => g.deletedAt && (g.deletedBy === userId || localUserCanManage(g, userId)))
        .map((g) => ({
          id: g.id, gameNumber: g.gameNumber ?? null, gameLabel: g.gameLabel ?? null, createdAt: g.date, status: g.isComplete ? 'completed' : 'active', creatorName: nameOf(g.createdBy),
          deletedAt: g.deletedAt as string, deletedByMe: g.deletedBy === userId, deletedByName: nameOf(g.deletedBy), playerCount: seatCount(g),
          removedFromResults: results.filter((r) => !r.deletedAt && (r.removedGameIds ?? []).includes(g.id)).length,
        }))
        .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)),
      deletedResults: results
        .filter((r) => r.deletedAt && ((r as { deletedBy?: string | null }).deletedBy === userId || r.declaredBy === userId))
        .map((r) => ({
          id: r.id, declaredAt: r.declaredAt, deletedAt: r.deletedAt as string, deletedByMe: (r as { deletedBy?: string | null }).deletedBy === userId,
          deletedByName: nameOf((r as { deletedBy?: string | null }).deletedBy), gameCount: r.gameIds.length, playerCount: r.standings.length,
        }))
        .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)),
    };
  },
};

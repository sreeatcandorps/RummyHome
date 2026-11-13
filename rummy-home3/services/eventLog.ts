import { RealtimeChannel } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { NOT_READY_MESSAGE } from '@/utils/notReady';
import { LogEntry, LogFilter, LOG_PAGE_SIZE, parseLogEntry, ResultHistory } from '@/utils/eventLog';

const missing = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  const message = ((error as { message?: string })?.message ?? '').toLowerCase();
  return code === 'PGRST202' || message.includes('could not find the function') || message.includes('schema cache');
};

export type LogPage = { rows: LogEntry[]; hasMore: boolean };

/**
 * The game and result log (036). Read-only from the app: every row is written on the server
 * inside the change's own transaction. Without Supabase (the local prototype) there is no log.
 */
export const eventLogService = {
  async listGameLog(gameId: string, filter: LogFilter = 'all', before: number | null = null, limit = LOG_PAGE_SIZE): Promise<LogPage> {
    if (!isSupabaseConfigured) return { rows: [], hasMore: false };
    const { data, error } = await supabase.rpc('list_game_log', { p_game_id: gameId, p_level: filter, p_before: before, p_limit: limit });
    if (error) {
      if (missing(error)) throw new Error(NOT_READY_MESSAGE);
      throw error;
    }
    const page = (data ?? {}) as { rows?: unknown[]; hasMore?: boolean };
    return { rows: (page.rows ?? []).map(parseLogEntry), hasMore: Boolean(page.hasMore) };
  },

  async listResultHistory(resultId: string): Promise<ResultHistory> {
    if (!isSupabaseConfigured) return { rows: [], versions: [], changedNote: null };
    const { data, error } = await supabase.rpc('list_result_history', { p_result_id: resultId });
    if (error) {
      // Before 036 there is no history; the page simply shows none.
      if (missing(error)) return { rows: [], versions: [], changedNote: null };
      throw error;
    }
    const raw = (data ?? {}) as { rows?: unknown[]; versions?: ResultHistory['versions']; changedNote?: ResultHistory['changedNote'] };
    return { rows: (raw.rows ?? []).map(parseLogEntry), versions: raw.versions ?? [], changedNote: raw.changedNote ?? null };
  },

  /** New rows for one game as they are written (D8). RLS applies to the stream. */
  subscribeToGameLog(gameId: string, onInsert: (entry: LogEntry) => void): RealtimeChannel | null {
    if (!isSupabaseConfigured) return null;
    return supabase
      .channel(`game-log:${gameId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_log', filter: `game_id=eq.${gameId}` }, (payload) => {
        const row = payload.new as Record<string, unknown>;
        onInsert(parseLogEntry({
          id: row.id, at: row.at, kind: row.kind, level: row.level, actorId: row.actor_id, actorName: row.actor_name,
          summary: row.summary, details: row.details, gameId: row.game_id, resultId: row.result_id,
        }));
      })
      .subscribe();
  },

  unsubscribe(channel: RealtimeChannel | null) {
    if (channel) supabase.removeChannel(channel);
  },
};

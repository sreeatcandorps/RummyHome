import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { queryCache } from '@/utils/queryCache';

/**
 * Game-started and result-saved emails (migration 024).
 *
 * The database decides who gets what (registered, has an email, preference on) and writes
 * one outbox row per event and recipient; the send-email edge function ('flush') delivers
 * the unsent rows. The app only asks for the queue and the flush, and never fails a game
 * action because an email could not go out.
 */

export type EmailPrefs = { gameStarted: boolean; results: boolean };
export const DEFAULT_EMAIL_PREFS: EmailPrefs = { gameStarted: true, results: true };

const LOCAL_KEY = 'emailPrefs';

const missingRpc = (error: unknown) => {
  const message = ((error as { message?: string })?.message ?? '').toLowerCase();
  return (error as { code?: string })?.code === 'PGRST202' || message.includes('could not find the function') || message.includes('schema cache');
};

/** Ask the edge function to deliver whatever is queued. Fire-and-forget; errors are swallowed. */
async function flush(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.functions.invoke('send-email', { body: { kind: 'flush' } });
  } catch {
    // Email is best effort: the next flush (any later game start or save) delivers what is left.
  }
}

export const emailsService = {
  async getPrefs(): Promise<EmailPrefs> {
    const local = await AsyncStorage.getItem(LOCAL_KEY).then((raw) => (raw ? (JSON.parse(raw) as EmailPrefs) : null)).catch(() => null);
    if (!isSupabaseConfigured) return local ?? DEFAULT_EMAIL_PREFS;
    const { data, error } = await supabase.from('my_profile').select('email_game_started, email_results').maybeSingle();
    if (error || !data) return local ?? DEFAULT_EMAIL_PREFS;
    const row = data as { email_game_started?: boolean | null; email_results?: boolean | null };
    return { gameStarted: row.email_game_started !== false, results: row.email_results !== false };
  },

  async savePrefs(prefs: EmailPrefs): Promise<EmailPrefs> {
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(prefs));
    if (!isSupabaseConfigured) return prefs;
    const { data, error } = await supabase.rpc('set_email_prefs', { p_game_started: prefs.gameStarted, p_results: prefs.results });
    if (error) {
      if (missingRpc(error)) throw new Error('Email settings need the latest database update (024).');
      throw error;
    }
    queryCache.invalidate('profile:');
    const row = (data ?? {}) as { gameStarted?: boolean; results?: boolean };
    return { gameStarted: row.gameStarted !== false, results: row.results !== false };
  },

  /**
   * After Start game: queue the live-link email for every registered player, then flush.
   * Returns how many were newly queued (0 on a retry or when the migration is missing).
   */
  async gameStarted(gameId: string): Promise<number> {
    if (!isSupabaseConfigured) return 0;
    const { data, error } = await supabase.rpc('queue_game_started_emails', { p_game_id: gameId });
    if (error) return 0;
    const queued = Number(data) || 0;
    if (queued > 0) void flush();
    return queued;
  },

  /** After Save result: the database queued the rows inside declare_game_result; deliver them. */
  async resultSaved(): Promise<void> {
    await flush();
  },
};

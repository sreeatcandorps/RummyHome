import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import { debounceTrailing } from '@/utils/debounce';

export type GameRealtimeHandlers = {
  onChange: () => void;
  /** Channel status as Realtime reports it (SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT, CLOSED). */
  onStatus?: (status: string, error?: Error) => void;
};

/**
 * A saved round arrives as one `rounds` event, one `scores` event per player and
 * one `games` event within a few milliseconds. The screen reloads once for the
 * burst, after this quiet period, instead of once per event.
 */
export const REALTIME_DEBOUNCE_MS = 400;

/** The scorecard's fallback poll while an active game is on screen and the app is in front. */
export const LIVE_POLL_MS = 20_000;

/** The debounced reload per channel, so unsubscribe() can drop a reload still waiting. */
const pending = new WeakMap<RealtimeChannel, { cancel: () => void }>();

export const realtimeService = {
  /**
   * Every write that changes a scorecard touches `games`, `game_players` or `rounds`
   * (save_round inserts the round and advances the game; an undo or edit retires the
   * round; a join inserts the seat), so those three tables are enough to follow it.
   */
  subscribeToGame(gameId: string, handlers: GameRealtimeHandlers): RealtimeChannel {
    const onChange = debounceTrailing(handlers.onChange, REALTIME_DEBOUNCE_MS);
    const channel = supabase
      .channel(`game:${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `game_id=eq.${gameId}` }, onChange)
      .subscribe((status, error) => {
        // Visible in `adb logcat -s ReactNativeJS` on a release build, so a phone that never hears
        // about the other phone's round can be read without a debugger (two-device T1).
        console.log(`[realtime] game ${gameId}: ${status}${error ? ` (${error.message})` : ''}`);
        handlers.onStatus?.(status, error);
      });
    pending.set(channel, onChange);
    return channel;
  },

  unsubscribe(channel: RealtimeChannel) {
    pending.get(channel)?.cancel();
    pending.delete(channel);
    supabase.removeChannel(channel);
  },
};

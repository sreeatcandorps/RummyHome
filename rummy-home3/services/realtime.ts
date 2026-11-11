import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import { debounceTrailing } from '@/utils/debounce';

export type GameRealtimeHandlers = {
  onChange: () => void;
};

/**
 * A saved round arrives as one `rounds` event, one `scores` event per player and
 * one `games` event within a few milliseconds. The screen reloads once for the
 * burst, after this quiet period, instead of once per event.
 */
export const REALTIME_DEBOUNCE_MS = 400;

export const realtimeService = {
  /**
   * Every write that changes a scorecard touches `games`, `game_players` or `rounds`
   * (save_round inserts the round and advances the game; an undo or edit retires the
   * round; a join inserts the seat), so those three tables are enough to follow it.
   */
  subscribeToGame(gameId: string, handlers: GameRealtimeHandlers): RealtimeChannel {
    const onChange = debounceTrailing(handlers.onChange, REALTIME_DEBOUNCE_MS);
    return supabase
      .channel(`game:${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `game_id=eq.${gameId}` }, onChange)
      .subscribe();
  },

  unsubscribe(channel: RealtimeChannel) {
    supabase.removeChannel(channel);
  },
};

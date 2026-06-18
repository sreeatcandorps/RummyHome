import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';

export type GameRealtimeHandlers = {
  onChange: () => void;
};

export const realtimeService = {
  subscribeToGame(gameId: string, handlers: GameRealtimeHandlers): RealtimeChannel {
    return supabase
      .channel(`game:${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, handlers.onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` }, handlers.onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `game_id=eq.${gameId}` }, handlers.onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `game_id=eq.${gameId}` }, handlers.onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'token_ledger', filter: `game_id=eq.${gameId}` }, handlers.onChange)
      .subscribe();
  },

  unsubscribe(channel: RealtimeChannel) {
    supabase.removeChannel(channel);
  },
};

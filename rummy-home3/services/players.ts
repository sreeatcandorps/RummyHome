import { supabase } from '@/services/supabase';
import { Player } from '@/types/player';
import { isEphemeralTestEmail } from '@/utils/playerFilters';

const toPlayer = (row: any): Player => ({
  id: row.id,
  email: row.email ?? undefined,
  phone: row.phone ?? undefined,
  name: row.display_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Rummy Player',
  role: row.role === 'app_admin' ? 'admin' : 'player',
});

export { isEphemeralTestEmail };

type ListOptions = {
  includeEphemeral?: boolean;
};

export const playersService = {
  async listPlayers(options: ListOptions = {}): Promise<Player[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('display_name', { ascending: true });

    if (error) throw error;

    const players = (data ?? []).map(toPlayer);
    if (options.includeEphemeral) return players;
    return players.filter((player) => !isEphemeralTestEmail(player.email));
  },

  async searchPlayers(query: string, options: ListOptions = {}): Promise<Player[]> {
    const term = `%${query.trim()}%`;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`display_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`)
      .order('display_name', { ascending: true });

    if (error) throw error;

    const players = (data ?? []).map(toPlayer);
    if (options.includeEphemeral) return players;
    return players.filter((player) => !isEphemeralTestEmail(player.email));
  },
};

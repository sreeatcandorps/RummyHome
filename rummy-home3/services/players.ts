import { supabase } from '@/services/supabase';
import { Player } from '@/types/player';

const toPlayer = (row: any): Player => ({
  id: row.id,
  email: row.email ?? undefined,
  phone: row.phone ?? undefined,
  name: row.display_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Rummy Player',
  role: row.role === 'app_admin' ? 'admin' : 'player',
});

export const playersService = {
  async listPlayers(): Promise<Player[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('display_name', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(toPlayer);
  },

  async searchPlayers(query: string): Promise<Player[]> {
    const term = `%${query.trim()}%`;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`display_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`)
      .order('display_name', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(toPlayer);
  },
};

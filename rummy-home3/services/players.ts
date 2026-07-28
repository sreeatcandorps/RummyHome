import { supabase } from '@/services/supabase';
import { Player } from '@/types/player';
import { isEphemeralTestEmail } from '@/utils/playerFilters';

const toPlayer = (row: any): Player => ({
  id: row.id,
  playerCode: row.player_code ?? undefined,
  email: row.email ?? undefined,
  phone: row.phone ?? undefined,
  name: row.display_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Rummy Player',
  role: row.role === 'app_admin' ? 'admin' : 'player',
});

export { isEphemeralTestEmail };

type ListOptions = {
  includeEphemeral?: boolean;
};

const digitsOnly = (value: string) => value.replace(/\D/g, '');

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

  async getPlayer(id: string): Promise<Player | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? toPlayer(data) : null;
  },

  /**
   * Deliberately does not match on names: a player must be looked up by
   * something they chose to share (email, phone, or their player ID).
   */
  async searchPlayers(query: string, options: ListOptions = {}): Promise<Player[]> {
    const trimmed = query.trim();
    if (trimmed.length < 3) return [];

    const filters = [`email.ilike.%${trimmed}%`];

    const digits = digitsOnly(trimmed);
    if (digits.length >= 6) {
      filters.push(`phone.ilike.%${digits}%`);
    }

    const runSearch = (searchFilters: string[]) =>
      supabase
        .from('profiles')
        .select('*')
        .or(searchFilters.join(','))
        .order('display_name', { ascending: true });

    let { data, error } = await runSearch([...filters, `player_code.ilike.${trimmed}`]);

    // Player codes arrive with migration 004; fall back until it has been applied.
    if (error && (error as { code?: string }).code === '42703') {
      ({ data, error } = await runSearch(filters));
    }

    if (error) throw error;

    const players = (data ?? []).map(toPlayer);
    if (options.includeEphemeral) return players;
    return players.filter((player) => !isEphemeralTestEmail(player.email));
  },
};

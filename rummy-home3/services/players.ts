import { NOT_READY_MESSAGE } from '@/utils/notReady';
import { displayPlayerId } from '@/utils/playerIdentity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { Player } from '@/types/player';
import { isEphemeralTestEmail } from '@/utils/playerFilters';
import { playerSearchMode } from '@/utils/playerSearch';
import { REQUEST_TIMEOUT_MS, withTimeout } from '@/utils/withTimeout';
import { queryCache } from '@/utils/queryCache';

export const MIGRATION_007_HINT = NOT_READY_MESSAGE;

const ROSTER_KEY = 'myPlayersRoster';
const MY_PLAYERS_KEY = (ownerId: string) => `myPlayers:${ownerId}`;
/** How long a list_my_players answer serves the tab bar count and the My Players screen before it is asked again. */
export const MY_PLAYERS_STALE_MS = 30_000;

type RosterRow = {
  ownerId: string;
  playerId: string;
  gamesTogether: number;
  createdAt: string;
  name: string;
  playerCode?: string;
};

const missingRpc = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  const message = ((error as { message?: string })?.message ?? '').toLowerCase();
  return code === 'PGRST202' || message.includes('could not find the function') || message.includes('schema cache');
};

/**
 * Columns a signed-in account may read about other players. Since migration 019
 * SELECT on profiles is granted per column, so `select('*')` is refused; email,
 * phone and zip are the owner's alone (read through `my_profile` in authService).
 */
export const PUBLIC_PROFILE_COLUMNS =
  'id, display_name, first_name, last_name, avatar_url, player_code, public_player_no, player_status, managed_by, role, is_demo, demo_owner_id';

const toPlayer = (row: any): Player => ({
  id: row.id,
  playerCode: displayPlayerId(row),
  playerNo: row.public_player_no ?? undefined,
  email: row.email ?? undefined,
  phone: row.phone ?? undefined,
  name: row.display_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Rummy Player',
  role: row.role === 'app_admin' ? 'admin' : 'player',
  isDemo: row.is_demo === true,
});

export { isEphemeralTestEmail };

type ListOptions = {
  includeEphemeral?: boolean;
};

const publicPlayer = (player: Player): Player => ({
  id: player.id,
  name: player.name,
  playerCode: player.playerCode,
  role: player.role,
  gamesTogether: player.gamesTogether,
  seated: player.seated,
  seatRole: player.seatRole,
  isDemo: player.isDemo,
});

async function readRoster(): Promise<RosterRow[]> {
  const raw = await AsyncStorage.getItem(ROSTER_KEY);
  return raw ? JSON.parse(raw) as RosterRow[] : [];
}

async function writeRoster(rows: RosterRow[]) {
  await AsyncStorage.setItem(ROSTER_KEY, JSON.stringify(rows));
}

function rowToPlayer(row: RosterRow): Player {
  return {
    id: row.playerId,
    name: row.name || 'Rummy Player',
    playerCode: row.playerCode,
    role: 'player',
    gamesTogether: row.gamesTogether,
  };
}

/** A list_my_players row (RPC or home bundle) as a Player. */
export const myPlayerFromRow = (row: { id: string; display_name: string; player_code: string | null; games_together: number }): Player => ({
  id: row.id,
  name: row.display_name || 'Rummy Player',
  playerCode: row.player_code ?? undefined,
  role: 'player' as const,
  gamesTogether: row.games_together ?? 0,
});

/** Does the server list differ from the cached roster rows for this owner? */
export function rosterChanged(mine: RosterRow[], players: Player[]): boolean {
  if (mine.length !== players.length) return true;
  const byId = new Map(mine.map((row) => [row.playerId, row]));
  return players.some((player) => {
    const row = byId.get(player.id);
    return !row || row.name !== player.name || row.playerCode !== player.playerCode || row.gamesTogether !== (player.gamesTogether ?? 0);
  });
}

/**
 * Keep the offline roster copy in step with a fresh server list. The write (a JSON
 * blob of every owner's players) is skipped when nothing changed, which is the usual
 * case on every tab change.
 */
async function rememberMyPlayers(ownerId: string, players: Player[]): Promise<void> {
  const rows = await readRoster();
  const mine = rows.filter((row) => row.ownerId === ownerId);
  if (!rosterChanged(mine, players)) return;
  const others = rows.filter((row) => row.ownerId !== ownerId);
  await writeRoster([
    ...others,
    ...players.map((player: Player) => ({
      ownerId,
      playerId: player.id,
      gamesTogether: player.gamesTogether ?? 0,
      createdAt: new Date().toISOString(),
      name: player.name,
      playerCode: player.playerCode,
    })),
  ]);
}

export const playersService = {
  async listPlayers(options: ListOptions = {}): Promise<Player[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_COLUMNS)
      .order('display_name', { ascending: true });

    if (error) throw error;

    const players = (data ?? []).map(toPlayer);
    if (options.includeEphemeral) return players;
    return players.filter((player) => !isEphemeralTestEmail(player.email));
  },

  async getPlayer(id: string): Promise<Player | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select(PUBLIC_PROFILE_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? toPlayer(data) : null;
  },

  /**
   * Name, player ID, or a full email address. Results never include an email
   * or a phone number. A partial email and any phone-shaped query match nobody.
   */
  async searchPlayers(query: string): Promise<Player[]> {
    const mode = playerSearchMode(query);
    if (mode === 'none') return [];
    const trimmed = query.trim();

    if (!isSupabaseConfigured) {
      const { storage } = await import('@/utils/storage');
      const players = await storage.getPlayers();
      const found = players.filter((player) => {
        // The database is registered players only. Unregistered ones live in their creator's My players.
        if (player.managedBy || (player.status && player.status !== 'registered')) return false;
        if (mode === 'email') return (player.email ?? '').toLowerCase() === trimmed.toLowerCase();
        const haystack = `${player.name} ${player.playerCode ?? ''}`.toLowerCase();
        return haystack.includes(trimmed.toLowerCase());
      });
      return found.map(publicPlayer);
    }

    const rpc = await withTimeout(
      supabase.rpc('search_players', { p_query: trimmed }),
      REQUEST_TIMEOUT_MS,
      'Couldn’t search players.',
    );
    if (!rpc.error) {
      return (rpc.data ?? []).map((row: { id: string; display_name: string; player_code: string | null }) => ({
        id: row.id,
        name: row.display_name || 'Rummy Player',
        playerCode: row.player_code ?? undefined,
        role: 'player' as const,
      }));
    }
    if (!missingRpc(rpc.error)) throw rpc.error;

    // Pre-011 server. Email is not a readable column for other accounts (019), so an
    // email search without the RPC matches nobody rather than erroring.
    if (mode === 'email') return [];
    const columns = 'id, display_name, player_code, first_name, last_name';
    const request = supabase
      .from('profiles')
      .select(columns)
      .or([
        `display_name.ilike.%${trimmed.replace(/[,]/g, '')}%`,
        `first_name.ilike.%${trimmed.replace(/[,]/g, '')}%`,
        `last_name.ilike.%${trimmed.replace(/[,]/g, '')}%`,
        `player_code.ilike.%${trimmed.replace(/[,]/g, '')}%`,
      ].join(','))
      .limit(20);
    const { data, error } = await request;
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.display_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Rummy Player',
      playerCode: row.player_code ?? undefined,
      role: 'player' as const,
    }));
  },

  async readMyPlayers(ownerId: string): Promise<Player[]> {
    const rows = await readRoster();
    return rows
      .filter((row) => row.ownerId === ownerId)
      .sort((a, b) => b.gamesTogether - a.gamesTogether || a.name.localeCompare(b.name))
      .map(rowToPlayer);
  },

  /**
   * The server list. Callers that run at the same moment share one request, and a
   * list younger than MY_PLAYERS_STALE_MS is served again without a request; every
   * roster change (add/remove/rename, a claim) calls forgetMyPlayers().
   */
  async listMyPlayers(ownerId: string, options: { fresh?: boolean } = {}): Promise<Player[]> {
    if (!isSupabaseConfigured) return this.readMyPlayers(ownerId);
    if (options.fresh) queryCache.invalidate(MY_PLAYERS_KEY(ownerId));

    return queryCache.read(MY_PLAYERS_KEY(ownerId), async () => {
      const rpc = await withTimeout(
        supabase.rpc('list_my_players'),
        REQUEST_TIMEOUT_MS,
        'Couldn’t load your players.',
      );
      if (rpc.error) {
        if (missingRpc(rpc.error)) throw new Error(MIGRATION_007_HINT);
        throw rpc.error;
      }
      const players = (rpc.data ?? []).map(myPlayerFromRow);
      await rememberMyPlayers(ownerId, players);
      return players;
    }, { staleTime: MY_PLAYERS_STALE_MS });
  },

  /** A list_my_players result that arrived inside the home bundle. */
  async primeMyPlayers(ownerId: string, rows: any[]): Promise<Player[]> {
    const players = (rows ?? []).map(myPlayerFromRow);
    queryCache.set(MY_PLAYERS_KEY(ownerId), players);
    await rememberMyPlayers(ownerId, players);
    return players;
  },

  /** After any change to who is on the roster. */
  forgetMyPlayers() {
    queryCache.invalidate('myPlayers:');
  },

  async addMyPlayer(ownerId: string, player: Pick<Player, 'id' | 'name' | 'playerCode'>): Promise<void> {
    const rows = await readRoster();
    const without = rows.filter((row) => !(row.ownerId === ownerId && row.playerId === player.id));
    const next: RosterRow = {
      ownerId,
      playerId: player.id,
      gamesTogether: rows.find((row) => row.ownerId === ownerId && row.playerId === player.id)?.gamesTogether ?? 0,
      createdAt: new Date().toISOString(),
      name: player.name,
      playerCode: player.playerCode,
    };
    await writeRoster([next, ...without]);
    this.forgetMyPlayers();

    if (!isSupabaseConfigured) return;
    const { error } = await supabase.rpc('add_my_player', { p_player_id: player.id });
    if (error) {
      await writeRoster(rows);
      if (missingRpc(error)) throw new Error(MIGRATION_007_HINT);
      throw error;
    }
  },

  async removeMyPlayer(ownerId: string, playerId: string): Promise<void> {
    const rows = await readRoster();
    await writeRoster(rows.filter((row) => !(row.ownerId === ownerId && row.playerId === playerId)));
    this.forgetMyPlayers();
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.rpc('remove_my_player', { p_player_id: playerId });
    if (error) {
      await writeRoster(rows);
      if (missingRpc(error)) throw new Error(MIGRATION_007_HINT);
      throw error;
    }
  },

  async rememberTogether(ownerId: string, playerIds: string[], names: Map<string, { name: string; playerCode?: string }> = new Map()): Promise<void> {
    const rows = await readRoster();
    const next = [...rows];
    playerIds.filter((id) => id && id !== ownerId).forEach((playerId) => {
      const index = next.findIndex((row) => row.ownerId === ownerId && row.playerId === playerId);
      const known = names.get(playerId);
      if (index >= 0) {
        next[index] = {
          ...next[index],
          gamesTogether: next[index].gamesTogether + 1,
          name: known?.name || next[index].name,
          playerCode: known?.playerCode || next[index].playerCode,
        };
      } else {
        next.unshift({
          ownerId,
          playerId,
          gamesTogether: 1,
          createdAt: new Date().toISOString(),
          name: known?.name || 'Rummy Player',
          playerCode: known?.playerCode,
        });
      }
    });
    await writeRoster(next);
    this.forgetMyPlayers();
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.rpc('touch_my_players', { p_ids: playerIds });
    if (error && !missingRpc(error)) throw error;
  },
};

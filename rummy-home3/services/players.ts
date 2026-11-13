import { NOT_READY_MESSAGE } from '@/utils/notReady';
import { displayPlayerId } from '@/utils/playerIdentity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { Player } from '@/types/player';
import { isEphemeralTestEmail } from '@/utils/playerFilters';
import { matchesMyPlayer, playerSearchMode } from '@/utils/playerSearch';
import { MY_PLAYERS_PAGE_SIZE, MY_PLAYERS_SEARCH_LIMIT, MyPlayersCursor, MyPlayersSort, sortMyPlayers } from '@/utils/myPlayersList';
import { REQUEST_TIMEOUT_MS, withTimeout } from '@/utils/withTimeout';
import { queryCache } from '@/utils/queryCache';
import { assignInitials, INITIALS_PATTERN, initialsProblem, normalizeInitials } from '@/utils/initials';
import { removeMyPlayerError, restoredRow } from '@/utils/removeMyPlayer';
import { localMyPlayersGuard } from '@/utils/guardrails';

export const MIGRATION_007_HINT = NOT_READY_MESSAGE;

const ROSTER_KEY = 'myPlayersRoster';
const MY_PLAYERS_KEY = (ownerId: string) => `myPlayers:${ownerId}`;
/** How long a list_my_players answer serves the tab bar count and the My Players screen before it is asked again. */
export const MY_PLAYERS_STALE_MS = 30_000;
/** Whether the server has the 030 paging functions; unknown until the first call, then remembered for the session. */
let supportsPaging: boolean | null = null;

/** A My players row from the paged list or the search (030): a Player plus the server's sort key and status. */
export type PagedPlayer = Player & { sortName?: string };

type RosterRow = {
  ownerId: string;
  playerId: string;
  gamesTogether: number;
  createdAt: string;
  /** Last name seen for the player; the live profile name replaces it on every read. */
  name: string;
  playerCode?: string;
  /** Stored scorecard label, unique within this owner's rows (022). Never changed by a rename. */
  initials?: string;
  /** 027 soft remove: set while the player is off this owner's list. The row (history, initials) stays. */
  removedAt?: string;
};

const isActive = (row: RosterRow) => !row.removedAt;

/** Same wording as set_my_player_initials / set_seat_label in migration 039. */
export const INITIALS_FORMAT_MESSAGE = 'Initials are 2 or 3 characters: a letter, then letters or digits.';

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
    initials: row.initials,
    addedAt: row.createdAt,
  };
}

/**
 * Local mode stands in for the 022 trigger: every roster row of this owner gets stored
 * initials, oldest row first, so the list is unique and stable across reads.
 */
function withLocalInitials(rows: RosterRow[], ownerId: string): { rows: RosterRow[]; changed: boolean } {
  const mine = rows.filter((row) => row.ownerId === ownerId && isActive(row));
  if (mine.every((row) => row.initials)) return { rows, changed: false };
  const labels = assignInitials(mine.map((row) => ({ id: row.playerId, name: row.name, initials: row.initials, addedAt: row.createdAt })));
  return {
    changed: true,
    rows: rows.map((row) => (row.ownerId === ownerId && isActive(row) && !row.initials ? { ...row, initials: labels.get(row.playerId) } : row)),
  };
}


/** A list_my_players row (RPC or home bundle) as a Player. The name is always the live profile name; pre-022 rows have no initials. */
export const myPlayerFromRow = (row: {
  id: string; display_name: string; player_code: string | null; games_together: number;
  initials?: string | null; added_at?: string | null;
}): Player => ({
  id: row.id,
  name: row.display_name || 'Rummy Player',
  playerCode: row.player_code ?? undefined,
  role: 'player' as const,
  gamesTogether: row.games_together ?? 0,
  initials: row.initials ?? undefined,
  addedAt: row.added_at ?? undefined,
});

/** Does the server list differ from the cached roster rows for this owner? */
export function rosterChanged(mine: RosterRow[], players: Player[]): boolean {
  if (mine.length !== players.length) return true;
  const byId = new Map(mine.map((row) => [row.playerId, row]));
  return players.some((player) => {
    const row = byId.get(player.id);
    return !row || row.name !== player.name || row.playerCode !== player.playerCode || row.gamesTogether !== (player.gamesTogether ?? 0)
      || (row.initials ?? undefined) !== player.initials;
  });
}

/**
 * Keep the offline roster copy in step with a fresh server list. The write (a JSON
 * blob of every owner's players) is skipped when nothing changed, which is the usual
 * case on every tab change.
 */
async function rememberMyPlayers(ownerId: string, players: Player[], options: { partial?: boolean } = {}): Promise<void> {
  const rows = await readRoster();
  const mine = rows.filter((row) => row.ownerId === ownerId && isActive(row));
  if (!options.partial && !rosterChanged(mine, players)) return;
  // A first page (030) refreshes the rows it holds and keeps the rest of the offline copy.
  const shown = new Set(players.map((player) => player.id));
  const others = options.partial
    ? rows.filter((row) => row.ownerId !== ownerId || !shown.has(row.playerId))
    : rows.filter((row) => row.ownerId !== ownerId);
  await writeRoster([
    ...others,
    ...players.map((player: Player) => ({
      ownerId,
      playerId: player.id,
      gamesTogether: player.gamesTogether ?? 0,
      createdAt: player.addedAt ?? new Date().toISOString(),
      name: player.name,
      playerCode: player.playerCode,
      initials: player.initials,
    })),
  ]);
}

/** The friendly message for a server refusal of set_my_player_initials / set_seat_label. */
const initialsError = (error: unknown): Error => {
  const message = (error as { message?: string })?.message ?? '';
  if (missingRpc(error)) return new Error(NOT_READY_MESSAGE);
  return new Error(message || 'Couldn’t save the initials.');
};

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
    // Like the server list, show the player's current name, not the one seen at add time.
    const { storage } = await import('@/utils/storage');
    const liveNames = new Map((await storage.getPlayers()).map((player) => [player.id, player.name]));
    const current = (await readRoster()).map((row) => {
      const live = row.ownerId === ownerId ? liveNames.get(row.playerId) : undefined;
      return live && live !== row.name ? { ...row, name: live } : row;
    });
    const filled = withLocalInitials(current, ownerId);
    await writeRoster(filled.rows);
    return filled.rows
      .filter((row) => row.ownerId === ownerId && isActive(row))
      .sort((a, b) => b.gamesTogether - a.gamesTogether || a.name.localeCompare(b.name))
      .map(rowToPlayer);
  },

  /**
   * The owner types the scorecard initials for one of their players. 2–3 characters, the
   * first a letter (039), unique within their My players. Returns the stored (upper-case) value.
   */
  async setInitials(ownerId: string, playerId: string, initials: string): Promise<string> {
    const value = normalizeInitials(initials);
    if (!INITIALS_PATTERN.test(value)) throw new Error(INITIALS_FORMAT_MESSAGE);

    if (!isSupabaseConfigured) {
      const rows = await readRoster();
      const mine = rows.filter((row) => row.ownerId === ownerId && row.playerId !== playerId);
      const problem = initialsProblem(value, new Map(mine.filter((row) => row.initials).map((row) => [row.initials!, row.name])));
      if (problem) throw new Error(problem.endsWith('.') ? `${problem.slice(0, -1)} in your My players.` : problem);
      if (!rows.some((row) => row.ownerId === ownerId && row.playerId === playerId)) throw new Error('This player is not in your My players.');
      await writeRoster(rows.map((row) => (row.ownerId === ownerId && row.playerId === playerId ? { ...row, initials: value } : row)));
      this.forgetMyPlayers();
      return value;
    }

    const { data, error } = await supabase.rpc('set_my_player_initials', { p_player_id: playerId, p_initials: value });
    if (error) throw initialsError(error);
    this.forgetMyPlayers();
    return (data as string) || value;
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

  /**
   * 030: one page of My players in the order the screen shows. On a server without 030 (or
   * locally) the whole list is sliced the same way, so the screen needs no second path.
   */
  async listMyPlayersPage(ownerId: string, sort: MyPlayersSort, cursor: MyPlayersCursor, pageSize = MY_PLAYERS_PAGE_SIZE): Promise<PagedPlayer[]> {
    if (isSupabaseConfigured && supportsPaging !== false) {
      const rpc = await withTimeout(
        supabase.rpc('list_my_players_page', {
          p_sort: sort, p_limit: pageSize,
          p_after_name: cursor?.afterName ?? null, p_after_id: cursor?.afterId ?? null, p_after_games: cursor?.afterGames ?? null,
        }),
        REQUEST_TIMEOUT_MS,
        'Couldn’t load your players.',
      );
      if (!rpc.error) {
        supportsPaging = true;
        const rows = (rpc.data ?? []) as any[];
        const page = rows.map((row) => ({ ...myPlayerFromRow(row), status: row.player_status ?? undefined, sortName: row.sort_name ?? undefined }));
        if (!cursor) await rememberMyPlayers(ownerId, page, { partial: page.length >= pageSize });
        return page;
      }
      if (!missingRpc(rpc.error)) throw rpc.error;
      supportsPaging = false;
    }
    const all = sortMyPlayers(await this.listMyPlayers(ownerId), sort).map((player) => ({ ...player, sortName: player.name.toLowerCase() }));
    const start = cursor ? all.findIndex((player) => player.id === cursor.afterId) + 1 : 0;
    return all.slice(start, start + pageSize);
  },

  /** 030: how many active My players the owner has, for the header. Falls back to the list length. */
  async countMyPlayers(ownerId: string): Promise<number> {
    if (isSupabaseConfigured && supportsPaging !== false) {
      const { data, error } = await supabase.rpc('count_my_players');
      if (!error && typeof data === 'number') return data;
      if (error && !missingRpc(error)) throw error;
    }
    return (await this.listMyPlayers(ownerId)).length;
  },

  /**
   * 030: the owner's My players matching a name part, initials or Player ID, from the server
   * when it has search_my_players, otherwise from the list on the phone with the same rules.
   */
  async searchMyPlayers(ownerId: string, query: string, limit = MY_PLAYERS_SEARCH_LIMIT): Promise<PagedPlayer[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    if (isSupabaseConfigured && supportsPaging !== false) {
      const { data, error } = await withTimeout(
        supabase.rpc('search_my_players', { p_query: trimmed, p_limit: limit }),
        REQUEST_TIMEOUT_MS,
        'Couldn’t search your players.',
      );
      if (!error) return ((data ?? []) as any[]).map((row) => ({ ...myPlayerFromRow(row), status: row.player_status ?? undefined }));
      if (!missingRpc(error)) throw error;
      supportsPaging = false;
    }
    return (await this.listMyPlayers(ownerId)).filter((player) => matchesMyPlayer(player, trimmed)).slice(0, limit);
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
    const existing = rows.find((row) => row.ownerId === ownerId && row.playerId === player.id);
    if (!isSupabaseConfigured && !existing) {
      const refused = localMyPlayersGuard(rows, ownerId);
      if (refused) throw new Error(refused);
    }
    const without = rows.filter((row) => !(row.ownerId === ownerId && row.playerId === player.id));
    // Re-adding (a rename, a claim, after Remove from My players) keeps the row's age, games
    // and initials: a rename never changes initials; a removed row's come back when still free.
    const next: RosterRow = restoredRow({
      ownerId,
      playerId: player.id,
      gamesTogether: existing?.gamesTogether ?? 0,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      name: player.name,
      playerCode: player.playerCode,
      initials: existing?.initials,
    }, without);
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

  /**
   * Remove from My players (027): a soft remove. The row stays with removedAt so past games,
   * scores and results keep the name and totals, and Undo / a later re-add brings the history
   * back. The server refuses while the player sits in a live game the owner can see.
   */
  async removeMyPlayer(ownerId: string, playerId: string): Promise<void> {
    const rows = await readRoster();
    const removedAt = new Date().toISOString();
    await writeRoster(rows.map((row) => (row.ownerId === ownerId && row.playerId === playerId ? { ...row, removedAt } : row)));
    this.forgetMyPlayers();
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.rpc('remove_my_player', { p_player_id: playerId });
    if (error) {
      await writeRoster(rows);
      this.forgetMyPlayers();
      if (missingRpc(error)) throw new Error(MIGRATION_007_HINT);
      throw removeMyPlayerError(error);
    }
  },

  /** Undo on the toast: the removed row comes back with its games and, when still free, its initials. */
  async restoreMyPlayer(ownerId: string, playerId: string): Promise<void> {
    const rows = await readRoster();
    await writeRoster(rows.map((row) => (row.ownerId === ownerId && row.playerId === playerId && row.removedAt ? restoredRow(row, rows) : row)));
    this.forgetMyPlayers();
    if (!isSupabaseConfigured) return;
    const { error } = await (supabase.rpc as any)('restore_my_player', { p_player_id: playerId });
    if (error) {
      await writeRoster(rows);
      this.forgetMyPlayers();
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
        next[index] = restoredRow({
          ...next[index],
          gamesTogether: next[index].gamesTogether + 1,
          name: known?.name || next[index].name,
          playerCode: known?.playerCode || next[index].playerCode,
        }, next);
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

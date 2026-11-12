/**
 * My players, Find player in database, and New game share these rules for
 * how a player is named, labelled, and ordered.
 */

export type ListedPlayer = {
  id: string;
  name: string;
  playerNo?: number | null;
  playerCode?: string | null;
  gamesTogether?: number | null;
};

export type MyPlayersSort = 'name' | 'frequent';

export const SORT_LABEL: Record<MyPlayersSort, string> = {
  name: 'Sort by Name',
  frequent: 'Sort by Frequent',
};

/** Short chip labels for the sort control beside Search. */
export const SORT_CHIP: Record<MyPlayersSort, string> = {
  frequent: 'Frequent',
  name: 'Alphabetical',
};
export const SORT_OPTIONS: MyPlayersSort[] = ['frequent', 'name'];

/** "Unregistered" means anyone who has not finished signing up: Unregistered and Pending registration. */
export type MyPlayersFilter = 'all' | 'unregistered';

export function matchesPlayerFilter(status: RegistrationLabel, filter: MyPlayersFilter): boolean {
  if (filter === 'all') return true;
  return status !== 'Registered';
}

export function filterMyPlayers<T>(players: T[], filter: MyPlayersFilter, statusOf: (player: T) => RegistrationLabel): T[] {
  return players.filter((player) => matchesPlayerFilter(statusOf(player), filter));
}

export const nextSort = (sort: MyPlayersSort): MyPlayersSort => (sort === 'name' ? 'frequent' : 'name');

/** People you play with most come first until the user flips it. */
export const DEFAULT_MY_PLAYERS_SORT: MyPlayersSort = 'frequent';

export type RegistrationLabel = 'Registered' | 'Pending registration' | 'Unregistered';

/**
 * Every player shows one of three words. An absent status is an older row for a
 * registered account; deleted and merged rows are not listed, so they read Registered too.
 */
export function registrationLabel(status?: string | null): RegistrationLabel {
  if (status === 'unregistered') return 'Unregistered';
  if (status === 'pending') return 'Pending registration';
  return 'Registered';
}

/** Tag tone per status: green, amber, and blue. The Player ID badge is an outlined pill, so none of these look like it. */
export const REGISTRATION_TONE: Record<RegistrationLabel, 'positive' | 'leader' | 'info'> = {
  Registered: 'positive',
  'Pending registration': 'leader',
  Unregistered: 'info',
};

/**
 * The public player ID as a number. Older databases still hand out letter codes
 * such as QTGFJH; those are never shown, so this is null for them.
 */
export function playerIdNumber(player: Pick<ListedPlayer, 'playerNo' | 'playerCode'>): number | null {
  if (player.playerNo != null && player.playerNo >= 1) return player.playerNo;
  const code = (player.playerCode ?? '').trim();
  if (/^#?\d{1,12}$/.test(code)) {
    const n = Number(code.replace(/^#/, ''));
    return n >= 1 ? n : null;
  }
  return null;
}

/** "Player ID 42", or null when the player has no numeric ID yet. */
export function playerIdBadge(player: Pick<ListedPlayer, 'playerNo' | 'playerCode'>): string | null {
  const n = playerIdNumber(player);
  return n == null ? null : `Player ID ${n}`;
}

export function sortMyPlayers<T extends ListedPlayer>(players: T[], sort: MyPlayersSort): T[] {
  return [...players].sort((a, b) => {
    if (sort === 'frequent') {
      const diff = (b.gamesTogether ?? 0) - (a.gamesTogether ?? 0);
      if (diff !== 0) return diff;
    }
    return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
}

/**
 * The owner is never a row in their own roster (the server and the local roster
 * both skip auth.uid()), yet they expect to find themselves in My players. This
 * pins the signed-in player to the front of whatever the list shows, so they
 * appear even when the roster is empty, filtered, or searched by their name.
 */
export function withOwnerFirst<T extends { id: string }>(players: T[], owner: T | null | undefined, include = true): T[] {
  const rest = owner ? players.filter((player) => player.id !== owner.id) : players;
  return owner && include ? [owner, ...rest] : rest;
}

/** Players not yet in My players first (search order kept), then the ones already there. */
export function orderDatabaseResults<T extends { id: string }>(results: T[], myPlayerIds: Iterable<string>): (T & { inMyPlayers: boolean })[] {
  const mine = new Set(myPlayerIds);
  const tagged = results.map((player) => ({ ...player, inMyPlayers: mine.has(player.id) }));
  return [...tagged.filter((row) => !row.inMyPlayers), ...tagged.filter((row) => row.inMyPlayers)];
}

/** Fixed-height list on My players: one row per player; this many rows are visible before it scrolls. */
export const MY_PLAYERS_VISIBLE_ROWS = 7;
export const MY_PLAYERS_CARD_HEIGHT = 60;

export function myPlayersGridHeight(playerCount: number, columns = 1): number {
  const rows = Math.ceil(Math.max(0, playerCount) / columns);
  return Math.min(rows, MY_PLAYERS_VISIBLE_ROWS) * MY_PLAYERS_CARD_HEIGHT;
}

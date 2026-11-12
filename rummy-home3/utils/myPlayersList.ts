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

export type RegistrationLabel = 'Registered' | 'Pending registration' | 'Link pending' | 'Unregistered';

/**
 * Every player shows one word. An absent status is an older row for a registered account;
 * deleted and merged rows are not listed, so they read Registered too. 'pending' is an open
 * invite, or an open Link to Player ID request (025) when `linkPending` says so.
 */
export function registrationLabel(status?: string | null, linkPending = false): RegistrationLabel {
  if (status === 'unregistered') return 'Unregistered';
  if (status === 'pending' && linkPending) return 'Link pending';
  if (status === 'pending') return 'Pending registration';
  return 'Registered';
}

/** Tag tone per status: green, amber, and blue. The Player ID badge is an outlined pill, so none of these look like it. */
export const REGISTRATION_TONE: Record<RegistrationLabel, 'positive' | 'leader' | 'info'> = {
  Registered: 'positive',
  'Pending registration': 'leader',
  'Link pending': 'leader',
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
/** The list card's top padding (styles.grid); the height must include it or the last row is cut. */
export const MY_PLAYERS_GRID_PADDING = 8;

export function myPlayersGridHeight(playerCount: number, columns = 1): number {
  const rows = Math.ceil(Math.max(0, playerCount) / columns);
  if (rows === 0) return 0;
  return Math.min(rows, MY_PLAYERS_VISIBLE_ROWS) * MY_PLAYERS_CARD_HEIGHT + MY_PLAYERS_GRID_PADDING;
}

// ---------- at scale (030): pages, sections, search ----------

/** Rows one page of My players fetches; the next page loads when the list nears its end. */
export const MY_PLAYERS_PAGE_SIZE = 100;
/** Keystrokes settle this long before the server is asked to search. */
export const MY_PLAYERS_SEARCH_DEBOUNCE_MS = 250;
/** Server search answers at most this many rows; the message below says so when it is full. */
export const MY_PLAYERS_SEARCH_LIMIT = 50;
export const SEARCH_FULL_NOTE = (limit: number) => `Showing the first ${limit} matches. Type more to narrow it down.`;

export type MyPlayersCursor = { afterName: string; afterId: string; afterGames: number } | null;

/** The cursor for the page after `rows` in `sort` order, or null when `rows` is the last page. */
export function nextPageCursor<T extends ListedPlayer & { sortName?: string }>(rows: readonly T[], pageSize: number): MyPlayersCursor {
  if (rows.length < pageSize) return null;
  const last = rows[rows.length - 1];
  return { afterName: last.sortName ?? last.name.toLowerCase(), afterId: last.id, afterGames: last.gamesTogether ?? 0 };
}

/** Appends a page, dropping any id already shown (a row that moved between pages while scrolling). */
export function appendPage<T extends { id: string }>(current: readonly T[], page: readonly T[]): T[] {
  const seen = new Set(current.map((row) => row.id));
  return [...current, ...page.filter((row) => !seen.has(row.id))];
}

/** The A–Z heading a name files under: its first letter, or # for digits and symbols. */
export function sectionLetter(name: string): string {
  const first = (name ?? '').trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : first ? (/^\p{L}$/u.test(first) ? first : '#') : '#';
}

export type PlayerSection<T> = { title: string; data: T[] };

/**
 * A–Z sections for the alphabetical sort: one section per first letter in list order, "#"
 * for names that start with a digit or symbol. The owner (pinned first) goes under "You".
 */
export function sectionsByLetter<T extends { id: string; name: string }>(players: readonly T[], ownerId?: string | null): PlayerSection<T>[] {
  const sections: PlayerSection<T>[] = [];
  for (const player of players) {
    const title = ownerId && player.id === ownerId ? 'You' : sectionLetter(player.name);
    const last = sections[sections.length - 1];
    if (last && last.title === title) last.data.push(player);
    else sections.push({ title, data: [player] });
  }
  return sections;
}

/** The list reached its end: ask for the next page unless there is none or one is already on its way. */
export function shouldLoadMore(hasMore: boolean, loading: boolean): boolean {
  return hasMore && !loading;
}

/**
 * While the user types, the rows already on the phone that match show at once; when the
 * server answers, its rows (which may include people not loaded yet) replace them, with any
 * local-only match kept so nothing the user could see disappears.
 */
export function mergeSearchResults<T extends { id: string }>(local: readonly T[], server: readonly T[] | null): T[] {
  if (!server) return [...local];
  const seen = new Set(server.map((row) => row.id));
  return [...server, ...local.filter((row) => !seen.has(row.id))];
}

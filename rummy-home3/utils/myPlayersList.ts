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

export const nextSort = (sort: MyPlayersSort): MyPlayersSort => (sort === 'name' ? 'frequent' : 'name');

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

/** Players not yet in My players first (search order kept), then the ones already there. */
export function orderDatabaseResults<T extends { id: string }>(results: T[], myPlayerIds: Iterable<string>): (T & { inMyPlayers: boolean })[] {
  const mine = new Set(myPlayerIds);
  const tagged = results.map((player) => ({ ...player, inMyPlayers: mine.has(player.id) }));
  return [...tagged.filter((row) => !row.inMyPlayers), ...tagged.filter((row) => row.inMyPlayers)];
}

/** Fixed-height list on My players: this many rows of the two-column grid are visible before it scrolls. */
export const MY_PLAYERS_VISIBLE_ROWS = 4;
export const MY_PLAYERS_CARD_HEIGHT = 104;

export function myPlayersGridHeight(playerCount: number, columns = 2): number {
  const rows = Math.ceil(Math.max(0, playerCount) / columns);
  return Math.min(rows, MY_PLAYERS_VISIBLE_ROWS) * MY_PLAYERS_CARD_HEIGHT;
}

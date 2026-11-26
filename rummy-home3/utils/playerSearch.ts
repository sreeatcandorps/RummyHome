/** Same two letters the list avatar shows: first character of each word. */
export function listInitials(name: string): string {
  return (name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Find on EZ Score (D113): the only query is an exact Player ID, "57" or "#57", spaces allowed
 * around it. Anything else (a name, initials, an email, "57a") is not a query: null.
 */
export function parsePlayerIdQuery(raw: string): number | null {
  const digits = (raw ?? '').trim().replace(/^#\s*/, '');
  if (!/^\d{1,12}$/.test(digits)) return null;
  const n = Number(digits);
  return n >= 1 ? n : null;
}

/**
 * The name a Player ID lookup shows: first name + last initial ("Ravi Kumar" -> "Ravi K."), one word as
 * it is. The server applies the same rule (053 short_player_name), so typing numbers never reveals a full name.
 */
export function shortPlayerName(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'Rummy Player';
  if (words.length === 1) return words[0];
  return `${words[0]} ${words[words.length - 1][0].toUpperCase()}.`;
}

/** The one result card's line: "#57 · Ravi K.". */
export function playerIdResultLine(playerNo: number, name: string): string {
  return `#${playerNo} · ${shortPlayerName(name)}`;
}

/** A Player ID nobody has: "No one has #58.". */
export function noOneHasLine(playerNo: number): string {
  return `No one has #${playerNo}.`;
}

export type SearchablePlayer = {
  name?: string | null;
  playerCode?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

/**
 * My players and New game filter on this phone: name, the initials on the
 * avatar, or the player ID with or without #. An email address matches nobody.
 */
export function matchesMyPlayer(player: SearchablePlayer, raw: string): boolean {
  const query = raw.trim().toLowerCase();
  if (!query) return true;
  if (query.includes('@')) return false;

  const name = (player.name ?? '').toLowerCase();
  const first = (player.firstName ?? '').toLowerCase();
  const last = (player.lastName ?? '').toLowerCase();
  if (name.includes(query) || first.includes(query) || last.includes(query)) return true;

  const initials = listInitials(player.name || `${player.firstName ?? ''} ${player.lastName ?? ''}`).toLowerCase();
  if (initials && (initials === query || initials.startsWith(query))) return true;

  const code = (player.playerCode ?? '').trim().toLowerCase();
  if (!code) return false;
  const bare = query.replace(/^#/, '');
  const codeBare = code.replace(/^#/, '');
  return code.includes(query) || codeBare.includes(bare);
}

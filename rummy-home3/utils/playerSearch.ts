export type PlayerSearchMode = 'none' | 'email' | 'text';

const FULL_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
 * Find rules: two characters before a name or player ID search, a full email
 * or nobody, and a phone number matches nobody.
 */
export function playerSearchMode(raw: string): PlayerSearchMode {
  const query = raw.trim();
  if (query.length < 2) return 'none';
  if (FULL_EMAIL.test(query)) return 'email';
  if (query.includes('@')) return 'none';

  const digits = query.replace(/\D/g, '');
  const letters = /[a-z]/i.test(query);
  if (!letters && digits.length >= 6) return 'none';
  return 'text';
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

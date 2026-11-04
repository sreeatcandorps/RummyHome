export type PlayerSearchMode = 'none' | 'email' | 'text';

const FULL_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

/** Name or player ID only. Never an email address. */
export function matchesMyPlayer(player: { name: string; playerCode?: string | null }, raw: string): boolean {
  const query = raw.trim().toLowerCase();
  if (!query) return true;
  if (player.name.toLowerCase().includes(query)) return true;
  return Boolean(player.playerCode && player.playerCode.toLowerCase().includes(query));
}

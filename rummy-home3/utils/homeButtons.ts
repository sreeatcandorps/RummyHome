/**
 * PR 5 — Home's Results / My players button row (the bottom bar is Home and Profile only).
 * Pure helpers so the unit tests can load them.
 */

/** The count badge on the My players button (D5.3): the number, "99+" past that, nothing while unknown. */
export function myPlayersBadge(count: number | null | undefined): string | null {
  if (count == null || count < 0) return null;
  return count > 99 ? '99+' : String(count);
}

/** Spoken label; the same "My players · N" the bottom bar used to say, so the test flows keep working. */
export function myPlayersAccessibilityLabel(count: number | null | undefined): string {
  return count == null ? 'My players' : `My players · ${count}`;
}

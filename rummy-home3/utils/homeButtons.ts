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

/** "My players" in the tile's 17 sp bold label: 86 dp at text size 1.0 (the Pixel 6 CI frame of #171). */
const MY_PLAYERS_LABEL_DP = 86;
/** What the tile keeps around its label: the icon with Paper's margins (16 + 18 − 16) and the label's own 26 + 16. */
const HOME_TILE_CHROME_DP = 60;
export const MY_PLAYERS_SHORT = 'Players';

/**
 * Batch row 12k: at 360 dp × 1.3 the tile read "My pla…". The label shortens to "Players" when the full one
 * does not fit the tile (the icon and the spoken "My players · N" still say whose); it is never cut.
 */
export function myPlayersLabel(tileWidth: number, fontScale: number): string {
  return MY_PLAYERS_LABEL_DP * fontScale + HOME_TILE_CHROME_DP <= tileWidth ? 'My players' : MY_PLAYERS_SHORT;
}

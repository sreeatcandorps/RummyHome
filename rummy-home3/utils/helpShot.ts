/**
 * v12 point 1 (Sree, Nov 19): help pictures are 540 × 1200 (9:20). They fit the card's measured width,
 * keep their ratio, and on tall or wide screens stop at a readable height instead of filling the page.
 */
export const HELP_SHOT_RATIO = 540 / 1200;

export function helpShotSize(cardWidth: number, maxHeight = 720): { width: number; height: number } {
  const width = Math.max(0, Math.min(Math.floor(cardWidth), Math.floor(maxHeight * HELP_SHOT_RATIO)));
  return { width, height: Math.round(width / HELP_SHOT_RATIO) };
}

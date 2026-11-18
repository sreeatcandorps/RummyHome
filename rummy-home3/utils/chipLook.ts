export type ChipLook = 'new' | 'saved' | 'added';

/**
 * Selected-players strip colouring. New game: every chip is `new` (green).
 * Mid-game add: seats already saved in the game are `saved` (quiet grey) and
 * only the fresh picks are `added` (yellow), so the organiser sees what changes.
 */
export function chipLook(id: string, savedIds?: ReadonlySet<string>): ChipLook {
  if (!savedIds) return 'new';
  return savedIds.has(id) ? 'saved' : 'added';
}

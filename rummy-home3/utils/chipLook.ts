export type ChipLook = 'new' | 'saved' | 'added';

/**
 * Selected-players strip colouring. New game: every chip is `new` (green).
 * Mid-game add: seats already saved in the game are `saved` (quiet grey) and
 * only the fresh picks are `added` (yellow), so the organiser sees what changes.
 * Add by initials after Save (D112): `newIds` are green, everyone else quiet grey.
 */
export function chipLook(id: string, savedIds?: ReadonlySet<string>, newIds?: ReadonlySet<string>): ChipLook {
  if (newIds) return newIds.has(id) ? 'new' : 'saved';
  if (!savedIds) return 'new';
  return savedIds.has(id) ? 'saved' : 'added';
}

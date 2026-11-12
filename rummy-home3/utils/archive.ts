/** Copy for Hide / Delete / Restore (023). Pure, so the unit tests pin the exact wording. */

export const HIDE_GAME_NOTE = 'Hidden from your Home. It still counts in results and stats. Unhide from Settings > Hidden & deleted.';

export const DELETE_GAME_TITLE = 'Delete this game?';
export const DELETE_GAME_BODY = 'It disappears for every player. You can restore it from Settings > Hidden & deleted.';

export const DELETE_RESULT_TITLE = 'Delete this result?';
export const DELETE_RESULT_BODY = 'It disappears for everyone. Its games are no longer Closed and can go into a new result. You can restore it from Settings > Hidden & deleted.';

const joinNames = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** "R3" for a result, from its position among the saver's live results. */
export const resultCode = (resultNo: number) => `R${resultNo}`;

/**
 * The extra warning before Delete game when saved results hold it.
 * One result: "This game is in result R3. Deleting it removes it from that result too."
 */
export function deleteGameWarning(holding: { resultNo: number }[]): string | null {
  if (holding.length === 0) return null;
  const codes = holding.map((r) => resultCode(r.resultNo));
  if (codes.length === 1) return `This game is in result ${codes[0]}. Deleting it removes it from that result too.`;
  return `This game is in results ${joinNames(codes)}. Deleting it removes it from those results too.`;
}

/** After Restore game: a game that left a result is not put back. */
export function restoreGameNote(removedCount: number): string {
  if (removedCount === 0) return 'Game restored.';
  return removedCount === 1
    ? 'Game restored. It was removed from a saved result and is not added back; save a new result if it should count.'
    : `Game restored. It was removed from ${removedCount} saved results and is not added back; save a new result if it should count.`;
}

export const GAME_DELETED_TITLE = 'This game was deleted';
export const RESULT_DELETED_TITLE = 'This result was deleted';

/** Scorecard / result page body for a soft-deleted item. */
export function deletedBody(kind: 'game' | 'result', canRestore: boolean): string {
  const what = kind === 'game' ? 'game' : 'result';
  return canRestore
    ? `You can bring this ${what} back with Restore, or from Settings > Hidden & deleted.`
    : `Only the person who deleted this ${what} or an admin can restore it.`;
}

/** Under a saved result whose games were deleted later. */
export function removedGamesNote(removedCount: number): string | null {
  if (removedCount <= 0) return null;
  return removedCount === 1
    ? 'One game was deleted after this result was saved. The totals no longer count it.'
    : `${removedCount} games were deleted after this result was saved. The totals no longer count them.`;
}

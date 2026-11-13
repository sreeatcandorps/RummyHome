/**
 * Delete result (PR 9, `docs/results-delete.md`). Pure copy and rules so the unit tests pin
 * the exact wording; the server side is `delete_result` / `restore_result` from 023 (no new
 * schema). Deleting reopens the games to Completed unless another live result holds them
 * (D9.1); a 10-second Undo toast stands in for a confirm dialog, except for a result that was
 * shared from this phone, which asks first (D9.2); deleted results stay listed for 30 days to
 * the people who could delete them, with Restore (D9.3).
 */

/** How long the Undo toast stays after Delete this result. */
export const UNDO_DELETE_MS = 10000;

/** Deleted results are listed under "Deleted" for this long; after that only Settings > Hidden & deleted has them. */
export const DELETED_RETENTION_DAYS = 30;

export const DELETE_RESULT_BUTTON = 'Delete this result';
export const RESTORE_RESULT_BUTTON = 'Restore';
export const DELETED_TAG = 'Deleted';

export const RESTORED_TOAST = 'Result restored · its games are Closed again';

export const SHARED_CONFIRM_TITLE = 'Delete a shared result?';
export const SHARED_CONFIRM_BODY = 'This result was shared from this phone. The link will say it was deleted; the picture or PDF already sent stays as it is. Everyone loses it here, and you can restore it for 30 days.';

export const DELETED_SECTION_TITLE = 'Deleted';
export const DELETED_SECTION_NOTE = 'Deleted results stay listed for 30 days under "Deleted" for the people who could delete them; everyone else no longer sees them.';

const joinLabels = (labels: string[]) =>
  labels.length <= 1 ? labels.join('') : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;

/** "S14" when the game has its number, else its short code. */
export function gameLabelsOf(games: { label?: string | null; name: string }[]): string[] {
  return games.map((game) => game.label || game.name).filter(Boolean);
}

/** The one line under the Delete button: what reopens, who loses it, how long Restore lasts. */
export function deleteConsequence(labels: string[]): string {
  const tail = `Everyone loses this result; you can restore it for ${DELETED_RETENTION_DAYS} days.`;
  if (labels.length === 0) return tail;
  const verb = labels.length === 1 ? 'goes' : 'go';
  return `${joinLabels(labels)} ${verb} back to Completed and can go into a new result. ${tail}`;
}

/** The Undo toast: "Result deleted · S14, S15 are Completed again". */
export function deletedToast(labels: string[]): string {
  if (labels.length === 0) return 'Result deleted · its games are Completed again';
  return `Result deleted · ${labels.join(', ')} ${labels.length === 1 ? 'is' : 'are'} Completed again`;
}

/** Whether a deleted result is still inside the 30-day window the list shows. */
export function withinRetention(deletedAt: string, now: number = Date.now()): boolean {
  const stamp = new Date(deletedAt).getTime();
  if (!Number.isFinite(stamp)) return false;
  return now - stamp <= DELETED_RETENTION_DAYS * 24 * 60 * 60 * 1000;
}

/** The deleted rows the Past results list shows: inside the window, newest deletion first. */
export function listedDeleted<T extends { deletedAt: string }>(rows: T[], now: number = Date.now()): T[] {
  return rows.filter((row) => withinRetention(row.deletedAt, now)).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

/** Spoken label for the Delete chip on a Past results row. */
export const deleteRowLabel = (when: string) => `Delete the result from ${when}`;
export const restoreRowLabel = (when: string) => `Restore the result from ${when}`;

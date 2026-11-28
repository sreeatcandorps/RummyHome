/**
 * D137 (Q55): Undo left the Scorecard's bottom bar. After a new round is saved the Scorecard shows
 * "Round N saved" with Undo for 5 seconds; Undo is in the ⋮ menu at all times. Add round marks the
 * round it saved; the Scorecard takes the mark once when it comes back into focus.
 */
export const ROUND_SAVED_NOTE_MS = 5000;
export const UNDO_MENU_ITEM = 'Undo last round';

let pending: { gameId: string; round: number } | null = null;

export const roundSavedMark = {
  mark(gameId: string, round: number) {
    pending = { gameId, round };
  },
  /** The round Add round just saved in this game, once; null when there is none. */
  take(gameId: string): number | null {
    if (!pending || pending.gameId !== gameId) return null;
    const { round } = pending;
    pending = null;
    return round;
  },
};

/**
 * The note's text, or null when it must not show. Undo removes the last round, so the note only offers it
 * while the round just saved is still the last one, the game is open and this person may score. A pool
 * re-entry made after the save is undone before the round (041 `pool_undo_reentry`), so then no note.
 */
export function roundSavedNote(input: { savedRound: number | null; roundCount: number; isComplete: boolean; canScore: boolean; reentryPending?: boolean }): string | null {
  const { savedRound, roundCount, isComplete, canScore, reentryPending = false } = input;
  if (savedRound === null || isComplete || !canScore || reentryPending) return null;
  if (savedRound !== roundCount) return null;
  return `Round ${savedRound} saved`;
}

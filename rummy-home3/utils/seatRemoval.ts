/**
 * When may a player be taken out of a game?
 *
 * Only when they have no scores at all, or every single round score they have is
 * exactly 0 (a mid-game joiner's backfilled zeros, for instance). One non-zero
 * round anywhere blocks it; the total is never what is checked.
 */
export const SEAT_HAS_SCORES_MESSAGE =
  'You cannot delete this player. You cannot delete a player that has a score. You will have to edit the round and delete all his scores before you remove a player.';

/** Removing a player with rounds needs the server function from 016. */
export const SEAT_REMOVAL_NOT_READY =
  "Removing a player who has rounds isn't available yet. You can keep scoring with the players you already have.";

export function canRemoveSeat(roundScores: ReadonlyArray<number | null | undefined> | null | undefined): boolean {
  if (!roundScores || roundScores.length === 0) return true;
  return roundScores.every((score) => score === null || score === undefined || score === 0);
}

/** Null when removal is allowed, otherwise the exact message to show. */
export function seatRemovalProblem(roundScores: ReadonlyArray<number | null | undefined> | null | undefined): string | null {
  return canRemoveSeat(roundScores) ? null : SEAT_HAS_SCORES_MESSAGE;
}

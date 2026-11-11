/**
 * Two admins saving the same round at the same moment.
 *
 * Since migration 019 the server serialises writers per game and answers the loser with
 * SQLSTATE `PT409` (PostgREST turns that into HTTP 409) and a plain-English message:
 * either the round was just saved by someone else with different scores, or a player in
 * the payload is no longer in the game. Before 019 the same race surfaced as a raw
 * `23505` unique violation on (game_id, round_number); that is mapped to the same
 * outcome so the app behaves the same against an older database.
 *
 * The screen's job on a conflict is: show the message, refresh the scorecard, and (for
 * Add round) clear the typed scores so they cannot land on the next round by accident.
 */
export const ROUND_CONFLICT_CODE = 'PT409';

export const ROUND_CONFLICT_FALLBACK_MESSAGE =
  'This round was just saved by someone else. The scorecard has been refreshed; check it before you save again.';

const ROUNDS_UNIQUE_KEY = /rounds_game_id_round_number_key|duplicate key value violates unique constraint "rounds/i;

type ErrorLike = { code?: string; message?: string; details?: string } | null | undefined;

export class RoundConflictError extends Error {
  readonly code = ROUND_CONFLICT_CODE;

  constructor(message: string) {
    super(message);
    this.name = 'RoundConflictError';
  }
}

/** True for the 019 conflict, the pre-019 unique violation, or an already mapped RoundConflictError. */
export function isRoundConflict(error: unknown): boolean {
  if (error instanceof RoundConflictError) return true;
  const err = error as ErrorLike;
  if (!err) return false;
  if (err.code === ROUND_CONFLICT_CODE) return true;
  if (err.code === '23505') return true;
  return ROUNDS_UNIQUE_KEY.test(`${err.message ?? ''} ${err.details ?? ''}`);
}

/** The server's message when it is the 019 one; the generic sentence for a raw unique violation. */
export function roundConflictMessage(error: unknown): string {
  if (error instanceof RoundConflictError) return error.message;
  const err = error as ErrorLike;
  if (err?.code === ROUND_CONFLICT_CODE && err.message) return err.message;
  return ROUND_CONFLICT_FALLBACK_MESSAGE;
}

export function toRoundConflictError(error: unknown): RoundConflictError {
  if (error instanceof RoundConflictError) return error;
  return new RoundConflictError(roundConflictMessage(error));
}

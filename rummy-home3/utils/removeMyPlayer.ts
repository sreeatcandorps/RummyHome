/**
 * Remove from My players (migration 027). A soft remove: the roster row stays with a
 * removedAt stamp so past games, scores and results keep the name and totals, and Undo or a
 * later re-add brings the history back. These are the pure rules; services/players.ts applies
 * them to the local roster and the server does the same in SQL.
 */

/** Same wording as remove_my_player in migration 027. */
export const LIVE_GAME_REMOVE_MESSAGE = 'In a live game. Remove them after the game ends.';
export const SELF_REMOVE_MESSAGE = 'You are always in your own list.';
export const REMOVE_FAILED_MESSAGE = 'Couldn’t remove them. Try again.';
/** How long the Undo toast stays after Remove from My players. */
export const UNDO_REMOVE_MS = 6000;

export const REMOVE_CONFIRM_TITLE = (name: string) => `Remove ${name} from My players?`;
export const REMOVE_CONFIRM_BODY = 'Only your list changes. Their account, past games, scores and results stay as they are.';
export const REMOVED_TOAST = (name: string) => `${name} removed from My players.`;

/** The friendly message for a server refusal of remove_my_player. */
export function removeMyPlayerError(error: unknown): Error {
  const message = (error as { message?: string })?.message ?? '';
  if (message.includes('In a live game')) return new Error(LIVE_GAME_REMOVE_MESSAGE);
  if (message.includes('always in your own list')) return new Error(SELF_REMOVE_MESSAGE);
  return error instanceof Error ? error : new Error(message || REMOVE_FAILED_MESSAGE);
}

export type RemovableRow = { ownerId: string; playerId: string; initials?: string; removedAt?: string };

/**
 * The 027 restore rule: a row coming back keeps its initials when no active row of the same
 * owner holds them; otherwise the initials are dropped so the normal default rule (SK, then
 * SUK, ...) labels it again.
 */
export function restoredRow<T extends RemovableRow>(row: T, rows: readonly RemovableRow[]): T {
  const taken = Boolean(row.initials) && rows.some((other) =>
    other.ownerId === row.ownerId && other.playerId !== row.playerId && !other.removedAt && other.initials === row.initials);
  const { removedAt: _removed, ...rest } = row;
  return (taken ? { ...rest, initials: undefined } : rest) as T;
}

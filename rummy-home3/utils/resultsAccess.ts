/**
 * Who may open a result. Mirrors can_see_game_result in
 * supabase/migrations/013_results_privacy.sql; the server is the real gate, this is the
 * client-side belt for the detail screen and for the local (no-Supabase) store.
 *
 * Visible when the viewer is the declarer, a seated player in any included game, the
 * creator or an admin of any included game (non-playing scorekeeper), or an app admin.
 * Watching a game through its public live link does not count.
 */
export type ResultAccessGame = {
  createdBy?: string | null;
  players?: string[] | null;
  adminIds?: string[] | null;
  unseatedAdminIds?: string[] | null;
};

export type ResultAccessFacts = {
  declaredBy: string;
  /** Player ids on the result sheet (everyone who sat in an included game). */
  playerIds: string[];
  /** Included games the client could load. Missing games (not readable) count for nothing. */
  games?: (ResultAccessGame | null | undefined)[];
};

export function userConnectedToGame(game: ResultAccessGame | null | undefined, userId: string): boolean {
  if (!game) return false;
  return (
    game.createdBy === userId
    || (game.players ?? []).includes(userId)
    || (game.adminIds ?? []).includes(userId)
    || (game.unseatedAdminIds ?? []).includes(userId)
  );
}

export function canSeeResult(
  facts: ResultAccessFacts,
  userId: string | null | undefined,
  options: { isAppAdmin?: boolean } = {},
): boolean {
  if (!userId) return false;
  if (options.isAppAdmin) return true;
  if (facts.declaredBy === userId) return true;
  if (facts.playerIds.includes(userId)) return true;
  return (facts.games ?? []).some((game) => userConnectedToGame(game, userId));
}

/** Shown when a result is missing or not the viewer's to see; the two cases read the same on purpose. */
export const RESULT_NOT_AVAILABLE = 'This result isn’t available on your account. Only players, the organizer and admins of the games in it can open it.';

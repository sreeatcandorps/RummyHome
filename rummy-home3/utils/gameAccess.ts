export type SeatRole = 'game_admin' | 'player' | 'spectator';

export type GameVisibility = {
  createdBy?: string | null;
  players: string[];
  spectators?: string[];
  adminIds?: string[];
  unseatedAdminIds?: string[];
  /** Emails of people tied to this game (seated, viewing, or the creator). */
  memberEmails?: { profileId: string; email?: string | null }[];
};

export type Viewer = {
  id: string;
  email?: string | null;
};

const sameEmail = (left?: string | null, right?: string | null) => {
  const a = left?.trim().toLowerCase();
  const b = right?.trim().toLowerCase();
  return Boolean(a && b && a === b);
};

/**
 * A signed-in person sees a game when they created it, sit in it, are a
 * view-only spectator, or their account email matches someone in the game.
 */
export function gameVisibleToUser(game: GameVisibility, viewer: Viewer): boolean {
  if (!viewer.id) return false;
  if (game.createdBy && game.createdBy === viewer.id) return true;
  if (game.players.includes(viewer.id)) return true;
  if (game.spectators?.includes(viewer.id)) return true;
  if (game.adminIds?.includes(viewer.id)) return true;
  if (game.unseatedAdminIds?.includes(viewer.id)) return true;

  const tied = new Set<string>([
    ...(game.createdBy ? [game.createdBy] : []),
    ...game.players,
    ...(game.spectators ?? []),
    ...(game.adminIds ?? []),
    ...(game.unseatedAdminIds ?? []),
  ]);

  return (game.memberEmails ?? []).some(
    (member) => sameEmail(member.email, viewer.email) && tied.has(member.profileId),
  );
}

/** Creator, a promoted admin, or a non-player admin. A seated player is not enough. */
export function userAdminsGame(
  game: { createdBy?: string | null; adminIds?: string[] | null },
  userId: string | null | undefined,
): boolean {
  if (!userId) return false;
  if (game.createdBy === userId) return true;
  return Boolean(game.adminIds?.includes(userId));
}

export type ScoreAccess = {
  isCreator: boolean;
  seatRole?: SeatRole | null;
  /** False for older local games that never stored a seat role. */
  rolesKnown: boolean;
};

/** Game admins and the creator (even if they are only keeping score) can enter and undo rounds. */
export function canEnterScores(access: ScoreAccess): boolean {
  if (access.isCreator) return true;
  if (access.seatRole === 'game_admin') return true;
  if (!access.rolesKnown) return true;
  return false;
}

export function isViewOnly(access: ScoreAccess): boolean {
  return !canEnterScores(access);
}

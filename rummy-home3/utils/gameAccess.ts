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

export type AccessLabel = 'Creator' | 'Admin' | 'Player' | 'View only';

/**
 * What a game is to the viewer, on the Home and Results cards: the organizer who created
 * it, someone made admin (seated or not), a seated player who cannot score, or anyone
 * else who can open it and only look.
 */
export function gameAccessLabel(
  game: { createdBy?: string | null; adminIds?: string[] | null; unseatedAdminIds?: string[] | null; players?: string[] },
  userId: string | null | undefined,
): AccessLabel | null {
  if (!userId) return null;
  if (game.createdBy === userId) return 'Creator';
  if (game.adminIds?.includes(userId) || game.unseatedAdminIds?.includes(userId)) return 'Admin';
  if (game.players?.includes(userId)) return 'Player';
  return 'View only';
}

export const ACCESS_TONE: Record<AccessLabel, 'leader' | 'info' | 'neutral'> = { Creator: 'leader', Admin: 'info', Player: 'neutral', 'View only': 'neutral' };

export type RoleTag = 'Creator' | 'Admin';

/**
 * Which role tag a viewer sees on a seat or a game card: Creator always, Admin only to
 * creators and admins (plain players just need to know who runs the game), and never a
 * "Player" or "View only" tag (docs/design/03-implementation-plan.md, Players/Admins).
 */
export function visibleRoleTag(role: AccessLabel | null | undefined, viewerManages: boolean): RoleTag | null {
  if (role === 'Creator') return 'Creator';
  if (role === 'Admin') return viewerManages ? 'Admin' : null;
  return null;
}

/** Whether the viewer runs the game: its creator or one of its admins. */
export function viewerManagesGame(
  game: { createdBy?: string | null; adminIds?: string[] | null; unseatedAdminIds?: string[] | null },
  userId: string | null | undefined,
): boolean {
  if (!userId) return false;
  return game.createdBy === userId || Boolean(game.adminIds?.includes(userId)) || Boolean(game.unseatedAdminIds?.includes(userId));
}
export const ACCESS_ICON: Record<AccessLabel, string> = { Creator: 'crown-outline', Admin: 'shield-account-outline', Player: 'account-outline', 'View only': 'eye-outline' };

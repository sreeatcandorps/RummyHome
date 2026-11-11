import { isUnregistered, PlayerStatus } from '@/utils/playerIdentity';

/** What the Players page shows and allows for one seat. Pure so it can be tested. */

export type SeatLike = {
  id: string;
  name: string;
  playerNo?: number | null;
  playerCode?: string;
  status?: PlayerStatus;
  managedBy?: string;
  seatRole?: 'game_admin' | 'player' | 'spectator';
  seated?: boolean;
};

export type GameLike = {
  createdBy?: string;
  players: string[];
  adminIds?: string[];
  unseatedAdminIds?: string[];
  spectators?: string[];
};

export type SeatRoleLabel = 'Creator' | 'Admin' | 'Player' | 'View only';
export type RegistrationLabel = 'Registered' | 'Pending registration' | 'Unregistered';

export function seatRoleLabel(seat: SeatLike, game: GameLike): SeatRoleLabel {
  if (game.createdBy && seat.id === game.createdBy) return 'Creator';
  if (seat.seatRole === 'spectator') return 'View only';
  if (seat.seatRole === 'game_admin' || game.adminIds?.includes(seat.id) || game.unseatedAdminIds?.includes(seat.id)) return 'Admin';
  return 'Player';
}

export function registrationLabel(seat: Pick<SeatLike, 'status'>): RegistrationLabel {
  if (seat.status === 'pending') return 'Pending registration';
  if (seat.status === 'unregistered') return 'Unregistered';
  return 'Registered';
}

/** "#42", or the older short code, or nothing. */
export function playerIdBadge(seat: Pick<SeatLike, 'playerNo' | 'playerCode'>): string | null {
  if (seat.playerNo != null) return `#${seat.playerNo}`;
  return seat.playerCode ?? null;
}

export function isSeatAdmin(seat: SeatLike, game: GameLike): boolean {
  return seat.seatRole === 'game_admin' || Boolean(game.adminIds?.includes(seat.id)) || Boolean(game.unseatedAdminIds?.includes(seat.id));
}

export type SeatMenuItem = 'make_admin' | 'remove_admin' | 'edit_name' | 'invite' | 'link_id';

export type SeatMenu = { item: SeatMenuItem; enabled: boolean; reason?: string }[];

/**
 * The per-player ⋮ menu for a game admin. The creator always stays admin.
 * Edit name and Link to a Player ID work only on an unregistered player the
 * viewer manages: another organiser's player is theirs to change.
 */
export function seatMenu(seat: SeatLike, game: GameLike, viewerId: string | null | undefined, canManage: boolean): SeatMenu {
  if (!canManage) return [];
  const isCreator = Boolean(game.createdBy) && seat.id === game.createdBy;
  const admin = isSeatAdmin(seat, game);
  const unregistered = isUnregistered(seat.status);
  const mine = Boolean(viewerId) && seat.managedBy === viewerId;
  const items: SeatMenu = [];
  if (seat.seatRole !== 'spectator') {
    if (admin) items.push({ item: 'remove_admin', enabled: !isCreator, reason: isCreator ? 'The creator is always an admin.' : undefined });
    else items.push({ item: 'make_admin', enabled: true });
  }
  if (unregistered) {
    const reason = mine ? undefined : 'Only the organiser who added this player can change them.';
    items.push({ item: 'edit_name', enabled: mine, reason });
    items.push({ item: 'invite', enabled: mine, reason });
    items.push({ item: 'link_id', enabled: mine, reason });
  }
  return items;
}

export const SEAT_MENU_LABEL: Record<SeatMenuItem, string> = {
  make_admin: 'Make admin',
  remove_admin: 'Remove admin',
  edit_name: 'Edit name',
  invite: 'Invite to register',
  link_id: 'Link to a Player ID',
};

/**
 * Why a looked-up registered player cannot take this seat, or null when they can.
 * Someone already seated (a score column of their own) cannot take a second one.
 * A non-playing admin or a viewer of this game can: the seat becomes theirs and
 * they keep their admin role (migration 017 does the same on the server).
 */
export function linkTargetProblem(target: { id: string; status?: PlayerStatus; managedBy?: string } | null, game: GameLike, seatId: string): string | null {
  if (!target) return 'No registered player has that Player ID.';
  if (target.id === seatId) return 'That is this same player.';
  if (target.managedBy || (target.status && target.status !== 'registered')) return 'That Player ID is not a registered account.';
  if (game.players.includes(target.id)) return 'They are already playing in this game.';
  return null;
}

/** How a link lands for the target: a fresh seat, or taking over their admin/viewer membership. */
export function linkLanding(target: { id: string }, game: GameLike): 'new_seat' | 'admin_takes_seat' | 'viewer_takes_seat' {
  if (game.unseatedAdminIds?.includes(target.id)) return 'admin_takes_seat';
  if (game.spectators?.includes(target.id)) return 'viewer_takes_seat';
  return 'new_seat';
}

/** When a player joins mid-game, every round already played is an explicit 0 for them. */
export function zerosForJoiner(scores: Record<string, number[]>, playerIds: string[]): number[] {
  const played = playerIds.reduce((max, id) => Math.max(max, scores[id]?.length ?? 0), 0);
  return Array.from({ length: played }, () => 0);
}

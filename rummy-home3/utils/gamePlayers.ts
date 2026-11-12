import { isDeletedStatus, isUnregistered, PlayerStatus } from '@/utils/playerIdentity';

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
export type RegistrationLabel = 'Registered' | 'Pending registration' | 'Link pending' | 'Unregistered';

export function seatRoleLabel(seat: SeatLike, game: GameLike): SeatRoleLabel {
  if (game.createdBy && seat.id === game.createdBy) return 'Creator';
  if (seat.seatRole === 'spectator') return 'View only';
  if (seat.seatRole === 'game_admin' || game.adminIds?.includes(seat.id) || game.unseatedAdminIds?.includes(seat.id)) return 'Admin';
  return 'Player';
}

/**
 * One word per seat. `linkPending` marks a seat whose Link to Player ID request (025) is
 * waiting for the account owner's Yes: the status is 'pending' either way, so the screen
 * passes the open link requests it listed.
 */
export function registrationLabel(seat: Pick<SeatLike, 'status'>, linkPending = false): RegistrationLabel {
  if (seat.status === 'pending' && linkPending) return 'Link pending';
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

export type SeatMenuItem = 'invite' | 'link_id' | 'edit_initials' | 'edit_name' | 'make_admin' | 'remove_admin' | 'remove_player' | 'remove_from_list';

export type SeatMenu = { item: SeatMenuItem; enabled: boolean; reason?: string }[];

export const SEAT_MENU_ICON: Record<SeatMenuItem, string> = {
  invite: 'send-outline',
  link_id: 'link-variant',
  edit_initials: 'format-letter-case',
  edit_name: 'pencil-outline',
  make_admin: 'shield-plus-outline',
  remove_admin: 'shield-off-outline',
  remove_player: 'account-remove-outline',
  remove_from_list: 'account-minus-outline',
};

export const SEAT_MENU_LABEL: Record<SeatMenuItem, string> = {
  invite: 'Invite to register',
  link_id: 'Link to Player ID',
  edit_initials: 'Edit initials',
  edit_name: 'Edit name',
  make_admin: 'Make admin',
  remove_admin: 'Remove admin',
  remove_player: 'Remove from game',
  remove_from_list: 'Remove from My players',
};

const NOT_MINE = 'Only the organiser who added this player can change them.';
const ACCOUNT_DELETED = 'This account was deleted.';

/**
 * The unified per-player ⋮ menu (Nov 11 item 5), in this order everywhere:
 * Invite to register · Link to Player ID · Edit initials · (Edit name) · Make/Remove admin · Remove from game.
 * The identity actions appear only for an unregistered player, and work only for the organiser
 * who added them. The creator always stays admin. Edit initials changes this game's column
 * label (022). Remove from game is offered for every seated player; whether it is allowed (no
 * scores, or every round score exactly 0) is decided at the tap with the exact message from
 * utils/seatRemoval, after a confirmation.
 */
export function seatMenu(seat: SeatLike, game: GameLike, viewerId: string | null | undefined, canManage: boolean): SeatMenu {
  if (!canManage) return [];
  const isCreator = Boolean(game.createdBy) && seat.id === game.createdBy;
  const admin = isSeatAdmin(seat, game);
  const unregistered = isUnregistered(seat.status);
  const mine = Boolean(viewerId) && seat.managedBy === viewerId;
  const seatedPlayer = seat.seatRole !== 'spectator' && seat.seated !== false;
  const items: SeatMenu = [];
  if (unregistered) {
    const reason = mine ? undefined : NOT_MINE;
    items.push({ item: 'invite', enabled: mine, reason });
    items.push({ item: 'link_id', enabled: mine, reason });
  }
  if (seatedPlayer) items.push({ item: 'edit_initials', enabled: true });
  if (unregistered) items.push({ item: 'edit_name', enabled: mine, reason: mine ? undefined : NOT_MINE });
  if (seat.seatRole !== 'spectator') {
    if (admin) items.push({ item: 'remove_admin', enabled: !isCreator, reason: isCreator ? 'The creator is always an admin.' : undefined });
    else if (isDeletedStatus(seat.status)) items.push({ item: 'make_admin', enabled: false, reason: ACCOUNT_DELETED });
    else items.push({ item: 'make_admin', enabled: true });
  }
  if (seatedPlayer) items.push({ item: 'remove_player', enabled: true });
  return items;
}

/**
 * The same menu on My players, where there is no game: Invite · Link · Edit initials · Edit name
 * for my unregistered players, then Remove from My players. The owner's own row has no menu.
 */
export function myPlayerMenu(player: Pick<SeatLike, 'id' | 'status' | 'managedBy'>, viewerId: string | null | undefined): SeatMenu {
  if (!viewerId || player.id === viewerId) return [];
  const unregistered = isUnregistered(player.status);
  const mine = player.managedBy === viewerId;
  const items: SeatMenu = [];
  if (unregistered) {
    const reason = mine ? undefined : NOT_MINE;
    items.push({ item: 'invite', enabled: mine, reason });
    items.push({ item: 'link_id', enabled: mine, reason });
  }
  items.push({ item: 'edit_initials', enabled: true });
  if (unregistered) items.push({ item: 'edit_name', enabled: mine, reason: mine ? undefined : NOT_MINE });
  items.push({ item: 'remove_from_list', enabled: true });
  return items;
}

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

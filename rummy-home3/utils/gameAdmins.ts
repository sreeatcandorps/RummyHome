import { GameLike, isSeatAdmin, playerIdBadge, SeatLike } from '@/utils/gamePlayers';
import { PlayerStatus } from '@/utils/playerIdentity';

/**
 * Nov 10: a game can have admins who do not play. They are added by Player ID from the
 * Players/Admins page, never counted as a player, and listed as "Game admins" on the
 * game details and final scores.
 */

export const PLAYERS_ADMINS_TITLE = 'Players/Admins';

type GameForAdmins = GameLike & { closedAt?: string | null; isComplete?: boolean };

/** Why Add admin is off, or null when a game admin may add one (open or completed, not closed). */
export function addAdminBlockedReason(game: GameForAdmins, canScore: boolean): string | null {
  if (game.closedAt) return 'This game is Closed (it is part of a saved result). Admins can no longer be added.';
  if (!canScore) return 'Only a game admin can add admins.';
  return null;
}

type Target = { id: string; name?: string; status?: PlayerStatus; managedBy?: string } | null;

/** What stops the looked-up Player ID from becoming a non-player admin, or null when fine. */
export function addAdminProblem(target: Target, game: GameForAdmins): string | null {
  if (!target) return 'No registered player has that Player ID.';
  if (target.managedBy || (target.status && target.status !== 'registered')) return 'That Player ID is not a registered account.';
  if (game.createdBy === target.id) return 'That is the creator of this game, already an admin.';
  if (game.adminIds?.includes(target.id) || game.unseatedAdminIds?.includes(target.id)) return `${target.name ?? 'They'} ${target.name ? 'is' : 'are'} already an admin of this game.`;
  if (game.players.includes(target.id)) return `${target.name ?? 'They'} ${target.name ? 'is' : 'are'} playing in this game. Use their ⋮ menu to make them an admin.`;
  if (game.spectators?.includes(target.id)) return `${target.name ?? 'They'} ${target.name ? 'is' : 'are'} watching this game. Use their ⋮ menu to make them an admin.`;
  return null;
}

/** The sentence under a found Player ID before confirming. */
export function addAdminPreview(target: { name: string }): string {
  return `${target.name} can score and manage this game but is not a player: no score column, not counted in the player total.`;
}

export type GameAdminLine = { id: string; name: string; badge: string | null; role: 'Creator' | 'Admin'; playing: boolean };

/**
 * Everyone who runs the game, creator first, then seated admins, then admins who do not
 * play — each with their Player ID when known.
 */
export function gameAdminLines(roster: SeatLike[], game: GameLike): GameAdminLine[] {
  const seen = new Set<string>();
  const lines: GameAdminLine[] = [];
  const push = (seat: SeatLike) => {
    if (seen.has(seat.id) || seat.id === 'EX') return;
    seen.add(seat.id);
    lines.push({
      id: seat.id,
      name: seat.name,
      badge: playerIdBadge(seat),
      role: game.createdBy === seat.id ? 'Creator' : 'Admin',
      playing: seat.seatRole !== 'spectator' && seat.seated !== false,
    });
  };
  const creator = roster.find((seat) => seat.id === game.createdBy);
  if (creator) push(creator);
  roster.filter((seat) => isSeatAdmin(seat, game) && seat.seatRole !== 'spectator' && seat.seated !== false).forEach(push);
  roster.filter((seat) => isSeatAdmin(seat, game) && seat.seated === false).forEach(push);
  return lines;
}

/** "Sree Koneru · #39" lines for the final-scores picture. */
export function gameAdminTextLines(lines: GameAdminLine[]): string[] {
  return lines.map((line) => [line.name, line.badge].filter(Boolean).join(' · '));
}

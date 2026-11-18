/** Pure helpers for the scorecard's info footer (no React Native imports, so the unit tests can load it). */
import { gameLabelOf, LabelledGame } from '@/utils/gameLabel';

/**
 * The scorecard's bottom-right lines under the table: "Game S3", then "Creator Sree", then
 * "Admins Harish, Cora", each on its own line. Admins are game admins other than the creator
 * (seated or not). Pieces without a value drop out.
 */
export function gameOwnersLines(
  game: LabelledGame & { createdBy?: string | null },
  members: { id: string; name: string; seatRole?: string | null }[],
  creatorName?: string | null,
): string[] {
  const creator = creatorName ?? members.find((m) => m.id === game.createdBy)?.name ?? null;
  const admins = members.filter((m) => m.seatRole === 'game_admin' && m.id !== game.createdBy).map((m) => m.name);
  const label = gameLabelOf(game);
  return [
    label ? `Game ${label}` : null,
    creator ? `Creator ${creator}` : null,
    admins.length ? `${admins.length === 1 ? 'Admin' : 'Admins'} ${admins.join(', ')}` : null,
  ].filter((part): part is string => Boolean(part));
}

/** The same pieces joined on one line, for places that have a single line (tests, accessibility labels). */
export function gameOwnersLine(
  game: LabelledGame & { createdBy?: string | null },
  members: { id: string; name: string; seatRole?: string | null }[],
  creatorName?: string | null,
): string {
  return gameOwnersLines(game, members, creatorName).join(' · ');
}

export type OwnerPart = { label: string; value: string };

/** The same line as structured pieces so the names can be set in bold: Creator → Sree, Admins → Harish, Cora. */
export function gameOwnerParts(
  game: { createdBy?: string | null },
  members: { id: string; name: string; seatRole?: string | null }[],
  creatorName?: string | null,
): OwnerPart[] {
  const creator = creatorName ?? members.find((m) => m.id === game.createdBy)?.name ?? null;
  const admins = members.filter((m) => m.seatRole === 'game_admin' && m.id !== game.createdBy).map((m) => m.name);
  const parts: OwnerPart[] = [];
  if (creator) parts.push({ label: 'Creator', value: creator });
  if (admins.length) parts.push({ label: admins.length === 1 ? 'Admin' : 'Admins', value: admins.join(', ') });
  return parts;
}

import { GameDeletion, RestoreRequest } from '@/types/game';
import { formatWhenDay } from '@/utils/formatWhen';

/**
 * Going rogue (PR 20, migration 045): copy and small rules for deleted games that the people who
 * played in them can still see. Pure, so the unit tests pin the wording and the date math.
 */

/**
 * How long a deleted game stays under Deleted games (045 deleted_game_retention). After that the nightly
 * step (046) hides it for good — second-layer soft delete: off every user's screens, not restorable in
 * the app, kept in the database for support. Nothing is ever erased. `purge*` names below are the
 * 045 field names the server still sends (purge_at); they mean "hidden for good on".
 */
export const DELETED_GAME_RETENTION_DAYS = 30;

export const SUPPORT_EMAIL = 'support@ezscore.app';

export const DELETED_GAMES_TITLE = 'Deleted games';
export const DELETED_GAMES_SUPPORTING = `Games you scored in that an admin deleted. Read-only; hidden for good after ${DELETED_GAME_RETENTION_DAYS} days — nothing is erased.`;

export const ASK_RESTORE_LABEL = 'Ask an admin to restore';
export const RESTORE_GAME_LABEL = 'Restore game';
export const ASKED_TOAST = 'Asked. The creator and the admins have been told.';

/** The Settings › Hidden & deleted support card (G07, Q20.7). */
export const SUPPORT_CARD_TITLE = 'Can’t find a game?';
export const SUPPORT_CARD_BODY =
  `If the person who deleted it is gone and no admin is left, email ${SUPPORT_EMAIL} with the Unique game ID (at the foot of every scorecard). Nothing is ever erased: after the ${DELETED_GAME_RETENTION_DAYS} days the game is hidden from everyone, and support can still find it.`;

/** deletedAt + 30 days, as an ISO string; null when the stamp is unreadable. */
export function purgeDate(deletedAt: string | null | undefined, days: number = DELETED_GAME_RETENTION_DAYS): string | null {
  if (!deletedAt) return null;
  const date = new Date(deletedAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

/** Whole days from `now` to the purge, never below 0. */
export function daysUntilPurge(purgeAt: string | null | undefined, now: Date = new Date()): number | null {
  if (!purgeAt) return null;
  const date = new Date(purgeAt);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}

/** "2 days ago" / "today" / "yesterday" for the deletion stamp. */
export function agoLabel(value: string, now: Date = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const days = Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/** "hidden for good on Dec 14" / "hidden for good today" for the last day. */
export function hiddenForGoodLabel(purgeAt: string | null | undefined, now: Date = new Date()): string {
  const days = daysUntilPurge(purgeAt, now);
  if (days === null) return '';
  if (days === 0) return 'hidden for good today';
  return `hidden for good on ${formatWhenDay(purgeAt as string, now)}`;
}

/** The grey card's second line (G03): "Deleted by Harish · 2 days ago · hidden for good on Dec 14". */
export function deletedCardLine(deletion: Pick<GameDeletion, 'deletedAt' | 'deletedByName' | 'deletedByMe' | 'purgeAt'>, now: Date = new Date()): string {
  const who = deletion.deletedByMe ? 'you' : deletion.deletedByName;
  const parts = [`Deleted by ${who}`, agoLabel(deletion.deletedAt, now), hiddenForGoodLabel(deletion.purgeAt, now)].filter(Boolean);
  return parts.join(' · ');
}

/** The ask button for a player: "Ask an admin to restore" or "Asked · Nov 10" (one ask per person per game). */
export function askButton(myRequestAt: string | null | undefined, now: Date = new Date()): { label: string; disabled: boolean } {
  if (myRequestAt) return { label: `Asked · ${formatWhenDay(myRequestAt, now)}`, disabled: true };
  return { label: ASK_RESTORE_LABEL, disabled: false };
}

const joinNames = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** "Anil asked to restore it" / "Anil and Priya asked to restore it"; null when nobody asked. */
export function askedLine(requests: RestoreRequest[] | undefined, viewerId?: string | null): string | null {
  if (!requests?.length) return null;
  const names = requests.map((r) => (viewerId && r.profileId === viewerId ? 'You' : r.name));
  const first = names[0];
  const others = names.slice(1);
  return `${joinNames([first, ...others])} asked to restore it`;
}

/** The red banner's first line for a deleted game: who and when, and the day it is hidden for good. */
export function deletedBannerLine(deletion: Pick<GameDeletion, 'deletedAt' | 'deletedByName' | 'deletedByMe' | 'purgeAt'>, now: Date = new Date()): string {
  return `This game was deleted by ${deletion.deletedByMe ? 'you' : deletion.deletedByName} ${agoLabel(deletion.deletedAt, now)} · ${hiddenForGoodLabel(deletion.purgeAt, now)}`;
}

/** The 045 `deletion` object of a bundle (snake_case) as the app's GameDeletion. */
export function deletionFromRow(row: Record<string, any> | null | undefined): GameDeletion | undefined {
  if (!row || typeof row !== 'object' || !row.deleted_at) return undefined;
  const requests: RestoreRequest[] = Array.isArray(row.requests)
    ? row.requests
        .filter((r: any) => r && typeof r === 'object' && r.profile_id)
        .map((r: any) => ({ profileId: String(r.profile_id), name: typeof r.name === 'string' && r.name ? r.name : 'Rummy Player', requestedAt: String(r.requested_at ?? '') }))
    : [];
  return {
    deletedAt: String(row.deleted_at),
    deletedBy: row.deleted_by ? String(row.deleted_by) : null,
    deletedByName: typeof row.deleted_by_name === 'string' && row.deleted_by_name ? row.deleted_by_name : 'Rummy Player',
    deletedByMe: row.deleted_by_me === true,
    purgeAt: row.purge_at ? String(row.purge_at) : purgeDate(String(row.deleted_at)),
    canRestore: row.can_restore === true,
    myRequestAt: row.my_request_at ? String(row.my_request_at) : null,
    requests,
  };
}

/** One Home › Deleted games card (045 `deleted_games` row). */
export type DeletedHomeGame = {
  id: string;
  gameNumber: number | null;
  gameLabel: string | null;
  gameType: string;
  status: string;
  createdAt: string;
  playerCount: number;
  deletion: GameDeletion;
};

/** The Home bundle's `deleted_games` rows (045) as cards; rows without a deletion stamp are dropped. */
export function deletedHomeGamesFrom(rows: unknown): DeletedHomeGame[] {
  if (!Array.isArray(rows)) return [];
  const out: DeletedHomeGame[] = [];
  for (const row of rows as Record<string, any>[]) {
    if (!row || typeof row !== 'object' || !row.id) continue;
    const deletion = deletionFromRow(row);
    if (!deletion) continue;
    out.push({
      id: String(row.id),
      gameNumber: typeof row.game_number === 'number' ? row.game_number : null,
      gameLabel: typeof row.game_label === 'string' ? row.game_label : null,
      gameType: typeof row.game_type === 'string' ? row.game_type : 'stake',
      status: typeof row.status === 'string' ? row.status : 'active',
      createdAt: String(row.created_at ?? ''),
      playerCount: Number(row.player_count) || 0,
      deletion,
    });
  }
  return out;
}

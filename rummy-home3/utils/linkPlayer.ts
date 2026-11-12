import { gameLabelList, gameLabelOf } from '@/utils/gameLabel';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { isUnregistered, PendingLink } from '@/utils/playerIdentity';

/**
 * Link to Player ID (migration 025, as amended Nov 12): a request, not an immediate merge.
 * The organiser types only the Player ID; the account owner says Yes (email link or in-app)
 * before anything moves. Pure helpers here are shared by the screens, the local store and tests.
 */

/** Days a link request stays open. Mirrors public.link_request_days(). */
export const LINK_REQUEST_EXPIRY_DAYS = 7;

export type LinkConflict = { gameId: string; gameNumber: number | null; gameLabel?: string | null; creatorName: string | null; startedAt?: string | null };

/** What link_player_check answers; the local store builds the same shape. */
export type LinkPreview = {
  target: { id: string; name: string; playerNo: number | null };
  gameCount: number;
  gameNumbers: number[];
  /** 028: "S3", "P1" for the same games; the app shows these, never the bare numbers. */
  gameLabels: string[];
  conflicts: LinkConflict[];
  /** The full sentence when something blocks, else null. */
  conflictMessage: string | null;
  /** The request already open for this player, if any. */
  pending: { id: string; expiresAt: string; targetId: string | null; targetNo: number | null; targetName: string | null } | null;
};

/** What request_player_link answers. */
export type LinkRequestOutcome = {
  linkId: string;
  expiresAt: string;
  emailQueued: boolean;
  playerName: string;
  target: { id: string; name: string; playerNo: number | null };
  gameCount: number;
  gameNumbers: number[];
  gameLabels: string[];
};

/** What perform_player_link answers once the owner said Yes. */
export type LinkOutcome = {
  linkId: string | null;
  playerName: string;
  playerInitials?: string | null;
  target: { id: string; name: string; playerNo: number | null };
  movedGameIds: string[];
  movedGameNumbers: number[];
};

/** A request waiting for the signed-in account (list_link_requests_for_me). */
export type LinkRequestForMe = {
  id: string;
  ownerId: string;
  ownerName: string;
  playerId: string;
  playerName: string;
  playerInitials: string | null;
  targetNo: number | null;
  gameNumbers: number[];
  /** 028 labels of the same games ("S3"); what the card shows. */
  gameLabels: string[];
  gameCount: number;
  expiresAt: string;
  conflictMessage: string | null;
};

export const LINK_MENU_LABEL = 'Link to Player ID';
export const LINK_COMPLETE_TITLE = 'Linked';
export const LINK_REQUEST_SENT_TITLE = 'Request sent';
/** The registration tag while a request is open. */
export const LINK_PENDING_LABEL = 'Link pending';

const gameWord = (n: number) => (n === 1 ? 'game' : 'games');
const joinAnd = (parts: string[]) => (parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`);

/**
 * The one conflict sentence (same as public.link_conflict_message). Every blocking game is named
 * with its label, its creator and its start date (028 wording, same as link_conflict_message):
 *   Can't link yet. Game S3 (creator Sree Koneru, started Nov 12) has both R K and #11. In that
 *   game, clear one of their scores to zero and remove them from the game first.
 */
export function linkConflictSentence(playerName: string, targetNo: number | null, conflicts: LinkConflict[]): string | null {
  if (conflicts.length === 0) return null;
  const parts = conflicts.map((c) => `${gameLabelOf(c) ?? 'a game'} (creator ${c.creatorName || 'Player'}, started ${startedOn(c.startedAt)})`);
  const one = conflicts.length === 1;
  return `Can't link yet. ${one ? 'Game' : 'Games'} ${joinAnd(parts)} ${one ? 'has' : 'have'} both ${playerName} and #${targetNo ?? '?'}. In ${one ? 'that game' : 'those games'}, clear one of their scores to zero and remove them from the game first.`;
}

/** "Nov 12", the same as to_char(created_at, 'Mon FMDD') on the server. */
export function startedOn(iso: string | null | undefined): string {
  if (!iso) return 'earlier';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'earlier';
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()]} ${date.getDate()}`;
}

/** The sentence the Send request button is blocked with; the server's wording when it sent one. */
export function linkConflictMessage(preview: Pick<LinkPreview, 'conflictMessage'>): string | null {
  return preview.conflictMessage;
}

/** What the confirm step says before the request goes out. */
export function linkPreviewMessage(playerName: string, preview: Pick<LinkPreview, 'target' | 'gameCount'>): string {
  const no = preview.target.playerNo != null ? ` (#${preview.target.playerNo})` : '';
  const games = preview.gameCount === 0 ? `${playerName} is in no games yet; the link folds them into ${preview.target.name}'s account.`
    : `${playerName}'s seat and scores in ${preview.gameCount} ${gameWord(preview.gameCount)} move to ${preview.target.name}.`;
  return `${preview.target.name}${no} gets an email and an in-app request. Nothing moves until they say Yes. ${games}`;
}

/** The "Request sent" pop-up body. */
export function linkRequestSentMessage(outcome: Pick<LinkRequestOutcome, 'playerName' | 'target' | 'emailQueued'>): string {
  const no = outcome.target.playerNo != null ? ` (#${outcome.target.playerNo})` : '';
  const how = outcome.emailQueued ? 'an email and a request on their Home screen' : 'a request on their Home screen';
  return `${outcome.target.name}${no} gets ${how}. ${outcome.playerName} shows Link pending until they say Yes; the request expires in ${LINK_REQUEST_EXPIRY_DAYS} days and you can cancel it from the same menu.`;
}

/** The pending state inside the Link dialog. */
export function linkPendingMessage(pending: NonNullable<LinkPreview['pending']>): string {
  const who = pending.targetName ? `${pending.targetName}${pending.targetNo != null ? ` (#${pending.targetNo})` : ''}` : `#${pending.targetNo ?? '?'}`;
  return `Waiting for ${who} to say Yes. Expires ${new Date(pending.expiresAt).toLocaleDateString()}.`;
}

/** The one-time pop-up for the organiser: "Harish (HG) is now linked to #40." (same text the server stores). */
export function linkedNoticeText(playerName: string, initials: string | null | undefined, playerNo: number | null): string {
  return `${playerName}${initials ? ` (${initials})` : ''} is now linked to #${playerNo ?? '?'}.`;
}

/** The link-complete pop-up body (after Yes). */
export function linkCompleteMessage(outcome: LinkOutcome): string {
  return linkedNoticeText(outcome.playerName, outcome.playerInitials, outcome.target.playerNo);
}

/** The card on the account owner's Home: "Sree wants to link “Harish (HG)” to your Player ID #40." */
export function linkRequestPrompt(req: Pick<LinkRequestForMe, 'ownerName' | 'playerName' | 'playerInitials' | 'targetNo'>): string {
  const who = `${req.playerName}${req.playerInitials ? ` (${req.playerInitials})` : ''}`;
  return `${req.ownerName} wants to link “${who}” to your Player ID #${req.targetNo ?? '?'}.`;
}

export function linkRequestDetail(req: Pick<LinkRequestForMe, 'playerName' | 'gameCount' | 'gameLabels' | 'expiresAt'> & { gameNumbers?: number[] }): string {
  const games = gameLabelList(req.gameLabels);
  const move = req.gameCount === 0 ? `${req.playerName} is in no games yet.` : `Yes moves ${req.playerName}'s seats and scores in ${req.gameCount} ${gameWord(req.gameCount)}${games} to your account.`;
  return `${move} Expires ${new Date(req.expiresAt).toLocaleDateString()}.`;
}

// ---------- local prototype store (no Supabase): the same rules over the games on this phone ----------

export function localConflicts(player: Pick<Player, 'id'>, targetId: string, games: Game[], creatorNameOf: (id: string | undefined) => string | null): LinkConflict[] {
  return games
    .filter((game) => game.players.includes(player.id) && game.players.includes(targetId))
    .map((game) => ({ gameId: game.id, gameNumber: game.gameNumber ?? null, gameLabel: gameLabelOf(game), creatorName: creatorNameOf(game.createdBy), startedAt: game.date }));
}

export function localLinkPreview(player: Player, target: Player | null, games: Game[], open: PendingLink | null, creatorNameOf: (id: string | undefined) => string | null): LinkPreview {
  if (!target || target.managedBy || (target.status && target.status !== 'registered')) throw new Error('No registered player has that Player ID.');
  if (target.id === player.id) throw new Error('That is this same player.');
  if (!isUnregistered(player.status)) throw new Error('Only an unregistered player can be linked to a Player ID.');
  const mine = games.filter((game) => game.players.includes(player.id));
  const conflicts = localConflicts(player, target.id, games, creatorNameOf);
  return {
    target: { id: target.id, name: target.name, playerNo: target.playerNo ?? null },
    gameCount: mine.length,
    gameNumbers: mine.map((g) => g.gameNumber).filter((n): n is number => n != null).sort((a, b) => a - b),
    gameLabels: mine.map((g) => gameLabelOf(g)).filter((label): label is string => Boolean(label)),
    conflicts,
    conflictMessage: linkConflictSentence(player.name, target.playerNo ?? null, conflicts),
    pending: open ? { id: open.id, expiresAt: open.expiresAt, targetId: open.targetId ?? null, targetNo: open.targetNo ?? null, targetName: open.targetName ?? null } : null,
  };
}

/** Local prototype store: move every seat to the account (no conflicts, checked by the caller). */
export function localLinkedGame(game: Game, playerId: string, targetId: string): Game {
  const swap = (id: string) => (id === playerId ? targetId : id);
  const wasUnseatedAdmin = game.unseatedAdminIds?.includes(targetId) ?? false;
  return {
    ...game,
    players: game.players.map(swap),
    scores: Object.fromEntries(Object.entries(game.scores).map(([id, column]) => [swap(id), column])),
    adminIds: [...new Set([...(game.adminIds ?? []).map(swap), ...(wasUnseatedAdmin ? [targetId] : [])])],
    unseatedAdminIds: game.unseatedAdminIds?.filter((id) => id !== targetId && id !== playerId),
    spectators: game.spectators?.filter((id) => id !== targetId && id !== playerId),
  };
}

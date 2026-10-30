/**
 * Player identity model (Round 3).
 *
 * A "player" is a profile row. Registered players have an account and a
 * verified email. Unregistered players are created by a game creator (the
 * "manager") with just a name or initials; they live in that creator's
 * My players until the real person signs up and claims them.
 *
 * Email is the only key that ties an unregistered record to a person:
 * - stored lowercased and trimmed (normalizeEmail)
 * - unique across registered accounts
 * - an unregistered player can be "pending" under several creators at once
 *   (one PendingLink per creator + player). At sign-up every pending link with
 *   that email is offered to the new account and, once confirmed, merged.
 *
 * Everything here is pure so it can be unit tested and reused by the local
 * (no Supabase) store and the server RPCs, which follow the same rules.
 * To extend: add a status to PLAYER_STATUSES and a row to TRANSITIONS, or a
 * link status to LINK_STATUSES; nothing else needs to change shape.
 */

export const PLAYER_STATUSES = [
  'unregistered',
  /** Invited with an email that belongs to an existing account; waiting for that person's Yes. */
  'pending',
  'registered',
  'deleted_before_registering',
  'deleted_after_registering',
  /** Internal: an unregistered record that was claimed and folded into an account. */
  'merged',
] as const;
export type PlayerStatus = (typeof PLAYER_STATUSES)[number];

export const PLAYER_STATUS_LABEL: Record<PlayerStatus, string> = {
  unregistered: 'Unregistered',
  pending: 'Pending',
  registered: 'Registered',
  deleted_before_registering: 'Deleted before registering',
  deleted_after_registering: 'Deleted after registering',
  merged: 'Registered',
};

export type PlayerEvent =
  | 'register'
  | 'claim'
  /** Email matched a registered account: ask them first, never link instantly. */
  | 'request_existing'
  /** The registered person tapped Yes. */
  | 'accept'
  /** Not me, or the request expired: back to Unregistered, email cleared. */
  | 'decline'
  | 'expire'
  /** Creator undoes a wrong link: back to an Unregistered record, scores kept. */
  | 'unlink'
  | 'delete'
  | 'restore';

const TRANSITIONS: Record<PlayerStatus, Partial<Record<PlayerEvent, PlayerStatus>>> = {
  unregistered: { register: 'registered', claim: 'merged', request_existing: 'pending', delete: 'deleted_before_registering' },
  pending: { accept: 'merged', decline: 'unregistered', expire: 'unregistered', request_existing: 'pending', delete: 'deleted_before_registering' },
  registered: { delete: 'deleted_after_registering' },
  deleted_before_registering: { restore: 'unregistered' },
  deleted_after_registering: { restore: 'registered' },
  merged: { unlink: 'unregistered' },
};

export function nextStatus(status: PlayerStatus, event: PlayerEvent): PlayerStatus {
  const next = TRANSITIONS[status]?.[event];
  if (!next) throw new Error(`A ${PLAYER_STATUS_LABEL[status].toLowerCase()} player can't ${event}.`);
  return next;
}

export function canTransition(status: PlayerStatus, event: PlayerEvent): boolean {
  return Boolean(TRANSITIONS[status]?.[event]);
}

export const isDeletedStatus = (status?: PlayerStatus | null) =>
  status === 'deleted_before_registering' || status === 'deleted_after_registering' || status === 'merged';

export const isUnregistered = (status?: PlayerStatus | null) => status === 'unregistered' || status === 'pending';

/** Days a join request to an existing account stays open before the player goes back to Unregistered. */
export const REQUEST_EXPIRY_DAYS = 14;

// ---------- email ----------

export function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}

export function isValidEmail(raw: string | null | undefined): boolean {
  const email = normalizeEmail(raw);
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email) && email.length <= 254;
}

export const sameEmail = (a?: string | null, b?: string | null) =>
  Boolean(a && b) && normalizeEmail(a) === normalizeEmail(b);

// ---------- names ----------

export function newPlayerDisplayName(first: string, last: string): string {
  return [first.trim(), last.trim()].filter(Boolean).join(' ');
}

export function chipInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------- new game picker ----------

export type Candidate = {
  id: string;
  name: string;
  playerCode?: string;
  status?: PlayerStatus;
  /** Games this player has played in, counting only games the viewer created or ran. */
  totalGames: number;
  /** ISO time of the most recent such game. */
  lastPlayedAt?: string | null;
};

export const RECENT_WINDOW_DAYS = 14;
export const PICKER_PAGE = 10;
export const PICKER_PREFETCH = 100;

export function isRecent(lastPlayedAt: string | null | undefined, now: Date, days = RECENT_WINDOW_DAYS): boolean {
  if (!lastPlayedAt) return false;
  const t = Date.parse(lastPlayedAt);
  if (Number.isNaN(t)) return false;
  return now.getTime() - t <= days * 24 * 60 * 60 * 1000;
}

/**
 * 1. Played in the last 2 weeks, most games first.
 * 2. Everyone else, most games first.
 * Ties: most recent game, then name. Deleted players never show.
 */
export function sortCandidates<T extends Candidate>(players: T[], now: Date = new Date()): T[] {
  return players
    .filter((player) => !isDeletedStatus(player.status))
    .map((player) => ({ player, recent: isRecent(player.lastPlayedAt, now) }))
    .sort((a, b) => {
      if (a.recent !== b.recent) return a.recent ? -1 : 1;
      if (b.player.totalGames !== a.player.totalGames) return b.player.totalGames - a.player.totalGames;
      const at = a.player.lastPlayedAt ? Date.parse(a.player.lastPlayedAt) : 0;
      const bt = b.player.lastPlayedAt ? Date.parse(b.player.lastPlayedAt) : 0;
      if (bt !== at) return bt - at;
      return a.player.name.localeCompare(b.player.name);
    })
    .map(({ player }) => player);
}

/**
 * The grid shows the next `size` unselected players from the prefetched,
 * sorted list, so it refills as players are picked. The viewer is never in
 * the grid: they are always the first selected chip.
 */
export function pickerGrid<T extends { id: string }>(sorted: T[], selectedIds: string[], meId?: string | null, size = PICKER_PAGE): T[] {
  const taken = new Set(selectedIds);
  if (meId) taken.add(meId);
  return sorted.filter((player) => !taken.has(player.id)).slice(0, size);
}

/** Viewer first, then the order players were picked. */
export function seatedOrder(meId: string, selectedIds: string[]): string[] {
  return [meId, ...selectedIds.filter((id) => id !== meId)];
}

// ---------- add-new-players stepper ----------

export const MAX_NEW_PLAYERS_AT_ONCE = 5;
export const clampNewPlayerCount = (n: number) => Math.max(1, Math.min(MAX_NEW_PLAYERS_AT_ONCE, Math.round(n) || 1));

// ---------- pending links, claim and merge ----------

export const LINK_STATUSES = ['pending', 'claimed', 'declined', 'expired', 'cancelled', 'unlinked'] as const;
export type LinkStatus = (typeof LINK_STATUSES)[number];

/** One unregistered player that one creator invited with one email. */
export type PendingLink = {
  id: string;
  ownerId: string;
  ownerName?: string;
  playerId: string;
  playerName: string;
  email: string;
  status: LinkStatus;
  invitedAt: string;
  lastSentAt?: string | null;
  claimedBy?: string | null;
  /** Up to a few G-numbers the player was in, for the "Is this you?" prompt. */
  gameNumbers?: number[];
  /** 'signup': the email had no account yet. 'existing': it already belonged to a registered player. */
  kind?: 'signup' | 'existing';
  /** Games whose seats were moved to the account on Yes, so Unlink can move exactly those back. */
  movedGameIds?: string[];
};

export function upsertPendingLink(links: PendingLink[], input: Omit<PendingLink, 'status' | 'email' | 'invitedAt'> & { email: string; now?: string }): PendingLink[] {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) throw new Error('Enter a full email address.');
  const now = input.now ?? new Date().toISOString();
  const existing = links.find((link) => link.ownerId === input.ownerId && link.playerId === input.playerId && link.status === 'pending');
  if (existing) {
    return links.map((link) => (link === existing
      ? { ...link, email, playerName: input.playerName, lastSentAt: now, gameNumbers: input.gameNumbers ?? link.gameNumbers }
      : link));
  }
  const { now: _now, ...rest } = input;
  return [...links, { ...rest, email, status: 'pending', invitedAt: now, lastSentAt: now }];
}

/** Pending links a newly verified account may claim. Requires a verified email. */
export function claimableLinks(links: PendingLink[], accountEmail: string | null | undefined, emailVerified: boolean): PendingLink[] {
  if (!emailVerified || !accountEmail) return [];
  const email = normalizeEmail(accountEmail);
  return links.filter((link) => link.status === 'pending' && link.email === email);
}

export function claimPrompt(link: PendingLink): string {
  const games = (link.gameNumbers ?? []).slice(0, 3).map((n) => `G${n}`);
  const where = games.length ? ` in ${games.join(', ')}` : '';
  return `Is this you? You played${where} with ${link.ownerName || 'a friend'} as "${link.playerName}".`;
}

export type ClaimDecision = { linkId: string; accept: boolean };

export type MergeResult = {
  links: PendingLink[];
  /** Unregistered player id -> account id. Every score row and seat for the key moves to the value. */
  remap: Record<string, string>;
};

/**
 * Applies the account holder's answers. Accepted links become claimed and
 * their player is remapped to the account; declined ones stay with the
 * creator (status declined) so the creator can fix the email and resend.
 * When the same email is pending under several creators, each accepted link
 * merges into the same account, so the person ends up as one player.
 */
export function applyClaims(links: PendingLink[], accountId: string, accountEmail: string, decisions: ClaimDecision[]): MergeResult {
  const email = normalizeEmail(accountEmail);
  const byId = new Map(decisions.map((d) => [d.linkId, d.accept]));
  const remap: Record<string, string> = {};
  const next = links.map((link) => {
    if (!byId.has(link.id) || link.status !== 'pending' || link.email !== email) return link;
    if (byId.get(link.id)) {
      remap[link.playerId] = accountId;
      return { ...link, status: 'claimed' as const, claimedBy: accountId };
    }
    return { ...link, status: 'declined' as const };
  });
  // A player that was claimed through one link is claimed for every creator.
  const final = next.map((link) => (link.status === 'pending' && remap[link.playerId]
    ? { ...link, status: 'claimed' as const, claimedBy: accountId }
    : link));
  return { links: final, remap };
}

/** Rewrites player ids in a game's seats and score columns after a merge. */
export function gamesWithPlayer<G extends { id: string; players: string[] }>(games: G[], playerId: string): string[] {
  return games.filter((game) => game.players.includes(playerId)).map((game) => game.id);
}

export function remapGamePlayers<G extends { players: string[]; scores: Record<string, number[]>; adminIds?: string[] }>(game: G, remap: Record<string, string>): G {
  if (!game.players.some((id) => remap[id])) return game;
  const map = (id: string) => remap[id] ?? id;
  const players: string[] = [];
  game.players.map(map).forEach((id) => { if (!players.includes(id)) players.push(id); });
  const scores: Record<string, number[]> = {};
  Object.entries(game.scores).forEach(([id, values]) => {
    const target = map(id);
    scores[target] = scores[target] ? scores[target].map((v, i) => v + (values[i] ?? 0)) : values;
  });
  return { ...game, players, scores, adminIds: game.adminIds?.map(map) };
}

// ---------- invite text ----------

export const INVITE_MESSAGE =
  'Please download the app and register with your email ID and then mention that exact email ID there.';

export function inviteShareText(playerName: string, email: string, inviterName: string, appUrl: string): string {
  return `Hi ${playerName}, ${inviterName} added you to a Rummy game on EZ Score: Rummy. ${INVITE_MESSAGE}\n\nYour email ID: ${normalizeEmail(email)}\nGet the app: ${appUrl}`;
}

// ---------- sign-up optional fields ----------

export function normalizeZip(raw: string): string | null {
  const zip = raw.trim();
  if (!zip) return null;
  if (!/^\d{5}(-\d{4})?$/.test(zip)) throw new Error('Zip code should be 5 digits, like 94086.');
  return zip;
}

// ---------- the tricky case: linking to an existing registered account ----------

export const EXISTING_ACCOUNT_NOTICE =
  "This email belongs to a registered player. We'll send them a request to join your game.";

export function joinRequestPrompt(link: PendingLink): string {
  const g = link.gameNumbers?.[0];
  return `${link.ownerName || 'A friend'} added you to ${g ? `G${g}` : 'a game'}. Is this you?`;
}

/** What inviting an email does to an unregistered player. Never links instantly. */
export function inviteOutcome(status: PlayerStatus, emailBelongsToAccount: boolean): { status: PlayerStatus; kind: 'signup' | 'existing'; notice: string } {
  if (emailBelongsToAccount) {
    return { status: nextStatus(status, 'request_existing'), kind: 'existing', notice: EXISTING_ACCOUNT_NOTICE };
  }
  if (status !== 'unregistered' && status !== 'pending') nextStatus(status, 'claim');
  return {
    status: 'unregistered',
    kind: 'signup',
    notice: 'Invite ready. When they sign up with this exact email, they will be asked to confirm it is them.',
  };
}

export function isExpired(link: PendingLink, now: Date = new Date(), days = REQUEST_EXPIRY_DAYS): boolean {
  if (link.status !== 'pending' || link.kind !== 'existing') return false;
  const sent = Date.parse(link.lastSentAt || link.invitedAt);
  return !Number.isNaN(sent) && now.getTime() - sent > days * 86400000;
}

export type CreatorNotice = { ownerId: string; playerId: string; text: string };

/**
 * Not me or expiry: the link closes, the player goes back to Unregistered with
 * no email, and the creator is told. Scores never moved, so nothing else changes.
 */
export function closeRequest(link: PendingLink, reason: 'decline' | 'expire'): { link: PendingLink; playerStatus: PlayerStatus; clearEmail: true; notice: CreatorNotice } {
  if (link.status !== 'pending') throw new Error('This request is already closed.');
  const playerStatus = nextStatus(link.kind === 'existing' ? 'pending' : 'unregistered', reason === 'decline' ? 'decline' : 'expire');
  const text = reason === 'decline'
    ? `${link.playerName}: the person at ${link.email} said "Not me". ${link.playerName} is unregistered again. Check the email and register them again.`
    : `${link.playerName}: nobody answered the request sent to ${link.email}. ${link.playerName} is unregistered again.`;
  return {
    link: { ...link, status: reason === 'decline' ? 'declined' : 'expired' },
    playerStatus,
    clearEmail: true,
    notice: { ownerId: link.ownerId, playerId: link.playerId, text },
  };
}

/** Pending: the creator fixes the email (or just resends). Restarts the expiry clock. */
export function changeRequestEmail(link: PendingLink, email: string, now = new Date().toISOString()): PendingLink {
  if (link.status !== 'pending') throw new Error('Only a pending request can be changed.');
  const next = normalizeEmail(email);
  if (!isValidEmail(next)) throw new Error('Enter a full email address.');
  return { ...link, email: next, lastSentAt: now };
}

/**
 * Unlink a wrongly linked player. Moves the seats in movedGameIds back from
 * the account to the original unregistered record (same initials, no email).
 * Scores are never deleted, only re-linked.
 */
export function unlinkPlayer<G extends { id: string; players: string[]; scores: Record<string, number[]>; adminIds?: string[] }>(
  link: PendingLink,
  games: G[],
): { link: PendingLink; games: G[]; playerStatus: PlayerStatus } {
  if (link.status !== 'claimed' || !link.claimedBy) throw new Error('Only a linked player can be unlinked.');
  const moved = new Set(link.movedGameIds ?? []);
  const back = { [link.claimedBy]: link.playerId };
  return {
    link: { ...link, status: 'unlinked', email: '' },
    games: games.map((game) => (moved.has(game.id) ? remapGamePlayers(game, back) : game)),
    playerStatus: nextStatus('merged', 'unlink'),
  };
}

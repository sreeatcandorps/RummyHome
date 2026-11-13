import { GET_PAGE_URL } from './siteUrls';
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
  /** A claim link was shared, or someone asked to claim this player by ID. */
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
  /** Creator shared a claim link: Pending until someone uses it. */
  | 'share_link'
  /** Someone typed this player's ID at sign-up: Pending until the creator answers. */
  | 'request_claim'
  /** Yes on a claim link, or the creator approved an ID claim. Scores move to the account. */
  | 'accept'
  /** Not me, creator declined, link revoked, or 14 days passed: back to Unregistered. */
  | 'decline'
  | 'expire'
  | 'revoke'
  /** Creator undoes a wrong link: back to an Unregistered record, scores kept. */
  | 'unlink'
  | 'delete'
  | 'restore';

const TRANSITIONS: Record<PlayerStatus, Partial<Record<PlayerEvent, PlayerStatus>>> = {
  unregistered: { register: 'registered', share_link: 'pending', request_claim: 'pending', delete: 'deleted_before_registering' },
  pending: {
    share_link: 'pending', request_claim: 'pending', accept: 'merged',
    decline: 'unregistered', expire: 'unregistered', revoke: 'unregistered', delete: 'deleted_before_registering',
  },
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

/** Days a claim link or an ID claim request stays open. */
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

/** Both names are required. The stored name keeps what was typed; the app shows two initials. */
export function newPlayerDisplayName(first: string, last: string): string {
  const given = first.trim();
  const family = last.trim();
  if (!given || !family) return '';
  return `${given} ${family}`;
}

/** Two letters for a face chip: first + last initial, or the first two letters of one word. */
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

/**
 * New game list: the creator is offered first but never pre-selected, because
 * they may only be scoring. Then everyone else not yet picked, one page at a time.
 */
/** Everyone not yet seated, in the given order. The organizer is not pushed to the front. */
export function newGameGrid<T extends { id: string }>(sorted: T[], selectedIds: string[], size = PICKER_PAGE): T[] {
  const taken = new Set(selectedIds);
  const seen = new Set<string>();
  return sorted
    .filter((player) => {
      if (taken.has(player.id) || seen.has(player.id)) return false;
      seen.add(player.id);
      return true;
    })
    .slice(0, size);
}

/**
 * The organiser is one more candidate, but the server never counts them in the
 * "games together" stats, so by Frequent they sorted dead last and fell off the
 * ten-row page whenever the roster had more than ten people. They are pinned to
 * the top of the list instead, until they are seated or the search excludes them.
 */
export function pinOrganiser<T extends { id: string }>(grid: T[], organiser: T | null | undefined, selectedIds: readonly string[], matchesQuery = true): T[] {
  if (!organiser) return grid;
  const rest = grid.filter((candidate) => candidate.id !== organiser.id);
  if (selectedIds.includes(organiser.id) || !matchesQuery) return rest;
  return [organiser, ...rest];
}

export type CandidateSort = 'frequent' | 'name';

/** Frequent keeps sortCandidates' order (recent partners, then most games); Alphabetical is by name. */
export function orderCandidates<T extends { name: string }>(sorted: T[], sort: CandidateSort): T[] {
  if (sort === 'name') return [...sorted].sort((a, b) => a.name.localeCompare(b.name));
  return sorted;
}

/** Only the people tapped are seated, in the order they were tapped. */
export function newGameSeats(selectedIds: string[]): string[] {
  return selectedIds.filter((id, index) => selectedIds.indexOf(id) === index);
}

// ---------- add-new-players stepper ----------

export const MAX_NEW_PLAYERS_AT_ONCE = 5;
export const clampNewPlayerCount = (n: number) => Math.max(1, Math.min(MAX_NEW_PLAYERS_AT_ONCE, Math.round(n) || 1));

// ---------- public player IDs ----------

/** Player IDs are plain numbers shown as #1, #2... They are never used to sign in. */
export const formatPlayerNo = (n: number | null | undefined) => (n == null ? '' : `#${n}`);

/** Visible player ID from a profile row: #42 once 012 is applied, else the older code. */
export const displayPlayerId = (row: { public_player_no?: number | null; player_code?: string | null } | null | undefined) =>
  row?.public_player_no != null ? formatPlayerNo(row.public_player_no) : row?.player_code ?? undefined;

export function parsePlayerNo(raw: string): number | null {
  const t = raw.trim().replace(/^#/, '');
  if (!/^\d{1,12}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 ? n : null;
}

/** Next number in the sequence. Numbers are never reused, so this is past the highest ever issued. */
export const nextPlayerNo = (highestIssued: number) => Math.max(0, Math.floor(highestIssued)) + 1;

/** Backfill for existing players: oldest first gets #1. Mirrors the SQL backfill in 012. */
export function backfillPlayerNumbers<T extends { id: string; createdAt?: string | null; playerNo?: number | null }>(players: T[]): (T & { playerNo: number })[] {
  const highest = Math.max(0, ...players.map((p) => p.playerNo ?? 0));
  let next = highest;
  const missing = players
    .filter((p) => p.playerNo == null)
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id));
  const assigned = new Map(missing.map((p) => [p.id, ++next]));
  return players.map((p) => ({ ...p, playerNo: p.playerNo ?? (assigned.get(p.id) as number) }));
}

// ---------- claims ----------

export const CLAIM_KINDS = ['link', 'id_request', 'link_request'] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];
export const LINK_STATUSES = ['pending', 'claimed', 'declined', 'expired', 'revoked', 'unlinked'] as const;
export type LinkStatus = (typeof LINK_STATUSES)[number];

/**
 * One way to claim one unregistered player.
 * - 'link': the creator shared a secret single-use link. Only the hash is stored.
 * - 'id_request': someone typed the player ID at sign-up. The creator must approve.
 * - 'link_request': the creator typed an account's Player ID (025). The account owner must say Yes.
 * Two creators holding records for the same person: each is claimed through its own link or
 * request into the same account, so the person ends up as one player.
 */
export type PendingLink = {
  id: string;
  kind: ClaimKind;
  ownerId: string;
  ownerName?: string;
  playerId: string;
  playerName: string;
  playerNo?: number;
  status: LinkStatus;
  createdAt: string;
  expiresAt: string;
  /** sha-256 of the token, hex. Only for kind 'link'. */
  tokenHash?: string;
  /** For 'id_request': the account asking. */
  requesterId?: string;
  requesterName?: string;
  /** For 'link_request': the account asked to say Yes. */
  targetId?: string;
  targetNo?: number;
  targetName?: string;
  claimedBy?: string | null;
  gameNumbers?: number[];
  /** 028 labels ("S3") of the same games, when the server has them. */
  gameLabels?: string[];
  movedGameIds?: string[];
};

/** 'linked' is the one-time "Harish (HG) is now linked to #40." pop-up; everything else is a plain card. */
export type CreatorNotice = { ownerId: string; playerId: string; text: string; kind?: 'notice' | 'linked' };

export const TOKEN_BYTES = 32; // 256 bits, well over the 128-bit minimum.

export const toBase64Url = (bytes: Uint8Array) => {
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const isWellFormedToken = (token: string) => /^[A-Za-z0-9_-]{22,}$/.test(token);

const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * 86400000).toISOString();

export function isExpired(link: PendingLink, now: Date = new Date()): boolean {
  return link.status === 'pending' && Date.parse(link.expiresAt) <= now.getTime();
}

/**
 * Share (or re-share): a new token for this player. Any older pending link for the
 * same player is revoked, so only the newest link works.
 */
export function issueClaimLink(
  links: PendingLink[],
  input: { id: string; ownerId: string; ownerName?: string; playerId: string; playerName: string; playerNo?: number; tokenHash: string; gameNumbers?: number[] },
  now: string = new Date().toISOString(),
): PendingLink[] {
  const revoked = links.map((l) => (l.kind === 'link' && l.playerId === input.playerId && l.status === 'pending' ? { ...l, status: 'revoked' as const } : l));
  return [...revoked, { ...input, kind: 'link', status: 'pending', createdAt: now, expiresAt: addDays(now, REQUEST_EXPIRY_DAYS) }];
}

export function revokeClaimLinks(links: PendingLink[], playerId: string): PendingLink[] {
  return links.map((l) => (l.kind === 'link' && l.playerId === playerId && l.status === 'pending' ? { ...l, status: 'revoked' as const } : l));
}

/** Finds the live link for a token hash. Used, revoked or expired links never match. */
export function findClaimLink(links: PendingLink[], tokenHash: string, now: Date = new Date()): PendingLink | null {
  const link = links.find((l) => l.kind === 'link' && l.tokenHash === tokenHash);
  if (!link || link.status !== 'pending' || isExpired(link, now)) return null;
  return link;
}

export function claimPrompt(link: Pick<PendingLink, 'gameNumbers' | 'gameLabels' | 'ownerName'>): string {
  const games = (link.gameLabels ?? []).slice(0, 3);
  const count = link.gameLabels?.length ?? link.gameNumbers?.length ?? 0;
  const where = games.length ? games.join(', ') : count > 1 ? `${count} games` : 'a game';
  return `Is this you? You played in ${where} with ${link.ownerName || 'a friend'}`;
}

export function claimRequestPrompt(link: Pick<PendingLink, 'playerNo' | 'playerName'>): string {
  return `${formatPlayerNo(link.playerNo)} wants to claim ${link.playerName}. Approve?`;
}

// ID claim requests: rate limited per account.
export const ID_CLAIMS_PER_DAY = 5;

export function canRequestClaim(links: PendingLink[], requesterId: string, now: Date = new Date()): boolean {
  const since = now.getTime() - 86400000;
  return links.filter((l) => l.kind === 'id_request' && l.requesterId === requesterId && Date.parse(l.createdAt) > since).length < ID_CLAIMS_PER_DAY;
}

export function requestClaimById(
  links: PendingLink[],
  input: { id: string; requesterId: string; requesterName?: string; player: { id: string; name: string; playerNo?: number; managedBy?: string; status?: PlayerStatus }; ownerName?: string; gameNumbers?: number[] },
  now: string = new Date().toISOString(),
): { links: PendingLink[]; notice: CreatorNotice } {
  const { player } = input;
  if (!player.managedBy || (player.status !== 'unregistered' && player.status !== 'pending')) {
    throw new Error('That player ID is not waiting to be claimed.');
  }
  if (player.managedBy === input.requesterId) throw new Error("You can't claim your own player.");
  if (!canRequestClaim(links, input.requesterId, new Date(now))) throw new Error('Too many player ID requests today. Try again tomorrow.');
  if (links.some((l) => l.kind === 'id_request' && l.status === 'pending' && l.playerId === player.id && l.requesterId === input.requesterId)) {
    throw new Error('You already asked to claim this player.');
  }
  const link: PendingLink = {
    id: input.id, kind: 'id_request', ownerId: player.managedBy, ownerName: input.ownerName, playerId: player.id, playerName: player.name,
    playerNo: player.playerNo, requesterId: input.requesterId, requesterName: input.requesterName, status: 'pending',
    createdAt: now, expiresAt: addDays(now, REQUEST_EXPIRY_DAYS), gameNumbers: input.gameNumbers,
  };
  return { links: [...links, link], notice: { ownerId: player.managedBy, playerId: player.id, text: claimRequestPrompt(link) } };
}

/**
 * Yes on a link (by the new account) or Approve on an ID request (by the creator).
 * Single use: the link becomes claimed and can never match again.
 */
export function acceptClaim<G extends { id: string; players: string[]; scores: Record<string, number[]>; adminIds?: string[] }>(
  links: PendingLink[], linkId: string, accountId: string, games: G[], now: Date = new Date(),
): { links: PendingLink[]; games: G[]; playerStatus: PlayerStatus } {
  const link = links.find((l) => l.id === linkId);
  if (!link || link.status !== 'pending' || isExpired(link, now)) throw new Error('This claim is no longer valid.');
  if (link.kind === 'id_request' && link.requesterId !== accountId) throw new Error('This request belongs to another account.');
  if (link.kind === 'link_request' && link.targetId !== accountId) throw new Error('This request is for another account.');
  // Games where the account already has its own seat stay with the creator.
  const moved = games.filter((g) => g.players.includes(link.playerId) && !g.players.includes(accountId)).map((g) => g.id);
  const movedSet = new Set(moved);
  const remap = { [link.playerId]: accountId };
  return {
    links: links.map((l) => {
      if (l.id === link.id) return { ...l, status: 'claimed' as const, claimedBy: accountId, movedGameIds: moved };
      if (l.playerId === link.playerId && l.status === 'pending') return { ...l, status: 'revoked' as const };
      return l;
    }),
    games: games.map((g) => (movedSet.has(g.id) ? remapGamePlayers(g, remap) : g)),
    playerStatus: nextStatus('pending', 'accept'),
  };
}

/** Not me, Decline, or expiry. The player goes back to Unregistered; scores never moved. */
export function closeClaim(link: PendingLink, reason: 'decline' | 'expire'): { link: PendingLink; playerStatus: PlayerStatus; notice: CreatorNotice } {
  if (link.status !== 'pending') throw new Error('This request is already closed.');
  const text = reason === 'expire'
    ? `${link.playerName}: the ${link.kind === 'link' ? 'claim link' : link.kind === 'link_request' ? 'link request' : 'claim request'} expired. ${link.playerName} is unregistered again.`
    : link.kind === 'link'
      ? `${link.playerName}: the person who opened your link said "Not me". ${link.playerName} is still unregistered.`
      : `You declined the claim for ${link.playerName}. ${link.playerName} is still unregistered.`;
  return {
    link: { ...link, status: reason === 'expire' ? 'expired' : 'declined' },
    playerStatus: nextStatus('pending', reason),
    notice: { ownerId: link.ownerId, playerId: link.playerId, text },
  };
}

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

/** Wrong link: moves exactly the moved games back to the original unregistered record. Scores kept. */
export function unlinkPlayer<G extends { id: string; players: string[]; scores: Record<string, number[]>; adminIds?: string[] }>(
  link: PendingLink,
  games: G[],
): { link: PendingLink; games: G[]; playerStatus: PlayerStatus } {
  if (link.status !== 'claimed' || !link.claimedBy) throw new Error('Only a linked player can be unlinked.');
  const moved = new Set(link.movedGameIds ?? []);
  const back = { [link.claimedBy]: link.playerId };
  return {
    link: { ...link, status: 'unlinked' },
    games: games.map((game) => (moved.has(game.id) ? remapGamePlayers(game, back) : game)),
    playerStatus: nextStatus('merged', 'unlink'),
  };
}

// ---------- share text ----------

export function claimShareText(playerNo: number | undefined, url: string): string {
  const id = playerNo ? ` Your player ID is ${formatPlayerNo(playerNo)}.` : '';
  return `Join me on EZ Score: Rummy! Download the app and sign up using this link to see your scores.${id}\n${url}`;
}

export const CLAIM_LINK_BASE = GET_PAGE_URL;
export const claimUrl = (token: string, base = CLAIM_LINK_BASE) => `${base}?claim=${encodeURIComponent(token)}`;

// ---------- sign-up optional fields ----------

export function normalizeZip(raw: string): string | null {
  const zip = raw.trim();
  if (!zip) return null;
  if (!/^\d{5}(-\d{4})?$/.test(zip)) throw new Error('Zip code should be 5 digits, like 94086.');
  return zip;
}

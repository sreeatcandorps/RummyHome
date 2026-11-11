import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';
import * as Crypto from 'expo-crypto';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { playersService } from '@/services/players';
import { storage } from '@/utils/storage';
import { Player } from '@/types/player';
import { NOT_READY_MESSAGE } from '@/utils/notReady';
import {
  acceptClaim,
  Candidate,
  claimShareText,
  claimUrl,
  closeClaim,
  CreatorNotice,
  findClaimLink,
  formatPlayerNo,
  isDeletedStatus,
  isExpired,
  isUnregistered,
  issueClaimLink,
  isWellFormedToken,
  newPlayerDisplayName,
  nextPlayerNo,
  nextStatus,
  PendingLink,
  PICKER_PREFETCH,
  PlayerStatus,
  requestClaimById,
  revokeClaimLinks,
  sortCandidates,
  toBase64Url,
  TOKEN_BYTES,
  unlinkPlayer,
} from '@/utils/playerIdentity';

export const MIGRATION_012_HINT = NOT_READY_MESSAGE;

const LINKS_KEY = 'pendingPlayerLinks';
const NOTICES_KEY = 'creatorNotices';
const SEQ_KEY = 'playerNoSeq';
/** Set when the app was opened from a claim link, until the person answers. */
export const PENDING_TOKEN_KEY = 'pendingClaimToken';
/** Player ID typed at sign-up, sent as a claim request after the first sign-in. */
export const PENDING_PLAYER_NO_KEY = 'pendingClaimPlayerNo';

const missingRpc = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  const message = ((error as { message?: string })?.message ?? '').toLowerCase();
  return code === 'PGRST202' || code === '42883' || message.includes('could not find the function');
};

const rpc = async <T,>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (error) {
    if (missingRpc(error)) throw new Error(MIGRATION_012_HINT);
    throw error;
  }
  return data as T;
};
const first = (row: any) => (Array.isArray(row) ? row[0] : row);

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}
const writeJson = (key: string, value: unknown) => AsyncStorage.setItem(key, JSON.stringify(value));

export const sha256Hex = (text: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
export const newClaimToken = () => toBase64Url(Crypto.getRandomBytes(TOKEN_BYTES));

/** Local mode: next number in a sequence that never goes backwards. */
async function takeLocalPlayerNo(): Promise<number> {
  const players = await storage.getPlayers();
  const seq = Number(await AsyncStorage.getItem(SEQ_KEY)) || 0;
  const highest = Math.max(seq, ...players.map((p) => p.playerNo ?? 0));
  const no = nextPlayerNo(highest);
  await AsyncStorage.setItem(SEQ_KEY, String(no));
  return no;
}

const serverPlayer = (row: any): Player => ({
  id: row.id,
  name: row.display_name || 'Rummy Player',
  playerNo: row.public_player_no ?? undefined,
  playerCode: row.public_player_no != null ? formatPlayerNo(row.public_player_no) : row.player_code ?? undefined,
  firstName: row.first_name ?? undefined,
  lastName: row.last_name ?? undefined,
  status: (row.player_status ?? 'registered') as PlayerStatus,
  managedBy: row.managed_by ?? undefined,
  role: 'player',
});

const linkFromRow = (row: any): PendingLink => ({
  id: row.id,
  kind: row.kind === 'id_request' ? 'id_request' : 'link',
  ownerId: row.owner_id,
  ownerName: row.owner_name ?? undefined,
  playerId: row.player_id,
  playerName: row.player_name ?? 'Player',
  playerNo: row.public_player_no ?? row.player_no ?? undefined,
  status: row.status,
  createdAt: row.invited_at ?? row.created_at,
  expiresAt: row.expires_at,
  requesterId: row.requester_id ?? undefined,
  requesterName: row.requester_name ?? undefined,
  claimedBy: row.claimed_by,
  gameNumbers: row.game_numbers ?? [],
  movedGameIds: row.moved_game_ids ?? [],
});

async function setLocalStatus(playerId: string, status: PlayerStatus) {
  const players = await storage.getPlayers();
  const p = players.find((x) => x.id === playerId);
  if (p) await storage.updatePlayer({ ...p, status });
}

export type ShareResult = { notice: string; shared: boolean; message: string };

export const playerIdentityService = {
  // ---------- Add new players ----------

  async createNewPlayer(ownerId: string, firstName: string, lastName: string): Promise<Player> {
    const name = newPlayerDisplayName(firstName, lastName);
    if (!name) throw new Error('Type a first and last name.');
    if (isSupabaseConfigured) {
      const player = serverPlayer(first(await rpc<any>('create_unregistered_player', { p_first: firstName.trim(), p_last: lastName.trim() })));
      await playersService.addMyPlayer(ownerId, player).catch(() => {});
      return player;
    }
    const no = await takeLocalPlayerNo();
    const player: Player = {
      id: `np-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name, firstName: firstName.trim(), lastName: lastName.trim(),
      playerNo: no, playerCode: formatPlayerNo(no),
      status: 'unregistered', managedBy: ownerId, role: 'player',
    };
    await storage.addPlayer(player);
    await playersService.addMyPlayer(ownerId, player);
    return player;
  },

  async updateNewPlayer(ownerId: string, playerId: string, firstName: string, lastName: string): Promise<Player> {
    const name = newPlayerDisplayName(firstName, lastName);
    if (!name) throw new Error('Type a first and last name.');
    if (isSupabaseConfigured) {
      const player = serverPlayer(first(await rpc<any>('update_unregistered_player', { p_player_id: playerId, p_first: firstName.trim(), p_last: lastName.trim() })));
      await playersService.addMyPlayer(ownerId, player).catch(() => {});
      return player;
    }
    const players = await storage.getPlayers();
    const found = players.find((p) => p.id === playerId && p.managedBy === ownerId);
    if (!found || !isUnregistered(found.status)) throw new Error('Only your unregistered players can be edited.');
    const next = { ...found, name, firstName: firstName.trim(), lastName: lastName.trim() };
    await storage.updatePlayer(next);
    await playersService.addMyPlayer(ownerId, next);
    return next;
  },

  /**
   * Hand an unregistered seat in one game to a registered account found by its
   * Player ID. Seat order and scores in that game stay with the seat. Needs
   * migration 015 on the server.
   */
  async linkSeatToPlayer(gameId: string, seat: Player, target: Player, ownerId: string): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await (supabase.rpc as any)('link_seat_to_player', { p_game_id: gameId, p_seat_profile: seat.id, p_target_profile: target.id });
      if (error) {
        if (missingRpc(error)) throw new Error('Linking to a Player ID needs a database update (migration 015) before it works here.');
        throw error;
      }
      return;
    }
    const games = await storage.getGames();
    const game = games.find((g) => g.id === gameId);
    if (!game) throw new Error('Game not found.');
    if (!game.players.includes(seat.id)) throw new Error('That player is not in this game.');
    if (game.players.includes(target.id)) throw new Error('They are already playing in this game.');
    if (seat.managedBy !== ownerId) throw new Error('Only the organiser who added this player can change them.');
    if (!isUnregistered(seat.status)) throw new Error('Only an unregistered player can be linked to a Player ID.');
    const swap = (id: string) => (id === seat.id ? target.id : id);
    const scores = Object.fromEntries(Object.entries(game.scores).map(([id, column]) => [swap(id), column]));
    // A non-playing admin or viewer who takes the seat is now seated: one membership, admin role kept.
    const wasUnseatedAdmin = game.unseatedAdminIds?.includes(target.id) ?? false;
    await storage.updateGame({
      ...game,
      players: game.players.map(swap),
      adminIds: [...new Set([...(game.adminIds ?? []).map(swap), ...(wasUnseatedAdmin ? [target.id] : [])])],
      unseatedAdminIds: game.unseatedAdminIds?.filter((id) => id !== target.id && id !== seat.id),
      spectators: game.spectators?.filter((id) => id !== target.id && id !== seat.id),
      scores,
    });
    const elsewhere = games.some((g) => g.id !== gameId && g.players.includes(seat.id));
    if (!elsewhere) await setLocalStatus(seat.id, 'merged');
    if (target.id !== ownerId) await playersService.addMyPlayer(ownerId, target).catch(() => {});
  },

  /** Soft delete. Past scores stay; the player leaves My players; any claim link stops working. */
  async deleteNewPlayer(ownerId: string, playerId: string): Promise<void> {
    if (isSupabaseConfigured) {
      await rpc('delete_unregistered_player', { p_player_id: playerId });
      await playersService.removeMyPlayer(ownerId, playerId).catch(() => {});
      return;
    }
    const players = await storage.getPlayers();
    const found = players.find((p) => p.id === playerId && p.managedBy === ownerId);
    if (!found) throw new Error('Player not found.');
    await storage.updatePlayer({ ...found, status: nextStatus(found.status ?? 'unregistered', 'delete') });
    const links = await readJson<PendingLink[]>(LINKS_KEY, []);
    await writeJson(LINKS_KEY, links.map((l) => (l.playerId === playerId && l.status === 'pending' ? { ...l, status: 'revoked' as const } : l)));
    await playersService.removeMyPlayer(ownerId, playerId);
  },

  // ---------- New game picker ----------

  async listCandidates(ownerId: string, now = new Date()): Promise<Candidate[]> {
    if (isSupabaseConfigured) {
      try {
        const rows = await rpc<any[]>('list_new_game_candidates', { p_limit: PICKER_PREFETCH });
        return sortCandidates((rows ?? []).map((row) => ({
          id: row.id,
          name: row.display_name || 'Rummy Player',
          playerCode: row.player_code ?? undefined,
          status: row.player_status ?? 'registered',
          totalGames: row.total_games ?? 0,
          lastPlayedAt: row.last_played_at ?? null,
        })), now).slice(0, PICKER_PREFETCH);
      } catch (error) {
        // 011/012 are not on the server yet. My players (007) still loads, so
        // New game can search and pick from that list instead of going blank.
        if (!(error instanceof Error) || error.message !== NOT_READY_MESSAGE) throw error;
        const mine = await playersService.listMyPlayers(ownerId);
        return sortCandidates(mine.filter((player) => player.id !== ownerId).map((player) => ({
          id: player.id,
          name: player.name,
          playerCode: player.playerCode,
          status: player.status,
          totalGames: player.gamesTogether ?? 0,
          lastPlayedAt: null,
        })), now).slice(0, PICKER_PREFETCH);
      }
    }
    const games = (await storage.getGames()).filter((g) => g.createdBy === ownerId || g.adminIds?.includes(ownerId));
    const [players, roster] = await Promise.all([storage.getPlayers(), playersService.readMyPlayers(ownerId)]);
    const byId = new Map(players.map((p) => [p.id, p]));
    const stats = new Map<string, { total: number; last: string | null }>();
    games.forEach((game) => game.players.forEach((id) => {
      if (id === ownerId || id === 'EX') return;
      const s = stats.get(id) ?? { total: 0, last: null };
      s.total += 1;
      if (!s.last || game.date > s.last) s.last = game.date;
      stats.set(id, s);
    }));
    roster.forEach((p) => { if (!stats.has(p.id) && p.id !== ownerId) stats.set(p.id, { total: 0, last: null }); });
    const list: Candidate[] = [...stats.entries()].map(([id, s]) => {
      const p = byId.get(id) ?? roster.find((r) => r.id === id);
      return { id, name: p?.name ?? 'Rummy Player', playerCode: p?.playerCode, status: p?.status, totalGames: s.total, lastPlayedAt: s.last };
    });
    return sortCandidates(list, now).slice(0, PICKER_PREFETCH);
  },

  // ---------- Register players (creator side) ----------

  async listUnregistered(ownerId: string, gameId?: string): Promise<Player[]> {
    if (isSupabaseConfigured) return ((await rpc<any[]>('list_my_unregistered_players', { p_game_id: gameId ?? null })) ?? []).map(serverPlayer);
    await this.expireOld(ownerId);
    const [players, games] = await Promise.all([storage.getPlayers(), storage.getGames()]);
    const game = gameId ? games.find((g) => g.id === gameId) : null;
    return players.filter((p) => p.managedBy === ownerId && isUnregistered(p.status) && (!game || game.players.includes(p.id)));
  },

  async listLinked(ownerId: string): Promise<PendingLink[]> {
    if (isSupabaseConfigured) return ((await rpc<any[]>('list_my_player_links')) ?? []).map(linkFromRow).filter((l) => l.status === 'claimed');
    return (await readJson<PendingLink[]>(LINKS_KEY, [])).filter((l) => l.ownerId === ownerId && l.status === 'claimed');
  },

  /** Live claim link (not the token, only that one exists) per player. */
  async listOpenLinks(ownerId: string): Promise<PendingLink[]> {
    if (isSupabaseConfigured) return ((await rpc<any[]>('list_my_player_links')) ?? []).map(linkFromRow).filter((l) => l.status === 'pending' && l.kind === 'link');
    return (await readJson<PendingLink[]>(LINKS_KEY, [])).filter((l) => l.ownerId === ownerId && l.kind === 'link' && l.status === 'pending' && !isExpired(l));
  },

  /**
   * Makes a new single-use claim link (invalidating any older one) and opens the
   * share sheet. The token exists only in this message; only its hash is stored.
   */
  async shareClaimLink(owner: Player, player: Player, gameNumbers: number[] = []): Promise<ShareResult> {
    let token: string;
    if (isSupabaseConfigured) {
      token = first(await rpc<any>('create_claim_link', { p_player_id: player.id, p_game_numbers: gameNumbers }))?.token;
      if (!token) throw new Error('Couldn’t make a link. Try again.');
    } else {
      token = newClaimToken();
      const links = await readJson<PendingLink[]>(LINKS_KEY, []);
      await writeJson(LINKS_KEY, issueClaimLink(links, {
        id: `link-${Date.now()}`, ownerId: owner.id, ownerName: owner.name, playerId: player.id, playerName: player.name,
        playerNo: player.playerNo, tokenHash: await sha256Hex(token), gameNumbers,
      }));
      await setLocalStatus(player.id, nextStatus(player.status ?? 'unregistered', 'share_link'));
    }
    const message = claimShareText(player.playerNo, claimUrl(token));
    try {
      const result = await Share.share({ message });
      const shared = (result as any)?.action !== 'dismissedAction';
      return { notice: shared ? `Link shared for ${player.name}. It works once and expires in 14 days.` : 'Link made but not sent. Tap Share again any time (that makes a new link).', shared, message };
    } catch {
      return { notice: 'Sharing isn’t available here. Copy this message:', shared: false, message };
    }
  },

  async revokeClaimLink(ownerId: string, playerId: string): Promise<void> {
    if (isSupabaseConfigured) { await rpc('revoke_claim_link', { p_player_id: playerId }); return; }
    const links = await readJson<PendingLink[]>(LINKS_KEY, []);
    await writeJson(LINKS_KEY, revokeClaimLinks(links, playerId));
    const stillPending = links.some((l) => l.playerId === playerId && l.kind === 'id_request' && l.status === 'pending');
    if (!stillPending) await setLocalStatus(playerId, 'unregistered');
  },

  /** ID claim requests waiting for this creator: "#42 wants to claim R K. Approve?" */
  async listClaimRequests(ownerId: string): Promise<PendingLink[]> {
    if (isSupabaseConfigured) return ((await rpc<any[]>('list_claim_requests')) ?? []).map(linkFromRow);
    await this.expireOld(ownerId);
    return (await readJson<PendingLink[]>(LINKS_KEY, [])).filter((l) => l.ownerId === ownerId && l.kind === 'id_request' && l.status === 'pending');
  },

  async answerClaimRequest(ownerId: string, link: PendingLink, approve: boolean): Promise<void> {
    if (isSupabaseConfigured) { await rpc('answer_claim_request', { p_link_id: link.id, p_approve: approve }); return; }
    const links = await readJson<PendingLink[]>(LINKS_KEY, []);
    if (!approve) {
      const closed = closeClaim(link, 'decline');
      await writeJson(LINKS_KEY, links.map((l) => (l.id === link.id ? closed.link : l)));
      const others = links.some((l) => l.id !== link.id && l.playerId === link.playerId && l.status === 'pending');
      if (!others) await setLocalStatus(link.playerId, closed.playerStatus);
      return;
    }
    await this.acceptLocal(links, link, link.requesterId as string, ownerId);
  },

  async acceptLocal(links: PendingLink[], link: PendingLink, accountId: string, ownerId: string) {
    const games = await storage.getGames();
    const result = acceptClaim(links, link.id, accountId, games);
    await writeJson(LINKS_KEY, result.links);
    await storage.saveGames(result.games);
    await setLocalStatus(link.playerId, result.playerStatus);
    const players = await storage.getPlayers();
    const account = players.find((p) => p.id === accountId);
    if (account) await playersService.addMyPlayer(ownerId, account).catch(() => {});
    await playersService.removeMyPlayer(ownerId, link.playerId).catch(() => {});
  },

  async unlink(ownerId: string, link: PendingLink): Promise<void> {
    if (isSupabaseConfigured) { await rpc('unlink_player', { p_link_id: link.id }); return; }
    const [links, games, players] = await Promise.all([readJson<PendingLink[]>(LINKS_KEY, []), storage.getGames(), storage.getPlayers()]);
    const result = unlinkPlayer(link, games);
    await writeJson(LINKS_KEY, links.map((l) => (l.id === link.id ? result.link : l)));
    await storage.saveGames(result.games);
    const original = players.find((p) => p.id === link.playerId);
    if (original) {
      await storage.updatePlayer({ ...original, status: result.playerStatus });
      await playersService.addMyPlayer(ownerId, original);
    }
    if (link.claimedBy) await playersService.removeMyPlayer(ownerId, link.claimedBy).catch(() => {});
  },

  // ---------- claimant side ----------

  async rememberClaimToken(token: string) {
    if (isWellFormedToken(token)) await AsyncStorage.setItem(PENDING_TOKEN_KEY, token);
  },

  /** The claim link this phone opened, if it is still valid. */
  async peekPendingClaim(): Promise<(PendingLink & { token: string }) | null> {
    const token = await AsyncStorage.getItem(PENDING_TOKEN_KEY);
    if (!token) return null;
    if (isSupabaseConfigured) {
      const row = first(await rpc<any>('peek_claim_link', { p_token: token }).catch(() => null));
      if (!row) { await AsyncStorage.removeItem(PENDING_TOKEN_KEY); return null; }
      return { ...linkFromRow(row), token };
    }
    const link = findClaimLink(await readJson<PendingLink[]>(LINKS_KEY, []), await sha256Hex(token));
    if (!link) { await AsyncStorage.removeItem(PENDING_TOKEN_KEY); return null; }
    return { ...link, token };
  },

  /** Yes links the player's scores to this account (single use). Not me leaves the player unregistered. */
  async answerClaimLink(me: Player, claim: PendingLink & { token: string }, accept: boolean): Promise<void> {
    try {
      if (isSupabaseConfigured) {
        await rpc('answer_claim_link', { p_token: claim.token, p_accept: accept });
        return;
      }
      const links = await readJson<PendingLink[]>(LINKS_KEY, []);
      const link = findClaimLink(links, await sha256Hex(claim.token));
      if (!link) throw new Error('This link was already used or has expired.');
      if (!accept) {
        const closed = closeClaim(link, 'decline');
        await writeJson(LINKS_KEY, links.map((l) => (l.id === link.id ? closed.link : l)));
        await setLocalStatus(link.playerId, closed.playerStatus);
        await this.notify(closed.notice);
        return;
      }
      await this.acceptLocal(links, link, me.id, link.ownerId);
    } finally {
      await AsyncStorage.removeItem(PENDING_TOKEN_KEY);
    }
  },

  /** Player ID typed at sign-up with no link: ask the creator. Rate limited per account. */
  async requestClaimByPlayerNo(me: Player, playerNo: number): Promise<string> {
    if (isSupabaseConfigured) {
      await rpc('request_claim_by_player_no', { p_player_no: playerNo });
      return `Request sent. The person who added ${formatPlayerNo(playerNo)} will approve it.`;
    }
    const [players, links, games] = await Promise.all([storage.getPlayers(), readJson<PendingLink[]>(LINKS_KEY, []), storage.getGames()]);
    const player = players.find((p) => p.playerNo === playerNo && !isDeletedStatus(p.status));
    if (!player) throw new Error(`No player ${formatPlayerNo(playerNo)} is waiting to be claimed.`);
    const owner = players.find((p) => p.id === player.managedBy);
    const gameNumbers = games.filter((g) => g.players.includes(player.id)).map((g) => g.gameNumber).filter((n): n is number => n != null);
    const out = requestClaimById(links, {
      id: `req-${Date.now()}`, requesterId: me.id, requesterName: me.name, ownerName: owner?.name, gameNumbers,
      player: { id: player.id, name: player.name, playerNo: player.playerNo, managedBy: player.managedBy, status: player.status },
    });
    await writeJson(LINKS_KEY, out.links);
    await setLocalStatus(player.id, nextStatus(player.status ?? 'unregistered', 'request_claim'));
    return `Request sent. ${owner?.name ?? 'The person who added you'} will approve it.`;
  },

  /** After the first sign-in: send the ID claim typed at sign-up, if any. */
  async flushPendingPlayerNo(me: Player): Promise<string | null> {
    const raw = await AsyncStorage.getItem(PENDING_PLAYER_NO_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(PENDING_PLAYER_NO_KEY);
    try { return await this.requestClaimByPlayerNo(me, Number(raw)); } catch (e) { return e instanceof Error ? e.message : null; }
  },

  // ---------- expiry and notices ----------

  async expireOld(ownerId: string, now = new Date()): Promise<void> {
    if (isSupabaseConfigured) return;
    const links = await readJson<PendingLink[]>(LINKS_KEY, []);
    const stale = links.filter((l) => l.ownerId === ownerId && isExpired(l, now));
    if (!stale.length) return;
    let next = links;
    for (const link of stale) {
      const closed = closeClaim(link, 'expire');
      next = next.map((l) => (l.id === link.id ? closed.link : l));
      if (!next.some((l) => l.playerId === link.playerId && l.status === 'pending')) await setLocalStatus(link.playerId, closed.playerStatus);
      await this.notify(closed.notice);
    }
    await writeJson(LINKS_KEY, next);
  },

  async notify(notice: CreatorNotice): Promise<void> {
    const all = await readJson<CreatorNotice[]>(NOTICES_KEY, []);
    await writeJson(NOTICES_KEY, [...all, notice]);
  },

  async takeNotices(ownerId: string): Promise<CreatorNotice[]> {
    if (isSupabaseConfigured) return ((await rpc<any[]>('take_creator_notices').catch(() => [])) ?? []).map((r: any) => ({ ownerId, playerId: r.player_id, text: r.text }));
    const all = await readJson<CreatorNotice[]>(NOTICES_KEY, []);
    await writeJson(NOTICES_KEY, all.filter((n) => n.ownerId !== ownerId));
    return all.filter((n) => n.ownerId === ownerId);
  },
};

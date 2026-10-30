import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Share } from 'react-native';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { playersService } from '@/services/players';
import { sendAppEmail } from '@/services/mail';
import { storage } from '@/utils/storage';
import { Player } from '@/types/player';
import { Game } from '@/types/game';
import { INVITE_URL } from '@/utils/inviteLink';
import {
  applyClaims,
  Candidate,
  changeRequestEmail,
  closeRequest,
  CreatorNotice,
  gamesWithPlayer,
  inviteOutcome,
  inviteShareText,
  isDeletedStatus,
  isExpired,
  isUnregistered,
  isValidEmail,
  newPlayerDisplayName,
  nextStatus,
  normalizeEmail,
  PendingLink,
  PICKER_PREFETCH,
  PlayerStatus,
  remapGamePlayers,
  sortCandidates,
  unlinkPlayer,
  upsertPendingLink,
} from '@/utils/playerIdentity';

export const MIGRATION_011_HINT =
  'This needs the latest database update. Run supabase/migrations/011_player_identity.sql in the Supabase SQL editor, then try again.';

const LINKS_KEY = 'pendingPlayerLinks';
const NOTICES_KEY = 'creatorNotices';

const missingRpc = (error: unknown) => {
  const code = (error as { code?: string })?.code;
  const message = ((error as { message?: string })?.message ?? '').toLowerCase();
  return code === 'PGRST202' || code === '42883' || message.includes('could not find the function');
};

const rpc = async <T,>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (error) {
    if (missingRpc(error)) throw new Error(MIGRATION_011_HINT);
    throw error;
  }
  return data as T;
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}
const writeJson = (key: string, value: unknown) => AsyncStorage.setItem(key, JSON.stringify(value));

const localCode = () => `P${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

const serverPlayer = (row: any): Player => ({
  id: row.id,
  name: row.display_name || 'Rummy Player',
  playerCode: row.player_code ?? undefined,
  firstName: row.first_name ?? undefined,
  lastName: row.last_name ?? undefined,
  status: (row.player_status ?? 'registered') as PlayerStatus,
  managedBy: row.managed_by ?? undefined,
  inviteEmail: row.invite_email ?? undefined,
  role: 'player',
});

const linkFromRow = (row: any): PendingLink => ({
  id: row.id,
  ownerId: row.owner_id,
  ownerName: row.owner_name ?? undefined,
  playerId: row.player_id,
  playerName: row.player_name ?? 'Player',
  email: row.email,
  status: row.status,
  kind: row.kind ?? 'signup',
  invitedAt: row.invited_at,
  lastSentAt: row.last_sent_at,
  claimedBy: row.claimed_by,
  gameNumbers: row.game_numbers ?? [],
  movedGameIds: row.moved_game_ids ?? [],
});

async function myGames(ownerId: string): Promise<Game[]> {
  const games = await storage.getGames();
  return games.filter((game) => game.createdBy === ownerId || game.adminIds?.includes(ownerId));
}

export type InviteResult = { status: PlayerStatus; notice: string; shared: 'email' | 'share-sheet' | 'none' };

export const playerIdentityService = {
  // ---------- Add new players (saved one row at a time) ----------

  async createNewPlayer(ownerId: string, first: string, last: string): Promise<Player> {
    const name = newPlayerDisplayName(first, last);
    if (!name) throw new Error('Type a name or initials.');
    if (isSupabaseConfigured) {
      const row = await rpc<any>('create_unregistered_player', { p_first: first.trim(), p_last: last.trim() });
      const player = serverPlayer(Array.isArray(row) ? row[0] : row);
      await playersService.addMyPlayer(ownerId, player).catch(() => {});
      return player;
    }
    const player: Player = {
      id: `np-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      firstName: first.trim(),
      lastName: last.trim(),
      playerCode: localCode(),
      status: 'unregistered',
      managedBy: ownerId,
      role: 'player',
    };
    await storage.addPlayer(player);
    await playersService.addMyPlayer(ownerId, player);
    return player;
  },

  async updateNewPlayer(ownerId: string, playerId: string, first: string, last: string): Promise<Player> {
    const name = newPlayerDisplayName(first, last);
    if (!name) throw new Error('Type a name or initials.');
    if (isSupabaseConfigured) {
      const row = await rpc<any>('update_unregistered_player', { p_player_id: playerId, p_first: first.trim(), p_last: last.trim() });
      const player = serverPlayer(Array.isArray(row) ? row[0] : row);
      await playersService.addMyPlayer(ownerId, player).catch(() => {});
      return player;
    }
    const players = await storage.getPlayers();
    const found = players.find((p) => p.id === playerId && p.managedBy === ownerId);
    if (!found || !isUnregistered(found.status)) throw new Error('Only your unregistered players can be edited.');
    const next = { ...found, name, firstName: first.trim(), lastName: last.trim() };
    await storage.updatePlayer(next);
    await playersService.addMyPlayer(ownerId, next);
    return next;
  },

  /** Soft delete. Past scores stay; the player disappears from My players. */
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
    await writeJson(LINKS_KEY, links.map((l) => (l.playerId === playerId && l.status === 'pending' ? { ...l, status: 'cancelled' } : l)));
    await playersService.removeMyPlayer(ownerId, playerId);
  },

  // ---------- New game picker ----------

  /** Top 100 from games this user created or ran, sorted (last 2 weeks first, then total games). */
  async listCandidates(ownerId: string, now = new Date()): Promise<Candidate[]> {
    if (isSupabaseConfigured) {
      const rows = await rpc<any[]>('list_new_game_candidates', { p_limit: PICKER_PREFETCH });
      return sortCandidates((rows ?? []).map((row) => ({
        id: row.id,
        name: row.display_name || 'Rummy Player',
        playerCode: row.player_code ?? undefined,
        status: row.player_status ?? 'registered',
        totalGames: row.total_games ?? 0,
        lastPlayedAt: row.last_played_at ?? null,
      })), now).slice(0, PICKER_PREFETCH);
    }
    const [games, players, roster] = await Promise.all([myGames(ownerId), storage.getPlayers(), playersService.readMyPlayers(ownerId)]);
    const byId = new Map(players.map((p) => [p.id, p]));
    const stats = new Map<string, { total: number; last: string | null }>();
    games.forEach((game) => game.players.forEach((id) => {
      if (id === ownerId || id === 'EX') return;
      const s = stats.get(id) ?? { total: 0, last: null };
      s.total += 1;
      if (!s.last || game.date > s.last) s.last = game.date;
      stats.set(id, s);
    }));
    // My players added by hand (or just created) show even before their first game.
    roster.forEach((p) => { if (!stats.has(p.id) && p.id !== ownerId) stats.set(p.id, { total: 0, last: null }); });
    const list: Candidate[] = [...stats.entries()].map(([id, s]) => {
      const p = byId.get(id) ?? roster.find((r) => r.id === id);
      return { id, name: p?.name ?? 'Rummy Player', playerCode: p?.playerCode, status: p?.status, totalGames: s.total, lastPlayedAt: s.last };
    });
    return sortCandidates(list, now).slice(0, PICKER_PREFETCH);
  },

  // ---------- Register players ----------

  /** Unregistered and pending players, either in one game or across My players. */
  async listUnregistered(ownerId: string, gameId?: string): Promise<Player[]> {
    if (isSupabaseConfigured) {
      const rows = await rpc<any[]>('list_my_unregistered_players', { p_game_id: gameId ?? null });
      return (rows ?? []).map(serverPlayer);
    }
    await this.expireOldRequests(ownerId);
    const [players, games, links] = await Promise.all([storage.getPlayers(), storage.getGames(), readJson<PendingLink[]>(LINKS_KEY, [])]);
    const game = gameId ? games.find((g) => g.id === gameId) : null;
    return players
      .filter((p) => p.managedBy === ownerId && isUnregistered(p.status) && (!game || game.players.includes(p.id)))
      .map((p) => {
        const link = links.find((l) => l.playerId === p.id && l.ownerId === ownerId && l.status === 'pending');
        return { ...p, inviteEmail: link?.email ?? p.inviteEmail };
      });
  },

  /** Linked players this creator invited (for the Unlink option). */
  async listLinked(ownerId: string): Promise<PendingLink[]> {
    if (isSupabaseConfigured) return ((await rpc<any[]>('list_my_player_links')) ?? []).map(linkFromRow).filter((l) => l.status === 'claimed');
    const links = await readJson<PendingLink[]>(LINKS_KEY, []);
    return links.filter((l) => l.ownerId === ownerId && l.status === 'claimed');
  },

  /**
   * Saves the email on the player and sends the invite. If the email already
   * belongs to a registered account, nothing is linked: the player becomes
   * Pending and that person gets an in-app "Is this you?" request.
   */
  async invite(owner: Player, player: Player, rawEmail: string, gameNumbers: number[] = []): Promise<InviteResult> {
    const email = normalizeEmail(rawEmail);
    if (!isValidEmail(email)) throw new Error('Enter a full email address.');
    let status: PlayerStatus;
    let notice: string;
    if (isSupabaseConfigured) {
      const row = await rpc<any>('invite_unregistered_player', { p_player_id: player.id, p_email: email, p_game_numbers: gameNumbers });
      const r = Array.isArray(row) ? row[0] : row;
      const out = inviteOutcome(player.status ?? 'unregistered', Boolean(r?.existing_account));
      status = out.status;
      notice = out.notice;
    } else {
      const players = await storage.getPlayers();
      const existing = players.find((p) => !p.managedBy && !isDeletedStatus(p.status) && normalizeEmail(p.email) === email);
      if (existing?.id === owner.id) throw new Error("That's your own email.");
      const out = inviteOutcome(player.status ?? 'unregistered', Boolean(existing));
      status = out.status;
      notice = out.notice;
      const links = await readJson<PendingLink[]>(LINKS_KEY, []);
      const next = upsertPendingLink(links, {
        id: `link-${Date.now()}`,
        ownerId: owner.id,
        ownerName: owner.name,
        playerId: player.id,
        playerName: player.name,
        email,
        gameNumbers,
      }).map((l) => (l.ownerId === owner.id && l.playerId === player.id && l.status === 'pending' ? { ...l, kind: out.kind } : l));
      await writeJson(LINKS_KEY, next);
      const target = players.find((p) => p.id === player.id);
      if (target) await storage.updatePlayer({ ...target, status, inviteEmail: email });
    }

    // Existing account: the in-app request is the message. New email: send the invite.
    if (status === 'pending') return { status, notice, shared: 'none' };
    const text = inviteShareText(player.name, email, owner.name, INVITE_URL);
    const mail = await sendAppEmail({ kind: 'player_invite', email, playerName: player.name, inviterName: owner.name, url: INVITE_URL }).catch(() => ({ sent: false }));
    if (mail.sent) return { status, notice: `Invite emailed to ${email}.`, shared: 'email' };
    try {
      if (Platform.OS === 'web' && !(navigator as any)?.share) {
        return { status, notice: `${notice} Copy this message and send it: ${text}`, shared: 'none' };
      }
      await Share.share({ message: text });
      return { status, notice, shared: 'share-sheet' };
    } catch {
      return { status, notice, shared: 'none' };
    }
  },

  /** Pending: fix the email, or resend the same one. */
  async changeEmail(owner: Player, player: Player, email: string, gameNumbers: number[] = []): Promise<InviteResult> {
    if (!isSupabaseConfigured) {
      const links = await readJson<PendingLink[]>(LINKS_KEY, []);
      const link = links.find((l) => l.ownerId === owner.id && l.playerId === player.id && l.status === 'pending');
      if (link && normalizeEmail(email) === link.email) {
        await writeJson(LINKS_KEY, links.map((l) => (l === link ? changeRequestEmail(l, email) : l)));
        return { status: player.status ?? 'pending', notice: 'Sent again.', shared: 'none' };
      }
      if (link) {
        await writeJson(LINKS_KEY, links.map((l) => (l === link ? { ...l, status: 'cancelled' as const } : l)));
        const players = await storage.getPlayers();
        const target = players.find((p) => p.id === player.id);
        if (target) await storage.updatePlayer({ ...target, status: 'unregistered', inviteEmail: undefined });
      }
      return this.invite(owner, { ...player, status: 'unregistered' }, email, gameNumbers);
    }
    return this.invite(owner, player, email, gameNumbers);
  },

  /** Requests to the signed-in person: "<creator> added you to G3. Is this you?" Needs a verified email. */
  async listMyRequests(me: Player): Promise<PendingLink[]> {
    if (isSupabaseConfigured) return ((await rpc<any[]>('list_my_pending_claims')) ?? []).map(linkFromRow);
    const links = await readJson<PendingLink[]>(LINKS_KEY, []);
    const email = normalizeEmail(me.email);
    return links.filter((l) => l.status === 'pending' && l.email === email && l.ownerId !== me.id && !isExpired(l));
  },

  /** Yes links the scores (status Registered). Not me sends the player back to Unregistered and tells the creator. */
  async answerRequest(me: Player, link: PendingLink, accept: boolean): Promise<void> {
    if (isSupabaseConfigured) {
      await rpc('answer_player_claim', { p_link_id: link.id, p_accept: accept });
      return;
    }
    const links = await readJson<PendingLink[]>(LINKS_KEY, []);
    const players = await storage.getPlayers();
    const target = players.find((p) => p.id === link.playerId);
    if (!accept) {
      const closed = closeRequest(link, 'decline');
      await writeJson(LINKS_KEY, links.map((l) => (l.id === link.id ? closed.link : l)));
      if (target) await storage.updatePlayer({ ...target, status: closed.playerStatus, inviteEmail: undefined });
      await this.notify(closed.notice);
      return;
    }
    const games = await storage.getGames();
    const moved = gamesWithPlayer(games, link.playerId);
    const { links: next, remap } = applyClaims(links, me.id, me.email ?? '', [{ linkId: link.id, accept: true }]);
    await writeJson(LINKS_KEY, next.map((l) => (l.id === link.id ? { ...l, movedGameIds: moved } : l)));
    await storage.saveGames(games.map((g) => remapGamePlayers(g, remap)));
    if (target) await storage.updatePlayer({ ...target, status: 'merged' });
    // The creator now sees the real account in My players.
    await playersService.addMyPlayer(link.ownerId, me).catch(() => {});
    await playersService.removeMyPlayer(link.ownerId, link.playerId).catch(() => {});
  },

  /** Wrong link: the player goes back to an Unregistered record under this creator, same initials, no email. */
  async unlink(ownerId: string, link: PendingLink): Promise<void> {
    if (isSupabaseConfigured) {
      await rpc('unlink_player', { p_link_id: link.id });
      return;
    }
    const [links, games, players] = await Promise.all([readJson<PendingLink[]>(LINKS_KEY, []), storage.getGames(), storage.getPlayers()]);
    const result = unlinkPlayer(link, games);
    await writeJson(LINKS_KEY, links.map((l) => (l.id === link.id ? result.link : l)));
    await storage.saveGames(result.games);
    const original = players.find((p) => p.id === link.playerId);
    if (original) {
      await storage.updatePlayer({ ...original, status: result.playerStatus, inviteEmail: undefined });
      await playersService.addMyPlayer(ownerId, original);
    }
    if (link.claimedBy) await playersService.removeMyPlayer(ownerId, link.claimedBy).catch(() => {});
  },

  async expireOldRequests(ownerId: string, now = new Date()): Promise<void> {
    if (isSupabaseConfigured) return; // the server expires them in list_my_unregistered_players
    const links = await readJson<PendingLink[]>(LINKS_KEY, []);
    const stale = links.filter((l) => l.ownerId === ownerId && isExpired(l, now));
    if (!stale.length) return;
    const players = await storage.getPlayers();
    let next = links;
    for (const link of stale) {
      const closed = closeRequest(link, 'expire');
      next = next.map((l) => (l.id === link.id ? closed.link : l));
      const p = players.find((x) => x.id === link.playerId);
      if (p) await storage.updatePlayer({ ...p, status: closed.playerStatus, inviteEmail: undefined });
      await this.notify(closed.notice);
    }
    await writeJson(LINKS_KEY, next);
  },

  async notify(notice: CreatorNotice): Promise<void> {
    const all = await readJson<CreatorNotice[]>(NOTICES_KEY, []);
    await writeJson(NOTICES_KEY, [...all, notice]);
  },

  /** Notices for the creator (Not me, expired). Read once. */
  async takeNotices(ownerId: string): Promise<CreatorNotice[]> {
    if (isSupabaseConfigured) return ((await rpc<any[]>('take_creator_notices').catch(() => [])) ?? []).map((r: any) => ({ ownerId, playerId: r.player_id, text: r.text }));
    const all = await readJson<CreatorNotice[]>(NOTICES_KEY, []);
    await writeJson(NOTICES_KEY, all.filter((n) => n.ownerId !== ownerId));
    return all.filter((n) => n.ownerId === ownerId);
  },
};

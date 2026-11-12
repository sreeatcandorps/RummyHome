import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  LINK_REQUEST_EXPIRY_DAYS, linkCompleteMessage, linkConflictMessage, linkConflictSentence, linkedNoticeText, linkPendingMessage,
  linkPreviewMessage, linkRequestDetail, linkRequestPrompt, linkRequestSentMessage, localLinkedGame, localLinkPreview,
} from '../utils/linkPlayer';
import { registrationLabel as seatRegistrationLabel, seatMenu } from '../utils/gamePlayers';
import { registrationLabel, REGISTRATION_TONE } from '../utils/myPlayersList';
import { acceptClaim, closeClaim, PendingLink } from '../utils/playerIdentity';
import { Game } from '../types/game';
import { Player } from '../types/player';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

const rk: Player = { id: 'rk', name: 'R K', status: 'unregistered', managedBy: 'me', playerNo: 9, role: 'player' } as Player;
const priya: Player = { id: 'priya', name: 'Priya', status: 'registered', playerNo: 3, role: 'player' } as Player;
const cora: Player = { id: 'cora', name: 'Cora', status: 'registered', playerNo: 6, role: 'player' } as Player;
const games = [
  { id: '3f2a0000-0000-4000-8000-000000000001', gameNumber: 4, createdBy: 'sree', players: ['harish', 'priya', 'rk'], scores: { harish: [-10], priya: [-20], rk: [30] }, adminIds: ['me'], unseatedAdminIds: ['me', 'cora'], spectators: ['vee'] },
  { id: 'C', gameNumber: 7, createdBy: 'me', players: ['harish', 'rk'], scores: { harish: [5], rk: [-5] }, adminIds: ['me'] },
  { id: 'Z', gameNumber: 9, players: ['harish', 'priya'], scores: {} },
] as unknown as Game[];
const names: Record<string, string> = { sree: 'Sree Koneru', me: 'Me' };
const creator = (id?: string) => (id ? names[id] ?? null : null);

test('item 5 fix 2: the conflict sentence names every blocking game with its G-number, full game ID and creator; no Remove button', () => {
  const one = linkConflictSentence('R K', 11, [{ gameId: '3f2a0000-0000-4000-8000-000000000001', gameNumber: 12, creatorName: 'Sree Koneru' }]);
  assert.equal(one, "Can't link yet. G12 (game ID 3f2a0000-0000-4000-8000-000000000001, creator Sree Koneru) has both R K and #11. In that game, clear one of their scores to zero and remove them from the game first.");
  const many = linkConflictSentence('R K', 11, [
    { gameId: 'a', gameNumber: 1, creatorName: 'Sree' },
    { gameId: 'b', gameNumber: 2, creatorName: 'Harish' },
    { gameId: 'c', gameNumber: null, creatorName: null },
  ]);
  assert.equal(many, "Can't link yet. G1 (game ID a, creator Sree), G2 (game ID b, creator Harish) and a game (game ID c, creator Player) have both R K and #11. In those games, clear one of their scores to zero and remove them from the game first.");
  assert.equal(linkConflictSentence('R K', 11, []), null);
  const dialog = src('components/players/LinkPlayerDialog.tsx');
  assert.doesNotMatch(dialog, /Remove from game|>Remove</, 'the conflict shows the sentence only, no Remove button');
  assert.match(dialog, /testID=\{clash \? 'link-conflict' : 'link-preview-text'\}/);
  const sql = src('supabase/migrations/025_link_player_to_account.sql');
  assert.match(sql, /coalesce\('G' \|\| c\.game_number::text, 'a game'\) \|\| ' \(game ID ' \|\| c\.game_id::text \|\| ', creator ' \|\| c\.creator_name \|\| '\)'/, 'the server builds the same list');
  assert.match(sql, /Can''t link yet\. %s %s both %s and #%s\. In %s, clear one of their scores to zero and remove them from the game first\./);
  assert.match(sql, /returns table \(game_id uuid, game_number integer, creator_name text\)/, 'link_conflicts carries the creator name');
});

test('item 5 fix 1: Check takes the Player ID only; the email field is gone everywhere', () => {
  const dialog = src('components/players/LinkPlayerDialog.tsx');
  assert.match(dialog, /testID="link-player-id"/);
  assert.doesNotMatch(dialog, /link-player-email|Email of that account|keyboardType="email-address"/, 'admins never type someone else\'s email');
  assert.match(dialog, /playerIdentityService\.linkPreview\(owner\.id, player, no\)/);
  assert.match(dialog, /playerIdentityService\.requestLink\(owner, player, no\)/, 'Send request, not an immediate link');
  assert.match(dialog, /testID="link-send"/);
  assert.match(dialog, /testID="link-cancel-request"/, 'an open request can be cancelled');
  assert.doesNotMatch(src('services/playerIdentity.ts'), /linkPlayerToAccount|link_player_to_account|p_email/);
  const sql = src('supabase/migrations/025_link_player_to_account.sql');
  assert.match(sql, /create or replace function public\.link_target_for\(p_player_no bigint\)/);
  assert.match(sql, /drop function if exists public\.link_player_to_account\(uuid, bigint, text\);/, 'the immediate-merge RPC is removed');
  assert.match(sql, /create or replace function public\.request_player_link\(p_player_id uuid, p_player_no bigint\)/);
  assert.doesNotMatch(sql, /create or replace function public\.link_player_to_account/);
});

test('item 5 fix 1: the local preview mirrors the server — who, how many games, the sentence, and any open request', () => {
  assert.throws(() => localLinkPreview(rk, null, games, null, creator), /No registered player has that Player ID/);
  assert.throws(() => localLinkPreview(rk, { ...rk, id: 'other' } as Player, games, null, creator), /No registered player/, 'an unregistered record is never a target');
  assert.throws(() => localLinkPreview({ ...priya, managedBy: 'me' } as Player, cora, games, null, creator), /Only an unregistered player/);
  assert.throws(() => localLinkPreview(rk, rk as Player, games, null, creator), /No registered player|same player/);
  const clash = localLinkPreview(rk, priya, games, null, creator);
  assert.equal(clash.gameCount, 2, 'rk sits in A and C');
  assert.deepEqual(clash.gameNumbers, [4, 7]);
  assert.deepEqual(clash.conflicts, [{ gameId: '3f2a0000-0000-4000-8000-000000000001', gameNumber: 4, creatorName: 'Sree Koneru' }]);
  assert.equal(linkConflictMessage(clash), "Can't link yet. G4 (game ID 3f2a0000-0000-4000-8000-000000000001, creator Sree Koneru) has both R K and #3. In that game, clear one of their scores to zero and remove them from the game first.");
  const fine = localLinkPreview(rk, cora, games, null, creator);
  assert.deepEqual(fine.conflicts, [], 'a non-playing admin of A is not a conflict');
  assert.equal(fine.conflictMessage, null);
  assert.equal(fine.pending, null);
  assert.match(linkPreviewMessage('R K', fine), /Cora \(#6\) gets an email and an in-app request\. Nothing moves until they say Yes\. R K's seat and scores in 2 games move to Cora\./);
  const open: PendingLink = { id: 'lr1', kind: 'link_request', ownerId: 'me', playerId: 'rk', playerName: 'R K', targetId: 'cora', targetNo: 6, targetName: 'Cora', status: 'pending', createdAt: '2026-11-12T00:00:00Z', expiresAt: '2026-11-19T00:00:00Z' };
  const pending = localLinkPreview(rk, cora, games, open, creator);
  assert.deepEqual(pending.pending, { id: 'lr1', expiresAt: '2026-11-19T00:00:00Z', targetId: 'cora', targetNo: 6, targetName: 'Cora' });
  assert.match(linkPendingMessage(pending.pending!), /Waiting for Cora \(#6\) to say Yes\. Expires /);
});

test('item 5 fix 1: nothing moves on Send; the owner gets the request; the row reads Link pending; 7-day expiry', () => {
  assert.equal(LINK_REQUEST_EXPIRY_DAYS, 7);
  assert.match(src('supabase/migrations/025_link_player_to_account.sql'), /create or replace function public\.link_request_days\(\)[\s\S]*?select 7 \$\$;/);
  const sent = linkRequestSentMessage({ playerName: 'R K', target: { id: 'cora', name: 'Cora', playerNo: 6 }, emailQueued: true });
  assert.equal(sent, 'Cora (#6) gets an email and a request on their Home screen. R K shows Link pending until they say Yes; the request expires in 7 days and you can cancel it from the same menu.');
  assert.match(linkRequestSentMessage({ playerName: 'R K', target: { id: 'cora', name: 'Cora', playerNo: 6 }, emailQueued: false }), /gets a request on their Home screen\./, 'no email on file: in-app only');
  // The service: request_player_link only inserts; perform_player_link runs at Yes.
  const service = src('services/playerIdentity.ts');
  assert.match(service, /\('request_player_link', \{ p_player_id: player\.id, p_player_no: playerNo \}\)/);
  assert.match(service, /rpc\('cancel_player_link_request', \{ p_link_id: linkId \}\)/);
  assert.match(service, /rpc<any\[\]>\('list_my_link_requests', \{ p_game_id: gameId \?\? null \}\)/);
  assert.match(service, /rpc<any>\('answer_player_link_request', \{ p_link_id: req\.id, p_accept: accept \}\)/);
  // The labels.
  assert.equal(registrationLabel('pending', true), 'Link pending');
  assert.equal(registrationLabel('pending'), 'Pending registration');
  assert.equal(registrationLabel('unregistered', true), 'Unregistered', 'only an open request on a pending row reads Link pending');
  assert.equal(seatRegistrationLabel({ status: 'pending' }, true), 'Link pending');
  assert.equal(seatRegistrationLabel({ status: 'pending' }), 'Pending registration');
  assert.equal(REGISTRATION_TONE['Link pending'], 'leader');
  for (const screen of ['app/(tabs)/players.tsx', 'app/(screens)/games/players.tsx']) {
    const text = src(screen);
    assert.match(text, /playerIdentityService\.listLinkRequests\(/, `${screen} lists open requests for the Link pending tag`);
    assert.match(text, /<LinkRequestSentDialog/, `${screen} shows the Request sent pop-up`);
    assert.doesNotMatch(text, /LinkCompleteDialog|onLinked=/, `${screen} no longer links immediately`);
  }
  assert.match(src('app/(screens)/games/players.tsx'), /registration === 'Link pending' \? 'link-variant'/);
});

test('item 5 fix 1: the owner sees the request in-app (Home) and by email, says Yes or No; conflicts re-checked at Yes', () => {
  const req = { id: 'lr1', ownerId: 'me', ownerName: 'Sree', playerId: 'rk', playerName: 'Harish', playerInitials: 'HG', targetNo: 40, gameNumbers: [4, 7], gameCount: 2, expiresAt: '2026-11-19T00:00:00Z', conflictMessage: null };
  assert.equal(linkRequestPrompt(req), 'Sree wants to link “Harish (HG)” to your Player ID #40.');
  assert.match(linkRequestDetail(req), /^Yes moves Harish's seats and scores in 2 games \(G4, G7\) to your account\. Expires /);
  assert.match(linkRequestDetail({ ...req, gameCount: 0, gameNumbers: [] }), /^Harish is in no games yet\. Expires /);
  const card = src('components/players/LinkRequestsCard.tsx');
  assert.match(card, /playerIdentityService\.listLinkRequestsForMe\(me\)/);
  assert.match(card, /playerIdentityService\.answerLinkRequest\(me, req, accept\)/);
  assert.match(card, /disabled=\{Boolean\(busy\) \|\| Boolean\(req\.conflictMessage\)\}/, 'Yes is disabled while a conflict stands');
  assert.match(card, />Yes<\/Button>/);
  assert.match(card, />No<\/Button>/);
  const home = src('app/(tabs)/index.tsx');
  assert.match(home, /<LinkRequestsCard me=\{currentPlayer\} preloaded=\{linkRequests\}/);
  assert.match(src('services/home.ts'), /data\.link_requests\.map\(linkRequestForMeFromRow\)/, 'one Home round-trip carries the requests');
  const sql = src('supabase/migrations/025_link_player_to_account.sql');
  assert.match(sql, /into v_link_requests\s*from public\.list_link_requests_for_me\(\) r;/);
  assert.match(sql, /'link_requests', v_link_requests,/);
  assert.match(sql, /create or replace function public\.perform_player_link\(p_link_id uuid\)/);
  assert.match(sql, /create or replace function public\.perform_player_link[\s\S]*?clash := public\.link_conflict_message\(seat\.id, t\.id\);\s*if clash is not null then raise exception '%', clash/, 'the conflict check runs again at Yes');
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\('game:' \|\| gid::text, 0\)\)/, 'the same per-game lock as save_round (019)');
  assert.match(sql, /create or replace function public\.answer_link_request_by_token\(p_token text, p_accept boolean\)/, 'the email buttons work signed out');
  assert.match(sql, /grant execute on function public\.answer_link_request_by_token\(text, boolean\) to anon, authenticated;/);
  assert.match(sql, /'yesUrl', public\.site_base_url\(\) \|\| '\/link\.html\?t=' \|\| raw \|\| '&a=yes'/);
  assert.match(sql, /'link_request'/, 'a new player_links kind and email_outbox kind');
  // The email and the page.
  const email = src('supabase/functions/send-email/index.ts');
  assert.match(email, /'link_request'/);
  assert.match(email, /Yes, that is me/);
  assert.match(email, /p\.noUrl/);
  const page = src('public/link.html');
  assert.match(page, /peek_link_request/);
  assert.match(page, /answer_link_request_by_token/);
  assert.match(page, /__SUPABASE_URL__/);
  assert.match(src('scripts/inject-scorecard-config.mjs'), /'link\.html'/, 'the page is deployed with the share site');
  assert.ok(existsSync(path.join(process.cwd(), 'public/link.html')));
});

test('item 5 fix 1: local store — the move happens only at Yes, every seat and score column follows, the admin gets the one-time pop-up', () => {
  const a = localLinkedGame(games[0], 'rk', 'cora');
  assert.deepEqual(a.players, ['harish', 'priya', 'cora']);
  assert.deepEqual(a.scores.cora, [30]);
  assert.equal('rk' in a.scores, false);
  assert.ok(a.adminIds?.includes('cora'), 'cora was a non-playing admin: stays admin');
  assert.deepEqual(a.unseatedAdminIds, ['me']);
  const c = localLinkedGame(games[1], 'rk', 'cora');
  assert.deepEqual(c.players, ['harish', 'cora']);
  assert.deepEqual(c.adminIds, ['me']);
  assert.equal(linkedNoticeText('Harish', 'HG', 40), 'Harish (HG) is now linked to #40.');
  assert.equal(linkCompleteMessage({ linkId: 'l1', playerName: 'R K', playerInitials: 'RK', target: { id: 'cora', name: 'Cora', playerNo: 6 }, movedGameIds: ['A'], movedGameNumbers: [4] }), 'R K (RK) is now linked to #6.');
  assert.equal(linkCompleteMessage({ linkId: null, playerName: 'R K', target: { id: 'cora', name: 'Cora', playerNo: null }, movedGameIds: [], movedGameNumbers: [] }), 'R K is now linked to #?.');
  const sql = src('supabase/migrations/025_link_player_to_account.sql');
  assert.match(sql, /insert into public\.creator_notices \(owner_id, player_id, text, kind\)\s*values \(l\.owner_id, seat\.id,[\s\S]*?' is now linked to #' \|\| coalesce\(t\.public_player_no::text, '\?'\) \|\| '\.', 'linked'\)/);
  const home = src('app/(tabs)/index.tsx');
  assert.match(home, /home\.notices\.filter\(\(n\) => n\.kind === 'linked'\)/, 'linked notices become a pop-up, not a card');
  assert.match(home, /testID="linked-popup"/);
  // A link_request only its target may answer; expiry puts the player back to unregistered.
  const link: PendingLink = { id: 'lr1', kind: 'link_request', ownerId: 'me', playerId: 'rk', playerName: 'R K', targetId: 'cora', status: 'pending', createdAt: '2026-11-12T00:00:00Z', expiresAt: '2026-11-19T00:00:00Z' };
  assert.throws(() => acceptClaim([link], 'lr1', 'priya', []), /for another account/);
  const expired = closeClaim(link, 'expire');
  assert.equal(expired.link.status, 'expired');
  assert.equal(expired.playerStatus, 'unregistered');
  assert.match(expired.notice.text, /the link request expired/);
});

test('item 5: Edit name stays in the ⋮ menu; one menu on both screens', () => {
  const game = { id: 'g', createdBy: 'me', adminIds: ['me'] } as any;
  const items = seatMenu({ id: 'rk', status: 'unregistered', managedBy: 'me' } as any, game, 'me', true).map((i) => i.item);
  assert.ok(items.includes('edit_name'), 'Edit name kept (approved)');
  assert.ok(items.includes('link_id'));
  assert.equal(existsSync(path.join(process.cwd(), 'components/players/RegisterPlayersDialog.tsx')), false, 'the Register popup component is deleted');
  for (const component of ['PlayerActionMenu', 'LinkPlayerDialog', 'LinkRequestSentDialog', 'InviteToRegisterDialog', 'EditNameDialog']) {
    assert.match(src('app/(tabs)/players.tsx'), new RegExp(`<${component}`), `My players uses ${component}`);
    assert.match(src('app/(screens)/games/players.tsx'), new RegExp(`<${component}`), `the game's Players page uses ${component}`);
  }
});

test('migration 025 rollback undoes the request flow and restores 011/012/023 functions', () => {
  const rb = src('supabase/rollback/rollback_025_link_player_to_account.sql');
  for (const fn of ['request_player_link(uuid, bigint)', 'link_player_check(uuid, bigint)', 'perform_player_link(uuid)', 'answer_link_request_by_token(text, boolean)', 'list_link_requests_for_me()', 'link_request_days()']) {
    assert.match(rb, new RegExp(`drop function if exists public\\.${fn.replace(/[()]/g, '\\$&')}`), `rollback drops ${fn}`);
  }
  assert.match(rb, /alter table public\.player_links drop column if exists target_id;/);
  assert.match(rb, /alter table public\.creator_notices drop column if exists kind;/);
  assert.match(rb, /delete from public\.email_outbox where kind = 'link_request';/);
  assert.match(rb, /create or replace function public\.get_home_bundle/, 'the 023 bundle is restored');
  assert.match(rb, /create or replace function public\.expire_player_requests/, 'the 012 expiry is restored');
  assert.match(src('../ci/db/replay-rollbacks.sh'), /link_requests/, 'the rollback replay checks the bundle lost link_requests');
});

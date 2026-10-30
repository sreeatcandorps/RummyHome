import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyClaims, canTransition, changeRequestEmail, claimableLinks, claimPrompt, clampNewPlayerCount, closeRequest,
  EXISTING_ACCOUNT_NOTICE, INVITE_MESSAGE, inviteOutcome, inviteShareText, isExpired, isValidEmail, joinRequestPrompt,
  nextStatus, normalizeEmail, normalizeZip, PendingLink, pickerGrid, remapGamePlayers, seatedOrder, sortCandidates,
  unlinkPlayer, upsertPendingLink,
} from '../utils/playerIdentity';
import { parseRuleInput, rulesFromProfileDefaults, validateRules, withStoredPointsRules } from '../utils/gameSettings';

const NOW = new Date('2026-10-29T20:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000).toISOString();

// ---------- sorting ----------
test('picker: last 2 weeks first (by total games), then the rest by total games', () => {
  const sorted = sortCandidates([
    { id: 'old-many', name: 'Old Many', totalGames: 40, lastPlayedAt: daysAgo(30) },
    { id: 'recent-few', name: 'Recent Few', totalGames: 2, lastPlayedAt: daysAgo(1) },
    { id: 'recent-many', name: 'Recent Many', totalGames: 9, lastPlayedAt: daysAgo(13) },
    { id: 'old-few', name: 'Old Few', totalGames: 3, lastPlayedAt: daysAgo(20) },
    { id: 'never', name: 'Never', totalGames: 0, lastPlayedAt: null },
  ], NOW);
  assert.deepEqual(sorted.map((p) => p.id), ['recent-many', 'recent-few', 'old-many', 'old-few', 'never']);
});

test('picker: deleted and merged players never show; 14-day edge counts as recent', () => {
  const sorted = sortCandidates([
    { id: 'gone', name: 'Gone', totalGames: 99, lastPlayedAt: daysAgo(1), status: 'deleted_before_registering' },
    { id: 'merged', name: 'M', totalGames: 99, lastPlayedAt: daysAgo(1), status: 'merged' },
    { id: 'edge', name: 'Edge', totalGames: 1, lastPlayedAt: daysAgo(14) },
    { id: 'big', name: 'Big', totalGames: 50, lastPlayedAt: daysAgo(15) },
  ], NOW);
  assert.deepEqual(sorted.map((p) => p.id), ['edge', 'big']);
});

test('picker: grid shows 10, skips me and selected, and refills', () => {
  const list = Array.from({ length: 30 }, (_, i) => ({ id: `p${i}` }));
  assert.equal(pickerGrid(list, [], 'p0').length, 10);
  assert.equal(pickerGrid(list, [], 'p0')[0].id, 'p1');
  const after = pickerGrid(list, ['p1', 'p2'], 'p0');
  assert.deepEqual(after.map((p) => p.id), ['p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12']);
  assert.deepEqual(seatedOrder('me', ['a', 'me', 'b']), ['me', 'a', 'b']);
});

test('stepper clamps to 1..5', () => {
  assert.equal(clampNewPlayerCount(0), 1);
  assert.equal(clampNewPlayerCount(6), 5);
  assert.equal(clampNewPlayerCount(3), 3);
});

// ---------- email ----------
test('email is lowercased and trimmed', () => {
  assert.equal(normalizeEmail('  Raj@Gmail.com '), 'raj@gmail.com');
  assert.equal(normalizeEmail('R aj@GMAIL.COM'), 'raj@gmail.com');
  assert.equal(normalizeEmail(undefined), '');
  assert.ok(isValidEmail(' Raj@Gmail.com '));
  assert.ok(!isValidEmail('raj@gmail'));
  assert.ok(!isValidEmail('raj'));
});

test('zip is optional and 5 digits', () => {
  assert.equal(normalizeZip(''), null);
  assert.equal(normalizeZip('94086'), '94086');
  assert.throws(() => normalizeZip('9408'));
});

// ---------- statuses ----------
test('status transitions', () => {
  assert.equal(nextStatus('unregistered', 'delete'), 'deleted_before_registering');
  assert.equal(nextStatus('registered', 'delete'), 'deleted_after_registering');
  assert.equal(nextStatus('unregistered', 'claim'), 'merged');
  assert.equal(nextStatus('unregistered', 'request_existing'), 'pending');
  assert.equal(nextStatus('pending', 'accept'), 'merged');
  assert.equal(nextStatus('pending', 'decline'), 'unregistered');
  assert.equal(nextStatus('pending', 'expire'), 'unregistered');
  assert.equal(nextStatus('merged', 'unlink'), 'unregistered');
  assert.equal(nextStatus('deleted_before_registering', 'restore'), 'unregistered');
  assert.throws(() => nextStatus('registered', 'claim'));
  assert.throws(() => nextStatus('unregistered', 'accept'), /can't accept/);
  assert.ok(!canTransition('deleted_after_registering', 'delete'));
});

// ---------- claim and merge (new sign-up) ----------
const link = (over: Partial<PendingLink>): PendingLink => ({
  id: 'l1', ownerId: 'sree', ownerName: 'Sree', playerId: 'rk1', playerName: 'R K', email: 'raj@gmail.com',
  status: 'pending', invitedAt: daysAgo(1), lastSentAt: daysAgo(1), gameNumbers: [3], kind: 'signup', ...over,
});

test('upsert keeps one pending record per creator + player and normalizes the email', () => {
  let links = upsertPendingLink([], { id: 'a', ownerId: 'sree', playerId: 'rk1', playerName: 'R K', email: ' RAJ@gmail.com' });
  links = upsertPendingLink(links, { id: 'b', ownerId: 'sree', playerId: 'rk1', playerName: 'R K', email: 'raj2@gmail.com' });
  assert.equal(links.length, 1);
  assert.equal(links[0].email, 'raj2@gmail.com');
  links = upsertPendingLink(links, { id: 'c', ownerId: 'anu', playerId: 'rk2', playerName: 'Raj', email: 'raj2@gmail.com' });
  assert.equal(links.length, 2);
  assert.throws(() => upsertPendingLink(links, { id: 'd', ownerId: 'x', playerId: 'y', playerName: 'z', email: 'nope' }));
});

test('claims need a verified email that matches exactly after normalizing', () => {
  const links = [link({}), link({ id: 'l2', email: 'other@gmail.com' })];
  assert.equal(claimableLinks(links, 'Raj@Gmail.com', false).length, 0);
  assert.deepEqual(claimableLinks(links, ' Raj@Gmail.com', true).map((l) => l.id), ['l1']);
  assert.equal(claimPrompt(link({})), 'Is this you? You played in G3 with Sree as "R K".');
});

test('same email under two creators merges into one account', () => {
  const links = [link({}), link({ id: 'l2', ownerId: 'anu', ownerName: 'Anu', playerId: 'rk2', playerName: 'Raj' })];
  const { links: out, remap } = applyClaims(links, 'acct', 'RAJ@gmail.com', [{ linkId: 'l1', accept: true }, { linkId: 'l2', accept: true }]);
  assert.deepEqual(remap, { rk1: 'acct', rk2: 'acct' });
  assert.ok(out.every((l) => l.status === 'claimed' && l.claimedBy === 'acct'));
});

test('declining one creator leaves that record with them', () => {
  const links = [link({}), link({ id: 'l2', ownerId: 'anu', playerId: 'rk2' })];
  const { links: out, remap } = applyClaims(links, 'acct', 'raj@gmail.com', [{ linkId: 'l1', accept: true }, { linkId: 'l2', accept: false }]);
  assert.deepEqual(remap, { rk1: 'acct' });
  assert.equal(out[1].status, 'declined');
});

test('remap moves seats and scores; nothing is lost', () => {
  const game = { players: ['sree', 'rk1'], scores: { sree: [10, 0], rk1: [-10, 0] }, adminIds: ['sree'] };
  const moved = remapGamePlayers(game, { rk1: 'acct' });
  assert.deepEqual(moved.players, ['sree', 'acct']);
  assert.deepEqual(moved.scores, { sree: [10, 0], acct: [-10, 0] });
});

// ---------- the tricky case: existing registered account ----------
test('email of a registered account makes the player Pending, never linked instantly', () => {
  const out = inviteOutcome('unregistered', true);
  assert.equal(out.status, 'pending');
  assert.equal(out.kind, 'existing');
  assert.equal(out.notice, EXISTING_ACCOUNT_NOTICE);
  assert.equal(inviteOutcome('unregistered', false).status, 'unregistered');
  assert.equal(joinRequestPrompt(link({ kind: 'existing' })), 'Sree added you to G3. Is this you?');
});

test('Not me sends the player back to Unregistered, clears the email, tells the creator', () => {
  const r = closeRequest(link({ kind: 'existing' }), 'decline');
  assert.equal(r.link.status, 'declined');
  assert.equal(r.playerStatus, 'unregistered');
  assert.equal(r.clearEmail, true);
  assert.equal(r.notice.ownerId, 'sree');
  assert.match(r.notice.text, /Not me/);
  assert.throws(() => closeRequest(r.link, 'decline'));
});

test('requests expire after 14 days and go back to Unregistered', () => {
  const stale = link({ kind: 'existing', lastSentAt: daysAgo(15) });
  assert.ok(isExpired(stale, NOW));
  assert.ok(!isExpired(link({ kind: 'existing', lastSentAt: daysAgo(3) }), NOW));
  assert.ok(!isExpired(link({ kind: 'signup', lastSentAt: daysAgo(30) }), NOW));
  const r = closeRequest(stale, 'expire');
  assert.equal(r.link.status, 'expired');
  assert.equal(r.playerStatus, 'unregistered');
});

test('Pending: Change email and Resend restart the clock', () => {
  const changed = changeRequestEmail(link({ kind: 'existing', lastSentAt: daysAgo(10) }), ' New@Mail.com', NOW.toISOString());
  assert.equal(changed.email, 'new@mail.com');
  assert.equal(changed.lastSentAt, NOW.toISOString());
  assert.ok(!isExpired(changed, NOW));
  assert.throws(() => changeRequestEmail(link({ status: 'claimed' }), 'a@b.co'));
});

test('Unlink moves only the moved games back to the unregistered record; scores kept', () => {
  const claimed = link({ status: 'claimed', claimedBy: 'acct', movedGameIds: ['g3'] });
  const games: { id: string; players: string[]; scores: Record<string, number[]> }[] = [
    { id: 'g3', players: ['sree', 'acct'], scores: { sree: [5], acct: [-5] } },
    { id: 'g9', players: ['acct', 'anu'], scores: { acct: [7], anu: [-7] } },
  ];
  const r = unlinkPlayer(claimed, games);
  assert.equal(r.playerStatus, 'unregistered');
  assert.equal(r.link.status, 'unlinked');
  assert.equal(r.link.email, '');
  assert.deepEqual(r.games[0].players, ['sree', 'rk1']);
  assert.deepEqual(r.games[0].scores, { sree: [5], rk1: [-5] });
  assert.deepEqual(r.games[1], games[1]);
  assert.throws(() => unlinkPlayer(link({}), games));
});

test('invite text has the exact message', () => {
  const text = inviteShareText('R K', ' Raj@Gmail.com', 'Sree', 'https://x.test/get');
  assert.ok(text.includes(INVITE_MESSAGE));
  assert.ok(text.includes('raj@gmail.com'));
});

// ---------- settings ----------
test('drop rules: typed positive, stored negative, validated, applied to games', () => {
  assert.equal(parseRuleInput('10'), -10);
  assert.equal(parseRuleInput(''), null);
  assert.equal(validateRules({ gameKind: 'points', drop: -40, middleDrop: -30 }), 'Middle drop is usually bigger than Drop.');
  assert.deepEqual(rulesFromProfileDefaults({ stakeDrop: -20, stakeMiddleDrop: -40 }), { gameKind: 'points', drop: -20, middleDrop: -40 });
  const base = { expense: true, expenseAmount: -10, dropAmount: -10, mdAmount: -30, maxCount: -80 };
  assert.equal(withStoredPointsRules(base, { stakeDrop: -15 }).dropAmount, -15);
  assert.equal(withStoredPointsRules(base, null).mdAmount, -30);
});

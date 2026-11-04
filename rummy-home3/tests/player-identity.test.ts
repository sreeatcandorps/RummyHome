import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomBytes } from 'node:crypto';
import {
  acceptClaim, backfillPlayerNumbers, canRequestClaim, canTransition, claimPrompt, claimRequestPrompt, claimShareText, claimUrl,
  clampNewPlayerCount, closeClaim, findClaimLink, formatPlayerNo, ID_CLAIMS_PER_DAY, isExpired, isValidEmail, issueClaimLink,
  isWellFormedToken, nextPlayerNo, nextStatus, normalizeEmail, normalizeZip, parsePlayerNo, PendingLink, pickerGrid,
  remapGamePlayers, requestClaimById, revokeClaimLinks, seatedOrder, sortCandidates, toBase64Url, TOKEN_BYTES, unlinkPlayer,
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
  assert.equal(nextStatus('unregistered', 'share_link'), 'pending');
  assert.equal(nextStatus('unregistered', 'request_claim'), 'pending');
  assert.equal(nextStatus('pending', 'accept'), 'merged');
  assert.equal(nextStatus('pending', 'decline'), 'unregistered');
  assert.equal(nextStatus('pending', 'expire'), 'unregistered');
  assert.equal(nextStatus('pending', 'revoke'), 'unregistered');
  assert.equal(nextStatus('merged', 'unlink'), 'unregistered');
  assert.equal(nextStatus('deleted_before_registering', 'restore'), 'unregistered');
  assert.throws(() => nextStatus('registered', 'accept'));
  assert.throws(() => nextStatus('unregistered', 'accept'), /can't accept/);
  assert.ok(!canTransition('deleted_after_registering', 'delete'));
});

// ---------- player ID sequence ----------
test('player IDs are #numbers, parsed with or without #, never 0', () => {
  assert.equal(formatPlayerNo(42), '#42');
  assert.equal(formatPlayerNo(undefined), '');
  assert.equal(parsePlayerNo(' #42 '), 42);
  assert.equal(parsePlayerNo('42'), 42);
  assert.equal(parsePlayerNo('0'), null);
  assert.equal(parsePlayerNo('4a'), null);
});

test('sequence goes up from the highest ever issued, so numbers are never reused', () => {
  assert.equal(nextPlayerNo(0), 1);
  assert.equal(nextPlayerNo(41), 42);
});

test('backfill numbers existing players oldest first and keeps existing numbers', () => {
  const out = backfillPlayerNumbers([
    { id: 'c', createdAt: '2026-03-01' },
    { id: 'a', createdAt: '2026-01-01' },
    { id: 'z', createdAt: '2025-01-01', playerNo: 7 },
    { id: 'b', createdAt: '2026-01-01' },
  ]);
  assert.deepEqual(out.map((p) => [p.id, p.playerNo]), [['c', 10], ['a', 8], ['z', 7], ['b', 9]]);
});

// ---------- claim links ----------
const hash = (t: string) => createHash('sha256').update(t).digest('hex');
const mkToken = () => toBase64Url(new Uint8Array(randomBytes(TOKEN_BYTES)));
const base = { ownerId: 'sree', ownerName: 'Sree', playerId: 'rk1', playerName: 'R K', playerNo: 42, gameNumbers: [3] };
const games = () => [
  { id: 'g3', players: ['sree', 'rk1'], scores: { sree: [5], rk1: [-5] } as Record<string, number[]> },
  { id: 'g9', players: ['acct', 'rk1'], scores: { acct: [1], rk1: [-1] } as Record<string, number[]> },
];

test('tokens are at least 128 bits, url-safe, and stored only as a hash', () => {
  const t = mkToken();
  assert.ok(TOKEN_BYTES * 8 >= 128);
  assert.ok(isWellFormedToken(t));
  assert.ok(!t.includes('+') && !t.includes('/') && !t.includes('='));
  const links = issueClaimLink([], { id: 'l1', ...base, tokenHash: hash(t) }, NOW.toISOString());
  assert.ok(!JSON.stringify(links).includes(t));
  assert.ok(findClaimLink(links, hash(t), NOW));
});

test('share message has the player ID and the link', () => {
  const text = claimShareText(42, claimUrl('abc_DEF-123'));
  assert.ok(text.startsWith('Join me on EZ Score: Rummy! Download the app and sign up using this link to see your scores. Your player ID is #42.'));
  assert.ok(text.includes('?claim=abc_DEF-123'));
});

test('re-sharing makes a new link and the old one stops working; revoke turns it off', () => {
  const t1 = mkToken(); const t2 = mkToken();
  let links = issueClaimLink([], { id: 'l1', ...base, tokenHash: hash(t1) }, NOW.toISOString());
  links = issueClaimLink(links, { id: 'l2', ...base, tokenHash: hash(t2) }, NOW.toISOString());
  assert.equal(findClaimLink(links, hash(t1), NOW), null);
  assert.equal(findClaimLink(links, hash(t2), NOW)?.id, 'l2');
  links = revokeClaimLinks(links, 'rk1');
  assert.equal(findClaimLink(links, hash(t2), NOW), null);
});

test('claim links expire after 14 days', () => {
  const t = mkToken();
  const links = issueClaimLink([], { id: 'l1', ...base, tokenHash: hash(t) }, daysAgo(15));
  assert.ok(isExpired(links[0], NOW));
  assert.equal(findClaimLink(links, hash(t), NOW), null);
  const fresh = issueClaimLink([], { id: 'l1', ...base, tokenHash: hash(t) }, daysAgo(13));
  assert.ok(findClaimLink(fresh, hash(t), NOW));
  assert.equal(closeClaim(links[0], 'expire').playerStatus, 'unregistered');
});

test('Yes on a link is single use and moves only games the account is not already in', () => {
  const t = mkToken();
  const links = issueClaimLink([], { id: 'l1', ...base, tokenHash: hash(t) }, NOW.toISOString());
  const out = acceptClaim(links, 'l1', 'acct', games(), NOW);
  assert.equal(out.playerStatus, 'merged');
  assert.deepEqual(out.games[0].players, ['sree', 'acct']);
  assert.deepEqual(out.games[0].scores, { sree: [5], acct: [-5] });
  assert.deepEqual(out.games[1].players, ['acct', 'rk1']);
  assert.deepEqual(out.links[0].movedGameIds, ['g3']);
  assert.equal(findClaimLink(out.links, hash(t), NOW), null);
  assert.throws(() => acceptClaim(out.links, 'l1', 'acct', out.games, NOW), /no longer valid/);
  assert.equal(claimPrompt(links[0]), 'Is this you? You played in G3 with Sree');
});

test('Not me leaves the player unregistered and tells the creator', () => {
  const links = issueClaimLink([], { id: 'l1', ...base, tokenHash: 'h' }, NOW.toISOString());
  const r = closeClaim(links[0], 'decline');
  assert.equal(r.link.status, 'declined');
  assert.equal(r.playerStatus, 'unregistered');
  assert.equal(r.notice.ownerId, 'sree');
  assert.match(r.notice.text, /Not me/);
  assert.throws(() => closeClaim(r.link, 'decline'));
});

// ---------- player ID typed at sign-up ----------
const rk = { id: 'rk1', name: 'R K', playerNo: 42, managedBy: 'sree', status: 'unregistered' as const };

test('ID claim makes a request for the creator; only Approve links', () => {
  const { links, notice } = requestClaimById([], { id: 'q1', requesterId: 'acct', requesterName: 'Raj', player: rk, ownerName: 'Sree' }, NOW.toISOString());
  assert.equal(links[0].kind, 'id_request');
  assert.equal(notice.text, '#42 wants to claim R K. Approve?');
  assert.equal(claimRequestPrompt(links[0]), '#42 wants to claim R K. Approve?');
  assert.throws(() => acceptClaim(links, 'q1', 'someone-else', games(), NOW), /another account/);
  const approved = acceptClaim(links, 'q1', 'acct', games(), NOW);
  assert.equal(approved.links[0].status, 'claimed');
  const declined = closeClaim(links[0], 'decline');
  assert.equal(declined.link.status, 'declined');
  assert.equal(declined.playerStatus, 'unregistered');
});

test('ID claims are rate limited per account and checked', () => {
  let links: PendingLink[] = [];
  for (let i = 0; i < ID_CLAIMS_PER_DAY; i++) {
    links = requestClaimById(links, { id: `q${i}`, requesterId: 'acct', player: { ...rk, id: `p${i}` } }, NOW.toISOString()).links;
  }
  assert.ok(!canRequestClaim(links, 'acct', NOW));
  assert.throws(() => requestClaimById(links, { id: 'qx', requesterId: 'acct', player: { ...rk, id: 'px' } }, NOW.toISOString()), /Too many/);
  assert.ok(canRequestClaim(links, 'acct', new Date(NOW.getTime() + 2 * 86400000)));
  assert.ok(canRequestClaim(links, 'other', NOW));
  assert.throws(() => requestClaimById([], { id: 'q', requesterId: 'sree', player: rk }), /own player/);
  assert.throws(() => requestClaimById([], { id: 'q', requesterId: 'acct', player: { ...rk, status: 'registered' } }), /not waiting/);
  const once = requestClaimById([], { id: 'q', requesterId: 'acct', player: rk }).links;
  assert.throws(() => requestClaimById(once, { id: 'q2', requesterId: 'acct', player: rk }), /already asked/);
});

test('two creators holding the same person: both claims merge into one account', () => {
  let links = issueClaimLink([], { id: 'a', ...base, tokenHash: 'h1' }, NOW.toISOString());
  links = issueClaimLink(links, { id: 'b', ownerId: 'anu', playerId: 'raj2', playerName: 'Raj', tokenHash: 'h2' }, NOW.toISOString());
  const g: { id: string; players: string[]; scores: Record<string, number[]> }[] = [{ id: 'g3', players: ['sree', 'rk1'], scores: { sree: [1], rk1: [-1] } }, { id: 'g7', players: ['anu', 'raj2'], scores: { anu: [2], raj2: [-2] } }];
  const one = acceptClaim(links, 'a', 'acct', g, NOW);
  const two = acceptClaim(one.links, 'b', 'acct', one.games, NOW);
  assert.deepEqual(two.games.map((x) => x.players), [['sree', 'acct'], ['anu', 'acct']]);
});

test('Unlink moves only the moved games back; scores kept', () => {
  const links = issueClaimLink([], { id: 'l1', ...base, tokenHash: 'h' }, NOW.toISOString());
  const claimed = acceptClaim(links, 'l1', 'acct', games(), NOW);
  const r = unlinkPlayer(claimed.links[0], claimed.games);
  assert.equal(r.playerStatus, 'unregistered');
  assert.equal(r.link.status, 'unlinked');
  assert.deepEqual(r.games[0].players, ['sree', 'rk1']);
  assert.deepEqual(r.games[0].scores, { sree: [5], rk1: [-5] });
  assert.deepEqual(r.games[1], games()[1]);
  assert.throws(() => unlinkPlayer(links[0], games()));
});

test('remap moves seats and scores; nothing is lost', () => {
  const game = { players: ['sree', 'rk1'], scores: { sree: [10, 0], rk1: [-10, 0] }, adminIds: ['sree'] };
  const moved = remapGamePlayers(game, { rk1: 'acct' });
  assert.deepEqual(moved.players, ['sree', 'acct']);
  assert.deepEqual(moved.scores, { sree: [10, 0], acct: [-10, 0] });
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

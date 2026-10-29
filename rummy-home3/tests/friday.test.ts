import assert from 'node:assert/strict';
import test from 'node:test';
import { canEnterScores, gameVisibleToUser } from '../utils/gameAccess';
import { DEFAULT_AUTH_REDIRECT_URL, authRedirectUrl } from '../utils/authRedirect';
import {
  balancesAfterEntries,
  coinSum,
  isSettled,
  openingBalances,
  poolPrizeShares,
  splitCoins,
  stakePrizeShares,
  suggestedStakePrize,
  validateLegs,
} from '../utils/prizeSession';
import { createViewToken, isViewToken, scorecardUrl } from '../utils/shareLink';
import { formatAuthError } from '../utils/authErrors';

const admin = 'admin-id';
const coAdmin = 'co-id';
const player = 'player-id';
const viewer = 'viewer-id';
const outsider = 'outsider-id';

const game = {
  createdBy: admin,
  players: [coAdmin, player],
  spectators: [viewer],
  memberEmails: [
    { profileId: admin, email: 'admin@example.com' },
    { profileId: coAdmin, email: 'co@example.com' },
    { profileId: player, email: 'player@example.com' },
    { profileId: viewer, email: 'viewer@example.com' },
  ],
};

test('seated players, the creator, and spectators can see the game', () => {
  assert.equal(gameVisibleToUser(game, { id: player, email: 'player@example.com' }), true);
  assert.equal(gameVisibleToUser(game, { id: coAdmin, email: 'co@example.com' }), true);
  assert.equal(gameVisibleToUser(game, { id: viewer, email: 'viewer@example.com' }), true);
  assert.equal(gameVisibleToUser(game, { id: admin, email: 'admin@example.com' }), true);
});

test('an outsider cannot see the game, even with a similar name', () => {
  assert.equal(gameVisibleToUser(game, { id: outsider, email: 'outsider@example.com' }), false);
});

test('the same account email sees the game when the profile id differs', () => {
  assert.equal(gameVisibleToUser(game, { id: 'other-profile', email: 'Player@Example.com' }), true);
});

test('a scorekeeper who is not seated can still score, and players cannot', () => {
  assert.equal(canEnterScores({ isCreator: true, seatRole: null, rolesKnown: true }), true);
  assert.equal(canEnterScores({ isCreator: false, seatRole: 'game_admin', rolesKnown: true }), true);
  assert.equal(canEnterScores({ isCreator: false, seatRole: 'player', rolesKnown: true }), false);
  assert.equal(canEnterScores({ isCreator: false, seatRole: 'spectator', rolesKnown: true }), false);
  assert.equal(canEnterScores({ isCreator: false, seatRole: null, rolesKnown: false }), true);
});

test('share tokens are unguessable and the public url keeps the token', () => {
  const token = createViewToken();
  assert.equal(isViewToken(token), true);
  assert.notEqual(createViewToken(), token);
  assert.equal(isViewToken('short'), false);
  assert.match(scorecardUrl(token), new RegExp(`github\\.io/Games/scorecard\\.html\\?t=${token}$`));
  assert.doesNotMatch(scorecardUrl(token), /functions\/v1/);
  assert.doesNotMatch(scorecardUrl(token), /localhost/);
});

test('passcode reset does not target localhost', () => {
  assert.equal(DEFAULT_AUTH_REDIRECT_URL.includes('localhost'), false);
  assert.equal(authRedirectUrl().includes('localhost'), false);
  assert.match(formatAuthError({ message: 'User already registered' }), /sign(?:ing)? in/i);
});

test('stake coins start as points and a pool prize is zero-sum', () => {
  const players = [
    { id: 'a', points: 40 },
    { id: 'b', points: -10 },
    { id: 'c', points: -30 },
  ];
  assert.deepEqual(stakePrizeShares(players), { a: 40, b: -10, c: -30 });
  assert.equal(suggestedStakePrize(players), 40);

  const shares = poolPrizeShares(players, 800);
  assert.equal(shares.a, 800);
  assert.equal(coinSum(shares), 0);
  assert.deepEqual(splitCoins(800, 3), [267, 267, 266]);
  assert.deepEqual(splitCoins(-800, 3), [-267, -267, -266]);
  assert.deepEqual(poolPrizeShares(players.map((player) => ({ ...player, points: 0 })), 800), { a: 0, b: 0, c: 0 });
});

test('a prize entry must add to zero and settlement is every balance at zero', () => {
  const opening = openingBalances([
    {
      id: 'g1',
      gameType: 'stake',
      players: [
        { id: 'a', points: 100 },
        { id: 'b', points: -40 },
        { id: 'c', points: -60 },
      ],
    },
  ]);
  assert.equal(validateLegs([{ profileId: 'a', amount: -100 }]).ok, false);
  assert.equal(validateLegs([
    { profileId: 'a', amount: -100 },
    { profileId: 'b', amount: 40 },
    { profileId: 'c', amount: 50 },
  ]).ok, false);

  const after = balancesAfterEntries(opening, [{
    id: 'e1',
    createdAt: '2026-10-30T00:00:00Z',
    legs: [
      { profileId: 'a', amount: -100 },
      { profileId: 'b', amount: 40 },
      { profileId: 'c', amount: 60 },
    ],
  }]);
  assert.deepEqual(after, { a: 0, b: 0, c: 0 });
  assert.equal(isSettled(after), true);
  assert.equal(isSettled(opening), false);
});

test('several games add into one session total', () => {
  const opening = openingBalances([
    {
      id: 'g1',
      gameType: 'stake',
      players: [
        { id: 'a', points: 20 },
        { id: 'b', points: -20 },
      ],
    },
    {
      id: 'g2',
      gameType: 'pool',
      prize: 800,
      players: [
        { id: 'a', points: 10 },
        { id: 'b', points: -10 },
      ],
    },
  ]);
  assert.equal(opening.a, 20 + 800);
  assert.equal(opening.b, -20 + -800);
  assert.equal(coinSum(opening), 0);
});

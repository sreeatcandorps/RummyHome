import assert from 'node:assert/strict';
import test from 'node:test';
import { canEnterScores, gameVisibleToUser } from '../utils/gameAccess';
import { DEFAULT_AUTH_REDIRECT_URL, authRedirectUrl } from '../utils/authRedirect';
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
  assert.match(scorecardUrl(token), new RegExp(`ezscore\\.mindweavetech\\.com/scorecard\\.html\\?t=${token}$`));
  assert.doesNotMatch(scorecardUrl(token), /functions\/v1/);
  assert.doesNotMatch(scorecardUrl(token), /localhost/);
});

test('passcode reset does not target localhost', () => {
  assert.equal(DEFAULT_AUTH_REDIRECT_URL.includes('localhost'), false);
  assert.equal(authRedirectUrl().includes('localhost'), false);
  assert.match(formatAuthError({ message: 'User already registered' }), /sign(?:ing)? in/i);
});

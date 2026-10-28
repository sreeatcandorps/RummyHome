import assert from 'node:assert/strict';
import test from 'node:test';
import { isLocalToday } from '../utils/localDay';
import { userAdminsGame } from '../utils/gameAccess';
import { inviteMessage, INVITE_URL } from '../utils/inviteLink';
import { matchesMyPlayer, playerSearchMode } from '../utils/playerSearch';
import { coinSum, openingBalances, stakePrizeShares, validateLegs } from '../utils/prizeSession';

test('find search is a full email, a name, or nothing for a phone', () => {
  assert.equal(playerSearchMode('a'), 'none');
  assert.equal(playerSearchMode('Sree'), 'text');
  assert.equal(playerSearchMode('SK82'), 'text');
  assert.equal(playerSearchMode('sree@example.com'), 'email');
  assert.equal(playerSearchMode('sree@'), 'none');
  assert.equal(playerSearchMode('555-123-4567'), 'none');
  assert.equal(playerSearchMode('+1 555 123 4567'), 'none');
});

test('my list search does not look at an email address', () => {
  const player = { name: 'Sree Koneru', playerCode: 'SK82' };
  assert.equal(matchesMyPlayer(player, 'sree'), true);
  assert.equal(matchesMyPlayer(player, 'sk82'), true);
  assert.equal(matchesMyPlayer(player, 'sree@example.com'), false);
});

test('today uses the local calendar day', () => {
  const now = new Date(2026, 9, 28, 23, 30);
  assert.equal(isLocalToday(new Date(2026, 9, 28, 0, 5).toISOString(), now), true);
  assert.equal(isLocalToday(new Date(2026, 9, 27, 23, 0).toISOString(), now), false);
});

test('only an admin of the game can settle it', () => {
  const game = { createdBy: 'host', adminIds: ['keeper'] };
  assert.equal(userAdminsGame(game, 'host'), true);
  assert.equal(userAdminsGame(game, 'keeper'), true);
  assert.equal(userAdminsGame(game, 'player'), false);
});

test('stake opening coins are the points and expense is not a person', () => {
  const shares = stakePrizeShares([
    { id: 'a', points: 40 },
    { id: 'b', points: -30 },
  ]);
  assert.deepEqual(shares, { a: 40, b: -30 });
  const opening = openingBalances([{
    id: 'g',
    gameType: 'stake',
    players: [
      { id: 'a', points: 40 },
      { id: 'b', points: -50 },
    ],
  }]);
  assert.equal(coinSum(opening), -10);
  assert.equal(opening.EX, undefined);
});

test('a payment that does not add to 0 cannot be saved', () => {
  assert.equal(validateLegs([
    { profileId: 'a', amount: -20 },
    { profileId: 'b', amount: 10 },
  ]).ok, false);
  assert.equal(validateLegs([
    { profileId: 'a', amount: -20 },
    { profileId: 'b', amount: 20 },
  ]).ok, true);
});

test('invite is the get page and not an email form', () => {
  assert.equal(INVITE_URL, 'https://sreeatcandorps.github.io/Games/get');
  assert.match(inviteMessage(), /Play Rummy Home with me: https:\/\/sreeatcandorps\.github\.io\/Games\/get/);
});

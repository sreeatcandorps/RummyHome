import assert from 'node:assert/strict';
import test from 'node:test';
import { isLocalToday } from '../utils/localDay';
import { userAdminsGame } from '../utils/gameAccess';
import { inviteMessage, INVITE_URL } from '../utils/inviteLink';
import { matchesMyPlayer, parsePlayerIdQuery } from '../utils/playerSearch';
import { HELP } from './_helpLegacy';
import { pointsGameLabel } from '../constants/features';

test('find search is a Player ID only: names, emails and phones are not queries (D113)', () => {
  assert.equal(parsePlayerIdQuery('a'), null);
  assert.equal(parsePlayerIdQuery('Sree'), null);
  assert.equal(parsePlayerIdQuery('SK82'), null);
  assert.equal(parsePlayerIdQuery('sree@example.com'), null);
  assert.equal(parsePlayerIdQuery('555-123-4567'), null);
  assert.equal(parsePlayerIdQuery('#82'), 82);
});

test('my list search matches a name, initials, or player ID, and never an email', () => {
  const player = { name: 'Sree Koneru', playerCode: 'SK82', firstName: 'Sree', lastName: 'Koneru' };
  assert.equal(matchesMyPlayer(player, 'sree'), true);
  assert.equal(matchesMyPlayer(player, 'koneru'), true);
  assert.equal(matchesMyPlayer(player, 'sk'), true);
  assert.equal(matchesMyPlayer(player, 'sk82'), true);
  assert.equal(matchesMyPlayer(player, 'sree@example.com'), false);
  const numbered = { name: 'Player 4', playerCode: '#42' };
  assert.equal(matchesMyPlayer(numbered, 'p4'), true);
  assert.equal(matchesMyPlayer(numbered, '42'), true);
  assert.equal(matchesMyPlayer(numbered, '#42'), true);
  assert.equal(matchesMyPlayer(numbered, 'mvp'), false);
});

test('today uses the local calendar day', () => {
  const now = new Date(2026, 9, 28, 23, 30);
  assert.equal(isLocalToday(new Date(2026, 9, 28, 0, 5).toISOString(), now), true);
  assert.equal(isLocalToday(new Date(2026, 9, 27, 23, 0).toISOString(), now), false);
});

test('only an admin of the game admins it', () => {
  const game = { createdBy: 'host', adminIds: ['keeper'] };
  assert.equal(userAdminsGame(game, 'host'), true);
  assert.equal(userAdminsGame(game, 'keeper'), true);
  assert.equal(userAdminsGame(game, 'player'), false);
});

test('no money words and results talk about places', () => {
  assert.equal(pointsGameLabel(), 'Points');
  const shown = [HELP.home, HELP.newGame, HELP.scorecard, HELP.scoreEntry, HELP.players, HELP.me, HELP.results].join('\n');
  assert.doesNotMatch(shown, /settle|prize|stake|coins|ledger|payment|money/i);
  assert.match(HELP.home, /Results/);
  assert.match(HELP.results, /place/);
  assert.match(HELP.results, /winner/);
});

test('invite is the get page and not an email form', () => {
  assert.equal(INVITE_URL, 'https://ezscore.mindweavetech.com/get');
  assert.match(inviteMessage(), /Get it here: https:\/\/ezscore\.mindweavetech\.com\/get /);
});

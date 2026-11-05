import assert from 'node:assert/strict';
import test from 'node:test';
import { HELP } from '../constants/help';
import { filterRecentGames, isWithinLastDays, RECENT_CHIPS, splitHomeGames } from '../utils/homeGames';
import {
  myPlayersGridHeight,
  MY_PLAYERS_CARD_HEIGHT,
  nextSort,
  orderDatabaseResults,
  playerIdBadge,
  playerIdNumber,
  SORT_LABEL,
  sortMyPlayers,
} from '../utils/myPlayersList';
import { markPlayerToCheck, queuePlayersForNewGame, takePlayersToCheck } from '../utils/pendingPlayer';

const now = new Date('2026-11-04T23:00:00');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();

test('Home lists every live game and keeps Completed and Closed games for Recent', () => {
  const games = [
    { id: 'a', isComplete: false, date: daysAgo(0) },
    { id: 'b', isComplete: false, date: daysAgo(1) },
    { id: 'c', isComplete: true, date: daysAgo(2) },
    { id: 'd', isComplete: true, closedAt: daysAgo(3), date: daysAgo(12) },
  ];
  const { live, recent } = splitHomeGames(games);
  assert.deepEqual(live.map((g) => g.id), ['a', 'b'], 'both active games, not just the first');
  assert.deepEqual(recent.map((g) => g.id), ['c', 'd'], 'completed and closed, never live');
});

test('Recent filters are All and Last 10 days; there is no Live filter', () => {
  assert.deepEqual(RECENT_CHIPS.map((chip) => chip.label), ['All', 'Last 10 days']);
  const games = [
    { id: 'recent', isComplete: true, date: daysAgo(9) },
    { id: 'edge', isComplete: true, date: daysAgo(10) },
    { id: 'old', isComplete: true, date: daysAgo(11) },
  ];
  assert.deepEqual(filterRecentGames(games, 'all', now).map((g) => g.id), ['recent', 'edge', 'old']);
  assert.deepEqual(filterRecentGames(games, 'last10d', now).map((g) => g.id), ['recent', 'edge']);
  assert.equal(isWithinLastDays('not a date', 10, now), false);
});

test('players show a numeric Player ID badge and never a letter code', () => {
  assert.equal(playerIdNumber({ playerNo: 42 }), 42);
  assert.equal(playerIdNumber({ playerCode: '#42' }), 42, 'servers on migration 012 label the ID as #42');
  assert.equal(playerIdNumber({ playerCode: '7' }), 7);
  assert.equal(playerIdNumber({ playerCode: 'QTGFJH' }), null, 'old letter codes are hidden');
  assert.equal(playerIdNumber({}), null);
  assert.equal(playerIdBadge({ playerNo: 42 }), 'Player ID 42');
  assert.equal(playerIdBadge({ playerCode: 'QTGFJH' }), null);
});

test('My players sorts by name or by how often you play together', () => {
  const players = [
    { id: 'v', name: 'Venkat Nallamothu', gamesTogether: 3 },
    { id: 'a', name: 'Anil Peddi', gamesTogether: 3 },
    { id: 'h', name: 'Harish Gadupudi', gamesTogether: 9 },
    { id: 'k', name: 'Kiran Tummala' },
  ];
  assert.deepEqual(sortMyPlayers(players, 'name').map((p) => p.id), ['a', 'h', 'k', 'v']);
  assert.deepEqual(sortMyPlayers(players, 'frequent').map((p) => p.id), ['h', 'a', 'v', 'k'], 'ties fall back to name');
  assert.equal(SORT_LABEL.name, 'Sort by Name');
  assert.equal(SORT_LABEL.frequent, 'Sort by Frequent');
  assert.equal(nextSort('name'), 'frequent');
  assert.equal(nextSort('frequent'), 'name');
});

test('the My players grid shows four rows of two before it scrolls', () => {
  assert.equal(myPlayersGridHeight(0), 0);
  assert.equal(myPlayersGridHeight(1), MY_PLAYERS_CARD_HEIGHT);
  assert.equal(myPlayersGridHeight(3), 2 * MY_PLAYERS_CARD_HEIGHT);
  assert.equal(myPlayersGridHeight(12), 4 * MY_PLAYERS_CARD_HEIGHT);
  assert.equal(myPlayersGridHeight(40), 4 * MY_PLAYERS_CARD_HEIGHT);
});

test('database results put people not yet in My players first', () => {
  const ordered = orderDatabaseResults(
    [{ id: 'p1', name: 'Player 1' }, { id: 'p2', name: 'Player 2' }, { id: 'p3', name: 'Player 3' }],
    ['p1', 'p3'],
  );
  assert.deepEqual(ordered.map((row) => [row.id, row.inMyPlayers]), [['p2', false], ['p1', true], ['p3', true]]);
});

test('players added from the database while New game waits are seated when it returns', () => {
  takePlayersToCheck();
  markPlayerToCheck({ id: 'p9', name: 'Player 9', playerCode: '#9' });
  markPlayerToCheck({ id: 'p9', name: 'Player 9' });
  markPlayerToCheck({ id: 'p4', name: 'Player 4' });
  assert.deepEqual(takePlayersToCheck().map((row) => row.id), ['p9', 'p4'], 'each person once, in order');
  assert.deepEqual(takePlayersToCheck(), [], 'taken only once');
  assert.deepEqual(queuePlayersForNewGame([{ id: 'a', name: 'A' }], { id: 'a', name: 'A' }).length, 1);
});

test('help copy matches the new Home, My players, and Find screens', () => {
  assert.match(HELP.home, /consolidated winners from one or more games/);
  assert.match(HELP.home, /Completed to Closed/);
  assert.match(HELP.home, /My players/);
  assert.doesNotMatch(HELP.home, /Last 24 hours|Resume|avatar/);
  for (const button of ['Add new players', 'Find player in database', 'Register players']) {
    assert.match(HELP.players, new RegExp(button));
  }
  assert.match(HELP.players, /live link/);
  assert.doesNotMatch(HELP.players, /− and \+/);
  assert.match(HELP.find, /In your player list/);
  assert.match(HELP.addToGame, /\+ Add/);
  assert.match(HELP.newGame, /Add player from database/);
  assert.doesNotMatch(HELP.newGame, /− and \+/);
});

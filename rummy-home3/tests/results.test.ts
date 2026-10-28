import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_RESULTS_PLAYERS, RESULTS_PLAYER_LIMIT, SEATED_PLAYER_LIMIT } from '../constants/limits';
import { buildShareCard, SHARE_CARD_LINE_CAP } from '../utils/shareCard';
import {
  canDeclareResults,
  formatPoints,
  placeLabel,
  podiumPlaces,
  presentResults,
  resultsPlayerCount,
  scoreCell,
  splitTotals,
  totalAcrossGames,
  winnerLine,
} from '../utils/results';

const host = { createdBy: 'host', adminIds: ['host'] };
const rita = { createdBy: 'rita', adminIds: ['rita'] };

test('points add up across games and the expense column is not a place', () => {
  const standings = totalAcrossGames([
    {
      players: ['host', 'rita', 'EX'],
      scores: { host: [20], rita: [-10], EX: [-10] },
      names: { host: 'Host', rita: 'Rita', EX: 'Expenses' },
    },
    {
      players: ['host', 'rita', 'dev'],
      scores: { host: [10], rita: [30], dev: [-40] },
      names: { host: 'Host', rita: 'Rita', dev: 'Dev' },
    },
  ]);

  assert.deepEqual(standings.map((row) => [row.name, row.points, row.place, row.games]), [
    ['Host', 30, 1, 2],
    ['Rita', 20, 2, 2],
    ['Dev', -40, 3, 1],
  ]);
  assert.equal(standings.some((row) => row.id === 'EX'), false);
  assert.equal(winnerLine(standings), 'Winner: Host');
  assert.equal(podiumPlaces(standings).length, 3);
});

test('tied totals share a place and the next place skips', () => {
  const standings = totalAcrossGames([
    {
      players: ['a', 'b', 'c', 'd'],
      scores: { a: [10], b: [10], c: [4], d: [1] },
      names: { a: 'Ada', b: 'Bea', c: 'Cam', d: 'Dee' },
    },
  ]);
  assert.deepEqual(standings.map((row) => [row.name, row.place]), [
    ['Ada', 1],
    ['Bea', 1],
    ['Cam', 3],
    ['Dee', 4],
  ]);
  assert.equal(winnerLine(standings), '1st place: Ada and Bea');
  assert.equal(podiumPlaces(standings).map((group) => group[0].place).join(','), '1,3,4');
  assert.equal(placeLabel(1), '1st');
  assert.equal(placeLabel(2), '2nd');
  assert.equal(placeLabel(3), '3rd');
  assert.equal(placeLabel(11), '11th');
  assert.equal(formatPoints(30), '+30');
  assert.equal(formatPoints(-4), '-4');
});

test('positive totals stay on the left, negative totals on the right, each by magnitude', () => {
  const standings = totalAcrossGames([
    {
      players: ['a', 'b', 'c', 'd', 'e', 'EX'],
      scores: { a: [50], b: [0], c: [-40], d: [-10], e: [10], EX: [-10] },
      names: { a: 'Ada', b: 'Bea', c: 'Cam', d: 'Dee', e: 'Eve', EX: 'Expenses' },
    },
  ]);
  const columns = splitTotals(standings);
  assert.deepEqual(columns.positive.map((row) => [row.name, row.points]), [
    ['Ada', 50],
    ['Eve', 10],
    ['Bea', 0],
  ]);
  assert.deepEqual(columns.negative.map((row) => [row.name, row.points]), [
    ['Cam', -40],
    ['Dee', -10],
  ]);
});

test('each game is a row, a missing seat is a dash, and a zero is a score', () => {
  const { sheet } = presentResults([
    {
      id: 'g2',
      name: 'LATE',
      date: '2026-10-28T20:00:00.000Z',
      players: ['a', 'c'],
      scores: { a: [5, 0], c: [-5] },
      names: { a: 'Ada', c: 'Cam' },
    },
    {
      id: 'g1',
      name: 'NIGHT',
      date: '2026-10-28T18:00:00.000Z',
      players: ['a', 'b', 'EX'],
      scores: { a: [10], b: [0], EX: [-10] },
      names: { a: 'Ada', b: 'Bea', EX: 'Expenses' },
    },
  ]);

  assert.deepEqual(sheet.games.map((game) => game.name), ['NIGHT', 'LATE']);
  assert.equal(scoreCell(sheet.games[0].scores, sheet.players.find((player) => player.name === 'Bea')?.id ?? ''), '0');
  assert.equal(scoreCell(sheet.games[1].scores, sheet.players.find((player) => player.name === 'Bea')?.id ?? ''), '—');
  assert.equal(scoreCell(sheet.games[0].scores, 'EX'), '—');
  assert.equal(sheet.players.some((player) => player.id === 'EX'), false);
  const ada = sheet.players.find((player) => player.name === 'Ada');
  assert.equal(ada && sheet.games[1].scores[ada.id], 5);
});

test('results stop at 50 players and a game stops at 15', () => {
  const tooMany = [{ players: Array.from({ length: MAX_RESULTS_PLAYERS + 1 }, (_, index) => `p${index}`), scores: {} }];
  assert.equal(resultsPlayerCount(tooMany), 51);
  assert.equal(resultsPlayerCount([{ players: ['a', 'EX', 'a'], scores: {} }]), 1);
  assert.equal(RESULTS_PLAYER_LIMIT, 'Results can include at most 50 players.');
  assert.equal(SEATED_PLAYER_LIMIT, 'A game can have at most 15 players.');
});

test('the share image names Rummy Home and shortens a long list', () => {
  const card = buildShareCard({
    title: 'Results',
    date: 'Wed, Oct 28 · 6:40 PM',
    rows: Array.from({ length: SHARE_CARD_LINE_CAP + 3 }, (_, index) => ({ name: `P${index}`, points: index })),
    places: [{ label: '1st', names: 'P14', points: 14 }],
  });
  assert.equal(card.brand, 'Rummy Home');
  assert.equal(card.title, 'Results');
  assert.equal(card.lines.length, SHARE_CARD_LINE_CAP);
  assert.equal(card.moreCount, 3);
  assert.equal(card.lines[0].name, 'P14');
  assert.equal(card.places[0].points, '+14');
});

test('only an admin of every selected game can declare', () => {
  assert.equal(canDeclareResults([host], 'host'), true);
  assert.equal(canDeclareResults([rita], 'host'), false);
  assert.equal(canDeclareResults([host, rita], 'host'), false);
  assert.equal(canDeclareResults([], 'host'), false);
  assert.equal(canDeclareResults([host], null), false);
});

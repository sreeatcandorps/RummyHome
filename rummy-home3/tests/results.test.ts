import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canDeclareResults,
  formatPoints,
  placeLabel,
  podiumPlaces,
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

test('only an admin of every selected game can declare', () => {
  assert.equal(canDeclareResults([host], 'host'), true);
  assert.equal(canDeclareResults([rita], 'host'), false);
  assert.equal(canDeclareResults([host, rita], 'host'), false);
  assert.equal(canDeclareResults([], 'host'), false);
  assert.equal(canDeclareResults([host], null), false);
});

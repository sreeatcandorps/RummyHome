import assert from 'node:assert/strict';
import test from 'node:test';
import { baseInitials, buildPlayerInitials, firstAppearanceOrder, initialsById } from '../utils/playerInitials';

test('uses first and last name initials and ignores middle names', () => {
  assert.deepEqual(buildPlayerInitials(['Sreenivas Koneru', 'Aditi Rao', 'Mary Jane Watson']), ['SK', 'AR', 'MW']);
});

test('the first player keeps the initials; later duplicates get the first initial plus 2, 3, ...', () => {
  assert.deepEqual(
    buildPlayerInitials(['Harish Yadav', 'Hema Yarlagadda', 'Hari Yellapragada', 'Anil Peddi']),
    ['HY', 'H2', 'H3', 'AP'],
  );
});

test('labels stay two characters and skip a number someone else already has', () => {
  assert.deepEqual(buildPlayerInitials(['Player 1', 'Player 2', 'Player 10']), ['P1', 'P2', 'P3']);
  buildPlayerInitials(['Sam Kumar', 'Sunil Kohli', 'Sai Krishna']).forEach((label) => assert.equal(label.length, 2));
});

test('order decides who keeps the plain initials', () => {
  assert.deepEqual(buildPlayerInitials(['Sam Kumar', 'Sunil Kohli']), ['SK', 'S2']);
  assert.deepEqual(buildPlayerInitials(['Sunil Kohli', 'Sam Kumar']), ['SK', 'S2']);
});

test('single word names use two letters', () => {
  assert.equal(baseInitials('Ravi'), 'RA');
  assert.deepEqual(buildPlayerInitials(['Ravi', 'Rani']), ['RA', 'R2']);
});

test('never returns an empty label', () => {
  const labels = buildPlayerInitials(['', '   ']);
  labels.forEach((label) => assert.ok(label.length > 0));
  assert.notEqual(labels[0], labels[1]);
});

test('results label players by first appearance across the games, not by total', () => {
  const players = [
    { id: 'hema', name: 'Hema Yarlagadda' },
    { id: 'harish', name: 'Harish Yadav' },
    { id: 'anil', name: 'Anil Peddi' },
  ];
  const games = [
    { scores: { harish: 10, anil: -10 } },
    { scores: { hema: 30, harish: -30 } },
  ];
  const ordered = firstAppearanceOrder(players, games);
  assert.deepEqual(ordered.map((player) => player.id), ['harish', 'anil', 'hema']);
  const labels = initialsById(ordered);
  assert.equal(labels.get('harish'), 'HY');
  assert.equal(labels.get('hema'), 'H2');
  assert.equal(labels.get('anil'), 'AP');
});

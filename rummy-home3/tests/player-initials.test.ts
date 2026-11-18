import assert from 'node:assert/strict';
import test from 'node:test';
import { baseInitials, buildPlayerInitials, firstAppearanceOrder, initialsById } from '../utils/playerInitials';

test('uses first and last name initials and ignores middle names', () => {
  assert.deepEqual(buildPlayerInitials(['Sreenivas Koneru', 'Aditi Rao', 'Mary Jane Watson']), ['SK', 'AR', 'MW']);
});

test('the first player keeps the initials; later duplicates get three letters from their own name (Nov 11 rule, no numbers)', () => {
  assert.deepEqual(
    buildPlayerInitials(['Harish Yadav', 'Hema Yarlagadda', 'Hari Yellapragada', 'Anil Peddi']),
    ['HY', 'HEY', 'HAY', 'AP'],
  );
});

test('digits in a name are not letters; a digit form appears only when every letter form is taken', () => {
  assert.deepEqual(buildPlayerInitials(['Player 1', 'Player 2', 'Player 10']), ['PL', 'PLA', 'PLY']);
  buildPlayerInitials(['Sam Kumar', 'Sunil Kohli', 'Sai Krishna']).forEach((label) => assert.match(label, /^[A-Z]{2,3}$/));
});

test('order decides who keeps the plain initials', () => {
  assert.deepEqual(buildPlayerInitials(['Sam Kumar', 'Sunil Kohli']), ['SK', 'SUK']);
  assert.deepEqual(buildPlayerInitials(['Sunil Kohli', 'Sam Kumar']), ['SK', 'SAK']);
});

test('single word names use two letters, three on a clash', () => {
  assert.equal(baseInitials('Ravi'), 'RA');
  assert.deepEqual(buildPlayerInitials(['Ravi', 'Rani']), ['RA', 'RAN']);
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
  assert.equal(labels.get('hema'), 'HEY');
  assert.equal(labels.get('anil'), 'AP');
});

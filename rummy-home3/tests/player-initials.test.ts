import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlayerInitials } from '../utils/playerInitials';

test('uses first and last name initials', () => {
  assert.deepEqual(buildPlayerInitials(['Sreenivas Koneru', 'Aditi Rao']), ['SK', 'AR']);
});

test('ignores middle names', () => {
  assert.deepEqual(buildPlayerInitials(['Mary Jane Watson']), ['MW']);
});

test('sample players stay distinct', () => {
  assert.deepEqual(buildPlayerInitials(['Player 1', 'Player 2', 'Player 10']), ['P1', 'P2', 'P10']);
});

test('numbers duplicate initials in seat order', () => {
  assert.deepEqual(buildPlayerInitials(['Sam Kumar', 'Sunil Kohli']), ['SK1', 'SK2']);
});

test('single word names use one letter', () => {
  assert.deepEqual(buildPlayerInitials(['Ravi']), ['R']);
});

test('labels the expense column', () => {
  assert.deepEqual(buildPlayerInitials(['Expenses']), ['EXP']);
});

test('never returns an empty label', () => {
  const labels = buildPlayerInitials(['', '   ']);
  labels.forEach((label) => assert.ok(label.length > 0));
  assert.notEqual(labels[0], labels[1]);
});

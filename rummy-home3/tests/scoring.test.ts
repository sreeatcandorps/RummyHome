import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateDealerId,
  calculateFinalTotals,
  getDropValue,
  getMiddleDropValue,
  validateRoundScores,
} from '../utils/scoring';

test('validates balanced rummy rounds', () => {
  const result = validateRoundScores([
    { playerId: 'a', value: -10, scoreType: 'drop' },
    { playerId: 'b', value: -30, scoreType: 'middle_drop' },
    { playerId: 'c', value: 40, scoreType: 'rummy' },
  ]);

  assert.equal(result.valid, true);
});

test('rejects unbalanced rounds', () => {
  const result = validateRoundScores([
    { playerId: 'a', value: -10, scoreType: 'drop' },
    { playerId: 'b', value: 5, scoreType: 'rummy' },
  ]);

  assert.equal(result.valid, false);
  assert.match(result.error ?? '', /must be 0/);
});

test('calculates dealer rotation by round', () => {
  assert.equal(calculateDealerId(['a', 'b', 'c'], 1), 'a');
  assert.equal(calculateDealerId(['a', 'b', 'c'], 2), 'b');
  assert.equal(calculateDealerId(['a', 'b', 'c'], 4), 'a');
});

test('uses separate stake and pool defaults', () => {
  assert.equal(getDropValue('stake'), -10);
  assert.equal(getMiddleDropValue('stake'), -30);
  assert.equal(getDropValue('pool'), -25);
  assert.equal(getMiddleDropValue('pool'), -50);
});

test('calculates final player totals', () => {
  assert.deepEqual(calculateFinalTotals({
    a: [-10, -30],
    b: [40, 0],
  }), {
    a: -40,
    b: 40,
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { distributeRummyWinnings } from '../utils/rummyDistribution';
import { validateRoundScores } from '../utils/scoring';

test('single winner takes the whole pot', () => {
  const result = distributeRummyWinnings(-50, ['a']);
  assert.deepEqual(result, { a: 50 });
});

test('two winners split evenly', () => {
  const result = distributeRummyWinnings(-50, ['a', 'b']);
  assert.deepEqual(result, { a: 25, b: 25 });
});

test('remainder goes to the earliest selected winners', () => {
  const result = distributeRummyWinnings(-50, ['a', 'b', 'c']);
  assert.deepEqual(result, { a: 17, b: 17, c: 16 });
  assert.equal(result.a + result.b + result.c, 50);
});

test('distribution always balances the round to zero', () => {
  for (const total of [-10, -33, -47, -100, -7]) {
    for (const winnerCount of [1, 2, 3, 4, 5]) {
      const winners = Array.from({ length: winnerCount }, (_, index) => `w${index}`);
      const distribution = distributeRummyWinnings(total, winners);
      const won = Object.values(distribution).reduce((sum, value) => sum + value, 0);
      assert.equal(total + won, 0, `total ${total} across ${winnerCount} winners`);
    }
  }
});

test('no winners means nothing is distributed', () => {
  assert.deepEqual(distributeRummyWinnings(-40, []), {});
});

test('a positive entries total leaves winners at zero', () => {
  assert.deepEqual(distributeRummyWinnings(10, ['a']), { a: 0 });
});

test('distributed rounds pass round validation', () => {
  const distribution = distributeRummyWinnings(-40, ['a', 'b', 'c']);
  const scores = [
    { playerId: 'x', value: -10, scoreType: 'drop' as const },
    { playerId: 'y', value: -30, scoreType: 'middle_drop' as const },
    ...Object.entries(distribution).map(([playerId, value]) => ({
      playerId,
      value,
      scoreType: 'rummy' as const,
    })),
  ];

  assert.equal(validateRoundScores(scores).valid, true);
});

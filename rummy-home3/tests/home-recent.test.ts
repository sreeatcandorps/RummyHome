import test from 'node:test';
import assert from 'node:assert/strict';
import { filterRecentGames, finishedAt, sortRecentGames, splitHomeGames } from '../utils/homeGames';
import { canReopenGame } from '../utils/gameStatus';

test('Recent is ordered by completion time, not by the day the game was created', () => {
  const games = [
    { id: 'old-created-finished-last', isComplete: true, date: '2026-11-01T10:00:00Z', completedAt: '2026-11-06T22:00:00Z' },
    { id: 'new-created-finished-first', isComplete: true, date: '2026-11-06T09:00:00Z', completedAt: '2026-11-06T12:00:00Z' },
    { id: 'live', isComplete: false, date: '2026-11-06T20:00:00Z' },
  ];
  const { live, recent } = splitHomeGames(games);
  assert.deepEqual(live.map((g) => g.id), ['live']);
  assert.deepEqual(recent.map((g) => g.id), ['old-created-finished-last', 'new-created-finished-first']);
});

test('a Closed game keeps its completion time; older rows fall back to closed_at then the game date', () => {
  assert.equal(finishedAt({ date: '2026-11-01', completedAt: '2026-11-03', closedAt: '2026-11-05' }), '2026-11-03');
  assert.equal(finishedAt({ date: '2026-11-01', completedAt: null, closedAt: '2026-11-05' }), '2026-11-05');
  assert.equal(finishedAt({ date: '2026-11-01', completedAt: null, closedAt: null }), '2026-11-01');
});

test('ties are deterministic: same finish time falls back to date, then id', () => {
  const sorted = sortRecentGames([
    { id: 'b', date: '2026-11-01T00:00:00Z', completedAt: '2026-11-06T00:00:00Z' },
    { id: 'a', date: '2026-11-01T00:00:00Z', completedAt: '2026-11-06T00:00:00Z' },
    { id: 'c', date: '2026-11-02T00:00:00Z', completedAt: '2026-11-06T00:00:00Z' },
  ]);
  assert.deepEqual(sorted.map((g) => g.id), ['c', 'a', 'b']);
});

test('the Last 10 days chip looks at when the game finished', () => {
  const now = new Date('2026-11-07T00:00:00Z');
  const games = [
    { id: 'finished-recently', date: '2026-10-01T00:00:00Z', completedAt: '2026-11-05T00:00:00Z' },
    { id: 'finished-long-ago', date: '2026-10-01T00:00:00Z', completedAt: '2026-10-05T00:00:00Z' },
  ];
  assert.deepEqual(filterRecentGames(games, 'last10d', now).map((g) => g.id), ['finished-recently']);
  assert.equal(filterRecentGames(games, 'all', now).length, 2);
});

test('only a Completed game that is not Closed can be reopened', () => {
  assert.equal(canReopenGame({ isComplete: true, closedAt: null }), true);
  assert.equal(canReopenGame({ isComplete: true, closedAt: '2026-11-06T00:00:00Z' }), false);
  assert.equal(canReopenGame({ isComplete: false, closedAt: null }), false);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_RESULTS_FILTER,
  filterResultGames,
  resultsEmptyText,
  resultsPickerHeading,
  resultsStatusCounts,
  resultsStatusOf,
  toggleResultsStatus,
  visibleSelection,
} from '../utils/results';

const games = [
  { id: 'a1', isComplete: false },
  { id: 'a2', isComplete: false },
  { id: 'c1', isComplete: true },
  { id: 'c2', isComplete: true },
  { id: 'x1', isComplete: true, closedAt: '2026-11-06T01:00:00Z' },
];

test('nov 6: a game in a result is Closed, a finished one Completed, the rest Active', () => {
  assert.deepEqual(games.map(resultsStatusOf), ['active', 'active', 'completed', 'completed', 'closed']);
  assert.deepEqual(resultsStatusCounts(games), { completed: 2, closed: 1, active: 2 });
});

test('nov 6: status chips are multi-select and keep a fixed order', () => {
  let filter = DEFAULT_RESULTS_FILTER;
  filter = toggleResultsStatus(filter, 'active');
  assert.deepEqual(filter, ['completed', 'active']);
  filter = toggleResultsStatus(filter, 'closed');
  assert.deepEqual(filter, ['completed', 'closed', 'active']);
  filter = toggleResultsStatus(filter, 'completed');
  assert.deepEqual(filter, ['closed', 'active']);
  assert.deepEqual(filterResultGames(games, filter).map((g) => g.id), ['a1', 'a2', 'x1']);
  assert.deepEqual(toggleResultsStatus(['closed'], 'closed'), []);
  assert.deepEqual(filterResultGames(games, []), []);
});

test('nov 6: the heading names the single status, or just says games for a mix', () => {
  assert.equal(resultsPickerHeading(['completed']), 'Select completed games');
  assert.equal(resultsPickerHeading(['closed']), 'Select closed games');
  assert.equal(resultsPickerHeading(['completed', 'active']), 'Select games');
});

test('nov 6: only ticked games that are on screen count (7 ticked, 5 shown means 5)', () => {
  const checked = ['a1', 'c1', 'c2', 'x1', 'ghost'];
  const shown = filterResultGames(games, ['completed']);
  assert.deepEqual(visibleSelection(checked, shown).map((g) => g.id), ['c1', 'c2']);
  assert.deepEqual(visibleSelection(checked, filterResultGames(games, ['closed'])).map((g) => g.id), ['x1']);
});

test('nov 6: the empty text never claims there are no games when the chips hide some', () => {
  assert.equal(resultsEmptyText([], ['completed']), 'No games to add up yet. Start a game from Home, then select it here.');
  const noneCompleted = games.filter((g) => resultsStatusOf(g) !== 'completed');
  assert.equal(resultsEmptyText(noneCompleted, ['completed']), 'No Completed games. Hidden by the chips: 1 Closed, 2 Active.');
  assert.equal(resultsEmptyText(noneCompleted, ['completed', 'closed', 'active']), 'No Completed or Closed or Active games.');
  assert.equal(resultsEmptyText(games, []), 'No status selected. Turn on a chip above to list games (2 Completed, 1 Closed, 2 Active).');
});

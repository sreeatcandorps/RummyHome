import assert from 'node:assert/strict';
import test from 'node:test';
import { HELP } from '../constants/help';
import { helpOutline, splitHelpLine } from '../utils/helpMarkup';
import { nameSegments } from '../utils/boldName';
import { filterMyPlayers, matchesPlayerFilter, SORT_CHIP, SORT_OPTIONS } from '../utils/myPlayersList';
import { orderCandidates } from '../utils/playerIdentity';
import { addDraftPick, removeDraftPick, newGameDraft } from '../utils/newGameDraft';
import { actionFill, CELL_FILL, cellTone, PRESET_FLASH_FILL, PRESET_FLASH_MS } from '../utils/roundEntry';
import { editableRounds, entryFromRound, playedRounds, retiredRoundNumber } from '../utils/editRound';
import {
  DEFAULT_RESULTS_FILTER,
  defaultResultSelection,
  filterResultGames,
  resultWarnings,
  reusedInResult,
} from '../utils/results';
import { GAME_STATUS_TONE } from '../utils/gameStatus';

test('build 4: Home help is Statuses, Results, My players, with coloured chips', () => {
  const { headings, bullets } = helpOutline(HELP.home);
  assert.deepEqual(headings, ['Statuses', 'Results', 'My players']);
  assert.equal(bullets.length, 5);
  assert.ok(bullets[0].startsWith('[Active]'));
  assert.ok(bullets[1].startsWith('[Completed]'));
  assert.ok(bullets[2].startsWith('[Closed]'));
  assert.ok(bullets[3].startsWith('[Results] show the consolidated winners from one or more games.'));
  assert.match(bullets[3], /move from \[Completed\] to \[Closed\]/);
  assert.equal(bullets[4], 'My players is a list of players you regularly play with.');
  assert.doesNotMatch(bullets[4], /database|register|link/i);
  const parts = splitHelpLine('From [Completed] to [Closed].');
  assert.deepEqual(parts, [
    { kind: 'text', text: 'From ' },
    { kind: 'chip', chip: 'Completed' },
    { kind: 'text', text: ' to ' },
    { kind: 'chip', chip: 'Closed' },
    { kind: 'text', text: '.' },
  ]);
  assert.deepEqual(GAME_STATUS_TONE, { Active: 'positive', Completed: 'primary', Closed: 'neutral' });
});

test('build 4: Results help says to delete the old result before reusing a Closed game', () => {
  assert.match(HELP.results, /delete the old result that closed it/);
});

test('build 4: names bold the first letter of the first and last name instead of an avatar', () => {
  const bold = (name: string) => nameSegments(name).filter((s) => s.bold).map((s) => s.text).join('');
  assert.equal(bold('Harish Gadupudi'), 'HG');
  assert.equal(bold('Ravi Chandra Bhimavarapu'), 'RB');
  assert.equal(bold('Madonna'), 'M');
  assert.equal(nameSegments('Harish Gadupudi').map((s) => s.text).join(''), 'Harish Gadupudi');
  assert.deepEqual(nameSegments('  '), []);
});

test('build 4: My players Unregistered filter includes Pending registration; sort chips are Frequent and Alphabetical', () => {
  assert.equal(matchesPlayerFilter('Unregistered', 'unregistered'), true);
  assert.equal(matchesPlayerFilter('Pending registration', 'unregistered'), true);
  assert.equal(matchesPlayerFilter('Registered', 'unregistered'), false);
  assert.equal(matchesPlayerFilter('Registered', 'all'), true);
  const rows = [{ id: 'a', s: 'Registered' as const }, { id: 'b', s: 'Pending registration' as const }, { id: 'c', s: 'Unregistered' as const }];
  assert.deepEqual(filterMyPlayers(rows, 'unregistered', (r) => r.s).map((r) => r.id), ['b', 'c']);
  assert.deepEqual(SORT_OPTIONS.map((o) => SORT_CHIP[o]), ['Frequent', 'Alphabetical']);
});

test('build 4: New game sort keeps Frequent order or goes alphabetical', () => {
  const sorted = [{ name: 'Zed' }, { name: 'Amy' }, { name: 'Bea' }];
  assert.deepEqual(orderCandidates(sorted, 'frequent').map((p) => p.name), ['Zed', 'Amy', 'Bea']);
  assert.deepEqual(orderCandidates(sorted, 'name').map((p) => p.name), ['Amy', 'Bea', 'Zed']);
});

test('build 4: the new-game draft is shared with Add New Players and edits flow both ways', () => {
  assert.deepEqual(addDraftPick([], { id: 'a', name: 'Ada' }), [{ id: 'a', name: 'Ada' }]);
  assert.deepEqual(addDraftPick([{ id: 'a', name: 'Ada' }], { id: 'a', name: 'Ada B' }), [{ id: 'a', name: 'Ada B' }]);
  assert.deepEqual(removeDraftPick([{ id: 'a', name: 'Ada' }, { id: 'b', name: 'Bea' }], 'a'), [{ id: 'b', name: 'Bea' }]);
  const seen: number[] = [];
  const stop = newGameDraft.subscribe((picks) => seen.push(picks.length));
  newGameDraft.set([{ id: 'x', name: 'X' }]);
  newGameDraft.add({ id: 'y', name: 'Y' });
  newGameDraft.remove('x');
  newGameDraft.clear();
  stop();
  assert.deepEqual(seen, [1, 2, 1, 0]);
  assert.deepEqual(newGameDraft.get(), []);
});

test('build 4: final Add round palette — yellow selected, green confirmed, blue Rummy, green preset flash', () => {
  assert.equal(CELL_FILL[cellTone('empty')], 'cellNeutral');
  assert.equal(CELL_FILL[cellTone('selected')], 'secondaryContainer');
  assert.equal(CELL_FILL[cellTone('pending')], 'secondaryContainer');
  assert.equal(CELL_FILL[cellTone('confirmed')], 'positiveContainer');
  assert.equal(actionFill('sign', true), 'secondaryContainer');
  assert.equal(actionFill('sign', false), 'surface');
  assert.equal(actionFill('rummy'), 'tertiaryContainer');
  assert.equal(actionFill('preset'), 'surface');
  assert.equal(PRESET_FLASH_FILL, 'positiveContainer');
  assert.ok(PRESET_FLASH_MS >= 300 && PRESET_FLASH_MS <= 500);
});

test('build 4: Edit round lists played rounds newest first and preloads their scores', () => {
  const game = { players: ['a', 'b'], scores: { a: [40, -20, -10], b: [-40, 20] } };
  assert.equal(playedRounds(game.scores), 3);
  assert.deepEqual(editableRounds(game.scores), [3, 2, 1]);
  const entry = entryFromRound(game, 2);
  assert.deepEqual(entry.entries, { a: { value: -20, scoreType: 'count' }, b: { value: 20, scoreType: 'rummy' } });
  assert.deepEqual(entryFromRound(game, 3).entries, { a: { value: -10, scoreType: 'count' } });
  assert.equal(retiredRoundNumber(2), 1002);
  assert.equal(retiredRoundNumber(2, 1), 2002);
});

test('build 4 / nov 6: Results opens on Completed with every completed game ticked; other chips add games unticked', () => {
  assert.deepEqual(DEFAULT_RESULTS_FILTER, ['completed']);
  const games = [
    { id: 'open', isComplete: false },
    { id: 'done', isComplete: true },
    { id: 'closed', isComplete: true, closedAt: '2026-10-29T10:00:00Z' },
  ];
  assert.deepEqual(filterResultGames(games, ['completed']).map((g) => g.id), ['done']);
  assert.deepEqual(filterResultGames(games, ['completed', 'closed', 'active']).map((g) => g.id), ['open', 'done', 'closed']);
  assert.deepEqual(filterResultGames(games, ['closed']).map((g) => g.id), ['closed']);
  assert.deepEqual(defaultResultSelection(games, ['completed']), ['done']);
  assert.deepEqual(defaultResultSelection(games, ['completed', 'closed', 'active']), ['done'], 'only Completed games start ticked');
  assert.deepEqual(defaultResultSelection(games, ['active']), []);
});

test('build 4: two result warnings — active game used, game already in another result', () => {
  assert.deepEqual(resultWarnings([{ isComplete: true, gameNumber: 7 }]), []);
  const active = resultWarnings([{ isComplete: false, gameNumber: 9 }, { isComplete: true, gameNumber: 7 }]);
  assert.equal(active.length, 1);
  assert.equal(active[0].kind, 'active');
  assert.match(active[0].text, /An active game was used in these results \(G9\)/);
  const both = resultWarnings([{ isComplete: false, gameNumber: 9 }, { isComplete: true, closedAt: '2026-10-29T10:00:00Z', gameNumber: 5 }]);
  assert.deepEqual(both.map((w) => w.kind), ['active', 'reused']);
  assert.match(both[1].text, /G5 was already part of another result/);
  assert.equal(reusedInResult('2026-11-05T10:00:00Z', { closedAt: '2026-10-29T10:00:00Z' }), true);
  assert.equal(reusedInResult('2026-11-05T10:00:00Z', { closedAt: '2026-11-05T10:00:05Z' }), false, 'closed by this very result');
  assert.equal(reusedInResult('2026-11-05T10:00:00Z', { closedAt: null }), false);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Candidate, newGameGrid, PICKER_PAGE, pinOrganiser, sortCandidates } from '../utils/playerIdentity';
import { withOwnerFirst } from '../utils/myPlayersList';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const me: Candidate = { id: 'me', name: 'Srikanth Koneru', totalGames: 0, lastPlayedAt: null };
const others: Candidate[] = Array.from({ length: 14 }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}`, totalGames: 14 - i, lastPlayedAt: '2026-11-09T00:00:00Z' }));

test('bug 1 root cause: by Frequent the organiser sorts last and falls off the ten-row page', () => {
  const sorted = sortCandidates([...others, me], new Date('2026-11-10T00:00:00Z'));
  assert.equal(sorted.at(-1)?.id, 'me', 'zero games together and no last-played date sort the organiser last');
  const page = newGameGrid(sorted, [], PICKER_PAGE);
  assert.equal(page.length, 10);
  assert.ok(!page.some((c) => c.id === 'me'), 'the old picker never reached the organiser with more than ten players');
});

test('the organiser is pinned first on the picker until seated', () => {
  const sorted = sortCandidates(others, new Date('2026-11-10T00:00:00Z'));
  const page = newGameGrid(sorted, [], PICKER_PAGE);
  const pinned = pinOrganiser(page, me, []);
  assert.equal(pinned[0].id, 'me');
  assert.equal(pinned.length, 11, 'pinning adds a row rather than pushing someone off the page');
  assert.deepEqual(pinOrganiser(page, me, ['me']).map((c) => c.id), page.map((c) => c.id), 'seated organiser leaves the list');
  assert.deepEqual(pinOrganiser(page, me, [], false).map((c) => c.id), page.map((c) => c.id), 'a search that does not match the organiser hides them');
  assert.deepEqual(pinOrganiser(page, null, []), page);
  assert.equal(pinOrganiser([me, ...page], me, []).filter((c) => c.id === 'me').length, 1, 'never duplicated');
});

test('My players pins the signed-in player first, even with an empty roster', () => {
  const owner = { id: 'me', name: 'Srikanth Koneru' };
  const roster = [{ id: 'a', name: 'Anil' }, { id: 'b', name: 'Bala' }];
  assert.deepEqual(withOwnerFirst(roster, owner).map((p) => p.id), ['me', 'a', 'b']);
  assert.deepEqual(withOwnerFirst([], owner).map((p) => p.id), ['me']);
  assert.deepEqual(withOwnerFirst(roster, owner, false).map((p) => p.id), ['a', 'b'], 'hidden when the search or filter excludes them');
  assert.deepEqual(withOwnerFirst(roster, null).map((p) => p.id), ['a', 'b']);
  assert.deepEqual(withOwnerFirst([owner, ...roster], owner).map((p) => p.id), ['me', 'a', 'b'], 'never duplicated');
});

test('From database lets the organiser add themselves to a new game; picker and tab mark "You"', () => {
  const find = read('app/(screens)/players/new.tsx');
  assert.match(find, /isMe && !fromNewGame/, 'the "This is you" badge only replaces the button outside New game');
  assert.match(find, /\+ Add me/);
  assert.match(find, /if \(player\.id !== ownerId\) \{\s*await playersService\.addMyPlayer/, 'you are never added to your own roster');
  const picker = read('app/(screens)/games/new.tsx');
  assert.match(picker, /pinOrganiser\(grid, meWatching \? null : meCandidate, selectedIds, meMatches\)/);
  assert.match(picker, /isMe=\{c\.id === me\?\.id\}/);
  assert.match(read('components/players/PlayerPickerRow.tsx'), /label="You"/);
  const tab = read('app/(tabs)/players.tsx');
  assert.match(tab, /withOwnerFirst\(others, me, Boolean\(me\) && filter === 'all' && matchesMyPlayer\(me as Player, query\)\)/);
});

test('My players: three actions side by side, the registered-only note lives in help, Add new players starts in row 1', () => {
  const tab = read('app/(tabs)/players.tsx');
  assert.equal((tab.match(/<ActionTile/g) ?? []).length, 3);
  assert.match(tab, /label="Register unregistered players"/);
  assert.doesNotMatch(tab, /PLAYERS_NOTE/, 'the banner above the list is gone');
  const help = read('constants/help.ts');
  assert.match(help, /players: bullets\([\s\S]*PLAYERS_NOTE,/, 'the note is a My players help bullet');
  const add = read('app/(screens)/players/add.tsx');
  assert.doesNotMatch(add, /Add a row/);
  assert.match(add, /firstInputs\.current\[rows\[0\]\?\.key\]\?\.focus\(\)/, 'cursor in the first field by default');
  assert.match(add, /const fresh = blank\(\);/, 'a new row appears once every row is saved');
});

test('round scores: every loss is red, same size, not bold; wins stay green and bold; the Playing badge fits two digits', async () => {
  const { scoreTextStyle, scoreTone } = await import('../utils/scoreTone');
  assert.deepEqual(scoreTextStyle(scoreTone(40, 80)), { colorKey: 'positive', fontWeight: '800' });
  assert.deepEqual(scoreTextStyle(scoreTone(-10, 80)), { colorKey: 'negative', fontWeight: '600' }, 'a small loss is red too');
  assert.deepEqual(scoreTextStyle(scoreTone(-80, 80)), { colorKey: 'negative', fontWeight: '600' }, 'a big loss is the same red, not bolder');
  assert.deepEqual(scoreTextStyle(scoreTone(0, 80)), { colorKey: 'outline', fontWeight: '600' });
  const cell = read('components/game/ScoreCell.tsx');
  assert.match(cell, /scoreTextStyle\(scoreTone\(value \?\? 0\)\)/, 'round entry / edit round colour saved losses red');
  assert.doesNotMatch(cell, /\(value \?\? 0\) > 0 \? colors\.positive : colors\.onPositiveContainer/, 'the dark-green-for-everything rule is gone');
  const table = read('components/game/ScoreTable.tsx');
  assert.match(table, /color: colors\[text\.colorKey\], fontWeight: text\.fontWeight/);
  const picker = read('app/(screens)/games/new.tsx');
  assert.match(picker, /const PLAYING_BADGE = 68;/);
  assert.match(picker, /numberOfLines=\{1\} adjustsFontSizeToFit style=\{\[styles\.countText/);
});

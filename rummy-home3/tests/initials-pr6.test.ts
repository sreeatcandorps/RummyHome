import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  clashSentence,
  INITIALS_PATTERN,
  initialsCellsProblem,
  initialsProblem,
  pickFreeInitials,
  splitInitials,
  suggestInitials,
} from '../utils/initials';

const read = (relative: string) => readFileSync(path.join(__dirname, '..', relative), 'utf8');

/** The same rows public.pick_free_initials is asserted against in supabase/tests/29_initials_039.sql. */
const cases = read('supabase/tests/fixtures/initials-cases.csv')
  .trim()
  .split('\n')
  .slice(1)
  .map((line) => {
    const [typed, taken, expected, note] = line.split(',');
    return { typed, taken: taken ? taken.split(';') : [], expected, note };
  });

test('PR 6: the shared fixture drives pickFreeInitials (DB and app agree)', () => {
  assert.equal(cases.length, 13);
  for (const c of cases) assert.equal(pickFreeInitials(c.typed, c.taken), c.expected, c.note);
});

test('6.2 / 6.3 / 6.4: S + K free → SK; SK taken → SK2 with the exact sentence; SK, SK2 taken → SK3', () => {
  assert.equal(pickFreeInitials('SK', []), 'SK');
  assert.equal(pickFreeInitials('SK', ['SK']), 'SK2');
  assert.equal(clashSentence('SK', 'Sree Koneru', 'SK2'), 'Sree Koneru is already SK. This new player is SK2.');
  assert.equal(pickFreeInitials('SK', ['SK', 'SK2']), 'SK3');
  assert.deepEqual(splitInitials('SK2'), { letters: 'SK', digits: '2' }, 'the digit is drawn in red');
  assert.deepEqual(splitInitials('SKR'), { letters: 'SKR', digits: '' });
  assert.deepEqual(splitInitials('S10'), { letters: 'S', digits: '10' });
});

test('6.5: three letters typed directly are accepted; letters still come before digits in suggestions', () => {
  assert.equal(initialsProblem('SKR', new Map([['SK', 'Sree Koneru']])), null);
  assert.equal(pickFreeInitials('SKR', []), 'SKR');
  assert.deepEqual(suggestInitials('Suresh Kumar', ['SK']), ['SUK', 'SKU', 'SRK'], 'the Nov 11 letter-first order stands (no digits-first rule)');
  assert.ok(INITIALS_PATTERN.test('HT2'), 'a digit may be suggested later in the label');
  assert.ok(!INITIALS_PATTERN.test('2HT'), 'never first');
});

test('6.6: "S", "SK45", "4K" are refused with the exact reason', () => {
  const taken = new Map<string, string>();
  assert.equal(initialsProblem('S', taken), 'Type at least 2 characters.');
  assert.equal(initialsProblem('SK45', taken), 'Up to 3 characters.');
  assert.equal(initialsProblem('4K', taken), 'The first character must be a letter, A to Z.');
  assert.equal(initialsProblem('SK2', taken), null, 'SK2 may be typed');
  assert.equal(initialsProblem('S K', taken), null, 'spaces are dropped');
});

test('6.1: the two cells — one letter, then one or two letters or digits', () => {
  assert.equal(initialsCellsProblem('S', 'K'), null);
  assert.equal(initialsCellsProblem('S', 'K2'), null);
  assert.equal(initialsCellsProblem('S', 'KR'), null);
  assert.match(initialsCellsProblem('4', 'K')!, /first character must be a letter/);
  assert.match(initialsCellsProblem('S', '')!, /one or two more/);
  assert.match(initialsCellsProblem('S', 'K-')!, /Letters and digits only/);
  assert.match(initialsCellsProblem('', '')!, /one letter, then one or two more/);
});

test('D112 rows: one row to start, a new row when the last fills; one character per box; Edit, then Remove after Save', () => {
  const screen = read('app/(screens)/players/add.tsx');
  assert.match(screen, /export const ADD_PLAYERS_HEADING = 'Add new players by initials';/, 'the ⓘ title');
  assert.match(screen, /useState<Row\[\]>\(\(\) => \[blank\(\)\]\)/, 'the screen opens on one empty row');
  assert.match(screen, /if \(needsNewRow\(next\)\) next = \[\.\.\.next, blank\(\)\];/, 'a new row appears when the last fills');
  assert.match(screen, /createPlayerByInitials\(ownerId, typedOf\(row\)\)/, 'the initials are box 1 + box 2');
  assert.match(screen, /maxLength=\{1\}/, 'each box holds one character');
  assert.doesNotMatch(screen, /maxLength=\{2\}/, 'box 2 no longer takes two (D112: one letter per box; Edit takes three)');
  assert.match(screen, /if \(first\) lastInputs\.current\[row\.key\]\?\.focus\(\)/, 'box 1 jumps on');
  assert.match(screen, /pendingFocus\.current = after\.key/, 'box 2 jumps to the next row');
  assert.equal((screen.match(/<InitialsDialog/g) ?? []).length, 1, 'one shared editor, one Edit per saved row');
  assert.doesNotMatch(screen, /onDelete=/, 'Remove is its own button on the saved row, not inside Edit');
  assert.match(screen, /title: ADD_PLAYERS_TITLE/);
});

test('one shared editor: digit-tolerant, hint when unchanged, keyboard-aware', () => {
  const dialog = read('components/players/InitialsDialog.tsx');
  assert.match(dialog, /KeyboardAvoidingView/);
  assert.match(dialog, /INITIALS_UNCHANGED_HINT/);
  assert.match(dialog, /maxLength=\{3\}/);
  for (const file of ['app/(tabs)/players.tsx', 'app/(screens)/games/players.tsx', 'app/(screens)/players/add.tsx', 'app/(screens)/players/new.tsx']) {
    assert.match(read(file), /InitialsDialog/, `${file} uses the shared editor`);
  }
  for (const file of ['services/players.ts', 'services/games.ts']) {
    assert.doesNotMatch(read(file), /\^\[A-Z\]\{2,3\}\$/, `${file} no longer refuses a trailing digit`);
    assert.match(read(file), /INITIALS_PATTERN/, `${file} uses the shared pattern`);
  }
  const migration = read('supabase/migrations/039_initials_rules.sql');
  assert.match(migration, /create or replace function public\.create_player_by_initials\(p_initials text\)/);
  assert.match(migration, /create or replace function public\.pick_free_initials\(p_typed text, p_taken text\[\]\)/);
  assert.equal((migration.match(/!~ '\^\[A-Z\]\[A-Z0-9\]\{1,2\}\$'/g) ?? []).length, 2, 'both editors accept the wider rule');
});

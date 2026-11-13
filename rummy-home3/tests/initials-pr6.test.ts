import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  clashSentence,
  INITIALS_PATTERN,
  initialsCellsProblem,
  initialsProblem,
  NEW_PLAYER_ROWS_MAX,
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

test('row cap: three rows per visit, title and heading, no delete on the screen', () => {
  assert.equal(NEW_PLAYER_ROWS_MAX, 3);
  const screen = read('app/(screens)/players/add.tsx');
  assert.match(screen, /Add new players by initials, \$\{NEW_PLAYER_ROWS_MAX\} at a time/);
  assert.match(screen, /Array\.from\(\{ length: NEW_PLAYER_ROWS_MAX \}, blank\)/);
  assert.doesNotMatch(screen, /blank\(\)\]/, 'no fourth row is ever appended');
  assert.doesNotMatch(screen, /delete-outline|deleteNewPlayer/, 'no delete on this screen');
  assert.match(screen, /createPlayerByInitials\(ownerId, row\.first \+ row\.last\)/, 'the initials are cell 1 + cell 2');
  assert.match(screen, /maxLength=\{1\}/, 'cell 1 holds one character');
  assert.match(screen, /maxLength=\{2\}/, 'cell 2 holds up to two');
  assert.match(screen, /lastInputs\.current\[row\.key\]\?\.focus\(\)/, 'cell 1 jumps on');
  assert.equal((screen.match(/<InitialsDialog/g) ?? []).length, 1, 'one shared editor, one Edit per row');
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

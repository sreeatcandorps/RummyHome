import assert from 'node:assert/strict';
import test from 'node:test';
import { HELP, SETTINGS_PRIORITY } from '../constants/help';
import { DEFAULT_MY_PLAYERS_SORT, registrationLabel, REGISTRATION_TONE, sortMyPlayers } from '../utils/myPlayersList';
import { newGameGrid, newGameSeats } from '../utils/playerIdentity';
import { initialsCellsProblem } from '../utils/initials';
import { normalizePhone, phoneProblem } from '../utils/phone';
import { cellTone } from '../utils/roundEntry';

test('build 3: My players opens sorted by Frequent', () => {
  assert.equal(DEFAULT_MY_PLAYERS_SORT, 'frequent');
  const rows = [
    { id: 'a', name: 'Zed', gamesTogether: 1 },
    { id: 'b', name: 'Amy', gamesTogether: 9 },
  ];
  assert.deepEqual(sortMyPlayers(rows, DEFAULT_MY_PLAYERS_SORT).map((r) => r.id), ['b', 'a']);
});

test('build 3: every player gets one of three status labels, never a bare Pending', () => {
  assert.equal(registrationLabel('registered'), 'Registered');
  assert.equal(registrationLabel(undefined), 'Registered');
  assert.equal(registrationLabel('pending'), 'Pending registration');
  assert.equal(registrationLabel('unregistered'), 'Unregistered');
  const tones = new Set(Object.values(REGISTRATION_TONE));
  assert.equal(tones.size, 3, 'each status has its own colour');
  for (const label of Object.keys(REGISTRATION_TONE)) assert.notEqual(label, 'Pending');
});

test('build 3 → PR 6: the first initial is a letter; the rest may be letters or digits', () => {
  assert.equal(initialsCellsProblem('H', 'Y'), null);
  assert.equal(initialsCellsProblem('S', 'KU'), null);
  assert.equal(initialsCellsProblem('H', '2'), null, 'a digit after the letter is allowed (HT2 is a real label)');
  assert.match(initialsCellsProblem('3', 'Y')!, /first character must be a letter/i);
  assert.match(initialsCellsProblem('', 'Y')!, /first character must be a letter/i);
  assert.match(initialsCellsProblem('H', '  ')!, /one or two more/i);
  assert.match(initialsCellsProblem('', '')!, /one letter, then one or two more/i);
});

test('build 3: New game lists the organizer like anyone else and never seats them automatically', () => {
  const me = { id: 'me', name: 'Sree' };
  const others = [{ id: 'a', name: 'Ada' }, { id: 'b', name: 'Bea' }];
  assert.deepEqual(newGameGrid([...others, me], []).map((p) => p.id), ['a', 'b', 'me'], 'organizer is not forced first');
  assert.deepEqual(newGameGrid([...others, me], ['me']).map((p) => p.id), ['a', 'b']);
  assert.deepEqual(newGameGrid([...others, me], ['a']).map((p) => p.id), ['b', 'me']);
  assert.deepEqual(newGameGrid(others, []).map((p) => p.id), ['a', 'b']);
  assert.deepEqual(newGameSeats(['a', 'b']), ['a', 'b'], 'the creator is not forced into the seats');
  assert.deepEqual(newGameSeats(['a', 'me', 'a']), ['a', 'me']);
});

test('build 3: phone save tidies and validates the number', () => {
  assert.equal(normalizePhone(' +1 (415) 555-0100 '), '+14155550100');
  assert.equal(normalizePhone('415.555.0100'), '4155550100');
  assert.equal(normalizePhone(''), '');
  assert.equal(phoneProblem(''), null, 'empty clears the number');
  assert.equal(phoneProblem('415 555 0100'), null);
  assert.match(phoneProblem('12345')!, /7 to 15 digits/);
  assert.match(phoneProblem('1234567890123456')!, /7 to 15 digits/);
});

test('build 3: Add Round cells are beige, light green when selected, light grey once confirmed', () => {
  assert.equal(cellTone('empty'), 'neutral');
  assert.equal(cellTone('selected'), 'selected');
  assert.equal(cellTone('pending'), 'selected');
  assert.equal(cellTone('confirmed'), 'confirmed');
});

test('build 3: every help screen is short bullets (or ## headings) with no version or build fluff', () => {
  for (const [key, text] of Object.entries(HELP)) {
    const lines = text.split('\n');
    const bullets = lines.filter((line) => line.startsWith('• '));
    assert.ok(bullets.length >= 1 && bullets.length <= 7, `${key} has ${bullets.length} bullets`);
    for (const line of lines) {
      assert.ok(line.startsWith('• ') || line.startsWith('## '), `${key}: "${line}" is not a bullet or heading`);
      assert.ok(line.length <= 200, `${key}: line too long: "${line}"`);
    }
    assert.doesNotMatch(text, /\bv\d+\.\d+|\bbuild\b|version/i, `${key} mentions version or build`);
  }
  assert.doesNotMatch(HELP.home, /Recent lists both/);
  assert.match(HELP.players, /own list, not everyone in the EZ Score database/i);
  assert.match(HELP.addPlayers, /Done/);
  assert.match(HELP.newGame, /Tap yourself if you are playing/);
  assert.match(HELP.scoreEntry, /Yellow: selected now\. Green: score saved/);
});

test('build 3: settings priority ladder is highest to lowest', () => {
  assert.deepEqual(SETTINGS_PRIORITY.map((s) => s.title), ['Game settings', 'User settings', 'Game defaults']);
  assert.deepEqual(SETTINGS_PRIORITY.map((s) => s.level), ['Highest', 'Medium', 'Lowest']);
  assert.match(HELP.userSettings, /Game settings/);
});

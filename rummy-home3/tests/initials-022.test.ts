import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assignInitials,
  defaultInitials,
  findInitialsConflicts,
  firstFreeInitials,
  initialsCandidates,
  initialsProblem,
  nameWords,
  seatLabels,
  suggestInitials,
} from '../utils/initials';

// The same table is asserted against public.initials_candidates in supabase/tests/12_player_initials_022.sql.
test('generator: two letters first, then three-letter forms from the name, digits last', () => {
  assert.deepEqual(initialsCandidates('Sree Koneru').slice(0, 3), ['SK', 'SRK', 'SKO']);
  assert.deepEqual(initialsCandidates('Suresh Kumar').slice(0, 9), ['SK', 'SUK', 'SKU', 'SRK', 'SEK', 'SSK', 'SHK', 'SKM', 'SKA']);
  assert.deepEqual(initialsCandidates('Ravi').slice(0, 3), ['RA', 'RAV', 'RAI']);
  assert.deepEqual(initialsCandidates('Anita Rao').slice(0, 7), ['AR', 'ANR', 'ARA', 'AIR', 'ATR', 'AAR', 'ARO']);
  assert.deepEqual(initialsCandidates('Mary Jane Watson').slice(0, 4), ['MW', 'MAW', 'MWA', 'MJW']);
  assert.deepEqual(initialsCandidates('Player 10').slice(0, 3), ['PL', 'PLA', 'PLY']);
  assert.equal(initialsCandidates('')[0], 'PL');
  assert.deepEqual(initialsCandidates('Jo').slice(0, 2), ['JO', 'JO2']);
  assert.equal(initialsCandidates('José Núñez')[0], 'JN');
  assert.deepEqual(nameWords('  Ævar  Ødegaard-2 '), ['AEVAR', 'ODEGAARD']);
});

test('generator: every digit form comes after every letter form', () => {
  const list = initialsCandidates('Suresh Kumar');
  const firstDigit = list.findIndex((c) => /\d/.test(c));
  const lastLetters = list.length - 1 - [...list].reverse().findIndex((c) => !/\d/.test(c));
  assert.ok(firstDigit > lastLetters);
  assert.ok(new Set(list).size === list.length, 'no duplicates');
  list.forEach((c) => assert.match(c, /^[A-Z][A-Z0-9]{1,2}$/));
});

test('defaultInitials, firstFreeInitials and suggestInitials', () => {
  assert.equal(defaultInitials('Sree Koneru'), 'SK');
  assert.equal(defaultInitials('X'), 'XX');
  assert.equal(firstFreeInitials('Suresh Kumar', ['SK']), 'SUK');
  assert.equal(firstFreeInitials('Suresh Kumar', ['sk', 'SUK ']), 'SKU');
  assert.deepEqual(suggestInitials('Suresh Kumar', ['SK']), ['SUK', 'SKU', 'SRK']);
  assert.deepEqual(suggestInitials('Suresh Kumar', ['SK', 'SUK', 'SRK']), ['SKU', 'SEK', 'SSK']);
  // digits only when the letters run out
  const allLetters = initialsCandidates('Jo').filter((c) => /^[A-Z]+$/.test(c));
  assert.deepEqual(suggestInitials('Jo', allLetters, 2), ['JO2', 'JO3']);
});

test('validation: letters only, 2 or 3, unique within the owner list', () => {
  const taken = new Map([['SK', 'Suresh Kumar'], ['HT', 'Harish Test']]);
  assert.equal(initialsProblem('', taken), 'Type 2 or 3 letters.');
  assert.equal(initialsProblem('S2', taken), 'Letters only, A to Z.');
  assert.equal(initialsProblem('S', taken), 'Type at least 2 letters.');
  assert.equal(initialsProblem('SKOR', taken), 'Up to 3 letters.');
  assert.equal(initialsProblem('sk', taken), 'SK is Suresh Kumar.');
  assert.equal(initialsProblem(' sko ', taken), null);
  assert.equal(initialsProblem('ék', taken), null, 'accents are folded before checking');
});

test('assignInitials: stored labels win, oldest keeps the short form, result is unique', () => {
  const labels = assignInitials([
    { id: 'c', name: 'Sree Koneru', addedAt: '2026-03-01' },
    { id: 'a', name: 'Sunil Kohli', addedAt: '2026-01-01' },
    { id: 'b', name: 'Suresh Kumar', addedAt: '2026-02-01' },
    { id: 'd', name: 'Harish Test', initials: 'HT', addedAt: '2026-04-01' },
    { id: 'e', name: 'Hema Tummala', initials: 'HT', addedAt: '2026-05-01' },
  ]);
  assert.equal(labels.get('a'), 'SK');
  assert.equal(labels.get('b'), 'SUK');
  assert.equal(labels.get('c'), 'SRK');
  assert.equal(labels.get('d'), 'HT', 'stored label kept');
  assert.equal(labels.get('e'), 'HET', 'a duplicate stored label is re-derived for the newer row');
  assert.equal(new Set(labels.values()).size, 5);
  // same input in another order gives the same answer
  const again = assignInitials([
    { id: 'e', name: 'Hema Tummala', initials: 'HT', addedAt: '2026-05-01' },
    { id: 'b', name: 'Suresh Kumar', addedAt: '2026-02-01' },
    { id: 'd', name: 'Harish Test', initials: 'HT', addedAt: '2026-04-01' },
    { id: 'c', name: 'Sree Koneru', addedAt: '2026-03-01' },
    { id: 'a', name: 'Sunil Kohli', addedAt: '2026-01-01' },
  ]);
  assert.deepEqual([...again.entries()].sort(), [...labels.entries()].sort());
  // a reserved label (the organiser's own) is never handed out
  assert.equal(assignInitials([{ id: 'x', name: 'Sam Kumar' }], ['SK']).get('x'), 'SAK');
});

test('findInitialsConflicts: the creator keeps the short form, others get suggestions nobody has', () => {
  const rows = [
    { id: 'me', name: 'Sree Koneru' },
    { id: 'suresh', name: 'Suresh Kumar', addedAt: '2026-01-01' },
    { id: 'sunil', name: 'Sunil Kohli', addedAt: '2026-02-01' },
    { id: 'harish', name: 'Harish Test', initials: 'HT', addedAt: '2026-01-05' },
    { id: 'hema', name: 'Hema Tummala', addedAt: '2026-01-06' },
    { id: 'priya', name: 'Priya Test', initials: 'PT', addedAt: '2026-01-07' },
  ];
  const conflicts = findInitialsConflicts(rows, 'me');
  assert.deepEqual(conflicts.map((c) => c.label), ['HT', 'SK']);
  const sk = conflicts[1];
  assert.equal(sk.keeper.id, 'me', 'the creator keeps SK even though they were added last');
  assert.deepEqual(sk.others.map((o) => o.row.id), ['suresh', 'sunil']);
  assert.deepEqual(sk.others[0].suggestions, ['SUK', 'SKU', 'SRK']);
  assert.ok(!sk.others[1].suggestions.includes('SUK'), 'the second player is not offered what the first will take');
  const ht = conflicts[0];
  assert.equal(ht.keeper.id, 'harish', 'without the creator the oldest row keeps it');
  assert.equal(ht.others[0].row.id, 'hema');
  ht.others[0].suggestions.forEach((s) => assert.ok(!['HT', 'PT', 'SK'].includes(s)));
  assert.deepEqual(findInitialsConflicts(rows.filter((r) => r.id !== 'suresh' && r.id !== 'sunil' && r.id !== 'hema'), 'me'), []);
});

test('seatLabels: stored seat labels win, the rest fill in seat order', () => {
  const labels = seatLabels([
    { id: 's1', name: 'Harish Test', label: 'HAT' },
    { id: 's2', name: 'Hema Tummala' },
    { id: 's3', name: 'Priya Test', label: null },
    { id: 's4', name: 'Sunil Kohli' },
    { id: 's5', name: 'Suresh Kumar' },
  ]);
  assert.deepEqual([...labels.values()], ['HAT', 'HT', 'PT', 'SK', 'SUK']);
});

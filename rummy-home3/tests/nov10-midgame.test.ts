import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { sortFinalScores } from '../utils/completeGame';
import { registrationLabel } from '../utils/gamePlayers';
import { chipLook } from '../utils/chipLook';

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

test('final scores are sorted highest first; ties keep seat order', () => {
  const rows = [
    { id: 'a', total: -40 },
    { id: 'b', total: 120 },
    { id: 'c', total: 0 },
    { id: 'd', total: 120 },
  ];
  assert.deepEqual(sortFinalScores(rows).map((r) => r.id), ['b', 'd', 'c', 'a']);
  assert.deepEqual(rows.map((r) => r.id), ['a', 'b', 'c', 'd'], 'input is not mutated');
  assert.deepEqual(sortFinalScores([]), []);
});

test('Complete game screen renders totals through sortFinalScores', () => {
  const page = read('app/(screens)/games/complete.tsx');
  assert.match(page, /sortFinalScores\(/);
});

test('an invited (pending) seat reads "Pending registration" everywhere', () => {
  assert.equal(registrationLabel({ status: 'pending' }), 'Pending registration');
  const page = read('app/(screens)/games/players.tsx');
  assert.match(page, /Pending registration/);
  assert.doesNotMatch(page, /=== 'Pending'/);
  // Optimistic: the seat is marked invited the moment the link exists, and the roster reloads when the share sheet closes.
  assert.match(page, /setInvited\(\(current\) => new Set\(\[\.\.\.current, sheet\.seat\.id\]\)\)/);
  assert.match(page, /AppState\.addEventListener\('change'/);
  assert.match(read('utils/myPlayersList.ts'), /Pending registration/);
});

test('mid-game add: "Add new player" button, "Added N" counter, whole list, yellow for new picks only', () => {
  const players = read('app/(screens)/games/players.tsx');
  assert.match(players, />\s*Add new player\s*</);
  assert.doesNotMatch(players, />\s*Add a player\s*</);

  const picker = read('app/(screens)/games/new.tsx');
  // PR 7: add mode shows the big "Total" circle (seated only) with "Added now: N"; New game keeps the Playing count.
  assert.match(picker, /<TotalCircle total=\{seatedCount\} added=\{newCount\} \/> : <PlayingCount count=\{seatedCount\} hint=\{hint\} \/>/);
  assert.match(picker, /newGameGrid\(orderCandidates\(pool, sort\), selectedIds, PICKER_PREFETCH\)/);
  assert.doesNotMatch(picker, /PICKER_PAGE\b/);

  assert.equal(chipLook('x'), 'new', 'New game: every chip is new (green)');
  assert.equal(chipLook('x', new Set(['x'])), 'saved', 'add mode: saved seats go quiet');
  assert.equal(chipLook('y', new Set(['x'])), 'added', 'add mode: only new picks are highlighted');
  const strip = read('components/players/SelectedPlayersStrip.tsx');
  assert.match(strip, /look === 'added'\s*\?\s*\{ bg: colors\.secondaryContainer/);
});

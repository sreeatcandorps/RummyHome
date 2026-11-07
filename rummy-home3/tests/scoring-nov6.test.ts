import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  canSaveRound,
  confirmedValue,
  draftValue,
  hasPendingEntry,
  initialRoundEntryState,
  pressDigit,
  saveScore,
  tapPlayer,
  toRoundScores,
} from '../utils/roundEntry';
import { entryFromRound } from '../utils/editRound';
import { bigNegativeThreshold, scoreTone } from '../utils/scoreTone';
import { validateRoundScores } from '../utils/scoring';

const type = (state: ReturnType<typeof initialRoundEntryState>, digits: string) =>
  digits.split('').reduce((acc, digit) => pressDigit(acc, digit), state);

test('a typed 0 is a real pending score, not an empty cell', () => {
  let state = tapPlayer(initialRoundEntryState(), 'a');
  state = type(state, '0');
  assert.equal(hasPendingEntry(state), true);
  assert.equal(draftValue(state.draft), 0);
  assert.equal(Object.is(draftValue(state.draft), -0), false);
  state = saveScore(state);
  assert.equal(confirmedValue(state, 'a'), 0);
  assert.deepEqual(toRoundScores(state), [{ playerId: 'a', value: 0, scoreType: 'count' }]);
});

test('typing after a lone 0 replaces it (0 → 5, never 05)', () => {
  let state = tapPlayer(initialRoundEntryState(), 'a');
  state = type(state, '05');
  assert.equal(state.draft.digits, '5');
  assert.equal(draftValue(state.draft), -5);
});

test('a round where someone scored exactly 0 still balances and saves', () => {
  let state = tapPlayer(initialRoundEntryState(), 'a');
  state = saveScore(type(state, '0'));
  state = tapPlayer(state, 'b');
  state = saveScore(type(state, '40'));
  state = tapPlayer(state, 'c');
  state = saveScore({ ...state, draft: { ...type(state, '40').draft, negative: false } });
  assert.equal(canSaveRound(state), true);
  const scores = toRoundScores(state);
  assert.ok(scores.some((s) => s.playerId === 'a' && s.value === 0));
  assert.equal(validateRoundScores(scores).valid, true);
});

test('a sheet of nothing but zeros is still not a round', () => {
  let state = tapPlayer(initialRoundEntryState(), 'a');
  state = saveScore(type(state, '0'));
  assert.equal(canSaveRound(state), false);
});

test('Edit round loads a saved 0 as a confirmed cell, and a missing cell as empty', () => {
  const game = { players: ['a', 'b'], scores: { a: [0, -20], b: [10] } };
  const round1 = entryFromRound(game, 1);
  assert.equal(confirmedValue(round1, 'a'), 0);
  assert.equal(confirmedValue(round1, 'b'), 10);
  const round2 = entryFromRound(game, 2);
  assert.equal(confirmedValue(round2, 'a'), -20);
  assert.equal(confirmedValue(round2, 'b'), undefined);
});

test('big losses turn red from half the Full count; wins stay green', () => {
  assert.equal(bigNegativeThreshold(80), 40);
  assert.equal(bigNegativeThreshold(75), 38);
  assert.equal(bigNegativeThreshold(0), null);
  assert.equal(bigNegativeThreshold(undefined), null);

  assert.equal(scoreTone(-39, 80), 'negative');
  assert.equal(scoreTone(-40, 80), 'bigNegative');
  assert.equal(scoreTone(-80, 80), 'bigNegative');
  assert.equal(scoreTone(-200, 80), 'bigNegative');
  assert.equal(scoreTone(40, 80), 'positive');
  assert.equal(scoreTone(0, 80), 'zero');
  // Without a Full count nothing is ever red.
  assert.equal(scoreTone(-500, undefined), 'negative');
});

test('migration 014 saves round and scores atomically, reuses empty rounds and ignores duplicate submits', () => {
  const sql = readFileSync(path.join(process.cwd(), 'supabase/migrations/014_save_round_atomic.sql'), 'utf8');
  assert.match(sql, /create or replace function public\.save_round/);
  assert.match(sql, /is_game_admin\(p_game_id\)/);
  assert.match(sql, /for update/);
  assert.match(sql, /elsif v_existing_scores > 0 then/);
  assert.match(sql, /greatest\(coalesce\(current_round, 1\), p_round_number \+ 1\)/);
  assert.match(sql, /revoke all on function public\.save_round[^;]*from anon/);
  assert.match(sql, /grant execute on function public\.save_round[^;]*to authenticated/);
});

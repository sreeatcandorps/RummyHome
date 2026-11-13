import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { distributeRummyWinnings, rummyShareNeedsConfirm } from '../utils/rummyDistribution';
import {
  applyPreset,
  applyRummy,
  canSaveRound,
  countWarning,
  countWarningText,
  exceedsMaxCount,
  initialRoundEntryState,
  pressDigit,
  rummyShares,
  saveScore,
  setNegative,
  tapPlayer,
  toRoundScores,
  balance,
} from '../utils/roundEntry';
import { overMaxConfirm, rummyShareConfirm } from '../utils/roundConfirms';
import { validateRoundScores } from '../utils/scoring';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');
const presets = { drop: -10, middle_drop: -30, count: -80 };
const people = [{ id: 'a', name: 'Sree Test' }, { id: 'b', name: 'Harish Test' }, { id: 'c', name: 'Priya Test' }, { id: 'd', name: 'Zed Zero' }];

const type = (state: ReturnType<typeof initialRoundEntryState>, digits: string, negative = true) => {
  let next = setNegative(state, negative);
  for (const d of digits) next = pressDigit(next, d);
  return next;
};

test('3.1 four at -10 and a Rummy → +40, Save enabled', () => {
  let s = initialRoundEntryState();
  for (const id of ['a', 'b', 'c', 'd']) s = applyPreset(tapPlayer(s, id), 'drop', presets);
  s = applyRummy(tapPlayer(s, 'a'));
  // a was a drop and is now the Rummy winner: the other three lost 30
  assert.deepEqual(rummyShares(s), { a: 30 });
  assert.equal(balance(s), 0);
  assert.ok(canSaveRound(s));
  s = initialRoundEntryState();
  for (const id of ['b', 'c', 'd']) s = applyPreset(tapPlayer(s, id), 'drop', presets);
  s = applyPreset(tapPlayer(s, 'a'), 'drop', presets);
  s = applyRummy(tapPlayer(s, 'd'));
  assert.deepEqual(rummyShares(s), { d: 30 });
  assert.ok(!rummyShareNeedsConfirm(rummyShares(s)), 'a normal win needs no confirm');
});

test('3.2 +100 / -20 / -30 and a Rummy → -50, Save enabled, the confirm flag is set', () => {
  let s = initialRoundEntryState();
  s = saveScore(type(tapPlayer(s, 'a'), '100', false));
  s = saveScore(type(tapPlayer(s, 'b'), '20'));
  s = applyPreset(tapPlayer(s, 'c'), 'middle_drop', presets);
  s = applyRummy(tapPlayer(s, 'd'));
  const shares = rummyShares(s);
  assert.deepEqual(shares, { d: -50 });
  assert.equal(balance(s), 0);
  assert.ok(canSaveRound(s), 'Save round is on: the round balances and someone lost');
  assert.ok(rummyShareNeedsConfirm(shares));
  const scores = toRoundScores(s);
  assert.deepEqual(scores.find((x) => x.playerId === 'd'), { playerId: 'd', value: -50, scoreType: 'rummy' });
  assert.deepEqual(validateRoundScores(scores), { valid: true, error: null }, 'the validator no longer refuses a negative Rummy');
  assert.equal(
    rummyShareConfirm(s, shares, people),
    "The others add up to +50, so Zed's Rummy share is -50 to keep the round at 0. Is that right?",
  );
});

test('3.3 two winners share -45 → +23 / +22 (first tapped takes the remainder)', () => {
  assert.deepEqual(distributeRummyWinnings(-45, ['a', 'b']), { a: 23, b: 22 });
});

test('3.4 two winners share a +31 pot → -16 / -15 (first tapped takes the larger piece)', () => {
  assert.deepEqual(distributeRummyWinnings(31, ['a', 'b']), { a: -16, b: -15 });
  let s = initialRoundEntryState();
  s = saveScore(type(tapPlayer(s, 'a'), '31', false));
  s = applyRummy(tapPlayer(tapPlayer(s, 'c'), 'd'));
  const shares = rummyShares(s);
  assert.deepEqual(shares, { c: -16, d: -15 });
  assert.equal(balance(s), 0);
  assert.equal(
    rummyShareConfirm(s, shares, people),
    'The others add up to +31, so Priya and Zed share -31 (-16 and -15) to keep the round at 0. Is that right?',
  );
});

test('D3.2: a Rummy share of exactly 0 also asks; any positive share does not', () => {
  assert.ok(rummyShareNeedsConfirm({ a: 0 }));
  assert.ok(rummyShareNeedsConfirm({ a: 10, b: -1 }));
  assert.ok(!rummyShareNeedsConfirm({ a: 1 }));
  assert.ok(!rummyShareNeedsConfirm({}));
});

test('exceedsMaxCount: 80 is the Full count, 81 and 120 are past it, sign does not matter, no Full count → never', () => {
  assert.equal(exceedsMaxCount(80, -80), false);
  assert.equal(exceedsMaxCount(-80, 80), false);
  assert.equal(exceedsMaxCount(81, -80), true);
  assert.equal(exceedsMaxCount(-120, 80), true);
  assert.equal(exceedsMaxCount(120, 80), true);
  assert.equal(exceedsMaxCount(120, null), false);
  assert.equal(exceedsMaxCount(undefined, 80), false);
});

test('count warning: none below half, soft from half (40 of 80), strong from the Full count', () => {
  assert.equal(countWarning(-39, -80), 'none');
  assert.equal(countWarning(-40, -80), 'half');
  assert.equal(countWarning(-79, 80), 'half');
  assert.equal(countWarning(-80, 80), 'full');
  assert.equal(countWarning(120, 80), 'full');
  assert.equal(countWarning(-45, 90), 'half');
  assert.equal(countWarning(-44, 90), 'none');
  assert.equal(countWarning(-40, null), 'none');
  assert.equal(countWarningText(-40, 80, 'half'), '40 is half the Full count (80).');
  assert.equal(countWarningText(-60, 80, 'half'), '60 is more than half the Full count (80).');
  assert.equal(countWarningText(-80, 80, 'full'), '80 is the Full count.');
  assert.equal(countWarningText(120, 80, 'full'), '120 is more than the Full count (80).');
  assert.equal(countWarningText(-10, 80, 'none'), null);
  assert.equal(overMaxConfirm(-120, -80), 'The Full count for this game is 80. Keep -120 for this round?');
  assert.equal(overMaxConfirm(120, 80), 'The Full count for this game is 80. Keep +120 for this round?');
});

test('Add round screen: typed digits go through the once-per-cell confirm; Save round asks about a non-winning Rummy once', () => {
  const screen = src('app/(screens)/score-entry.tsx');
  assert.match(screen, /onDigit=\{typeDigit\}/);
  assert.match(screen, /warnedCells\.current\.has\(id\)/, 'once per cell');
  assert.match(screen, /!exceedsMaxCount\(draftValue\(prev\.draft\), fullCount\)/, 'only when the number first goes past the count, not every keystroke');
  assert.match(screen, /rummyConfirmed\.current && rummyShareNeedsConfirm\(shares\)/);
  assert.match(screen, /testID="count-warning"/);
  assert.doesNotMatch(screen, /label: '00'|'Clear'|check-bold/, 'no 00, tick or Clear keys (Sree): the layout is unchanged');
});

test('037: the scores check lets a Rummy row be negative; the rollback restores the old rule NOT VALID', () => {
  const migration = src('supabase/migrations/037_rummy_negative_share.sql');
  assert.match(migration, /alter table public\.scores drop constraint if exists scores_check;/);
  assert.match(migration, /or score_type = 'rummy'\s*\n\);/);
  assert.doesNotMatch(migration, /value >= 0/);
  const rollback = src('supabase/rollback/rollback_037_rummy_negative_share.sql');
  assert.match(rollback, /\(score_type = 'rummy' and value >= 0\)\s*\n\) not valid;/);
});

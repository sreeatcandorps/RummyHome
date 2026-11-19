import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { limitChangePreview, poolLimitChangeConfirm, poolLimitRoundsNote, POOL_LIMIT_CHANGE_TITLE } from '../utils/pool';
import { dotTone, kindLabel } from '../utils/eventLog';

const src = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

// ---- APK v12 point 12 (Sree, Nov 19): "Pool limit locked. I don't think you should lock it … a player that's out
// comes back and becomes active … keep it as flexible as possible." → 051 / D53 ----

const game = {
  players: ['s', 'h', 'p'],
  scores: { s: [0, 0], h: [60, 50], p: [30, 30] },
  poolSeats: { h: { outRound: 2, reenteredRound: null, reentryScore: null, entries: 1 } },
} as any;
const names: Record<string, string> = { s: 'Sree', h: 'Harish', p: 'Priya' };
const nameOf = (id: string) => names[id];

test('D53: the preview says who comes back in and who goes out at a new limit', () => {
  assert.deepEqual(limitChangePreview(game, 201, nameOf), { backIn: ['Harish'], goOut: [] }, '110 < 201: Harish is back');
  assert.deepEqual(limitChangePreview(game, 51, nameOf), { backIn: [], goOut: ['Priya'] }, 'Priya 60 ≥ 51 goes out; Harish was already out');
  assert.deepEqual(limitChangePreview(game, 101, nameOf), { backIn: [], goOut: [] });
  assert.deepEqual(limitChangePreview(game, 1, nameOf), { backIn: [], goOut: ['Priya'] }, 'a 0 total stays in at any limit ≥ 1');
});

test('D53: the confirm text names the rounds, the limits and the people; nothing to ask before a round or on the same limit', () => {
  assert.equal(poolLimitChangeConfirm(0, 101, 201, null), null);
  assert.equal(poolLimitChangeConfirm(3, 101, 101, null), null);
  assert.equal(
    poolLimitChangeConfirm(2, 101, 201, { backIn: ['Harish'], goOut: [] }),
    '2 rounds already played. At 201 instead of 101, who is out is read again from every total. Harish comes back in. Totals stay as they are. The Log records it.',
  );
  assert.equal(
    poolLimitChangeConfirm(1, 201, 51, { backIn: [], goOut: ['Harish', 'Priya'] }),
    '1 round already played. At 51 instead of 201, who is out is read again from every total. Harish and Priya go out. Totals stay as they are. The Log records it.',
  );
  assert.match(poolLimitChangeConfirm(2, 101, 151, { backIn: [], goOut: [] })!, /Nobody changes today; the new limit applies from the next round\./);
  assert.match(poolLimitChangeConfirm(2, 101, 151, null)!, /every total\. Totals stay/, 'without a preview: no names, no "nobody"');
  assert.equal(POOL_LIMIT_CHANGE_TITLE, 'Change the pool limit?');
  assert.equal(poolLimitRoundsNote(1), '1 round played · a change re-reads who is out');
  assert.equal(poolLimitRoundsNote(4), '4 rounds played · a change re-reads who is out');
});

test('D53: Game settings asks once for a pool-limit change with rounds; the form has no lock; the menu has no padlock', () => {
  const dialog = src('components/game/GameSettingsDialog.tsx');
  assert.match(dialog, /kind: 'pool-limit'/);
  assert.match(dialog, /poolLimitChangeConfirm\(roundCount, from, to, poolLimitPreview \? poolLimitPreview\(to\) : null\)/);
  assert.match(dialog, /testID="pool-limit-confirm-change">Change the limit<\/Button>/);
  assert.match(dialog, /testID="pool-limit-confirm-cancel">Cancel<\/Button>/);
  assert.doesNotMatch(dialog, /lockValues|settingsLocked|WhyLink/);
  const form = src('components/game/RulesForm.tsx');
  assert.match(form, /limit-rounds-note/);
  assert.doesNotMatch(form, /LOCKED_TAG|POOL_LOCK_NOTE|lockValues/);
  for (const file of ['app/(screens)/games/[id].tsx', 'app/(screens)/score-entry.tsx']) {
    assert.doesNotMatch(src(file), /lock-outline|lockValues/, `${file}: no lock`);
    assert.match(src(file), /poolLimitPreview=\{pool \? \(limit\) => limitChangePreview\(game, limit,/, `${file}: preview wired`);
  }
  assert.doesNotMatch(src('constants/helpTopics.ts'), /settingsLocked|limit-locked|settings-locked|Game settings · locked/, 'help no longer speaks of a lock');
});

test('D53: the Log shows "Back in" in blue for a player the new limit let back', () => {
  assert.equal(kindLabel('player_back_in'), 'Back in');
  assert.equal(dotTone({ kind: 'player_back_in', level: 'important' } as any), 'blue');
  const sql = src('supabase/migrations/051_pool_limit_unlocked.sql');
  assert.match(sql, /drop trigger if exists games_pool_settings_lock on public\.games;/);
  assert.match(sql, /'player_back_in'\)\);/, 'the kind is allowed');
  assert.match(sql, /create trigger games_pool_limit_changed after update of settings on public\.games/);
  assert.match(src('supabase/rollback/rollback_051_pool_limit_unlocked.sql'), /create trigger games_pool_settings_lock before update of settings/);
});

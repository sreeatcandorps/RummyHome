import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { Game, GameSettings } from '../types/game';
import { DEFAULT_POOL_RULES, rulesFromGame, rulesFromProfileDefaults, rulesToProfileDefaults, withStoredPointsRules } from '../utils/gameSettings';
import {
  DEFAULT_LATE_ENTRY_PLUS, DEFAULT_REENTRY_PLUS, entryPlusDefault, entryPlusLabel, entryScoreUnder, highestIn, lateEntryPlusOf, lateEntryScore, reentryPlusOf, reentryScore,
} from '../utils/pool';
import { draftFromRules, parseReentryLimit, rulesFromDraft } from '../utils/rulesDraft';

// PR 24 (Sree's feedback on v11, Nov 17) — item 7: where a player who comes back starts.
// X24-7a the two rules: "Highest score" (0) or "Highest score + 1" (1); new pools and user defaults
// at + 1; a game without the keys keeps the 041 rule. X24-7b the Re-entries form: Unlimited by
// default, switching to Limited leaves the count empty. X24-7c migration 047 is written with its
// rollback, pgTAP file and replay hook, and is NOT applied to live.

const read = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');

const settings = (over: Partial<GameSettings> = {}): GameSettings => ({ expense: false, expenseAmount: 0, dropAmount: 25, mdAmount: 50, maxCount: 130, poolLimit: 101, ...over });

const pool = (over: Partial<Game> = {}): Game => ({
  id: 'g', createdAt: '', updatedAt: '', createdBy: 'a', status: 'active', gameType: 'pool',
  players: ['a', 'b', 'c'],
  scores: { a: [0, 10], b: [40, 30], c: [60, 50] },
  poolSeats: { a: { outRound: null, reenteredRound: null, reentryScore: null, entries: 1 }, b: { outRound: null, reenteredRound: null, reentryScore: null, entries: 1 }, c: { outRound: 2, reenteredRound: null, reentryScore: null, entries: 1 } },
  settings: settings(),
  isComplete: false,
  ...over,
} as unknown as Game);

test('X24-7a the rules: absent on a game = Highest score (041); user defaults = Highest score + 1', () => {
  assert.equal(DEFAULT_REENTRY_PLUS, 1);
  assert.equal(DEFAULT_LATE_ENTRY_PLUS, 1);
  assert.equal(reentryPlusOf({}), 0, 'a pool saved before PR 24 keeps the 041 rule');
  assert.equal(reentryPlusOf(null), 0);
  assert.equal(reentryPlusOf({ reentryPlus: 1 }), 1);
  assert.equal(reentryPlusOf({ reentryPlus: 0 }), 0);
  assert.equal(lateEntryPlusOf({ lateEntryPlus: 1 }), 1);
  assert.equal(lateEntryPlusOf({ reentryPlus: 1 } as never), 0, 'each key is read on its own');
  assert.equal(entryPlusDefault(undefined, 1), 1, 'no saved default → + 1');
  assert.equal(entryPlusDefault(0, 1), 0);
  assert.equal(entryPlusDefault(true, 0), 1, 'a boolean is tolerated');
  assert.equal(entryPlusLabel(0), 'Highest score');
  assert.equal(entryPlusLabel(1), 'Highest score + 1');
  assert.equal(entryScoreUnder(105, 1), 106);
  assert.equal(entryScoreUnder(105, 0), 105);
});

test('X24-7a reentryScore / lateEntryScore follow the game rule; the highest still in ignores out players', () => {
  const g = pool();
  assert.equal(highestIn(g), 70, 'b 70 is the highest still in (c is out at 110)');
  assert.equal(reentryScore(g), 70, 'no key: the 041 rule');
  assert.equal(reentryScore(pool({ settings: settings({ reentryPlus: 1 }) })), 71, 'Highest + 1');
  assert.equal(lateEntryScore(g), 70);
  assert.equal(lateEntryScore(pool({ settings: settings({ lateEntryPlus: 1 }) })), 71);
  assert.equal(lateEntryScore(pool({ settings: settings({ reentryPlus: 1 }) })), 70, 'the late-entry rule is its own setting');
});

test('X24-7a settings round-trip: defaults, profile keys, game keys', () => {
  assert.equal(DEFAULT_POOL_RULES.reentryPlus, 1);
  assert.equal(DEFAULT_POOL_RULES.lateEntryPlus, 1);
  const saved = rulesToProfileDefaults({ ...DEFAULT_POOL_RULES, reentryPlus: 0 });
  assert.equal(saved.poolReentryPlus, 0);
  assert.equal(saved.poolLateEntryPlus, 1);
  assert.equal(rulesFromProfileDefaults({ poolLimit: 201 }, 'pool').reentryPlus, 1, 'a profile saved before PR 24 reads as + 1');
  assert.equal(rulesFromProfileDefaults({ poolLimit: 201, poolReentryPlus: 0, poolLateEntryPlus: 0 }, 'pool').lateEntryPlus, 0);
  assert.equal(rulesFromGame(settings(), 'pool').reentryPlus, 0, 'a game without the key: the 041 rule');
  assert.equal(rulesFromGame(settings({ reentryPlus: 1, lateEntryPlus: 0 }), 'pool').reentryPlus, 1);
  assert.equal(rulesFromGame(settings({ reentryPlus: 1, lateEntryPlus: 0 }), 'pool').lateEntryPlus, 0);
  const merged = withStoredPointsRules({ poolLimit: 101, reentryPlus: 1 } as never, { poolLimit: 101 } as never) as Record<string, unknown>;
  assert.equal(merged.reentryPlus, 1, 'a stored key rides along');
  assert.ok(!('lateEntryPlus' in merged), 'an absent key stays absent');
});

test('X24-7b the form: Unlimited by default, Limited starts with an empty count, the rules are radios', () => {
  const draft = draftFromRules(DEFAULT_POOL_RULES);
  assert.equal(draft.reentryMode, 'unlimited');
  assert.equal(draft.reentryCount, '', 'switching to Limited leaves the count empty');
  assert.equal(draft.reentryPlus, 1);
  assert.equal(draft.lateEntryPlus, 1);
  assert.equal(parseReentryLimit({ reentryMode: 'limited', reentryCount: '' }), -1, 'an empty Limited count is refused on save');
  assert.match(rulesFromDraft({ ...draft, reentryMode: 'limited' }).error!, /0 to 99, or Unlimited/);
  const ok = rulesFromDraft({ ...draft, reentryPlus: 0, lateEntryPlus: 1 });
  assert.equal(ok.rules!.reentryPlus, 0);
  assert.equal(ok.rules!.lateEntryPlus, 1);
  assert.equal(draftFromRules({ ...DEFAULT_POOL_RULES, reentryLimit: 2 }).reentryCount, '2', 'a saved Limited count shows');

  const form = read('components/game/RulesForm.tsx');
  assert.match(form, /-reentries-block/, 'the Re-entries block groups count and score rule');
  assert.match(form, /-reentry-score/, 'the Re-entry score radios');
  assert.match(form, /-late-entry-block/, 'Late entry is its own block');
  assert.match(form, /-late-entry-score/, 'the Late entry radios');
  assert.ok(!/highest score still in\. How many/.test(form), 'the old count hint no longer says where they start');
  for (const screen of ['app/(screens)/settings.tsx', 'components/game/GameSettingsDialog.tsx']) {
    assert.match(read(screen), /RulesForm/, `${screen} renders the form, so both get the two blocks`);
  }
});

test('X24-7c migration 047 is written with rollback, pgTAP and replay hook — not applied to live', () => {
  const sql = read('supabase/migrations/047_reentry_and_late_entry_score.sql');
  for (const needle of [
    'create or replace function public.pool_entry_plus(p_settings jsonb, p_key text)',
    'create or replace function public.entry_plus_text(p_value jsonb)',
    'create or replace function public.reenter_player(uuid, uuid)'.replace('(uuid, uuid)', '(p_game_id uuid, p_profile_id uuid)'),
    "public.pool_entry_plus(g.settings, 'reentryPlus')",
    'create or replace function public.add_seated_player(p_game_id uuid, p_profile_id uuid, p_label text default null)',
    "public.pool_entry_plus(g.settings, 'lateEntryPlus')",
    'create or replace function public.event_log_games()',
    "when 'reentryPlus' then 'Re-entry score' when 'lateEntryPlus' then 'Late entry score'",
    'Written, not applied to live',
  ]) assert.ok(sql.includes(needle), `047 has: ${needle}`);
  assert.ok(!/drop\s+table|delete\s+from|alter\s+table/i.test(sql), '047 touches no table or row — functions only');

  const rollback = read('supabase/rollback/rollback_047_reentry_and_late_entry_score.sql');
  assert.ok(rollback.includes('drop function if exists public.pool_entry_plus(jsonb, text);'));
  assert.ok(rollback.includes('create or replace function public.reenter_player(p_game_id uuid, p_profile_id uuid)'), 'the 042 body comes back');
  assert.ok(!rollback.includes('pool_entry_plus(g.settings'), 'the restored bodies do not read the rule');
  assert.ok(rollback.includes("where k <> 'seatingPrompted'"), 'the 044 event_log_games body comes back');

  const hook = read('../ci/db/replay-rollbacks.sh');
  assert.ok(hook.includes('rollback_047_reentry_and_late_entry_score.sql'));
  assert.ok(hook.includes('047_reentry_and_late_entry_score'));
  assert.ok(hook.includes('HAS_047'));

  const t38 = read('supabase/tests/38_reentry_plus_047.sql');
  assert.match(t38, /re-enters at the highest score still in \(20\)/, 'the 041 rule when the key is absent');
  assert.match(t38, /re-enters at 41/, 'Highest + 1');
  assert.match(t38, /late entry at Highest \+ 1/);
});

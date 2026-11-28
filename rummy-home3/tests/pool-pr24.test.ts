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
import {
  clearOrder, displayOrder, displayRows, isFirstNumbered, isLastNumbered, numberedCounter, orderChanged, orderComplete, seatNumberOf, showsPlayerCode, startOrder, stepNumbered, stepsFor, tapPlayer,
} from '../utils/seating';

// PR 24 (Sree's feedback on v11, Nov 17) — item 7: where a player who comes back starts.
// X24-7a the two rules: "Highest score" (0) or "Highest score + 1" (1); new pools and user defaults
// at + 1; a game without the keys keeps the 041 rule. X24-7b the Re-entries form: Unlimited by
// default, switching to Limited leaves the count empty. X24-7c migration 047 is written with its
// rollback, pgTAP file and replay hook, and is NOT applied to live. X24-10 Order of players: the
// tap-to-number draft (undo last, highlight, arrows on numbered rows only, Clear, Done when everyone
// is numbered). X24-9 the New game flow: Next, Next, Next, Start game — order before co-admin.
// X24-3/5/6 the scorecard: pool header one line taller than Points (same typography), footer inside
// the card at 70% italic, portrait five-row card (Nov 18; was 70/30 panes), landscape table alone (Nov 18; was standings below).

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

// ---------- X24-10: the Order of players draft ----------
const four = ['sree', 'harish', 'priya', 'zed'];

test('X24-10a / D56 game start: nobody numbered; taps count down from the table size; tapping the latest one again undoes it', () => {
  let d = startOrder(four);
  assert.deepEqual(d.numbered, []);
  assert.equal(d.focus, null);
  assert.deepEqual(displayRows(d), four, 'untouched rows keep the pick order');
  assert.ok(!orderComplete(d));
  assert.equal(numberedCounter(0, 4), '0 of 4 numbered');

  d = tapPlayer(d, 'zed');
  assert.deepEqual(displayRows(d), ['zed', 'sree', 'harish', 'priya'], 'the first tap (highest card) moves to the top');
  assert.equal(seatNumberOf(d, 'zed'), 4, 'and shows the highest seat, not 1');
  assert.equal(seatNumberOf(d, 'sree'), null);
  assert.equal(d.focus, 'zed', 'the last touched row is highlighted');
  assert.ok(isLastNumbered(d, 'zed') && isFirstNumbered(d, 'zed'));

  d = tapPlayer(d, 'zed');
  assert.deepEqual(d.numbered, [], 'tapping the most recent number takes it back');
  assert.deepEqual(displayRows(d), four, 'and the player drops back among the unnumbered, in pick order');

  d = tapPlayer(tapPlayer(tapPlayer(d, 'zed'), 'sree'), 'harish');
  assert.deepEqual(d.numbered, ['harish', 'sree', 'zed'], 'seat order: the latest tap is the lowest seat');
  assert.deepEqual(displayRows(d), ['zed', 'sree', 'harish', 'priya'], 'rows: first tap on top, then each later tap under it');
  assert.equal(seatNumberOf(d, 'zed'), 4);
  assert.equal(seatNumberOf(d, 'sree'), 3);
  assert.equal(seatNumberOf(d, 'harish'), 2, 'numbers never change once given');
  assert.equal(numberedCounter(3, 4), '3 of 4 numbered');
  assert.ok(isFirstNumbered(d, 'zed') && isLastNumbered(d, 'harish'));
  const before = d;
  d = tapPlayer(d, 'zed');
  assert.deepEqual(d.numbered, before.numbered, 'tapping an earlier number only highlights');
  assert.equal(d.focus, 'zed');
  d = tapPlayer(d, 'priya');
  assert.ok(orderComplete(d));
  assert.equal(seatNumberOf(d, 'priya'), 1, 'the last tap is seat 1 and deals');
  assert.equal(numberedCounter(4, 4), 'Everyone numbered');
  assert.deepEqual(displayOrder(d), ['priya', 'harish', 'sree', 'zed'], 'what is saved: seat 1 first');
  assert.deepEqual(displayRows(d), ['zed', 'sree', 'harish', 'priya'], 'what is shown: seat 4 down to seat 1');
  assert.ok(orderChanged(d), 'Done has something to save');
  assert.equal(tapPlayer(d, 'nobody'), d, 'an unknown id is ignored');
});

test('X24-10b arrows move numbered players one seat at once and never touch the unnumbered; Clear empties everything', () => {
  let d = tapPlayer(tapPlayer(startOrder(four), 'zed'), 'sree');
  assert.deepEqual(d.numbered, ['sree', 'zed'], 'zed seat 4, sree seat 3');
  assert.equal(stepNumbered(d, 'priya', -1), d, 'no arrows on an unnumbered row');
  d = stepNumbered(d, 'sree', 1);
  assert.deepEqual(d.numbered, ['zed', 'sree'], '▲ gives sree the higher seat (4) and zed drops to 3');
  assert.equal(seatNumberOf(d, 'sree'), 4);
  assert.equal(d.focus, 'sree');
  assert.deepEqual(stepNumbered(d, 'sree', 1).numbered, ['zed', 'sree'], 'the highest seat has nowhere to go up');
  assert.deepEqual(stepNumbered(d, 'zed', -1).numbered, ['zed', 'sree'], 'the lowest seat so far has nowhere to go down');
  assert.deepEqual(displayRows(d), ['sree', 'zed', 'harish', 'priya'], 'the unnumbered stay below, in pick order');
  const cleared = clearOrder(d);
  assert.deepEqual(cleared.numbered, []);
  assert.equal(cleared.focus, null);
  assert.deepEqual(cleared.base, four, 'Clear keeps the players');
});

test('X24-10c mid-game: the page opens prefilled (select, then ▲ or ▼); Done stays off until the order changes', () => {
  const d = startOrder(four, true);
  assert.deepEqual(d.numbered, four, 'seat order as played');
  assert.deepEqual(displayRows(d), ['zed', 'priya', 'harish', 'sree'], 'shown seat 4 down to seat 1');
  assert.ok(orderComplete(d));
  assert.ok(!orderChanged(d), 'nothing moved yet');
  const moved = stepNumbered(d, 'zed', -1);
  assert.ok(orderChanged(moved));
  assert.deepEqual(displayOrder(moved), ['sree', 'harish', 'zed', 'priya'], '▼ on seat 4 (zed): zed to seat 3, priya to 4');
  const back = stepNumbered(moved, 'zed', 1);
  assert.ok(!orderChanged(back), 'moving back leaves Done off again');
  // Clear then renumber highest card first (seat 4 down to seat 1): complete, unchanged, Done off.
  const same = [...four].reverse().reduce((acc, id) => tapPlayer(acc, id), clearOrder(d));
  assert.ok(orderComplete(same) && !orderChanged(same));
  assert.ok(showsPlayerCode(347) && !showsPlayerCode(300), 'the player ID shows only when the row is wide enough (a Pixel 6 row inside the card is ~347 dp)');
  assert.ok(!showsPlayerCode(347, 1.3), 'at font 1.3 the same row is too narrow for the ID (Pixel 7 Pro nightly: the name collapsed)');
});

test('X24-10d the component and sheet: no chips panel, no "Keep this order", arrows only on numbered rows, Clear and Done', () => {
  const list = read('components/game/OrderOfPlayers.tsx');
  // D138: the list became a circle; ▲ ▼ live in the middle card, for the one selected player only.
  assert.match(list, /if \(centrePlayer && selected\) \{[\s\S]*?const steps = stepsFor\(draft, selected\);/, 'arrows only for the selected player');
  assert.match(list, /const next = tapRing\(draft, id\);/, 'a disc tap goes through tapRing');
  assert.match(list, /onPress=\{\(\) => onChange\(deselect\(draft\)\)\}/, 'a tap on the table lets go');
  assert.ok(!list.includes('Keep this order') && !list.includes('Picked up'));
  const sheet = read('components/game/SeatingSheet.tsx');
  assert.match(sheet, /startOrder\(base, true\)/, 'mid-game opens prefilled');
  assert.match(sheet, /testID="seating-clear"/);
  // Small fixes batch (Nov 21): Done is never grey once everyone is numbered — unchanged order → it closes.
  assert.match(sheet, /onPress=\{changed \? save : onDismiss\} loading=\{saving\} disabled=\{saving \|\| !complete\}[^\n]*testID="seating-done"/);
  assert.match(sheet, /unchanged=\{complete && !changed\}/, 'the counter line says why Done only closes');
  assert.equal(numberedCounter(4, 4, true), 'Everyone numbered · order unchanged — Done closes');
  assert.equal(numberedCounter(3, 4, true), '3 of 4 numbered');
  assert.ok(!sheet.includes('fromMenu') && !sheet.includes('seating-chips'));
});

// ---------- X24-9: the New game flow ----------
test('X24-9 New game: Players → Next → Game type → Next → Order of players → Next → Co-admin → Start game', () => {
  const screen = read('app/(screens)/games/new.tsx');
  assert.match(screen, /useState<'players' \| 'type' \| 'order' \| 'coadmin'>\('players'\)/);
  assert.match(screen, /setOrder\(startOrder\(newGameSeats\(selectedIds\)\)\);\s*setStep\('order'\);/, 'the order step starts with nobody numbered');
  assert.match(screen, /if \(coAdminPicks\.length\) \{ setStep\('coadmin'\); return; \}/, 'co-admin comes after the order');
  assert.match(screen, /nextIsStart=\{coAdminPicks\.length === 0\}/, 'with nobody to pick, the order step\'s button starts the game');
  assert.match(screen, /newGameSeats\(displayOrder\(order\)\)/, 'the seats are the numbered order');
  assert.ok(!screen.includes('setNudge') && !screen.includes('<CoAdminNudge'), 'the nudge dialog is gone');
  const type = read('components/game/GameTypeStep.tsx');
  assert.match(type, /testID="new-game-type-next"/);
  assert.ok(!type.includes('testID="start-game"'), 'the type step never says Start');
  const order = read('components/game/OrderStep.tsx');
  assert.match(order, /testID="new-game-order-next"/);
  assert.match(order, /testID="start-game"/, 'the order step says Start game only when no co-admin step follows');
  assert.match(order, /testID="new-game-order-clear"/);
  const coadmin = read('components/game/CoAdminNudge.tsx');
  assert.match(coadmin, /export function CoAdminStep/);
  assert.match(coadmin, /testID="start-game"/);
  assert.ok(!read('app/(screens)/games/[id].tsx').includes('shouldPromptSeating'), 'the scorecard pop-up is gone');
});

// ---------- X24-3 / 5 / 6: the scorecard ----------
test('X24-3 pool header: same lines as Points (the #number line went on Nov 18), same type sizes; the footer at 70% italic', async () => {
  const { headerHeight, footerType, FOOTER_SCALE, POOL_HEADER_SLACK, poolCardBodyHeight } = await import('../utils/scorecardLayout');
  const points = headerHeight(72, false, 1, false);
  const poolH = headerHeight(72, false, 1, true);
  assert.equal(poolH - points, POOL_HEADER_SLACK, 'only the slack that keeps the dealer column from shrinking its initials (CI run 1); no #number line');
  // Nov 18 (Sree): the 70 / 30 split is gone; the card hugs its rows and stops at five round rows.
  assert.equal(poolCardBodyHeight(130, 48, 5), 130, 'two rounds: the card hugs');
  assert.equal(poolCardBodyHeight(700, 48, 5), 240, 'many rounds: five row heights');
  assert.match(read('components/game/ScoreTable.tsx'), /flexShrink: 0,\s*includeFontPadding: false,\s*\},\s*headerTotal/, 'the initials never give way');
  const f = footerType();
  assert.equal(FOOTER_SCALE, 0.7);
  assert.equal(f.fontStyle, 'italic');
  assert.equal(f.fontWeight, '400', 'never bold');
  assert.ok(f.fontSize <= 10);
  const table = read('components/game/ScoreTable.tsx');
  assert.match(table, /testID="score-table-footer"/, 'the footer lives inside the card, under the last row');
  assert.match(table, /REENTRY_MARK = '↺'/);
  assert.match(table, /beforeReentry \? \{ color: colors\.onSurfaceVariant \}/, 'cells above the re-entry row go grey');
  assert.match(table, /`\$\{REENTRY_MARK\}\$\{column\.reentryScore\}`/, 'the re-entry cell shows the re-entry score, not the typed one');
  const screen = read('app/(screens)/games/[id].tsx');
  assert.doesNotMatch(screen, /below=\{/, 'Nov 18: landscape pool has no standings (turn the phone back for them)');
  assert.match(screen, /hugRows=\{pool && !sideways \? POOL_CARD_MAX_ROWS : undefined\}/, 'portrait pool: the five-row card');
  assert.match(screen, /testID="pool-standings-pane"/, 'portrait: the standings pane');
  assert.ok(!/flexDirection: 'row'[^\n]*standings/i.test(screen), 'never side by side');
});

// ---------- X24-1: wording ----------
test('X24-1 no "stake" in user-facing copy', () => {
  const files = ['components/game/RulesForm.tsx', 'components/game/GameTypeStep.tsx', 'app/(screens)/settings.tsx', 'constants/help.ts', 'app/(screens)/games/new.tsx', 'app/(screens)/games/[id].tsx', 'components/game/PoolStandings.tsx', 'utils/eventLog.ts'];
  for (const f of files) {
    const src = read(f).replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
    const strings = [...src.matchAll(/(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g)].map((m) => m[2]);
    const offending = strings.filter((text) => /\bstakes?\b/i.test(text) && !/^stake$|gameType|'stake'|stakeDrop|stakeMiddleDrop/.test(text));
    assert.deepEqual(offending, [], `${f} shows "stake" to the user`);
  }
});

test('D59 + D74 (D138 ring): the lowest numbered seat has no ▼, the highest no ▲ — an empty slot, never a grey chevron', () => {
  const list = read('components/game/OrderOfPlayers.tsx');
  assert.match(list, /\{steps\.up \? \([\s\S]*?chevron-up[\s\S]*?\) : <View style=\{styles\.moveSlot\} \/>\}/);
  assert.match(list, /\{steps\.down \? \([\s\S]*?chevron-down[\s\S]*?\) : <View style=\{styles\.moveSlot\} \/>\}/);
  const d = ['a', 'b', 'c', 'd'].reduce((acc, id) => tapPlayer(acc, id), startOrder(['a', 'b', 'c', 'd']));
  assert.deepEqual(stepsFor(d, 'a'), { up: false, down: true }, 'seat 4: no ▲');
  assert.deepEqual(stepsFor(d, 'd'), { up: true, down: false }, 'seat 1: no ▼');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Game } from '../types/game';
import {
  actual,
  anyShortened,
  APPLY_WHOLE_GAME,
  digitCount,
  exactLines,
  formatExact,
  highMultiplierConfirm,
  multiplierChangeConfirm,
  multiplierExample,
  multiplierFieldText,
  multiplierLabel,
  multiplierOf,
  MULTIPLIER_MAX,
  MULTIPLIER_RANGE_TEXT,
  multiplyScores,
  parseMultiplierInput,
  pdfBlockSize,
  pointsGameMultiplier,
  resolveMultiplier,
  SHARE_ONE_COLUMN_FROM_DIGITS,
  SHORT_MAX_CHARS,
  shortNumber,
  spokenExact,
  START_NEW_GAME_INSTEAD,
  totalsFooter,
  widestChars,
} from '../utils/multiplier';
import { rankScores, shareColumns, resultInitials } from '../utils/resultsDesign';
import { buildResultsDetails, buildRoundTable, resultsDetailsHtml } from '../utils/resultsDetails';
import { buildFinalScoresSheet } from '../utils/finalScoresSheet';
import { buildResultSheet } from '../utils/results';
import { resultScoresOf } from '../utils/pool';
import { rulesFromDraft, draftFromRules } from '../utils/rulesDraft';
import { DEFAULT_POINTS_RULES, rulesFromGame, validateRules } from '../utils/gameSettings';

const src = (file: string) => readFileSync(path.join(__dirname, '..', file), 'utf8');

// ---------- X14-1: shortNumber, one rule everywhere ----------

// value, expected (plus: true). CSV so a reviewer can scan the rule in one place.
const SHORT_CASES = `
0,0
7,+7
-30,-30
9999,+9999
-9999,-9999
10000,+10K
-10000,-10K
12345,+12K
-12345,-12K
99499,+99K
99500,+100K
123456,+123K
-123456,-123K
999499,+999K
999500,+1M
-999500,-1M
1000000,+1M
1234567,+1.2M
-1234567,-1.2M
12345678,+12M
123456789,+123M
999500000,+1B
2280000000,+2.3B
-2280000000,-2.3B
`.trim().split('\n').map((line) => line.split(',') as [string, string]);

test('X14-1 shortNumber: K from 10,000, M from 1,000,000, B past that; never more than 5 characters; half away from zero; no ".0" (CSV cases)', () => {
  SHORT_CASES.forEach(([value, expected]) => {
    assert.equal(shortNumber(Number(value), { plus: true }), expected, `${value} → ${expected}`);
  });
  assert.equal(shortNumber(12345), '12.3K', 'without the plus there is room for one decimal');
  assert.equal(shortNumber(-12345), '-12K', 'the minus sign always stays and takes its character');
});

test('X14-1 property: for every value from -5e9 to 5e9 the short form keeps the sign, stays ≤ 5 characters and never ends in ".0"', () => {
  let seed = 20261115;
  const next = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < 20000; i += 1) {
    const magnitude = 10 ** (next() * 9.7);
    const value = Math.round((next() < 0.5 ? -1 : 1) * magnitude);
    const text = shortNumber(value, { plus: true });
    assert.ok(text.length <= SHORT_MAX_CHARS, `${value} → "${text}" is ${text.length} chars`);
    assert.ok(!/\.0[KMB]?$/.test(text), `${value} → "${text}" has a trailing .0`);
    if (value < 0) assert.ok(text.startsWith('-'), `${value} keeps its minus`);
    if (value > 0) assert.ok(text.startsWith('+'), `${value} gets its plus`);
    if (Math.abs(value) < 10000) assert.equal(text, (value > 0 ? '+' : '') + String(value), 'under 10,000 nothing is shortened');
  }
});

test('X14-1 formatExact: thousands separators, sign, no decimals; the exact and spoken forms agree', () => {
  assert.equal(formatExact(2280000000), '+2,280,000,000');
  assert.equal(formatExact(-3000), '-3,000');
  assert.equal(formatExact(0), '0');
  assert.equal(formatExact(10000, false), '10,000');
  assert.equal(spokenExact(-3000), 'minus 3,000');
  assert.equal(spokenExact(3000), 'plus 3,000');
  assert.equal(spokenExact(0), '0');
  assert.equal(multiplierLabel(10000), '×10,000');
  assert.equal(anyShortened([30, -9999, 0]), false);
  assert.equal(anyShortened([30, 10000]), true);
  assert.equal(totalsFooter(0, false), 'Totals add to 0');
  assert.equal(totalsFooter(40, true), 'Totals add to +40 (exact)');
});

// ---------- X14-2 / X14-3: actual points, precedence, parsing ----------

test('X14-2 actual = entered × the game multiplier; multiplyScores keeps holes and lengths; sums at ×N still add to 0', () => {
  assert.equal(actual(-30, 100), -3000);
  assert.equal(actual(80, 10000), 800000);
  const scores = { a: [10, -20, 30], b: [-10, 20, -30], c: [undefined, undefined, 0] as (number | undefined)[] };
  const times = multiplyScores(scores, 100);
  assert.deepEqual(times.a, [1000, -2000, 3000]);
  assert.deepEqual(times.b, [-1000, 2000, -3000]);
  assert.equal(times.c.length, 3, 'the column keeps its length');
  assert.equal(times.c[0], undefined, 'a hole stays a hole');
  assert.equal(times.c[2], 0);
  const sum = (['a', 'b', 'c'] as const).flatMap((id) => times[id]).reduce<number>((s, v) => s + (v ?? 0), 0);
  assert.equal(sum, 0);
  assert.equal(multiplyScores(scores, 1), scores, '×1 returns the same object (no copy)');
});

test('X14-3 precedence: game › user default › 1; absent / bad keys read as 1; Pool ignores the multiplier', () => {
  assert.equal(multiplierOf(undefined), 1);
  assert.equal(multiplierOf({}), 1);
  assert.equal(multiplierOf({ multiplier: 100 }), 100);
  assert.equal(multiplierOf({ multiplier: 100 }, 'pool'), 1, 'a pool never multiplies');
  assert.equal(multiplierOf({ multiplier: 0 }), 1);
  assert.equal(multiplierOf({ multiplier: 2.9 }), 2, 'whole numbers only');
  assert.equal(multiplierOf({ multiplier: 'x' as unknown as number }), 1);
  assert.equal(pointsGameMultiplier({ gameType: 'stake', settings: { multiplier: 50 } }), 50);
  assert.equal(pointsGameMultiplier({ gameType: 'pool', settings: { multiplier: 50 } }), 1);
  assert.equal(pointsGameMultiplier(null), 1);
  assert.equal(resolveMultiplier(undefined, 10), 10, 'no game value → the user default');
  assert.equal(resolveMultiplier(5, 10), 5, 'the game wins');
  assert.equal(resolveMultiplier(undefined, undefined), 1);
  assert.equal(resolveMultiplier(99999, undefined), MULTIPLIER_MAX, 'capped');
});

test('X14-3 parsing: digits only, 1–10,000, empty / 0 → 1, over the cap → the range text; the field shows "" at ×1', () => {
  assert.deepEqual(parseMultiplierInput(''), { value: 1, error: null });
  assert.deepEqual(parseMultiplierInput('0'), { value: 1, error: null });
  assert.deepEqual(parseMultiplierInput('007'), { value: 7, error: null });
  assert.deepEqual(parseMultiplierInput('10000'), { value: 10000, error: null });
  assert.deepEqual(parseMultiplierInput('10001'), { value: null, error: MULTIPLIER_RANGE_TEXT });
  assert.deepEqual(parseMultiplierInput('1e3'), { value: 13, error: null }, 'letters are dropped, digits kept');
  assert.equal(multiplierFieldText(1), '');
  assert.equal(multiplierFieldText(undefined), '');
  assert.equal(multiplierFieldText(250), '250');
  assert.equal(multiplierExample(100, -80), 'A 30 is 3,000 · a Full count is 8,000');
  assert.match(multiplierExample(1, -80), /×1 unless you change it/);
});

test('X14-3 rules: the draft round-trips the multiplier for Points, drops it for Pool; validateRules refuses out-of-range; rulesFromGame reads settings', () => {
  const points = { ...DEFAULT_POINTS_RULES, multiplier: 100 };
  const draft = draftFromRules(points);
  assert.equal(draft.multiplier, '100');
  assert.equal(rulesFromDraft(draft).rules?.multiplier, 100);
  const bad = rulesFromDraft({ ...draft, multiplier: '10001' });
  assert.equal(bad.rules, null);
  assert.equal(bad.error, MULTIPLIER_RANGE_TEXT);
  assert.equal(validateRules({ ...DEFAULT_POINTS_RULES, multiplier: 0 }) !== null, true, '0 is refused');
  assert.equal(validateRules({ ...DEFAULT_POINTS_RULES, multiplier: 10000 }), null);
  assert.equal(rulesFromGame({ drop: -10, middleDrop: -30, maxCount: -80, multiplier: 25 } as never, 'stake').multiplier, 25);
  assert.equal(rulesFromGame({ drop: 25, middleDrop: 50, maxCount: 130, multiplier: 25, n: 101 } as never, 'pool').multiplier, undefined, 'pool rules carry no multiplier');
});

// ---------- X14-12: the whole-game confirm ----------

test('X14-12 confirm gating: no rounds → no dialog; N rounds → the text names N and the whole game; the three actions; ≥ 1,000 asks once', () => {
  assert.equal(multiplierChangeConfirm(0, 1, 100), null, 'no rounds → straight save');
  assert.equal(multiplierChangeConfirm(3, 10, 10), null, 'no change → no dialog');
  assert.equal(multiplierChangeConfirm(1, 1, 10), '1 round already played. The new multiplier will apply to the whole game, including that round. Or end this game and start a new one with the new multiplier.');
  assert.equal(multiplierChangeConfirm(3, 10, 5), '3 rounds already played. The new multiplier will apply to the whole game, including those rounds. Or end this game and start a new one with the new multiplier.');
  assert.equal(APPLY_WHOLE_GAME, 'Apply to whole game');
  assert.equal(START_NEW_GAME_INSTEAD, 'Start a new game instead');
  assert.equal(highMultiplierConfirm(999, -80), null);
  assert.equal(highMultiplierConfirm(1000, -80), '×1,000? A Full count is 80,000 points.');
  assert.equal(highMultiplierConfirm(10000, -80), '×10,000? A Full count is 800,000 points.');
  const dialog = src('components/game/GameSettingsDialog.tsx');
  ['multiplier-apply-whole-game', 'multiplier-start-new-game', 'multiplier-confirm-cancel', 'multiplier-confirm-keep'].forEach((id) => assert.ok(dialog.includes(id), id));
  const screen = src('app/(screens)/games/[id].tsx');
  assert.match(screen, /newGameDraft\.setRules\(rules\)/, 'Start a new game instead carries the rules (with the new multiplier) to New game');
  assert.match(screen, /roundCount=\{maxRounds\}/, 'the dialog knows how many rounds exist');
});

// ---------- X14-4: share one-column rule, PDF block widths ----------

test('X14-4 share image: two columns to 7 digits, one column from 8; the PDF blocks go 5 / 4 / 3 by the widest value', () => {
  assert.equal(SHARE_ONE_COLUMN_FROM_DIGITS, 8);
  assert.equal(digitCount(-9999999), 7);
  assert.equal(digitCount(10000000), 8);
  const players = [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Bob' }, { id: 'c', name: 'Cy' }];
  const labels = resultInitials(players, []);
  const seven = rankScores([{ id: 'a', name: 'Ann', points: 9999999, place: 1, games: 1 }, { id: 'b', name: 'Bob', points: -9999999, place: 2, games: 1 }, { id: 'c', name: 'Cy', points: 0, place: 3, games: 1 }], players, labels);
  assert.equal(shareColumns(seven).layout, 'split');
  const eight = rankScores([{ id: 'a', name: 'Ann', points: 10000000, place: 1, games: 1 }, { id: 'b', name: 'Bob', points: -10000000, place: 2, games: 1 }], players, labels);
  const single = shareColumns(eight);
  assert.equal(single.layout, 'single');
  assert.equal(single.left.length, 2, 'everyone in the one column');
  assert.equal(single.right.length, 0);
  assert.equal(pdfBlockSize(7), 5);
  assert.equal(pdfBlockSize(8), 4);
  assert.equal(pdfBlockSize(9), 4);
  assert.equal(pdfBlockSize(10), 3);
  assert.equal(widestChars(['+30', '-3,000,000']), 10);
  const view = src('components/share/ShareCardView.tsx');
  assert.match(view, /card\.layout === 'single' \? null/, 'the view drops the second column');
  const canvas = src('utils/shareImage.ts');
  assert.match(canvas, /card\.layout === 'single' \? cardW - INNER_PAD \* 2/, 'the web canvas draws one full-width column');
});

test('X14-4 round-by-round table: five a block at ×1, four at ×100 (8–9 chars), three at ×10,000; the heading says ×N · exact points', () => {
  const players = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}` }));
  const rounds = Object.fromEntries(players.map((p, i) => [p.id, [i === 0 ? 720 : -80, i === 0 ? 720 : -80]]));
  const totals = Object.fromEntries(players.map((p, i) => [p.id, i === 0 ? 1440 : -160]));
  const base = { id: 'g', name: 'C0DE', label: 'S1', date: '2026-11-15T10:00:00', scores: totals, rounds, roundCount: 2 };
  assert.equal(buildRoundTable(base, 0, players).blocks.length, 2, '10 players → two blocks of five at ×1');
  const x100 = buildRoundTable({ ...base, scores: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v * 100])), rounds: multiplyScores(rounds, 100), multiplier: 100 }, 0, players);
  assert.equal(x100.blockSize, 4, '+144,000 is 8 characters → four a block');
  assert.equal(x100.blocks.length, 3);
  assert.equal(x100.multiplier, '×100');
  const x10000 = buildRoundTable({ ...base, scores: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v * 10000])), rounds: multiplyScores(rounds, 10000), multiplier: 10000 }, 0, players);
  assert.equal(x10000.blockSize, 3, '+14,400,000 is 11 characters → three a block');
  const details = buildResultsDetails({
    createdAtLabel: 'x',
    standings: players.map((p, i) => ({ id: p.id, name: p.name, points: (i === 0 ? 1440 : -160) * 100, place: i + 1, games: 1 })),
    players,
    games: [{ ...base, scores: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v * 100])), rounds: multiplyScores(rounds, 100), multiplier: 100 }],
  });
  const html = resultsDetailsHtml(details);
  assert.match(html, /<span class="mult">×100 · exact points<\/span>/);
  assert.match(html, /<table class="rb b4 n4">/, 'the four-wide blocks carry their width class');
  assert.match(html, /\+144,000/, 'the PDF prints exact points');
  assert.doesNotMatch(html, /144K/, 'never short in the PDF');
});

// ---------- X14-5: Results multiply at the boundary ----------

test('X14-5 Results: a Points game contributes entered × its multiplier; the band table shows K/M on screen, exact in text, ×N under the game header; Pool awards untouched', () => {
  const game = {
    gameType: 'stake' as const,
    players: ['a', 'b'],
    scores: { a: [30, -10], b: [-30, 10] },
    awardedAt: null,
    prizeShares: null,
    settings: { drop: -10, middleDrop: -30, maxCount: -80, multiplier: 1000 } as unknown as Game['settings'],
  };
  assert.deepEqual(resultScoresOf(game), { a: [30000, -10000], b: [-30000, 10000] });
  assert.deepEqual(resultScoresOf({ ...game, settings: { ...game.settings, multiplier: undefined } }), game.scores, 'no key → entered');
  const pool = { gameType: 'pool' as const, players: ['a', 'b'], scores: { a: [20], b: [0] }, awardedAt: '2026-11-15', prizeShares: { a: -50, b: 50 }, settings: { drop: 25, middleDrop: 50, maxCount: 130, n: 101, multiplier: 1000 } as unknown as Game['settings'] };
  assert.deepEqual(resultScoresOf(pool), { a: [-50], b: [50] }, 'a pool contributes its awards, never multiplied');

  const players = [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Bob' }];
  const sheet = buildResultSheet(
    [{ id: 'g1', name: 'C0DE1', label: 'S1', date: '2026-11-15T10:00:00', players: ['a', 'b'], scores: { a: [20000], b: [-20000] }, multiplier: 1000 }],
    [{ id: 'a', name: 'Ann', points: 20000, place: 1, games: 1 }, { id: 'b', name: 'Bob', points: -20000, place: 2, games: 1 }],
  );
  assert.equal(sheet.games[0].multiplier, 1000, 'the sheet carries the game multiplier');

  const details = buildResultsDetails({
    createdAtLabel: 'x',
    standings: [{ id: 'a', name: 'Ann', points: 20030, place: 1, games: 1 }, { id: 'b', name: 'Bob', points: -20030, place: 2, games: 1 }],
    players,
    games: [
      { id: 'g1', name: 'C0DE1', label: 'S1', date: '2026-11-15T10:00:00', scores: { a: 20000, b: -20000 }, multiplier: 1000 },
      { id: 'g2', name: 'C0DE2', label: 'S2', date: '2026-11-15T11:00:00', scores: { a: 30, b: -30 } },
    ],
  });
  const cell = details.table.rows[0].bands[0][0];
  assert.equal(cell.text, '+20,000');
  assert.equal(cell.short, '+20K');
  assert.equal(details.table.rows[1].bands[0][0].short, '-20K');
  assert.equal(details.table.rows[0].bands[0][1].short, '+30', 'the ×1 game is never shortened');
  assert.deepEqual(details.table.headerMultipliers, [['×1,000', '']], '×N only under the multiplied game');
  assert.equal(details.table.rows[0].totalShort, '+20K');
  assert.equal(details.table.rows[0].total, '+20,030');
  const html = resultsDetailsHtml(details);
  assert.match(html, /S1 ×1,000/, 'the PDF band header carries ×N');
  assert.match(html, /2 players · 1 round · ×1,000|players · ×1,000/, 'the games block names the multiplier');
  assert.match(html, /\+20,000/);
});

test('X14-5 Final scores: the sheet multiplies once (cells, totals, table, card) and says ×N · exact points; the live and /r/ pages know the key', () => {
  const sheet = buildFinalScoresSheet({
    game: { id: 'g', shareCode: 'C0DE', gameLabel: 'S1', date: '2026-11-15T10:00:00', isComplete: true },
    players: [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Bob' }],
    scores: { a: [30, 50], b: [-30, -50] },
    multiplier: 100,
  });
  assert.equal(sheet.multiplier, 100);
  assert.equal(sheet.multiplierLine, '×100 · exact points');
  assert.equal(sheet.players[0].rows[0][0].text, '+3,000');
  assert.equal(sheet.players[0].totalText, '+8,000');
  assert.equal(sheet.summary[0].total, 8000);
  assert.equal(sheet.totalSum, 0);
  assert.match(sheet.card.summary ?? '', /×100$/);
  assert.equal(sheet.table.multiplier, '×100');
  const plain = buildFinalScoresSheet({ game: { id: 'g', date: '2026-11-15T10:00:00', isComplete: true }, players: [{ id: 'a', name: 'Ann' }], scores: { a: [30] }, multiplier: 1 });
  assert.equal(plain.multiplier, undefined);
  assert.equal(plain.multiplierLine, undefined);
  const live = src('public/scorecard.html');
  assert.match(live, /card\.multiplier/, 'the live page reads the multiplier from public_scorecard');
  assert.match(live, /Exact points/);
  assert.equal(src('public/scorecard.html'), src('web/scorecard.html'), 'the web mirror is byte-identical');
  assert.match(src('public/r/index.html'), /g\.multiplier/, 'the /r/ page heads multiplied games');
});

// ---------- X14-6: the per-phone toggle ----------

test('X14-6 the Actual / Entered toggle is per phone, default on, hidden at ×1; the Exact sheet sorts by actual total', () => {
  const strip = src('components/game/MultiplierStrip.tsx');
  assert.match(strip, /if \(multiplier <= 1\) return null;/, 'chip and toggle vanish at ×1');
  const hook = src('hooks/useActualToggle.ts');
  assert.match(hook, /AsyncStorage/, 'the choice lives on the phone');
  const util = src('utils/multiplier.ts');
  assert.match(util, /ACTUAL_TOGGLE_DEFAULT = true/);
  const table = src('components/game/ScoreTable.tsx');
  assert.match(table, /showActual && multiplier > 1 \? multiplier : 1/, 'Entered points paints the raw numbers');
  const lines = exactLines({ players: [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Bob' }], totals: { a: -40, b: 40 }, multiplier: 100 });
  assert.equal(lines[0].name, 'Bob');
  assert.equal(lines[0].exact, '+4,000');
  assert.equal(lines[0].entered, 'entered +40 × 100');
  assert.equal(lines[1].exact, '-4,000');
});

// ---------- migration 043 and the test plan ----------

test('043 is written, not applied: bigint result sums, the Multiplier log label, the range trigger, the live-page key; the rollback and the replay list know it', () => {
  const migration = src('supabase/migrations/043_multiplier.sql');
  ['game_multiplier', 'games_multiplier_check', 'declare_game_result', 'result_places_json', 'public_result', 'public_scorecard', 'event_log_games', "'Multiplier'", 'bigint', 'queue_result_saved_emails', 'list_game_results_page'].forEach((needle) => assert.ok(migration.includes(needle), needle));
  assert.ok(src('supabase/rollback/rollback_043_multiplier.sql').includes('drop function if exists public.game_multiplier'));
  assert.match(src('supabase/tests/34_multiplier_043.sql'), /select plan\(/);
  assert.match(src('../ci/db/replay-rollbacks.sh'), /043/);
  const plan = src('docs/migrations-to-apply.md');
  assert.match(plan, /043_multiplier\.sql/);
  assert.doesNotMatch(plan, /043 \(Multiplier, PR 14\) and 044 \(Going rogue, PR 20\) are spec-only and not yet written/);
  const strategy = src('docs/testing-strategy.md');
  assert.match(strategy, /tests\/multiplier-pr14\.test\.ts/);
  assert.match(strategy, /smoke\/18-multiplier-change\.yaml/);
  assert.match(strategy, /full\/50-multiplier-20p\.yaml/);
});

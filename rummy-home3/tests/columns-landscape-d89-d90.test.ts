import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COLUMN_CHOICE_DEFAULT,
  columnChoices,
  ColumnChoice,
  columnLayout,
  maxColumns,
  MIN_COLUMN_WIDTH,
  pinchStep,
  PINCH_SNAP,
  readColumnChoice,
  scorecardChrome,
  shownChoice,
  stepColumnChoice,
  visibleColumns,
  writeColumnChoice,
} from '../utils/scorecardLayout';

// columns-landscape-spec.md (Sree, Nov 24 — "Yes, the spec is okay").
// D90: "How about 5, 7, and then max? … whatever the minimum size is, you allow that. … Let's start with 5 as the default."
// D89: "landscape is landscape, no buttons, nothing, no three dots, just to see the scorecard." … "don't delete all that code. Just park it."

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (path: string) => readFileSync(join(root, path), 'utf8');

/** The portrait table is the screen less spacing.sm on each side (games/[id].tsx portraitTable). */
const portraitTable = (screenDp: number) => screenDp - 16;
const widthFor = (screenDp: number, players: number, choice: ColumnChoice) => {
  const table = portraitTable(screenDp);
  return columnLayout(table, players, false, visibleColumns(choice, table, false));
};
const close = (actual: number, expected: number, message: string) => assert.ok(Math.abs(actual - expected) < 0.01, `${message}: ${actual} ≈ ${expected}`);

test('D90: Max is as many 38-dp columns as fit, computed from the width — 7 on 360 dp, 9 on 412 dp, 14 on 600 dp', () => {
  assert.equal(maxColumns(portraitTable(360), false), 7, '302 / 38 = 7.9');
  assert.equal(maxColumns(portraitTable(412), false), 9, '354 / 38 = 9.3');
  assert.equal(maxColumns(portraitTable(600), false), 14, '542 / 38 = 14.3');
  assert.equal(maxColumns(0, false), 1, 'never zero columns, even before the table is measured');
});

test('D90: 13 players — 5 · 7 · Max column widths at 360, 412 and 600 dp; the rest are a swipe away', () => {
  const cases: [number, ColumnChoice, number, boolean][] = [
    [360, 5, 302 / 5, true], [360, 7, 302 / 7, true], [360, 'max', 302 / 7, true],
    [412, 5, 354 / 5, true], [412, 7, 354 / 7, true], [412, 'max', 354 / 9, true],
    // 600 dp: Max (14) is more than the 13 players, so the 13 share the width and nothing scrolls.
    [600, 5, 542 / 5, true], [600, 7, 542 / 7, true], [600, 'max', 542 / 13, false],
  ];
  for (const [screen, choice, width, scrolls] of cases) {
    const layout = widthFor(screen, 13, choice);
    close(layout.columnWidth, width, `${screen} dp, ${choice}`);
    assert.equal(layout.scrollsSideways, scrolls, `${screen} dp, ${choice}: scrolls sideways`);
    close(layout.contentWidth, layout.columnWidth * 13, `${screen} dp, ${choice}: every column is in the content`);
  }
});

test('D90: 4 players — fewer players than any choice share the width, as before', () => {
  for (const screen of [360, 412, 600]) {
    const share = (portraitTable(screen) - 42) / 4;
    for (const choice of [5, 7, 'max'] as ColumnChoice[]) {
      const layout = widthFor(screen, 4, choice);
      close(layout.columnWidth, share, `${screen} dp, ${choice}`);
      assert.equal(layout.scrollsSideways, false, `${screen} dp, ${choice}: no sideways scroll`);
    }
    assert.deepEqual(widthFor(screen, 4, 5), columnLayout(portraitTable(screen), 4, false), 'same as the uncapped layout');
  }
});

test('D90: Max is never below the 38-dp minimum, on any width, for any player count', () => {
  for (let screen = 300; screen <= 1200; screen += 7) {
    for (const players of [1, 4, 7, 13, 20]) {
      for (const choice of [5, 7, 'max'] as ColumnChoice[]) {
        const { columnWidth } = widthFor(screen, players, choice);
        assert.ok(columnWidth >= MIN_COLUMN_WIDTH, `${screen} dp, ${players} players, ${choice}: ${columnWidth}`);
      }
    }
  }
});

test('D90: the menu offers "5 · Max" when 7 equals Max, "5 · 7 · Max" otherwise; a stored 7 then reads as Max', () => {
  assert.deepEqual(columnChoices(portraitTable(360), false), [5, 'max'], '360 dp: 7 = Max');
  assert.deepEqual(columnChoices(portraitTable(412), false), [5, 7, 'max']);
  assert.deepEqual(columnChoices(portraitTable(600), false), [5, 7, 'max']);
  assert.equal(shownChoice(7, [5, 'max']), 'max');
  assert.equal(shownChoice(5, [5, 'max']), 5);
  assert.equal(shownChoice(7, [5, 7, 'max']), 7);
  assert.equal(visibleColumns(7, portraitTable(360), false), 7, 'and 7 shows exactly the Max columns there');
});

test('D90: 5 is the default, remembered on the phone; unknown values fall back to 5', () => {
  assert.equal(COLUMN_CHOICE_DEFAULT, 5);
  for (const choice of [5, 7, 'max'] as ColumnChoice[]) assert.equal(readColumnChoice(writeColumnChoice(choice)), choice);
  assert.equal(readColumnChoice(null), 5);
  assert.equal(readColumnChoice('all'), 5, 'Sree: "it shouldn\'t say all"');
  const hook = src('hooks/useColumnChoice.ts');
  assert.match(hook, /AsyncStorage\.getItem\(COLUMN_CHOICE_KEY\)/);
  assert.match(hook, /AsyncStorage\.setItem\(COLUMN_CHOICE_KEY, writeColumnChoice\(next\)\)/);
});

test('D90: pinch snaps — fingers apart steps towards 5, together towards Max, one step per snap, never past the ends', () => {
  assert.equal(pinchStep(1), 0);
  assert.equal(pinchStep(1.1), 0, 'small wobble: nothing');
  assert.equal(pinchStep(PINCH_SNAP), -1, 'spread: fewer, bigger columns');
  assert.equal(pinchStep(1 / PINCH_SNAP), 1, 'pinch: more columns');
  assert.equal(pinchStep(0), 0);
  const all: ColumnChoice[] = [5, 7, 'max'];
  assert.equal(stepColumnChoice(5, all, 1), 7);
  assert.equal(stepColumnChoice(7, all, 1), 'max');
  assert.equal(stepColumnChoice('max', all, 1), 'max');
  assert.equal(stepColumnChoice('max', all, -1), 7);
  assert.equal(stepColumnChoice(5, all, -1), 5);
  assert.equal(stepColumnChoice(5, [5, 'max'], 1), 'max', '5 · Max phones skip 7');
  assert.equal(stepColumnChoice(7, [5, 'max'], -1), 5, 'a stored 7 there is Max, one step from 5');
});

test('D90: the pinch is PanResponder with two touches (no gesture library), the names row still drags the table, the menu has the Columns row', () => {
  const table = src('components/game/ScoreTable.tsx');
  assert.match(table, /e\.nativeEvent\.touches\.length === 2/);
  assert.match(table, /onStartShouldSetPanResponderCapture: twoFingers/);
  assert.match(table, /\{\.\.\.pinch\.panHandlers\} testID="score-table"/);
  assert.match(table, /\{\.\.\.headerPan\.panHandlers\} testID="score-table-header-scroller"/, 'the names row still swipes the table');
  assert.doesNotMatch(table, /react-native-gesture-handler|react-native-reanimated/);
  assert.match(table, /columnLayout\(tableWidth, columns\.length, compact, visible\)/);
  const screen = src('app/(screens)/games/[id].tsx');
  assert.match(screen, /columnChoice=\{sideways \? undefined : columnChoice\}/, 'portrait only; landscape keeps every column');
  assert.match(screen, /testID="game-menu-columns"/);
  assert.match(screen, /testID: `columns-choice-\$\{choice\}`/);
});

test('D89 park switch: off, landscape is the table alone; on, today\'s landscape chrome is back; portrait never changes', () => {
  const none = { header: false, strip: false, bottomBar: false, footer: false, taps: false };
  const all = { header: true, strip: true, bottomBar: true, footer: true, taps: true };
  assert.deepEqual(scorecardChrome(true, false), none, 'landscape, switch off: no header, tags, menu, bar, footer; taps open nothing');
  assert.deepEqual(scorecardChrome(true, true), all, 'landscape, switch on (future tablet mode): as before D89');
  assert.deepEqual(scorecardChrome(false, false), all, 'portrait: unchanged');
  assert.deepEqual(scorecardChrome(false, true), all);

  assert.match(src('hooks/useLayout.ts'), /export const LANDSCAPE_EDITING = false;/, 'the switch ships off');
  const screen = src('app/(screens)/games/[id].tsx');
  assert.match(screen, /const chrome = scorecardChrome\(sideways, LANDSCAPE_EDITING\);/);
  assert.match(screen, /headerShown: chrome\.header,/, 'the header (back, title, Share, Help, ⋮) goes');
  assert.match(screen, /\{chrome\.strip \? \(\s*<View style=\{\[styles\.infoStrip/, 'the tags, Actual toggle, completed line and pool hint go');
  assert.match(screen, /\{chrome\.bottomBar && !game\.isComplete && canScoreNow \? \(\s*<BottomBar/, 'Undo / Add round / Complete go');
  assert.match(screen, /onRoundPress=\{chrome\.taps && /, 'a row tap opens nothing');
  assert.match(screen, /onTotalPress=\{pool \|\| !chrome\.taps \? undefined/);
  // Parked, not deleted: the landscape-only Give awards in the strip is still in the code.
  assert.match(screen, /pool && sideways && canManageNow && !game\.closedAt \?[\s\S]*?testID="strip-give-awards"/);
});

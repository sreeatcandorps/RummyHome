import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { helpShotSize, HELP_SHOT_RATIO } from '../utils/helpShot';
import { seatRowHeight, SEAT_ROW_MIN_HEIGHT } from '../utils/seating';

const src = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

// ---- APK v12 feedback (Sree, Nov 19): the points he and I agreed on, see docs/v12-feedback.md ----

test('v12 #1: the help picture is sized from the card width at the picture ratio, capped on tall screens', () => {
  assert.equal(HELP_SHOT_RATIO, 540 / 1200);
  assert.deepEqual(helpShotSize(360), { width: 324, height: 720 }, 'a 360-wide card: capped by the 720 height');
  assert.deepEqual(helpShotSize(300), { width: 300, height: 667 }, 'a narrow card: full width');
  assert.deepEqual(helpShotSize(0), { width: 0, height: 0 });
  const page = src('components/help/HelpPage.tsx');
  assert.match(page, /onLayout=\{\(e\) => setShotWidth\(Math\.floor\(e\.nativeEvent\.layout\.width\)\)\}/);
  assert.match(page, /helpShotSize\(shotWidth\)/);
  assert.doesNotMatch(page, /aspectRatio: 0\.72/, 'the old letterboxing ratio is gone');
});

test('v12 #3/#4/#5: Add by initials — no sample letters, Save beside the boxes, count + Done under the rows, Unsaved players', () => {
  const screen = src('app/(screens)/players/add.tsx');
  assert.match(screen, /export const FIRST_PLACEHOLDER = '';/);
  assert.match(screen, /export const LAST_PLACEHOLDER = '';/);
  assert.match(screen, /export const UNSAVED_TITLE = 'Unsaved players';/);
  assert.match(screen, /one letter only\.`/, 'the dialog is only about half-filled rows');
  assert.match(screen, /const complete = unsavedRows\.filter\(\(row\) => row\.first && row\.last/, 'rows with both letters are saved on Done');
  assert.match(screen, /testID="add-players-done-row"[\s\S]*?testID="add-players-count"[\s\S]*?testID="add-players-done"/, 'count and Done share the row under the cards');
  assert.match(screen, /<\/ScrollView>/);
  assert.doesNotMatch(screen, /<BottomBar>/, 'Done is no longer under the keyboard');
  // Save / Edit comes straight after the two boxes; the saved label sits to its right.
  const saveAt = screen.indexOf('accessibilityLabel={`Save row ${index + 1}`}');
  const middleAt = screen.indexOf('<View style={styles.middle}>');
  assert.ok(saveAt > 0 && middleAt > saveAt, 'button before the text');
  // The strip of seated players follows the Done row.
  assert.match(screen, /testID="add-players-done-row"[\s\S]*?<SelectedPlayersStrip/);
});

test('v12 #6: Order of players rows never below the 48 dp touch target', () => {
  assert.equal(SEAT_ROW_MIN_HEIGHT, 48);
  for (const n of [1, 4, 8, 13, 20]) assert.equal(seatRowHeight(n), 48);
  const rows = src('components/game/OrderOfPlayers.tsx');
  assert.match(rows, /const compact = false;/);
  assert.match(rows, /const ARROWS_WIDTH = 96;/, 'two 48-wide arrow targets side by side');
});

test('v12 #8: no tick on a scored tile; #9: the grid clears the "N more" pill; #10: the header scrolls sideways', () => {
  assert.doesNotMatch(src('components/game/ScoreCell.tsx'), /source="check"/);
  const entry = src('app/(screens)/score-entry.tsx');
  assert.match(entry, /export const MORE_PILL_CLEARANCE = 56;/);
  assert.match(entry, /paddingBottom: MORE_PILL_CLEARANCE/);
  const table = src('components/game/ScoreTable.tsx');
  assert.match(table, /testID="score-table-header-scroller"/);
  // Small fixes batch (Nov 21): the names are a pan surface that drives the rows' scroller (one offset).
  assert.match(table, /\{\.\.\.headerPan\.panHandlers\}/);
  assert.match(table, /onPanResponderGrant: \(\) => \{ stopFling\(\); dragStart\.current = sidewaysX\.current; \}/);
});

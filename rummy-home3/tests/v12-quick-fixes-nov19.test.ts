import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { helpShotSize, HELP_SHOT_RATIO } from '../utils/helpShot';
import { seatRowHeight, SEAT_ROW_MIN_HEIGHT } from '../utils/seating';
import { discSize } from '../utils/seatRing';

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

// D112 (Q44, Nov 25) supersedes v12 #3 and #5: no per-row Save, no Done while typing; one Save bar rides on the keyboard.
test('v12 #4 + D112: Add by initials — no sample letters; one Save bar above the keyboard; the saved list ends in + Add more / Done', () => {
  const screen = src('app/(screens)/players/add.tsx');
  assert.doesNotMatch(screen, /placeholder=/, 'v12 #4: the boxes stay empty');
  assert.doesNotMatch(screen, /Save row \$\{/, 'D112: the per-row Save button is gone');
  assert.doesNotMatch(screen, /UNSAVED_TITLE|unsavedLeaveLabel|keep the/, 'D97 wording is superseded');
  assert.match(screen, /<KeyboardAvoidingView[^>]*keyboardVerticalOffset=\{topY\}/, 'the Save bar rides on top of the keyboard');
  assert.match(screen, /<\/ScrollView>\s*<BottomBar testID="add-players-save-bar">[\s\S]*?testID="add-players-count"[\s\S]*?testID="add-players-save"/, 'the bar sits under the rows, above the keyboard');
  assert.match(screen, /returnKeyType="done"/);
  assert.match(screen, /returnKeyLabel: KEYBOARD_SAVE_LABEL/, 'the keyboard key reads Save on Android');
  assert.match(screen, /onSubmitEditing=\{\(\) => \{ saveAll\(\)/, 'either Save saves');
  assert.match(screen, /disabled=\{saving \|\| ready\.length === 0\}/, 'disabled while saving (no double tap)');
  assert.match(screen, /testID="add-players-saved-list"[\s\S]*?<SelectedPlayersStrip[\s\S]*?newIds=\{savedIds\}/, 'the seated chips under the saved list highlight the new ones');
  assert.match(screen, /testID="add-players-add-more"[\s\S]*?testID="add-players-done"/, '+ Add more, then Done');
  assert.match(screen, /onPress=\{leave\}[\s\S]{0,400}testID="add-players-done"/, 'Done leaves with no further dialog');
});

test('v12 #6 (D138 circle): every disc and both arrows are at least the 48 dp touch target', () => {
  assert.equal(SEAT_ROW_MIN_HEIGHT, 48);
  for (const n of [1, 4, 8, 13, 20]) assert.equal(seatRowHeight(n), 48);
  for (const n of [2, 10, 11, 20]) assert.ok(discSize(n) >= 48, `${n} players`);
  const ring = src('components/game/OrderOfPlayers.tsx');
  assert.match(ring, /move: \{ width: 48, height: 48,/, 'the ▲ ▼ in the middle card');
  assert.match(ring, /moveSlot: \{ width: 48, height: 48 \}/);
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

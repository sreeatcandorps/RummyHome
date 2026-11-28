import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROUND_SAVED_NOTE_MS, roundSavedMark, roundSavedNote, UNDO_MENU_ITEM } from '../utils/roundSavedNote';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

// ---- 12l (D137): Undo leaves the Scorecard's bottom bar ----

test('12l: the note names the round just saved and offers Undo only while it is still the last round', () => {
  assert.equal(ROUND_SAVED_NOTE_MS, 5000, 'Sree: a 5-second note');
  assert.equal(roundSavedNote({ savedRound: 3, roundCount: 3, isComplete: false, canScore: true }), 'Round 3 saved');
  assert.equal(roundSavedNote({ savedRound: null, roundCount: 3, isComplete: false, canScore: true }), null, 'no save, no note');
  assert.equal(roundSavedNote({ savedRound: 3, roundCount: 4, isComplete: false, canScore: true }), null, 'another phone saved round 4: Undo would remove theirs');
  assert.equal(roundSavedNote({ savedRound: 3, roundCount: 2, isComplete: false, canScore: true }), null, 'already undone');
  assert.equal(roundSavedNote({ savedRound: 3, roundCount: 3, isComplete: true, canScore: true }), null, 'completed from the Round saved sheet');
  assert.equal(roundSavedNote({ savedRound: 3, roundCount: 3, isComplete: false, canScore: false }), null, 'view only');
  assert.equal(roundSavedNote({ savedRound: 3, roundCount: 3, isComplete: false, canScore: true, reentryPending: true }), null, 'Undo would take back the re-entry, not round 3');
  assert.match(src('app/(screens)/games/[id].tsx'), /reentryPending: pool && players\.some\(\(player\) => seatOf\(game, player\.id\)\?\.reenteredRound === maxRounds \+ 1\)/);
});

test('12l: Add round marks the round once, for its own game only', () => {
  roundSavedMark.mark('g1', 4);
  assert.equal(roundSavedMark.take('g2'), null, 'another game does not take it');
  assert.equal(roundSavedMark.take('g1'), 4);
  assert.equal(roundSavedMark.take('g1'), null, 'taken once');
  const entry = src('app/(screens)/score-entry.tsx');
  assert.match(entry, /await gamesService\.addRound\([\s\S]*?\}\);\s*roundSavedMark\.mark\(game\.id, nextRoundNumber\(game\)\);/, 'marked after a new round saves, before the pool sheet');
  assert.doesNotMatch(entry.slice(entry.indexOf('if (editRound) {'), entry.indexOf('} else {', entry.indexOf('if (editRound) {'))), /roundSavedMark/, 'an edit is not a new round');
});

test('12l: the bar has no Undo; the ⋮ menu and the note do, with the same confirm', () => {
  const screen = src('app/(screens)/games/[id].tsx');
  const bar = screen.slice(screen.indexOf('<BottomBar fullWidth>'), screen.indexOf('</BottomBar>'));
  assert.doesNotMatch(bar, /undo/i, 'Undo is out of the bottom bar');
  assert.doesNotMatch(screen, /icon="undo-variant"\s+label="Undo"/, 'no Undo StackedAction left');
  assert.equal(UNDO_MENU_ITEM, 'Undo last round');
  assert.match(screen, /<Menu\.Item leadingIcon="undo-variant" title=\{UNDO_MENU_ITEM\} disabled=\{maxRounds === 0\} onPress=\{handleUndoLastRound\} testID="game-menu-undo" \/>/);
  assert.match(screen, /<Toast\s+message=\{linkNote \? null : savedNote\}[\s\S]*?onPress: handleUndoLastRound[\s\S]*?durationMs=\{ROUND_SAVED_NOTE_MS\}/);
  assert.match(screen, /const handleUndoLastRound = \(\) => \{[\s\S]*?setShowUndoConfirm\(true\);/, 'both open "Remove the last round?"');
  assert.match(screen, /const round = roundSavedMark\.take\(id\);/);
});

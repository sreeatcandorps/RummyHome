import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADD_ROWS_MAX,
  backNeedsDialog,
  hiddenRowsLine,
  initialsChanged,
  isHalf,
  isReady,
  KEYBOARD_SAVE_LABEL,
  listInitials,
  needsNewRow,
  nextFocus,
  oneChar,
  predictRows,
  readyCount,
  readyLine,
  readyRows,
  savedHeading,
  savedNote,
  saveButtonLabel,
  scrollTargetFor,
  seatedLine,
  typingNote,
  unsavedBody,
  unsavedSaveLabel,
  unsavedTitle,
} from '../utils/addByInitials';
import { chipLook } from '../utils/chipLook';
import { MAX_SEATED_PLAYERS } from '../constants/limits';

const r = (first: string, last: string) => ({ first, last });

// ---- D112 (Q44, Sree Nov 25: "this is good to go now"): design-review-2 §8.3a, add-players-q44.png ----

test('D112: a row is ready only with both letters; a one-letter row is half and left out of the count', () => {
  assert.equal(isReady(r('S', 'K')), true);
  assert.equal(isReady(r('s', 'k')), true, 'lower case counts (the keyboard may send it)');
  assert.equal(isReady(r('S', '2')), true, 'box 2 may be a digit');
  assert.equal(isReady(r('S', '')), false);
  assert.equal(isReady(r('', 'K')), false);
  assert.equal(isReady(r('4', 'K')), false, 'box 1 must be a letter');
  assert.equal(isReady(r('S', '#')), false);
  assert.equal(isHalf(r('V', '')), true);
  assert.equal(isHalf(r('', '')), false, 'an empty row is neither');
  assert.equal(isHalf(r('S', 'K')), false);
  const rows = [r('S', 'K'), r('H', 'G'), r('V', ''), r('', '')];
  assert.equal(readyCount(rows), 2);
  assert.deepEqual(readyRows(rows), [r('S', 'K'), r('H', 'G')], 'Save saves exactly the ready rows, in order');
});

test('D112: the Save bar reads "Save N players", counting only ready rows; the line beside it says what is missing', () => {
  assert.equal(saveButtonLabel(0), 'Save', 'nothing ready: plain Save (disabled)');
  assert.equal(saveButtonLabel(1), 'Save 1 player');
  assert.equal(saveButtonLabel(2), 'Save 2 players');
  assert.equal(saveButtonLabel(7), 'Save 7 players');
  assert.equal(readyLine(2, 1), '2 ready · 1 needs a 2nd letter', 'the picture, frame 1');
  assert.equal(readyLine(7, 0), '7 ready');
  assert.equal(readyLine(3, 2), '3 ready · 2 need a 2nd letter');
  assert.equal(KEYBOARD_SAVE_LABEL, 'Save', 'the keyboard’s own action key');
});

test('D112: one character per box; the cursor goes first → last → next row; a new row appears when the last fills', () => {
  assert.equal(oneChar('s'), 'S');
  assert.equal(oneChar(''), '');
  assert.equal(oneChar('SK'), 'K', 'a second character replaces the first');
  assert.deepEqual(nextFocus(0, 'first'), { row: 0, cell: 'last' });
  assert.deepEqual(nextFocus(0, 'last'), { row: 1, cell: 'first' });
  assert.equal(needsNewRow([r('S', 'K')]), true);
  assert.equal(needsNewRow([r('S', 'K'), r('', '')]), false);
  assert.equal(needsNewRow([r('S', '')]), false, 'half a row is not "filled"');
  assert.equal(needsNewRow([]), true);
  assert.equal(ADD_ROWS_MAX, MAX_SEATED_PLAYERS);
  assert.equal(needsNewRow(Array.from({ length: ADD_ROWS_MAX }, () => r('S', 'K'))), false, 'no row past the seat cap');
});

test('D112: a new player shows only its letters; a clash with My players shows the existing clashSentence while typing', () => {
  const taken = new Map([['HG', 'Harish G'], ['RK', 'RK']]);
  const rows = [r('S', 'K'), r('H', 'G'), r('V', ''), r('S', 'K'), r('R', 'K')];
  const [sk, hg, half, sk2, rk] = predictRows(rows, taken);
  assert.deepEqual(sk, { typed: 'SK', stored: 'SK', holder: null, sameAsRow: null });
  assert.equal(typingNote(sk!), 'SK · new player', 'never an invented name');
  assert.equal(hg!.stored, 'HG2');
  assert.equal(typingNote(hg!), 'Harish G is already HG. This new player is HG2.', 'the picture, frame 1');
  assert.equal(half, null, 'a one-letter row has no line');
  assert.equal(sk2!.stored, 'SK2', 'the same letters twice in one batch: the second gets the digit');
  assert.equal(sk2!.sameAsRow, 1);
  assert.equal(typingNote(sk2!), 'Row 1 is already SK. This new player is SK2.');
  assert.equal(typingNote(rk!), 'RK is already taken. This new player is RK2.', 'a holder named only by initials is not "RK is already RK"');
});

test('D112: after Save each row says ✓ new player, or ! with who already had the letters', () => {
  const plain = { typed: 'SK', initials: 'SK', takenBy: null };
  const clash = { typed: 'HG', initials: 'HG2', takenBy: 'Harish G' };
  const batch = { typed: 'SK', initials: 'SK2', takenBy: 'SK' };
  assert.equal(initialsChanged(plain), false);
  assert.equal(savedNote(plain), 'new player');
  assert.equal(initialsChanged(clash), true);
  assert.equal(savedNote(clash), 'Harish G is already HG', 'the picture, frame 3: "HG2 · Harish G is already HG"');
  assert.equal(savedNote(batch), 'SK is already taken');
  assert.equal(savedHeading(8, true), '8 players saved and seated');
  assert.equal(savedHeading(1, true), '1 player saved and seated');
  assert.equal(savedHeading(2, false), '2 players saved', 'from My players nobody is seated');
  assert.equal(seatedLine(12, 8), 'Playing in this game · 12 · the 8 new ones in green');
  assert.equal(seatedLine(4, 1), 'Playing in this game · 4 · the new one in green');
  assert.equal(seatedLine(4, 0), 'Playing in this game · 4');
});

test('D112 (replaces D97): Back after typing asks once, "SK is not saved yet": Save SK and go back / Discard', () => {
  assert.equal(listInitials(['SK']), 'SK');
  assert.equal(listInitials(['SK', 'HG']), 'SK and HG');
  assert.equal(listInitials(['SK', 'HG', 'VR']), 'SK, HG and VR');
  assert.equal(listInitials(['SK', 'HG', 'VR', 'AB', 'MP']), 'SK, HG, VR and 2 more');
  assert.equal(unsavedTitle(['SK']), 'SK is not saved yet');
  assert.equal(unsavedTitle(['SK', 'HG']), 'SK and HG are not saved yet');
  assert.equal(unsavedBody(['V']), 'You typed letters but did not tap Save. V has only one letter, so it is left out either way.');
  assert.equal(unsavedBody(['V', 'K']), 'You typed letters but did not tap Save. V and K have only one letter, so they are left out either way.');
  assert.equal(unsavedBody([]), 'You typed letters but did not tap Save.');
  assert.equal(unsavedSaveLabel(['SK']), 'Save SK and go back');
  assert.equal(unsavedSaveLabel(['SK', 'HG', 'VR']), 'Save 3 players and go back');
  assert.equal(backNeedsDialog([r('S', 'K'), r('', '')]), true);
  assert.equal(backNeedsDialog([r('V', ''), r('', '')]), false, 'only one-letter rows: nothing Save would keep, no dialog');
  assert.equal(backNeedsDialog([r('', '')]), false, 'nothing typed: no dialog');
});

test('D112: eight rows — the list scrolls so the row being typed sits just above the Save bar; a line names the rows above', () => {
  assert.equal(scrollTargetFor(300, 400, 0), null, 'already in view: no scroll');
  assert.equal(scrollTargetFor(560, 400, 0), 160, 'below the bar: scroll its bottom to the bar');
  assert.equal(scrollTargetFor(560, 400, 200), null, 'never scrolls backwards on its own');
  assert.equal(hiddenRowsLine([]), null);
  assert.equal(hiddenRowsLine(['SK', 'HG']), '↑ rows 1–2 (SK, HG) scrolled up · swipe down to see them', 'the picture, frame 2');
  assert.equal(hiddenRowsLine(['SK']), '↑ row 1 (SK) scrolled up · swipe down to see it');
  assert.equal(hiddenRowsLine(['SK', 'HG', 'VR', 'AB']), '↑ rows 1–4 (SK, HG, VR …) scrolled up · swipe down to see them');
});

test('D112: the seated chips after Save highlight the new players in green, the rest quiet', () => {
  const fresh = new Set(['new']);
  assert.equal(chipLook('new', undefined, fresh), 'new');
  assert.equal(chipLook('old', undefined, fresh), 'saved');
  assert.equal(chipLook('x'), 'new', 'New game unchanged');
  assert.equal(chipLook('y', new Set(['x'])), 'added', 'mid-game add unchanged');
});

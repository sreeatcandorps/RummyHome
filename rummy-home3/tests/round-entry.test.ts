import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyPreset,
  applyRummy,
  balance,
  canSaveRound,
  cellView,
  clearPlayer,
  commitPending,
  confirmedValue,
  hasPendingEntry,
  initialRoundEntryState,
  pressDigit,
  RoundEntryState,
  saveScore,
  setNegative,
  tapPlayer,
  toRoundScores,
} from '../utils/roundEntry';
import { validateRoundScores } from '../utils/scoring';

const PRESETS = { drop: -10, middle_drop: -30, count: -80 };

const type = (state: RoundEntryState, digits: string) =>
  digits.split('').reduce((acc, digit) => pressDigit(acc, digit), state);

const select = (state: RoundEntryState, ...ids: string[]) =>
  ids.reduce((acc, id) => tapPlayer(acc, id), state);

test('minus is the default sign and the sheet starts empty', () => {
  const state = initialRoundEntryState();
  assert.equal(state.draft.negative, true);
  assert.equal(balance(state), 0);
  assert.equal(canSaveRound(state), false, 'an empty sheet is not a round');
});

test('tapping players builds a multi-selection in tap order', () => {
  const state = select(initialRoundEntryState(), 'a', 'b', 'c');
  assert.deepEqual(state.selectedIds, ['a', 'b', 'c']);
  assert.equal(cellView(state, 'a').status, 'selected');
  assert.equal(cellView(state, 'd').status, 'empty');
});

test('tapping a selected player again deselects it', () => {
  const state = select(initialRoundEntryState(), 'a', 'b', 'a');
  assert.deepEqual(state.selectedIds, ['b']);
});

test('Drop gives every selected player the game setting value', () => {
  const state = applyPreset(select(initialRoundEntryState(), 'a', 'b', 'c'), 'drop', PRESETS);
  assert.equal(confirmedValue(state, 'a'), -10);
  assert.equal(confirmedValue(state, 'b'), -10);
  assert.equal(confirmedValue(state, 'c'), -10);
  assert.equal(state.entries.a.scoreType, 'drop');
  assert.deepEqual(state.selectedIds, [], 'selection clears after the preset');
  assert.deepEqual(state.lastSavedIds, ['a', 'b', 'c']);
  assert.equal(cellView(state, 'a').status, 'confirmed');
});

test('Middle drop and Full count use the settings values too', () => {
  let state = applyPreset(select(initialRoundEntryState(), 'a'), 'middle_drop', { ...PRESETS, middle_drop: -25 });
  state = applyPreset(select(state, 'b'), 'count', { ...PRESETS, count: -100 });
  assert.equal(confirmedValue(state, 'a'), -25);
  assert.equal(state.entries.a.scoreType, 'middle_drop');
  assert.equal(confirmedValue(state, 'b'), -100);
  assert.equal(state.entries.b.scoreType, 'count');
});

test('presets and digits do nothing with no player selected', () => {
  const state = initialRoundEntryState();
  assert.equal(applyPreset(state, 'drop', PRESETS), state);
  assert.equal(applyRummy(state), state);
  assert.equal(pressDigit(state, '5'), state);
});

test('a typed number is negative by default and saves to every selected player', () => {
  const state = saveScore(type(select(initialRoundEntryState(), 'a', 'b'), '23'));
  assert.equal(confirmedValue(state, 'a'), -23);
  assert.equal(confirmedValue(state, 'b'), -23);
  assert.equal(state.entries.a.scoreType, 'count');
  assert.deepEqual(state.selectedIds, []);
  assert.equal(state.draft.negative, true, 'the sign goes back to minus after a save');
});

test('the plus toggle saves a hand-entered positive score', () => {
  const state = saveScore(type(setNegative(select(initialRoundEntryState(), 'a'), false), '41'));
  assert.equal(confirmedValue(state, 'a'), 41);
  assert.equal(state.entries.a.scoreType, 'rummy');
});

test('a lone 0 is an explicit zero, the next digit replaces it, and digits cap at four', () => {
  let state = pressDigit(select(initialRoundEntryState(), 'a'), '0');
  assert.equal(state.draft.digits, '0');
  assert.equal(saveScore(state).entries.a?.value, 0, 'an explicit 0 can be saved');
  state = type(state, '12345');
  assert.equal(state.draft.digits, '1234');
});

test('the pending number shows in the selected cells before it is saved', () => {
  const state = type(select(initialRoundEntryState(), 'a', 'b'), '7');
  assert.deepEqual(cellView(state, 'a'), { status: 'pending', value: -7 });
  assert.deepEqual(cellView(state, 'b'), { status: 'pending', value: -7 });
  assert.equal(hasPendingEntry(state), true);
});

test('moving to another player auto-saves the number that was being typed', () => {
  const state = tapPlayer(type(select(initialRoundEntryState(), 'a'), '15'), 'b');
  assert.equal(confirmedValue(state, 'a'), -15);
  assert.deepEqual(state.lastSavedIds, ['a']);
  assert.deepEqual(state.selectedIds, ['b'], 'the new player is the only selection');
  assert.equal(state.draft.digits, '');
});

test('tapping one of the players being typed for confirms the number', () => {
  const state = tapPlayer(type(select(initialRoundEntryState(), 'a', 'b'), '9'), 'a');
  assert.equal(confirmedValue(state, 'a'), -9);
  assert.equal(confirmedValue(state, 'b'), -9);
  assert.deepEqual(state.selectedIds, []);
});

test('tapping a filled cell opens it for editing and the first digit replaces the value', () => {
  let state = applyPreset(select(initialRoundEntryState(), 'a'), 'drop', PRESETS);
  state = tapPlayer(state, 'a');
  assert.deepEqual(state.selectedIds, ['a']);
  assert.equal(state.draft.digits, '10');
  assert.equal(state.draft.typed, false);
  assert.equal(cellView(state, 'a').status, 'selected', 'a prefilled value is not pending');

  state = pressDigit(state, '4');
  assert.equal(state.draft.digits, '4', 'typing starts over instead of appending');
  assert.equal(confirmedValue(saveScore(state), 'a'), -4);
});

test('leaving a filled cell without typing keeps its saved score', () => {
  let state = applyPreset(select(initialRoundEntryState(), 'a'), 'drop', PRESETS);
  state = tapPlayer(tapPlayer(state, 'a'), 'b');
  assert.equal(confirmedValue(state, 'a'), -10);
  assert.deepEqual(state.selectedIds, ['a', 'b'], 'with nothing typed the tap extends the selection');
  assert.equal(state.draft.digits, '', 'a group selection has no prefill');
});

test('flipping the sign on a prefilled value counts as an edit', () => {
  let state = applyPreset(select(initialRoundEntryState(), 'a'), 'drop', PRESETS);
  state = setNegative(tapPlayer(state, 'a'), false);
  assert.equal(hasPendingEntry(state), true);
  assert.equal(confirmedValue(tapPlayer(state, 'b'), 'a'), 10);
});

test('X clears a player and any number being typed for them', () => {
  let state = applyPreset(select(initialRoundEntryState(), 'a', 'b'), 'drop', PRESETS);
  state = type(select(state, 'c'), '5');
  state = clearPlayer(state, 'c');
  assert.equal(confirmedValue(state, 'c'), undefined);
  assert.deepEqual(state.selectedIds, []);
  assert.equal(state.draft.digits, '');
  state = clearPlayer(state, 'a');
  assert.equal(confirmedValue(state, 'a'), undefined);
  assert.equal(confirmedValue(state, 'b'), -10, 'other players keep their scores');
});

test('one Rummy player takes everything the table lost', () => {
  let state = applyPreset(select(initialRoundEntryState(), 'a', 'b'), 'drop', PRESETS);
  state = applyPreset(select(state, 'c'), 'count', PRESETS);
  state = applyRummy(select(state, 'd'));
  assert.equal(confirmedValue(state, 'd'), 100);
  assert.equal(balance(state), 0);
  assert.equal(canSaveRound(state), true);
});

test('several Rummy players split the points evenly', () => {
  let state = applyPreset(select(initialRoundEntryState(), 'a', 'b'), 'middle_drop', PRESETS);
  state = applyRummy(select(state, 'c', 'd'));
  assert.equal(confirmedValue(state, 'c'), 30);
  assert.equal(confirmedValue(state, 'd'), 30);
  assert.equal(balance(state), 0);
});

test('an uneven Rummy split gives the extra points to the players tapped first', () => {
  let state = applyPreset(select(initialRoundEntryState(), 'a'), 'drop', PRESETS);
  state = applyPreset(select(state, 'b'), 'middle_drop', PRESETS);
  state = applyRummy(select(state, 'x', 'y', 'z'));
  assert.equal(confirmedValue(state, 'x'), 14);
  assert.equal(confirmedValue(state, 'y'), 13);
  assert.equal(confirmedValue(state, 'z'), 13);
  assert.equal(balance(state), 0, 'the round still adds to zero');
});

test('Rummy shares follow later changes to the losing scores', () => {
  let state = applyRummy(select(initialRoundEntryState(), 'w'));
  assert.equal(confirmedValue(state, 'w'), 0);
  assert.equal(canSaveRound(state), false, 'a winner with nothing to win is not a round');
  state = applyPreset(select(state, 'a', 'b'), 'count', PRESETS);
  assert.equal(confirmedValue(state, 'w'), 160);
  state = clearPlayer(state, 'a');
  assert.equal(confirmedValue(state, 'w'), 80);
});

test('a Rummy player who then gets a typed score stops being a winner', () => {
  let state = applyPreset(select(initialRoundEntryState(), 'a'), 'drop', PRESETS);
  state = applyRummy(select(state, 'w', 'v'));
  const editing = select(state, 'w');
  assert.equal(editing.draft.negative, false, 'editing keeps the sign of the current score');
  state = saveScore(type(setNegative(editing, true), '20'));
  assert.deepEqual(state.rummyIds, ['v']);
  assert.equal(confirmedValue(state, 'w'), -20);
  assert.equal(confirmedValue(state, 'v'), 30);
});

test('Save round stays off until the balance is 0', () => {
  let state = applyPreset(select(initialRoundEntryState(), 'a', 'b'), 'drop', PRESETS);
  assert.equal(balance(state), -20);
  assert.equal(canSaveRound(state), false);
  state = applyRummy(select(state, 'c'));
  assert.equal(balance(state), 0);
  assert.equal(canSaveRound(state), true);
});

test('typed scores that add to zero also unlock Save round', () => {
  let state = saveScore(type(select(initialRoundEntryState(), 'a'), '40'));
  state = saveScore(type(setNegative(select(state, 'b'), false), '40'));
  assert.equal(balance(state), 0);
  assert.equal(canSaveRound(state), true);
});

test('Save round counts a number still being typed as if it were saved', () => {
  let state = applyRummy(select(initialRoundEntryState(), 'w'));
  state = type(select(state, 'a'), '35');
  assert.equal(balance(state), 0, 'the sheet alone has nothing yet');
  assert.equal(canSaveRound(state), true, 'the pending -35 balances against the winner');

  const saved = commitPending(state);
  assert.equal(confirmedValue(saved, 'a'), -35);
  assert.equal(confirmedValue(saved, 'w'), 35);
  assert.deepEqual(saved.lastSavedIds, ['a']);
  assert.equal(commitPending(saved), saved, 'nothing left to commit');
});

test('a pending number that breaks the balance blocks Save round', () => {
  let state = applyPreset(select(initialRoundEntryState(), 'a'), 'drop', PRESETS);
  state = saveScore(type(setNegative(select(state, 'w'), false), '10'));
  assert.equal(canSaveRound(state), true);
  state = type(select(state, 'b'), '5');
  assert.equal(canSaveRound(state), false);
});

test('the saved round passes the scorecard validation', () => {
  let state = applyPreset(select(initialRoundEntryState(), 'a', 'b', 'c'), 'drop', PRESETS);
  state = applyPreset(select(state, 'd'), 'middle_drop', PRESETS);
  state = saveScore(type(select(state, 'e'), '17'));
  state = applyRummy(select(state, 'f', 'g'));

  const scores = toRoundScores(commitPending(state));
  assert.equal(validateRoundScores(scores).valid, true);
  assert.deepEqual(
    scores.filter((score) => score.scoreType === 'rummy').map((score) => score.value),
    [39, 38],
  );
});

test('a sign chosen before tapping a player is kept', () => {
  const state = saveScore(type(tapPlayer(setNegative(initialRoundEntryState(), false), 'a'), '41'));
  assert.equal(confirmedValue(state, 'a'), 41);
});

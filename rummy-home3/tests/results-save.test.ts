import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { gameAccessLabel } from '../utils/gameAccess';
import { defaultResultSelection, DEFAULT_RESULTS_FILTER } from '../utils/results';
import {
  applyFilterSwitch,
  canPickForResults,
  canShareResult,
  NON_ADMIN_PICK_MESSAGE,
  pastResultRows,
  planFilterSwitch,
  resultReusedNote,
  resultWarningLines,
  reusedGameIds,
  saveBlockedReason,
  saveStatusChanges,
  selectedCountLine,
  winnerInitials,
} from '../utils/resultsSave';

const me = 'me';
const other = 'other';
const game = (id: string, over: Partial<{ isComplete: boolean; closedAt: string | null; gameNumber: number; createdBy: string; adminIds: string[]; players: string[] }> = {}) => ({
  id,
  isComplete: true,
  closedAt: null as string | null,
  gameNumber: Number(id.replace(/\D/g, '')),
  createdBy: me,
  adminIds: [me],
  players: [me],
  ...over,
});

test('nov 10: only a creator or admin can tick a game for results; others see the admin message', () => {
  assert.equal(canPickForResults(game('g1'), me), true);
  assert.equal(canPickForResults(game('g2', { createdBy: other, adminIds: [other, me] }), me), true);
  assert.equal(canPickForResults(game('g3', { createdBy: other, adminIds: [other] }), me), false);
  assert.equal(canPickForResults(game('g3'), null), false);
  assert.match(NON_ADMIN_PICK_MESSAGE, /not an admin/);
  assert.match(NON_ADMIN_PICK_MESSAGE, /Ask the creator for admin privileges/);
});

test('nov 10: default ticks skip games the person is in but does not run', () => {
  const games = [game('g1'), game('g2', { createdBy: other, adminIds: [other], players: [other, me] }), game('g3', { isComplete: false })];
  assert.deepEqual(defaultResultSelection(games, DEFAULT_RESULTS_FILTER, me), ['g1']);
  // Without a viewer the old behaviour (every completed game) still holds for callers that filter later.
  assert.deepEqual(defaultResultSelection(games, DEFAULT_RESULTS_FILTER), ['g1', 'g2']);
});

test('nov 10: the picker card says Player for a seated non-admin, matching the Home cards', () => {
  assert.equal(gameAccessLabel(game('g1'), me), 'Creator');
  assert.equal(gameAccessLabel(game('g1', { createdBy: other, adminIds: [other, me] }), me), 'Admin');
  assert.equal(gameAccessLabel(game('g1', { createdBy: other, adminIds: [other], players: [other, me] }), me), 'Player');
  assert.equal(gameAccessLabel(game('g1', { createdBy: other, adminIds: [other], players: [other] }), me), 'View only');
});

test('nov 10: "N games selected" line', () => {
  assert.equal(selectedCountLine(0), 'No games selected');
  assert.equal(selectedCountLine(1), '1 game selected');
  assert.equal(selectedCountLine(3), '3 games selected');
});

test('nov 10: turning a filter off warns when it would hide a ticked game; cancel keeps everything', () => {
  const games = [game('g7'), game('g4', { closedAt: '2026-11-01T00:00:00Z' }), game('g9', { isComplete: false })];
  // Completed is on by default; switching it off hides the ticked G7.
  const plan = planFilterSwitch(games, ['g7'], DEFAULT_RESULTS_FILTER, 'completed');
  assert.equal(plan.question, 'G7 is selected and will be deselected. OK?');
  assert.deepEqual(plan.hidden.map((g) => g.id), ['g7']);
  assert.equal(plan.next.includes('completed'), false);
  // OK drops only the hidden ticks.
  assert.deepEqual(applyFilterSwitch(['g7', 'g4'], plan.hidden), ['g4']);

  // Two hidden games read naturally.
  const two = planFilterSwitch([...games, game('g8')], ['g7', 'g8', 'g4'], ['completed', 'closed'], 'completed');
  assert.equal(two.question, 'G7 and G8 are selected and will be deselected. OK?');

  // Turning a filter ON hides nothing: no question, no change to the ticks.
  const on = planFilterSwitch(games, ['g7'], DEFAULT_RESULTS_FILTER, 'closed');
  assert.equal(on.question, null);
  assert.deepEqual(on.hidden, []);
  assert.deepEqual(applyFilterSwitch(['g7'], on.hidden), ['g7']);

  // Every chip goes through the same check: hiding Closed with a ticked closed game asks too.
  const closedOff = planFilterSwitch(games, ['g4'], ['completed', 'closed'], 'closed');
  assert.equal(closedOff.question, 'G4 is selected and will be deselected. OK?');
});

test('nov 10: one warning per selected game, active first then closed', () => {
  const lines = resultWarningLines([
    game('g1'),
    game('g2', { closedAt: '2026-11-01T00:00:00Z' }),
    game('g3', { isComplete: false }),
    game('g4', { closedAt: '2026-11-02T00:00:00Z' }),
  ]);
  assert.deepEqual(lines.map((l) => [l.kind, l.gameId]), [['active', 'g3'], ['closed', 'g2'], ['closed', 'g4']]);
  assert.match(lines[0].text, /G3 is still active/);
  assert.match(lines[1].text, /G2 is already part of a previous result/);
});

test('nov 10: save result is blocked by any active game, allowed with closed games', () => {
  assert.equal(saveBlockedReason([], me), 'Nothing to save.');
  assert.match(saveBlockedReason([game('g1'), game('g2', { isComplete: false })], me) ?? '', /G2 is still active\. Go back and deselect it/);
  assert.match(saveBlockedReason([game('g2', { isComplete: false }), game('g3', { isComplete: false })], me) ?? '', /G2 and G3 are still active.*deselect them/);
  assert.equal(saveBlockedReason([game('g1'), game('g2', { closedAt: '2026-11-01T00:00:00Z' })], me), null);
  assert.match(saveBlockedReason([game('g1', { createdBy: other, adminIds: [other] })], me) ?? '', /admin of every selected game/);
});

test('nov 10: the save popup lists each game and its status change', () => {
  const changes = saveStatusChanges([game('g11'), game('g3', { closedAt: '2026-11-01T00:00:00Z' })]);
  assert.deepEqual(changes.map((c) => c.line), ['G11: Completed → Closed', 'G3: already Closed · counted again in this result']);
  assert.equal(changes[0].from, 'Completed');
  assert.equal(changes[1].from, 'Closed');
  assert.ok(changes.every((c) => c.to === 'Closed'));
});

test('nov 10: a result that reused closed games carries a warning note wherever it is listed', () => {
  const declaredAt = '2026-11-10T12:00:00Z';
  const ids = reusedGameIds([
    game('g1', { closedAt: '2026-11-10T12:00:00Z' }), // closed by this very save: not reused
    game('g2', { closedAt: '2026-11-01T00:00:00Z' }), // closed earlier: reused
    game('g3'),
  ], declaredAt);
  assert.deepEqual(ids, ['g2']);
  assert.equal(resultReusedNote(undefined), null);
  assert.equal(resultReusedNote(0), null);
  assert.equal(resultReusedNote(1), 'Includes a game from an earlier result');
  assert.equal(resultReusedNote(2), 'Includes 2 games from earlier results');
});

test('nov 10: sharing needs a saved result', () => {
  assert.equal(canShareResult(null), false);
  assert.equal(canShareResult(undefined), false);
  assert.equal(canShareResult(''), false);
  assert.equal(canShareResult('result-1'), true);
});

test('nov 10: past results card rows are 1st/2nd/3rd with amounts; winner initials for the avatar', () => {
  const top = [
    { name: 'Bala', points: -120, place: 3 },
    { name: 'Sree Kumar', points: 732, place: 1 },
    { name: 'Anu', points: 40, place: 2 },
  ];
  assert.deepEqual(pastResultRows(top), [
    { label: '1st', name: 'Sree Kumar', points: '+732' },
    { label: '2nd', name: 'Anu', points: '+40' },
    { label: '3rd', name: 'Bala', points: '-120' },
  ]);
  assert.equal(winnerInitials(top), 'SK');
  assert.equal(winnerInitials([]), '?');
});

test('nov 10: Show results never saves on its own; the picker only opens the preview', () => {
  const src = readFileSync(path.join(__dirname, '..', 'app', '(screens)', 'results', 'index.tsx'), 'utf8');
  assert.doesNotMatch(src, /resultsService\.declare/);
  assert.match(src, /results\/view/);
  assert.match(src, /NON_ADMIN_PICK_MESSAGE/);
  assert.match(src, /planFilterSwitch/);
  assert.match(src, /selectedCountLine/);
});

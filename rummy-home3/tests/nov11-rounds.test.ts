import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { nextRoundNumber, playedRounds } from '../utils/editRound';

const read = (relative: string) => readFileSync(path.join(__dirname, '..', relative), 'utf8');

// ---------------------------------------------------------------------------
// Nov 11 P2.3 — undoing / deleting a score must not leave an empty row
// ---------------------------------------------------------------------------

test('nextRoundNumber follows the scores, not a stale currentRound counter', () => {
  const scores = { a: [10, 20, 30], b: [5, 0, 15] };
  assert.equal(nextRoundNumber({ scores, currentRound: 4 }), 4);
  // After Undo the third round is gone but the old counter still said 4: the next save
  // must reuse 3, otherwise the table shows a blank row 3 and the new scores land on 4.
  assert.equal(nextRoundNumber({ scores: { a: [10, 20], b: [5, 0] }, currentRound: 4 }), 3);
  assert.equal(nextRoundNumber({ scores: {}, currentRound: 1 }), 1);
  assert.equal(nextRoundNumber({ scores: { a: [], b: [] } }), 1);
  assert.equal(playedRounds({ a: [10, 20], b: [5, 0] }), 2);
});

test('Add round numbers and labels the round from the scores', () => {
  const screen = read('app/(screens)/score-entry.tsx');
  assert.match(screen, /import \{ entryFromRound, nextRoundNumber \} from '\.\.\/\.\.\/utils\/editRound'/);
  assert.match(screen, /roundNumber: nextRoundNumber\(game\),/, 'the saved round number comes from the scores');
  assert.match(screen, /`Round \$\{nextRoundNumber\(game\)\}`/, 'the header label matches');
  assert.doesNotMatch(screen, /game\.currentRound/, 'the stale counter is no longer read on this screen');

  const scorecard = read('app/(screens)/games/[id].tsx');
  assert.match(scorecard, /<Tag label=\{`Round \$\{maxRounds \+ 1\}`\} tone="primary" icon="cards-outline" \/>/);
  assert.doesNotMatch(scorecard, /game\.currentRound/);
});

test('Undo on Supabase moves current_round back to the undone round', () => {
  const service = read('services/games.ts');
  const undo = service.slice(service.indexOf('async undoLastRound('));
  const body = undo.slice(0, undo.indexOf('\n  },\n'));
  assert.match(body, /\.update\(\{ current_round: round\.round_number \}\)/);
  assert.match(body, /\.gt\('current_round', round\.round_number\)/, 'only ever moves the counter backwards');
});

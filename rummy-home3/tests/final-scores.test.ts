import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildFinalScoresSheet, CELLS_PER_ROW, chunk, finalScoresFooter, finalScoresHeading } from '../utils/finalScoresSheet';
import { completionCheck } from '../utils/completeGame';

const game = { id: '11111111-2222-3333-4444-5555660a1b2c', gameNumber: 3, date: '2026-11-06T19:12:00Z', completedAt: '2026-11-06T21:40:00Z', isComplete: true };
const players = [
  { id: 'a', name: 'Sree Kumar' },
  { id: 'b', name: 'Satya' },
  { id: 'c', name: 'Ravi' },
];
// Totals: a = +35, b = -5, c = -30. Every round adds to 0.
const scores = {
  a: [-20, 40, -10, 0, 30, 0, -5],
  b: [10, -30, -10, 0, -60, 90, -5],
  c: [10, -10, 20, 0, 30, -90, 10],
};

test('heading and footer: "Game S3 Final Scores", "Game S3" footer, never the id, never the word Results', () => {
  assert.equal(finalScoresHeading(game), 'Game S3 Final Scores');
  assert.equal(finalScoresHeading({ gameNumber: null }), 'Final Scores');
  assert.equal(finalScoresFooter(game), 'Game S3');
  assert.equal(finalScoresFooter({ ...game, gameLabel: 'P3', gameType: 'pool' }), 'Game P3');
  assert.doesNotMatch(finalScoresFooter(game), new RegExp(game.id.slice(-6), 'i'), 'the id and the short code left the sheet');
  const sheet = buildFinalScoresSheet({ game, players, scores, now: new Date('2026-11-07T10:01:00Z') });
  assert.doesNotMatch(JSON.stringify(sheet), /result/i);
  assert.doesNotMatch(JSON.stringify(sheet), /1st|2nd|3rd|podium/i);
});

test('the sheet carries started, completed and generated times', () => {
  const sheet = buildFinalScoresSheet({ game, players, scores, now: new Date('2026-11-07T10:01:00Z') });
  assert.match(sheet.startedLine, /^Started /);
  assert.match(sheet.completedLine, /^Completed .+/);
  assert.match(sheet.generatedLine, /^Generated /);
  assert.equal(buildFinalScoresSheet({ game: { ...game, completedAt: null }, players, scores }).completedLine, 'Completed');
});

test('round cells come five per row in round order with consistent rows per player', () => {
  const sheet = buildFinalScoresSheet({ game, players, scores });
  assert.equal(sheet.roundCount, 7);
  for (const player of sheet.players) {
    assert.equal(player.rows.length, 2);
    assert.equal(player.rows[0].length, CELLS_PER_ROW);
    assert.equal(player.rows[1].length, 2);
    assert.deepEqual(player.rows.flat().map((cell) => cell.round), [1, 2, 3, 4, 5, 6, 7]);
  }
  assert.deepEqual(chunk([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5), [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]]);
  assert.deepEqual(chunk([], 5), []);
});

test('summary lists highest total first without rank labels; per-player totals match', () => {
  const sheet = buildFinalScoresSheet({ game, players, scores });
  assert.deepEqual(sheet.summary.map((row) => [row.name, row.total]), [['Sree Kumar', 35], ['Satya', -5], ['Ravi', -30]]);
  assert.equal(sheet.totalSum, 0);
  assert.equal(sheet.players.find((p) => p.id === 'a')?.totalText, '+35');
  const cell = sheet.players.find((p) => p.id === 'a')!.rows[0][1];
  assert.deepEqual(cell, { round: 2, text: '+40', sign: 'pos' });
});

test('completion check: balanced rounds pass, an unbalanced round names itself, no rounds warns but does not block', () => {
  assert.equal(completionCheck(scores, ['a', 'b', 'c']).ok, true);
  assert.equal(completionCheck(scores, ['a', 'b', 'c']).problem, null);
  const broken = completionCheck({ a: [-20, 10], b: [20, 10] }, ['a', 'b']);
  assert.equal(broken.ok, false);
  assert.deepEqual(broken.unbalancedRounds, [2]);
  assert.match(broken.problem ?? '', /round 2/);
  const empty = completionCheck({}, ['a', 'b']);
  assert.equal(empty.ok, false);
  assert.equal(empty.problem, null);
  assert.equal(empty.roundCount, 0);
});

test('single-game share never says Results and has no PDF; the scorecard menu says Share final scores', () => {
  const scorecard = readFileSync(path.join(process.cwd(), 'app/(screens)/games/[id].tsx'), 'utf8');
  assert.match(scorecard, /title="Share final scores"/);
  assert.doesNotMatch(scorecard, /title="Share results"/);
  const page = readFileSync(path.join(process.cwd(), 'app/(screens)/games/final-scores.tsx'), 'utf8');
  assert.doesNotMatch(page, /pdf/i);
  assert.doesNotMatch(page, />\s*Share results\s*</i);
});

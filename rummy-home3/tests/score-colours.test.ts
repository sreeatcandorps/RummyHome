import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { scoreTextStyle, scoreTone } from '../utils/scoreTone';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

test('final batch 5: the score colour standard, the same in the app, round entry and the web scorecard', () => {
  // Points game, Full count 80: +30 green highlight, -40 plain, -41 red text, 0 plain.
  assert.equal(scoreTextStyle(scoreTone(30, 80)).highlight, true);
  assert.equal(scoreTextStyle(scoreTone(-40, 80)).colorKey, 'onSurface');
  assert.equal(scoreTextStyle(scoreTone(-41, 80)).colorKey, 'negative');
  assert.equal(scoreTextStyle(scoreTone(0, 80)).colorKey, 'onSurface');
  // Only a win is ever highlighted.
  for (const score of [-1, -40, -41, -200, 0]) assert.equal(scoreTextStyle(scoreTone(score, 80)).highlight, false, `${score} has no background`);
  // Pool-style full count 100: -50 plain, -51 red.
  assert.equal(scoreTone(-50, 100), 'negative');
  assert.equal(scoreTone(-51, 100), 'bigNegative');

  const table = src('components/game/ScoreTable.tsx');
  assert.doesNotMatch(table, /errorContainer/, 'no red background anywhere on the scorecard (score cells or the round column)');
  assert.match(table, /text\.highlight && \{ backgroundColor: colors\.positiveContainer \}/, 'the only background is the win highlight');
  assert.match(table, /color: colors\.error \}\]\} numberOfLines=\{1\} accessibilityLabel=\{`Round does not add up/, 'a round that does not add up is red text, not a red cell');

  for (const rel of ['web/scorecard.html', 'public/scorecard.html']) {
    const page = src(rel);
    assert.match(page, /Math\.floor\(maxCount \/ 2\) \+ 1/, `${rel}: more than half the Full count`);
    assert.match(page, /td\.big \{ color: #B3261E; \}/, `${rel}: big penalty is red text`);
    assert.doesNotMatch(page, /td\.big \{[^}]*background/, `${rel}: no red background`);
    assert.match(page, /value > 0 \? 'pos' : \(bigLoss !== null && value <= -bigLoss\) \? 'big' : ''/, `${rel}: small losses are plain`);
  }
});

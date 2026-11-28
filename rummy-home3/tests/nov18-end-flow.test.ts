import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAwardsRoute, afterCompleteRoute, AWARD_NEXT_FINAL, AWARD_ROUTE, FINAL_SCORES_ROUTE, HOME_ROUTE, showsDone } from '../utils/endFlow';
import { buildFinalScoresSheet, poolPdfSections, poolRoundCellText } from '../utils/finalScoresSheet';
import { pdfSectionHtml, roundsPdfHtml } from '../utils/resultsDetails';
import { ONE_GAME_RESULT_NOTE, showResultsLabel } from '../utils/resultsSave';
import { poolStatusLabel } from '../utils/pool';
import { Game, PoolSeat } from '../types/game';

const src = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

const points = { id: 'g1', gameType: 'stake', isComplete: true } as Game;
const pool = { id: 'p1', gameType: 'pool', isComplete: true } as Game;

// ---- Nov 18 end flow: Complete → (Awards →) Final → Done = Home ----

test('after Complete: a pool goes to Awards with next=final, a Points game straight to the Final screen', () => {
  assert.deepEqual(afterCompleteRoute(pool), { pathname: AWARD_ROUTE, params: { id: 'p1', next: AWARD_NEXT_FINAL } });
  assert.deepEqual(afterCompleteRoute(points), { pathname: FINAL_SCORES_ROUTE, params: { id: 'g1' } });
});

test('after Awards: on to the Final screen only when opened from Complete; otherwise back to the caller', () => {
  assert.deepEqual(afterAwardsRoute(pool, 'final'), { pathname: FINAL_SCORES_ROUTE, params: { id: 'p1' } });
  assert.equal(afterAwardsRoute(pool, undefined), null);
  assert.equal(afterAwardsRoute(pool, 'x'), null);
});

test('Done shows only on a finished game and always goes Home; the header arrow is the way back to the scorecard', () => {
  assert.equal(HOME_ROUTE, '/(tabs)');
  assert.equal(showsDone(points), true);
  assert.equal(showsDone({ ...points, isComplete: false }), false);
  assert.equal(showsDone(null), false);
  const final = src('app/(screens)/games/final-scores.tsx');
  assert.match(final, /router\.navigate\(HOME_ROUTE\)/, 'navigate, not push: Home is the tab root, so the stack unwinds');
  assert.doesNotMatch(final, /router\.back\(\)/, 'no in-page Back');
});

test('the scorecard and Add round share the one Complete dialog; the Complete page and its route are gone', () => {
  const scorecard = src('app/(screens)/games/[id].tsx');
  assert.match(scorecard, /const openComplete = \(\) => \{\s*if \(!game\) return;\s*setCompleteOpen\(true\);/);
  assert.match(scorecard, /router\.push\(afterCompleteRoute\(updated\)\)/, 'push: the completed scorecard stays under the Final screen for the header arrow');
  assert.match(scorecard, /'Completed and awarded\.' : 'Completed\.'/, 'the strip says what happened, not what to do next');
  assert.doesNotMatch(scorecard, /Go to Results|Give awards first/, 'no Results nudge on the scorecard');
  assert.doesNotMatch(src('app/(screens)/_layout.tsx'), /games\/complete/);
  assert.doesNotMatch(src('constants/help.ts'), /^\s+complete: bullets/m);
  const entry = src('app/(screens)/score-entry.tsx');
  assert.match(src('components/game/RoundSavedSheet.tsx'), /testID="after-complete"/, 'Round saved (a sheet since D139) offers Complete');
  assert.match(entry, /onComplete=\{\(\) => \{ setAfterSave\(null\); setCompleteOpen\(true\); \}\}/);
  assert.doesNotMatch(entry, /games\/complete/);
});

// ---- Status words: "Completed" for a pool without awards, "Awarded" after ----

test('a completed pool without awards is "Completed"; the Results picker says Give awards first when it is picked', () => {
  assert.equal(poolStatusLabel(pool), null);
  assert.equal(poolStatusLabel({ ...pool, awardedAt: '2026-11-18T10:00:00Z' }), 'Awarded');
  for (const file of ['app/(screens)/games/[id].tsx', 'app/(screens)/games/award.tsx', 'components/game/PoolAwardsCard.tsx', 'components/ui/GameListItem.tsx', 'utils/pool.ts']) {
    assert.doesNotMatch(src(file).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''), /Awards pending/, `${file}: no "Awards pending"`);
  }
  assert.match(src('app/(screens)/results/index.tsx'), /GIVE_AWARDS_FIRST/, 'the one place that asks for awards');
});

// ---- Results picker: a one-game result is allowed and obvious ----

test('Show results · 1 game, with a note; plural above', () => {
  assert.equal(showResultsLabel(0), 'Show results');
  assert.equal(showResultsLabel(1), 'Show results · 1 game');
  assert.equal(showResultsLabel(3), 'Show results · 3 games');
  assert.match(ONE_GAME_RESULT_NOTE, /one game/);
  const picker = src('app/(screens)/results/index.tsx');
  assert.match(picker, /\{showResultsLabel\(selected\.length\)\}/);
  assert.match(picker, /selected\.length === 1 && !tooMany[\s\S]*?testID="one-game-note"/);
});

// ---- The full-details PDF: everything about a pool, every round ----

const seats: Record<string, PoolSeat> = {
  a: { outRound: null, reenteredRound: null, reentryScore: null, entries: 1 },
  b: { outRound: 3, reenteredRound: null, reentryScore: null, entries: 1 },
  c: { outRound: null, reenteredRound: 3, reentryScore: 51, entries: 2 },
};

test('pool round cells in the PDF: plain numbers, "out" on the out round, ↺ on the re-entry round, · once gone', () => {
  assert.equal(poolRoundCellText(seats.a, 0, 12), '12');
  assert.equal(poolRoundCellText(seats.b, 2, 101), '101 out');
  assert.equal(poolRoundCellText(seats.b, 3, undefined), '·');
  assert.equal(poolRoundCellText(seats.c, 2, 40), '↺51');
  assert.equal(poolRoundCellText(seats.a, 1, undefined), '—');
});

test('the pool PDF has the limit and drops, every player with pool score, entries, put in, gets, award and out round, and the re-entries', () => {
  const players = [{ id: 'a', name: 'Sree', total: 52 }, { id: 'b', name: 'Zed', total: 101 }, { id: 'c', name: 'Ravi', total: 60 }];
  const sections = poolPdfSections({
    pool: { limit: 101, fullCount: 80, drop: 20, seats, awards: { a: 300, b: -100, c: -200 }, awardNote: { preset: 'winner', presetLabel: 'Winner takes all', entry: 100, poolTotal: 400, givenOut: 400 } },
    players,
    order: ['a', 'c', 'b'],
  });
  assert.deepEqual(sections.map((s) => s.title), ['Pool', 'Players and awards', 'Re-entries']);
  assert.deepEqual(sections[0].lines, ['Limit 101 · drop 20', '2 in · 1 out', 'Awards given · Winner takes all · entry 100 · pool 400 · given out 400']);
  assert.deepEqual(sections[1].table?.heads, ['Player', 'Pool score', 'Entries', 'Out', 'Put in', 'Gets', 'Award']);
  assert.deepEqual(sections[1].table?.rows, [
    ['Sree', '52', '1', '—', '100', '400', '+300'],
    ['Ravi', '60', '2', '—', '200', '0', '-200'],
    ['Zed', '101', '1', 'Round 3', '100', '0', '-100'],
  ]);
  assert.deepEqual(sections[2].lines, ['Ravi: came back in round 3 at 51']);

  const noAwards = poolPdfSections({ pool: { limit: 101, fullCount: 80, seats, awards: null }, players, order: ['a', 'c', 'b'] });
  assert.equal(noAwards[0].lines?.[2], 'Awards not given yet');
  assert.deepEqual(noAwards[1].table?.heads, ['Player', 'Pool score', 'Entries', 'Out']);
  assert.equal(noAwards[1].title, 'Players');
});

test('the sheet carries the PDF sections; shareFinalScoresPdf prints them above Round by round; Final scores comes first (D104)', () => {
  const game = { id: 'p1', gameNumber: 4, gameType: 'pool', date: '2026-11-18T19:00:00Z', completedAt: '2026-11-18T21:00:00Z', isComplete: true } as const;
  const players = [{ id: 'a', name: 'Sree' }, { id: 'b', name: 'Zed' }, { id: 'c', name: 'Ravi' }];
  const scores = { a: [12, 20, 20], b: [50, 30, 21], c: [40, 25, 9] };
  const sheet = buildFinalScoresSheet({
    game,
    players,
    scores,
    pool: { limit: 101, fullCount: 80, drop: 20, seats, awards: { a: 300, b: -100, c: -200 }, awardNote: { presetLabel: 'Winner takes all', entry: 100, poolTotal: 400, givenOut: 400 } },
  });
  assert.deepEqual(sheet.pdfSections.map((s) => s.title), ['Final scores', 'Pool', 'Players and awards', 'Re-entries']);
  // Columns by first name (Ravi, Sree, Zed): the round table reads like the scorecard.
  assert.deepEqual(sheet.table.rows[2].cells, ['↺51', '20', '21 out']);
  assert.deepEqual(sheet.table.totals, ['60', '52', '101 out']);
  const html = roundsPdfHtml({ heading: sheet.heading, lines: [sheet.poolLine!], sections: sheet.pdfSections, table: sheet.table, footer: sheet.footer });
  assert.ok(html.indexOf('Players and awards') < html.indexOf('Round by round'), 'the awards table sits above the rounds');
  assert.match(html, /Limit 101 · drop 20/);
  assert.match(html, /Re-entries/);
  assert.match(pdfSectionHtml({ title: 'T', table: { heads: ['A'], rows: [['<b>']] } }), /&lt;b&gt;/, 'cells are escaped');

  const pointsSheet = buildFinalScoresSheet({ game, players, scores: { a: [-20, 10], b: [10, -30], c: [10, 20] }, multiplier: 100 });
  assert.deepEqual(pointsSheet.pdfSections.map((s) => s.title), ['Final scores'], 'Points: the Final scores table replaces the Totals line');
  assert.deepEqual(pointsSheet.pdfSections[0].table?.foot, ['', 'Totals add to', '0']);
  assert.match(pointsSheet.pdfSections[0].lines![0], /×100/);
  assert.match(src('utils/shareResultsPdf.ts'), /sections: sheet\.pdfSections/);
});

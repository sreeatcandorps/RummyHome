import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFinalScoresSheet, finalScoresSection, FINAL_SCORES_TITLE, placesOf, poolStatus } from '../utils/finalScoresSheet';
import { columnAlign, pdfSectionHtml, roundsPdfHtml } from '../utils/resultsDetails';
import type { PoolSeat } from '../types/game';

// D104 (Q19, Sree Nov 25: "it should have the final scores, and it was missing … I'll take your default"):
// the game PDF opens with a Final scores table; every numeric heading sits right, over its numbers. b2-game-pdf.png.

const game = { id: 'g1', shareCode: 'GAMES1', gameNumber: 1, gameLabel: 'S1', date: '2026-11-23T19:00:00Z', completedAt: '2026-11-23T21:00:00Z', isComplete: true };
const players = [
  { id: 'ss', name: 'Sree Staging' },
  { id: 'pk', name: 'Priya K' },
  { id: 'ht', name: 'Harish T' },
  { id: 'ar', name: 'Anil R' },
];
const pointsScores = { ss: [40, 20, 30, 30], pk: [-10, 0, 20, 30], ht: [-10, -10, 0, 30], ar: [-20, -10, -50, -90] };

const html = (sheet: ReturnType<typeof buildFinalScoresSheet>) =>
  roundsPdfHtml({ heading: sheet.heading, lines: [], sections: sheet.pdfSections, table: sheet.table, footer: sheet.footer });

test('D104: places follow the order; equal scores share a place', () => {
  assert.deepEqual(placesOf([120, 40, 10, -20]), [1, 2, 3, 4]);
  assert.deepEqual(placesOf([40, 10, 10, -60]), [1, 2, 2, 4]);
  assert.deepEqual(placesOf([]), []);
});

test('D104 Points: Final scores is the first section — Place · Player · Total, the winner tinted, "Totals add to 0" last', () => {
  const sheet = buildFinalScoresSheet({ game, players, scores: pointsScores });
  const [first] = sheet.pdfSections;
  assert.equal(first.title, FINAL_SCORES_TITLE);
  assert.equal(sheet.pdfSections.length, 1, 'the old one-line Totals block is gone');
  assert.deepEqual(first.table?.heads, ['Place', 'Player', 'Total']);
  assert.deepEqual(first.table?.rows, [
    ['1', 'Sree Staging · SS', '+120'],
    ['2', 'Priya K · PK', '+40'],
    ['3', 'Harish T · HT', '+10'],
    ['4', 'Anil R · AR', '-170'],
  ]);
  assert.deepEqual(first.table?.highlight, [0], 'the winner row is tinted');
  assert.deepEqual(first.table?.foot, ['', 'Totals add to', '0']);
  assert.deepEqual(first.table?.align, ['left', 'left', 'right'], 'Total (numbers) sits right');
});

test('D104: the PDF prints Final scores before Round by round, with the heading on the same side as its numbers', () => {
  const page = html(buildFinalScoresSheet({ game, players, scores: pointsScores }));
  const finalAt = page.indexOf('<h2>Final scores</h2>');
  const roundsAt = page.indexOf('<h2>Round by round</h2>');
  assert.ok(finalAt > 0 && roundsAt > finalAt, 'Final scores first, then Round by round');
  assert.match(page, /<th class="l">Place<\/th><th class="l">Player<\/th><th class="r">Total<\/th>/);
  assert.match(page, /<tr class="win"><td class="l zero">1<\/td><td class="l zero">Sree Staging · SS<\/td><td class="r pos">\+120<\/td><\/tr>/);
  assert.match(page, /<tr class="foot"><td class="l"><\/td><td class="l">Totals add to<\/td><td class="r">0<\/td><\/tr>/);
  assert.match(page, /table\.det th\.r, table\.det td\.r \{ text-align: right; \}/);
  assert.match(page, /table\.rb th \{ text-align: right; \}/, 'round-table headings right over their numbers');
  assert.match(page, /table\.rb th\.rn \{ text-align: left; \}/, '"Rnd" stays left over the round numbers');
});

test('D104 Pool: Place · Player · Score · Status ("49 left" / "Out · round 3"), players still in first; Award when given', () => {
  const seats: Record<string, PoolSeat> = {
    ss: { outRound: null, reenteredRound: null, reentryScore: null, entries: 1 },
    pk: { outRound: null, reenteredRound: null, reentryScore: null, entries: 1 },
    ht: { outRound: 3, reenteredRound: null, reentryScore: null, entries: 1 },
    ar: { outRound: null, reenteredRound: null, reentryScore: null, entries: 1 },
  };
  const scores = { ss: [12, 20, 20], pk: [30, 10, 20], ht: [50, 30, 21], ar: [12, 20, 20] };
  const sheet = buildFinalScoresSheet({ game, players, scores, pool: { limit: 101, fullCount: 80, drop: 20, seats } });
  assert.deepEqual(sheet.pdfSections.map((s) => s.title), ['Final scores', 'Pool', 'Players']);
  const table = sheet.pdfSections[0].table!;
  assert.deepEqual(table.heads, ['Place', 'Player', 'Score', 'Status']);
  assert.deepEqual(table.rows, [
    ['1', 'Anil R · AR', '52', '49 left'],
    ['1', 'Sree Staging · SS', '52', '49 left'],
    ['3', 'Priya K · PK', '60', '41 left'],
    ['4', 'Harish T · HT', '101', 'Out · round 3'],
  ]);
  assert.deepEqual(table.highlight, [0, 1], 'a tie for the lowest score still in: both tinted');
  assert.equal(table.foot, undefined, 'pool scores do not add to 0: no totals row');
  assert.deepEqual(table.align, ['left', 'left', 'right', 'right']);

  const awarded = buildFinalScoresSheet({ game, players, scores, pool: { limit: 101, fullCount: 80, seats, awards: { ss: 200, ar: 100, pk: -100, ht: -200 } } });
  const withAwards = awarded.pdfSections[0].table!;
  assert.deepEqual(withAwards.heads, ['Place', 'Player', 'Award', 'Score', 'Status']);
  assert.deepEqual(withAwards.rows[0], ['1', 'Sree Staging · SS', '+200', '52', '49 left'], 'ordered by award, as the Final screen picture');
  assert.deepEqual(withAwards.highlight, [0]);
  assert.deepEqual(withAwards.align, ['left', 'left', 'right', 'right', 'right']);
});

test('D104: pool status and column sides', () => {
  assert.equal(poolStatus(52, { outRound: null, reenteredRound: null, reentryScore: null, entries: 1 }, 101), '49 left');
  assert.equal(poolStatus(130, { outRound: 5, reenteredRound: null, reentryScore: null, entries: 1 }, 101), 'Out · round 5');
  assert.equal(columnAlign(undefined, 0), 'left');
  assert.equal(columnAlign(undefined, 2), 'right', 'existing tables keep numbers right');
  assert.equal(columnAlign(['left', 'left', 'right'], 1), 'left');
  assert.match(pdfSectionHtml({ title: 'T', table: { heads: ['Player', 'Pool score'], rows: [['A', '52']] } }), /<th class="l">Player<\/th><th class="r">Pool score<\/th>/, 'the pool Players table: headings over their numbers');
});

test('D104: a game with no rounds still opens with the table; nobody tinted at 0', () => {
  const section = finalScoresSection({
    summary: [{ id: 'a', name: 'A', total: 0 }, { id: 'b', name: 'B', total: 0 }],
    initials: new Map([['a', 'AA'], ['b', 'BB']]),
    totals: { a: 0, b: 0 },
    totalSum: 0,
  });
  assert.deepEqual(section.table?.rows, [['1', 'A · AA', '0'], ['1', 'B · BB', '0']]);
  assert.deepEqual(section.table?.highlight, []);
});

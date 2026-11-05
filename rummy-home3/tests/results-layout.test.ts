import assert from 'node:assert/strict';
import test from 'node:test';
import { buildResultsDetails, buildRoundTable, resultsDetailsHtml } from '../utils/resultsDetails';
import {
  buildShareBreakdown,
  SHARE_BREAKDOWN_MAX_GAMES,
  SHARE_BREAKDOWN_OMITTED,
  shareBreakdownOmitted,
  uniquePlayerCount,
} from '../utils/resultsLayout';
import { presentResults } from '../utils/results';
import { buildResultsShareCard } from '../utils/shareCard';

const players = [
  { id: 'h', name: 'Harish Gadupudi' },
  { id: 's', name: 'Sree Koneru' },
  { id: 'p1', name: 'Player 1' },
  { id: 'p2', name: 'Player 2' },
  { id: 'p4', name: 'Player 4' },
];

const gameOf = (index: number, scores: Record<string, number>) => ({ id: `g${index}`, name: `G${index}`, when: '11:51 am', scores });

const twoGames = [
  gameOf(1, { h: 80, p1: -20, s: -40 }),
  gameOf(2, { h: -60, p1: -40, p2: -120, p4: 160, s: 100 }),
];
const totals = { h: 20, s: 60, p1: -60, p2: -120, p4: 160 };

test('unique players are counted once across the selected games', () => {
  assert.equal(uniquePlayerCount(twoGames), 5, 'Harish, Sree, and Player 1 sit in both games');
  assert.equal(uniquePlayerCount([twoGames[0]]), 3);
  assert.equal(uniquePlayerCount([]), 0);
});

test('the share image breaks totals down for up to five games', () => {
  const grid = buildShareBreakdown({ players, games: twoGames, totals });
  assert.ok(grid);
  assert.deepEqual(grid.columns, ['G1', 'G2', 'Total']);
  assert.deepEqual(grid.rows.map((row) => row.initials), ['HG', 'P1', 'P2', 'P4', 'SK']);
  const harish = grid.rows[0];
  assert.deepEqual(harish.cells, ['+80', '-60']);
  assert.equal(harish.total, '+20');
  assert.deepEqual(grid.rows[2].cells, ['—', '-120'], 'a player who sat out a game shows a dash');

  const five = Array.from({ length: SHARE_BREAKDOWN_MAX_GAMES }, (_, index) => gameOf(index + 1, { h: 1 }));
  assert.ok(buildShareBreakdown({ players, games: five, totals }));
  assert.equal(shareBreakdownOmitted(SHARE_BREAKDOWN_MAX_GAMES), false);

  const six = [...five, gameOf(6, { h: 1 })];
  assert.equal(buildShareBreakdown({ players, games: six, totals }), null);
  assert.equal(shareBreakdownOmitted(6), true);
  assert.equal(SHARE_BREAKDOWN_OMITTED, 'Full details in PDF');
});

test('the results card marks the top three rows and carries the breakdown or the PDF note', () => {
  const { standings, sheet } = presentResults([
    { id: 'g1', name: 'A', date: '2026-11-04T11:51:00Z', players: ['h', 'p1', 's'], scores: { h: [80], p1: [-20], s: [-40] }, names: { h: 'Harish Gadupudi', p1: 'Player 1', s: 'Sree Koneru' } },
    { id: 'g2', name: 'B', date: '2026-11-04T20:47:00Z', players: ['h', 'p1', 'p2', 'p4', 's'], scores: { h: [-60], p1: [-40], p2: [-120], p4: [160], s: [100] }, names: { h: 'Harish Gadupudi', p1: 'Player 1', p2: 'Player 2', p4: 'Player 4', s: 'Sree Koneru' } },
  ]);
  const rows = standings.map((row) => ({ id: row.id, name: row.name, points: row.points, place: row.place }));
  const card = buildResultsShareCard({ title: 'Results', date: 'Wed, Nov 4 · 11:19 AM', rows, gameCount: 2, games: sheet.games });
  assert.equal(card.summary, '2 games · 5 players');
  assert.deepEqual(card.lines.map((line) => [line.name, line.points, line.place]), [
    ['Player 4', '+160', 1],
    ['Sree Koneru', '+60', 2],
    ['Harish Gadupudi', '+20', 3],
    ['Player 1', '-60', undefined],
    ['Player 2', '-120', undefined],
  ]);
  assert.deepEqual(card.places, []);
  assert.ok(card.breakdown);
  assert.deepEqual(card.breakdown.columns, ['G1', 'G2', 'Total']);
  assert.equal(card.breakdownNote, undefined);

  const manyGames = Array.from({ length: 6 }, (_, index) => ({ scores: { h: index } }));
  const long = buildResultsShareCard({ title: 'Results', date: 'x', rows, gameCount: 6, games: manyGames });
  assert.equal(long.breakdown, null);
  assert.equal(long.breakdownNote, 'Full details in PDF');
});

test('each game in the PDF lists every round for every seated player and the game totals', () => {
  const game = { ...gameOf(1, { h: 80, p1: -20, s: -40 }), rounds: { h: [40, 40], p1: [-20, 0], s: [-20, -20] } };
  const table = buildRoundTable(game, 0, players);
  assert.equal(table.label, 'G1');
  assert.equal(table.when, '11:51 am');
  assert.deepEqual(table.initials, ['HG', 'P1', 'SK']);
  assert.deepEqual(table.names, ['Harish Gadupudi', 'Player 1', 'Sree Koneru']);
  assert.deepEqual(table.rows, [
    { round: 1, cells: ['+40', '-20', '-20'] },
    { round: 2, cells: ['+40', '0', '-20'] },
  ]);
  assert.deepEqual(table.totals, ['+80', '-20', '-40']);
  assert.equal(table.totalsOnly, false);

  const saved = buildRoundTable(gameOf(1, { h: 80 }), 0, players);
  assert.equal(saved.totalsOnly, true, 'results saved before rounds were kept fall back to totals');
  assert.deepEqual(saved.rows, []);
});

test('the PDF is one phone-width column with the counts, game list, side-by-side totals, places, and rounds', () => {
  const details = buildResultsDetails({
    createdAtLabel: 'Wed, Nov 4 · 11:19 AM',
    standings: [
      { id: 'p4', name: 'Player 4', points: 160, games: 1, place: 1 },
      { id: 's', name: 'Sree Koneru', points: 60, games: 2, place: 2 },
      { id: 'h', name: 'Harish Gadupudi', points: 20, games: 2, place: 3 },
      { id: 'p1', name: 'Player 1', points: -60, games: 2, place: 4 },
      { id: 'p2', name: 'Player 2', points: -120, games: 1, place: 5 },
    ],
    players,
    games: [
      { ...twoGames[0], rounds: { h: [80], p1: [-20], s: [-40] } },
      { ...twoGames[1], when: '8:47 pm' },
    ],
  });
  assert.equal(details.playerCount, 5);
  assert.deepEqual(details.games, [{ name: 'G1', when: '11:51 am' }, { name: 'G2', when: '8:47 pm' }]);
  const html = resultsDetailsHtml(details);
  const body = html.slice(html.indexOf('<body>'));
  const order = ['Created Wed, Nov 4 · 11:19 AM', '2 games · 5 players', '<li>G1 — 11:51 am', '<li>G2 — 8:47 pm', '<h2>Totals', 'totals-row', 'Positive', 'Negative', '<h2>Top 3', '<h2>Games', 'G1 <span class="when">11:51 am', '<th>Round</th>', 'G2 <span class="when">8:47 pm']
    .map((marker) => body.indexOf(marker));
  assert.ok(order.every((index) => index >= 0), `missing markers ${order}`);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'sections run top to bottom in the asked order');
  assert.match(html, /class="num neg">-120</);
  assert.match(html, /Round scores were not saved/);
  assert.doesNotMatch(html, /width: 100%/);
});

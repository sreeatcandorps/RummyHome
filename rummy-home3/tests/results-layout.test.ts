import assert from 'node:assert/strict';
import test from 'node:test';
import { buildResultsDetails, buildRoundTable, resultsDetailsHtml } from '../utils/resultsDetails';
import {
  bandRanges,
  buildShareBreakdown,
  legendLines,
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

// Games carry their own number (G7 stays G7); the short code is separate.
const gameOf = (index: number, scores: Record<string, number>) => ({ id: `g${index}`, name: `C0DE${index}`, label: `G${index}`, when: '11:51 am', scores });

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

test('the share image breaks totals down: players as rows, games as columns, one band for up to five games', () => {
  const grid = buildShareBreakdown({ players, games: twoGames, totals });
  assert.ok(grid);
  assert.equal(grid.bands.length, 1);
  const band = grid.bands[0];
  assert.deepEqual(band.columns, ['G1', 'G2', 'Total']);
  assert.equal(band.hasTotal, true);
  assert.deepEqual(band.rows.map((row) => row.head), ['HG', 'P1', 'P2', 'P4', 'SK']);
  assert.deepEqual(grid.legend.map((entry) => entry.name), ['Harish Gadupudi', 'Player 1', 'Player 2', 'Player 4', 'Sree Koneru']);
  const harish = band.rows[0];
  assert.deepEqual(harish.cells, ['+80', '-60', '+20'], 'the last cell is the total');
  assert.deepEqual(band.rows[2].cells.slice(0, 2), ['—', '-120'], 'a player who sat out a game shows a dash');

  const five = Array.from({ length: SHARE_BREAKDOWN_MAX_GAMES }, (_, index) => gameOf(index + 1, { h: 1 }));
  assert.equal(buildShareBreakdown({ players, games: five, totals })?.bands.length, 1, 'five games still fit one band');
  assert.equal(shareBreakdownOmitted(SHARE_BREAKDOWN_MAX_GAMES), false);

  const six = [...five, gameOf(6, { h: 1 })];
  assert.equal(buildShareBreakdown({ players, games: six, totals })?.bands.length, 2, 'the sixth game starts a new band');
  assert.equal(shareBreakdownOmitted(6), true);
  assert.equal(SHARE_BREAKDOWN_OMITTED, 'Round by round in the PDF');
});

test('the results card marks the top three rows and carries the breakdown or the PDF note', () => {
  const { standings, sheet } = presentResults([
    { id: 'g1', name: 'A', label: 'G1', date: '2026-11-04T11:51:00Z', players: ['h', 'p1', 's'], scores: { h: [80], p1: [-20], s: [-40] }, names: { h: 'Harish Gadupudi', p1: 'Player 1', s: 'Sree Koneru' } },
    { id: 'g2', name: 'B', label: 'G2', date: '2026-11-04T20:47:00Z', players: ['h', 'p1', 'p2', 'p4', 's'], scores: { h: [-60], p1: [-40], p2: [-120], p4: [160], s: [100] }, names: { h: 'Harish Gadupudi', p1: 'Player 1', p2: 'Player 2', p4: 'Player 4', s: 'Sree Koneru' } },
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
  assert.deepEqual(card.breakdown.bands[0].columns, ['G1', 'G2', 'Total']);
  assert.equal(card.breakdownNote, undefined);

  const manyGames = Array.from({ length: 6 }, (_, index) => ({ scores: { h: index }, name: `C${index}`, label: `G${index + 1}` }));
  const long = buildResultsShareCard({ title: 'Results', date: 'x', rows, gameCount: 6, games: manyGames, footer: 'Result ID · ABC123' });
  assert.ok(long.breakdown, 'past five games the grid stays: every game is on the image');
  assert.equal(long.breakdown.bands.length, 2);
  assert.deepEqual(long.breakdown.bands.map((band) => band.columns), [['G1', 'G2', 'G3', 'G4', 'G5'], ['G6', 'Total']]);
  assert.equal(long.breakdownNote, 'Round by round in the PDF');
  assert.equal(long.footer, 'Result ID · ABC123');
});

test('nov 10: eight and twenty games wrap into bands of five — extra header rows with matching score rows, Total on the last', () => {
  const twenty = Array.from({ length: 20 }, (_, index) => gameOf(index + 1, { h: index % 2 ? 40 : -40, s: index % 2 ? -40 : 40, p1: 0 }));
  const grid = buildShareBreakdown({ players, games: twenty, totals: { h: 0, s: 0, p1: 0, p2: 0, p4: 0 } });
  assert.ok(grid);
  assert.equal(grid.gameCount, 20);
  assert.equal(grid.bands.length, 4, '20 games → 4 bands of 5');
  assert.deepEqual(bandRanges(20), [{ start: 0, end: 5 }, { start: 5, end: 10 }, { start: 10, end: 15 }, { start: 15, end: 20 }]);
  assert.deepEqual(grid.bands[0].columns, ['G1', 'G2', 'G3', 'G4', 'G5']);
  assert.deepEqual(grid.bands[1].columns, ['G6', 'G7', 'G8', 'G9', 'G10']);
  assert.deepEqual(grid.bands[3].columns, ['G16', 'G17', 'G18', 'G19', 'G20', 'Total']);
  assert.deepEqual(grid.bands.map((band) => band.hasTotal), [false, false, false, true]);
  // Every band has the same player rows in the same order.
  grid.bands.forEach((band) => assert.deepEqual(band.rows.map((row) => row.head), ['HG', 'P1', 'P2', 'P4', 'SK']));
  assert.deepEqual(grid.bands[0].rows[0].cells, ['-40', '+40', '-40', '+40', '-40'], 'Harish, G1–G5');
  assert.deepEqual(grid.bands[3].rows[0].cells, ['+40', '-40', '+40', '-40', '+40', '0'], 'Harish, G16–G20 then Total');
  assert.ok(grid.bands.every((band) => band.columns.length <= SHARE_BREAKDOWN_MAX_GAMES + 1), 'no band is wider than five games plus Total');
  assert.equal(grid.dense, false, 'five players is not dense; the bands keep the type readable');

  const eight = buildShareBreakdown({ players, games: twenty.slice(0, 8), totals: { h: 0, s: 0, p1: 0, p2: 0, p4: 0 } });
  assert.equal(eight?.bands.length, 2);
  assert.deepEqual(eight?.bands[1].columns, ['G6', 'G7', 'G8', 'Total']);
  assert.deepEqual(bandRanges(5), [{ start: 0, end: 5 }]);
  assert.deepEqual(bandRanges(0), []);
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

test('nov 6: the legend wraps so every name stays on the image', () => {
  const legend = [
    { initials: 'AP', name: 'Anil Peddi' }, { initials: 'HG', name: 'Harish Gadupudi' }, { initials: 'KT', name: 'Kiran Tummala' },
    { initials: 'RB', name: 'Ravi Chandra Bhimavarapu' }, { initials: 'SK', name: 'Sree Koneru' }, { initials: 'VN', name: 'Venkat Nallamothu' },
  ];
  const lines = legendLines(legend, 60);
  assert.ok(lines.length >= 2);
  assert.ok(lines.every((line) => line.length <= 60));
  assert.equal(lines.join(' · '), legend.map((entry) => `${entry.initials} ${entry.name}`).join(' · '));
});

test('nov 10: share image and PDF carry the Player ID on a second line and wrap the by-game table at five games', () => {
  const seats = [
    { id: 'h', name: 'Harish Gadupudi', playerNo: 12 },
    { id: 's', name: 'Sree Koneru', playerNo: 39 },
    { id: 'p1', name: 'Player 1', playerNo: null },
  ];
  const standings = [
    { id: 's', name: 'Sree Koneru', points: 60, place: 1, games: 7 },
    { id: 'h', name: 'Harish Gadupudi', points: 20, place: 2, games: 7 },
    { id: 'p1', name: 'Player 1', points: -80, place: 3, games: 7 },
  ];
  const seven = Array.from({ length: 7 }, (_, index) => gameOf(index + 1, { h: 10, s: 10, p1: -20 }));
  const card = buildResultsShareCard({ title: 'Results', date: 'x', rows: standings, gameCount: 7, games: seven, players: seats });
  assert.deepEqual(card.lines.map((line) => line.sub), ['SK · #39', 'HG · #12', 'P1'], 'initials, then the Player ID when known');
  assert.equal(card.breakdown?.bands.length, 2);
  assert.deepEqual(card.breakdown?.bands[1].columns, ['G6', 'G7', 'Total']);

  const details = buildResultsDetails({ createdAtLabel: 'x', standings, players: seats, games: seven });
  assert.deepEqual(details.rows.map((row) => row.sub), ['HG · #12', 'P1', 'SK · #39']);
  assert.deepEqual(details.positive.map((row) => row.sub), ['SK · #39', 'HG · #12']);
  assert.equal(details.bands.length, 2);
  assert.deepEqual(details.bands[0].columns, ['G1', 'G2', 'G3', 'G4', 'G5']);
  assert.deepEqual(details.bands[1].rows.map((row) => row.head), ['HG', 'P1', 'SK']);
  assert.ok(details.legend.some((line) => line.includes('SK Sree Koneru')));

  const html = resultsDetailsHtml(details);
  assert.ok(html.includes('<span class="sub">SK · #39</span>'), 'the PDF totals show the Player ID under the name');
  assert.ok(html.includes('<h2>By game</h2>'));
  assert.ok(html.includes('data-band="1"') && html.includes('data-band="2"'), 'two header bands');
  assert.ok(!html.includes('data-band="3"'));
  assert.ok(html.indexOf('<h2>By game</h2>') < html.indexOf('<h2>Games</h2>'), 'the by-game bands come before the round tables');
});

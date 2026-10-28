import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_RESULTS_PLAYERS, RESULTS_PLAYER_LIMIT, SEATED_PLAYER_LIMIT } from '../constants/limits';
import { buildResultsShareCard, buildShareCard, RESULTS_IMAGE_TOTAL_CAP, SHARE_CARD_LINE_CAP } from '../utils/shareCard';
import { buildResultsDetails, resultsDetailsHtml, resultsDetailsPdf } from '../utils/resultsDetails';
import {
  canDeclareResults,
  formatPoints,
  placeLabel,
  playersByFirstName,
  podiumPlaces,
  presentResults,
  RESULTS_SCORE_MIN,
  resultsColumnWidths,
  resultsPlayerCount,
  resultsTableScrollsHorizontally,
  resultsVisibleGameCount,
  scoreCell,
  splitTotals,
  totalAcrossGames,
  winnerLine,
} from '../utils/results';

const host = { createdBy: 'host', adminIds: ['host'] };
const rita = { createdBy: 'rita', adminIds: ['rita'] };

test('points add up across games and the expense column is not a place', () => {
  const standings = totalAcrossGames([
    {
      players: ['host', 'rita', 'EX'],
      scores: { host: [20], rita: [-10], EX: [-10] },
      names: { host: 'Host', rita: 'Rita', EX: 'Expenses' },
    },
    {
      players: ['host', 'rita', 'dev'],
      scores: { host: [10], rita: [30], dev: [-40] },
      names: { host: 'Host', rita: 'Rita', dev: 'Dev' },
    },
  ]);

  assert.deepEqual(standings.map((row) => [row.name, row.points, row.place, row.games]), [
    ['Host', 30, 1, 2],
    ['Rita', 20, 2, 2],
    ['Dev', -40, 3, 1],
  ]);
  assert.equal(standings.some((row) => row.id === 'EX'), false);
  assert.equal(winnerLine(standings), 'Winner: Host');
  assert.equal(podiumPlaces(standings).length, 3);
});

test('tied totals share a place and the next place skips', () => {
  const standings = totalAcrossGames([
    {
      players: ['a', 'b', 'c', 'd'],
      scores: { a: [10], b: [10], c: [4], d: [1] },
      names: { a: 'Ada', b: 'Bea', c: 'Cam', d: 'Dee' },
    },
  ]);
  assert.deepEqual(standings.map((row) => [row.name, row.place]), [
    ['Ada', 1],
    ['Bea', 1],
    ['Cam', 3],
    ['Dee', 4],
  ]);
  assert.equal(winnerLine(standings), '1st place: Ada and Bea');
  assert.equal(podiumPlaces(standings).map((group) => group[0].place).join(','), '1,3,4');
  assert.equal(placeLabel(1), '1st');
  assert.equal(placeLabel(2), '2nd');
  assert.equal(placeLabel(3), '3rd');
  assert.equal(placeLabel(11), '11th');
  assert.equal(formatPoints(30), '+30');
  assert.equal(formatPoints(-4), '-4');
});

test('positive totals stay on the left, negative totals on the right, each by magnitude', () => {
  const standings = totalAcrossGames([
    {
      players: ['a', 'b', 'c', 'd', 'e', 'EX'],
      scores: { a: [50], b: [0], c: [-40], d: [-10], e: [10], EX: [-10] },
      names: { a: 'Ada', b: 'Bea', c: 'Cam', d: 'Dee', e: 'Eve', EX: 'Expenses' },
    },
  ]);
  const columns = splitTotals(standings);
  assert.deepEqual(columns.positive.map((row) => [row.name, row.points]), [
    ['Ada', 50],
    ['Eve', 10],
    ['Bea', 0],
  ]);
  assert.deepEqual(columns.negative.map((row) => [row.name, row.points]), [
    ['Cam', -40],
    ['Dee', -10],
  ]);
});

test('a missing seat is a dash, a zero is a score, and names sort by first name', () => {
  const { sheet } = presentResults([
    {
      id: 'g2',
      name: 'LATE',
      date: '2026-10-28T20:00:00.000Z',
      players: ['a', 'c'],
      scores: { a: [5, 0], c: [-5] },
      names: { a: 'Ada', c: 'Cam' },
    },
    {
      id: 'g1',
      name: 'NIGHT',
      date: '2026-10-28T18:00:00.000Z',
      players: ['a', 'b', 'EX'],
      scores: { a: [10], b: [0], EX: [-10] },
      names: { a: 'Ada', b: 'Bea', EX: 'Expenses' },
    },
  ]);

  assert.deepEqual(sheet.games.map((game) => game.name), ['NIGHT', 'LATE']);
  assert.equal(scoreCell(sheet.games[0].scores, sheet.players.find((player) => player.name === 'Bea')?.id ?? ''), '0');
  assert.equal(scoreCell(sheet.games[1].scores, sheet.players.find((player) => player.name === 'Bea')?.id ?? ''), '—');
  assert.equal(scoreCell(sheet.games[0].scores, 'EX'), '—');
  assert.equal(sheet.players.some((player) => player.id === 'EX'), false);
  const ada = sheet.players.find((player) => player.name === 'Ada');
  assert.equal(ada && sheet.games[1].scores[ada.id], 5);
  assert.deepEqual(playersByFirstName(sheet.players).map((player) => player.name), ['Ada', 'Bea', 'Cam']);
  assert.deepEqual(
    playersByFirstName([
      { id: 'z', name: 'Zoe Ann' },
      { id: 'a', name: 'ann' },
      { id: 'b', name: 'Bea' },
    ]).map((player) => player.name),
    ['ann', 'Bea', 'Zoe Ann'],
  );
});

test('game columns follow the width, and the total keeps a slot', () => {
  const gutter = 32;
  const small = 360 - gutter;
  const typical = 412 - gutter;
  const largePhone = 430 - gutter;
  const tablet = 1024 - gutter;
  const games = 8;

  assert.equal(resultsVisibleGameCount(small, games), 4);
  assert.equal(resultsTableScrollsHorizontally(small, 4), false);
  assert.equal(resultsTableScrollsHorizontally(small, games), true);
  assert.equal(resultsColumnWidths(small, 4).reduce((sum, value) => sum + value, 0), small);

  const typicalVisible = resultsVisibleGameCount(typical, games);
  assert.ok(typicalVisible >= 4 && typicalVisible <= 5, `typical phone shows ${typicalVisible}`);
  assert.ok(resultsVisibleGameCount(largePhone, games) >= typicalVisible);
  assert.equal(resultsTableScrollsHorizontally(tablet, games), false);
  assert.equal(resultsVisibleGameCount(tablet, games), games);
  assert.ok(resultsVisibleGameCount(tablet, 20) > resultsVisibleGameCount(largePhone, 20));

  for (const width of [small, typical, largePhone, tablet]) {
    const widths = resultsColumnWidths(width, games);
    assert.equal(widths.length, games + 2);
    assert.ok(widths.slice(1).every((value) => value >= RESULTS_SCORE_MIN));
    assert.equal(widths[0], 76);
  }

  const landscape = 844 - 24;
  assert.ok(resultsVisibleGameCount(landscape, games) > resultsVisibleGameCount(small, games));
});

test('results stop at 50 players and a game stops at 15', () => {
  const tooMany = [{ players: Array.from({ length: MAX_RESULTS_PLAYERS + 1 }, (_, index) => `p${index}`), scores: {} }];
  assert.equal(resultsPlayerCount(tooMany), 51);
  assert.equal(resultsPlayerCount([{ players: ['a', 'EX', 'a'], scores: {} }]), 1);
  assert.equal(RESULTS_PLAYER_LIMIT, 'Results can include at most 50 players.');
  assert.equal(SEATED_PLAYER_LIMIT, 'A game can have at most 15 players.');
});

test('the share image names Rummy Home and shortens a long list', () => {
  const card = buildShareCard({
    title: 'Results',
    date: 'Wed, Oct 28 · 6:40 PM',
    rows: Array.from({ length: SHARE_CARD_LINE_CAP + 3 }, (_, index) => ({ name: `P${index}`, points: index })),
    places: [{ label: '1st', names: 'P14', points: 14 }],
  });
  assert.equal(card.brand, 'Rummy Home');
  assert.equal(card.title, 'Results');
  assert.equal(card.lines.length, SHARE_CARD_LINE_CAP);
  assert.equal(card.moreCount, 3);
  assert.equal(card.lines[0].name, 'P14');
  assert.equal(card.places[0].points, '+14');

  const resultsCard = buildResultsShareCard({
    title: 'Results',
    date: 'Wed, Oct 28 · 6:40 PM',
    rows: Array.from({ length: RESULTS_IMAGE_TOTAL_CAP + 2 }, (_, index) => ({ name: `P${index}`, points: index })),
    places: [{ label: '1st', names: 'P7', points: 7 }],
  });
  assert.equal(resultsCard.podiumFirst, false);
  assert.equal(resultsCard.brand, 'Rummy Home');
  assert.equal(resultsCard.lines.length, RESULTS_IMAGE_TOTAL_CAP);
  assert.equal(resultsCard.moreCount, 2);
  assert.equal(resultsCard.places[0].label, '1st');
  assert.equal(resultsCard.lines[0].points, `+${RESULTS_IMAGE_TOTAL_CAP + 1}`);
});

test('the full details include the games, the player table, both totals, and the places', () => {
  const { standings, sheet } = presentResults([
    {
      id: 'g1',
      name: 'ALPHA',
      date: '2026-10-28T15:00:00.000Z',
      players: ['a', 'b'],
      scores: { a: [20], b: [-20] },
      names: { a: 'Ada', b: 'Bea' },
    },
    {
      id: 'g2',
      name: 'BETA',
      date: '2026-10-28T17:00:00.000Z',
      players: ['a'],
      scores: { a: [5] },
      names: { a: 'Ada' },
    },
  ]);
  const details = buildResultsDetails({
    createdAtLabel: 'Wed, Oct 28 · 6:40 PM',
    standings,
    players: sheet.players,
    games: sheet.games.map((game) => ({ ...game, when: game.date })),
  });
  assert.deepEqual(details.rows.map((row) => row.name), ['Ada', 'Bea']);
  assert.deepEqual(details.columns, ['Game 1 2026-10-28T15:00:00.000Z', 'Game 2 2026-10-28T17:00:00.000Z', 'Total']);
  assert.equal(details.rows[1].cells[1], '—');
  assert.equal(details.rows[0].cells[2], '+25');
  const html = resultsDetailsHtml(details);
  assert.match(html, /Rummy Home/);
  assert.match(html, /Created Wed, Oct 28/);
  assert.match(html, /class="n">1</);
  assert.match(html, /class="n">2</);
  assert.match(html, />Total</);
  assert.match(html, /Positive/);
  assert.match(html, /Negative/);
  assert.match(html, /1st/);
  const many = buildResultsDetails({
    createdAtLabel: 'Wed, Oct 28 · 6:40 PM',
    standings: Array.from({ length: 50 }, (_, index) => ({
      id: `p${index}`,
      name: `P${String(index).padStart(2, '0')}`,
      points: index,
      games: 1,
      place: 1,
    })),
    players: Array.from({ length: 50 }, (_, index) => ({ id: `p${index}`, name: `P${String(index).padStart(2, '0')}` })),
    games: [{ id: 'g', name: 'ALPHA', when: 'Wed', scores: {} }],
  });
  const pdf = new TextDecoder().decode(resultsDetailsPdf(many));
  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(pdf, /Game 1/);
  assert.match(pdf, /P00/);
  assert.match(pdf, /P49/);
  const pageCount = pdf.match(/\/Count (\d+)/);
  assert.ok(pageCount && Number(pageCount[1]) >= 2);
  assert.match(pdf, /1st/);
});

test('only an admin of every selected game can declare', () => {
  assert.equal(canDeclareResults([host], 'host'), true);
  assert.equal(canDeclareResults([rita], 'host'), false);
  assert.equal(canDeclareResults([host, rita], 'host'), false);
  assert.equal(canDeclareResults([], 'host'), false);
  assert.equal(canDeclareResults([host], null), false);
});

test('game headers use h:mm with no AM/PM', async () => {
  const { gameClock } = await import('@/utils/results');
  const d = new Date(2026, 9, 28, 22, 5);
  assert.equal(gameClock(d.toISOString()), '10:05');
  assert.equal(gameClock(new Date(2026, 9, 28, 0, 7).toISOString()), '12:07');
});

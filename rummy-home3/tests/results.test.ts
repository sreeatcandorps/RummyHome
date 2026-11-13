import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_RESULTS_PLAYERS, RESULTS_PLAYER_LIMIT, SEATED_PLAYER_LIMIT } from '../constants/limits';
import { buildResultsShareCard, buildScoresCard, SHARE_SIDE_CAP } from '../utils/shareCard';
import { buildResultsDetails, resultsDetailsHtml, resultsDetailsPdf } from '../utils/resultsDetails';
import { clockOf, rankScores, resultInitials } from '../utils/resultsDesign';
import {
  canDeclareResults,
  formatPoints,
  placeLabel,
  playersByFirstName,
  podiumPlaces,
  presentResults,
  resultsPlayerCount,
  scoreCell,
  totalAcrossGames,
  winnerLine,
} from '../utils/results';

const host = { createdBy: 'host', adminIds: ['host'] };
const rita = { createdBy: 'rita', adminIds: ['rita'] };

test('points add up across games', () => {
  const standings = totalAcrossGames([
    {
      players: ['host', 'rita'],
      scores: { host: [20], rita: [-20] },
      names: { host: 'Host', rita: 'Rita' },
    },
    {
      players: ['host', 'rita', 'dev'],
      scores: { host: [10], rita: [30], dev: [-40] },
      names: { host: 'Host', rita: 'Rita', dev: 'Dev' },
    },
  ]);

  assert.deepEqual(standings.map((row) => [row.name, row.points, row.place, row.games]), [
    ['Host', 30, 1, 2],
    ['Rita', 10, 2, 2],
    ['Dev', -40, 3, 1],
  ]);
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

test('positive totals stay on the left ranked with medals, negatives on the right closest to zero first, zeros are Even', () => {
  const standings = totalAcrossGames([
    {
      players: ['a', 'b', 'c', 'd', 'e'],
      scores: { a: [50], b: [0], c: [-40], d: [-10], e: [10] },
      names: { a: 'Ada', b: 'Bea', c: 'Cam', d: 'Dee', e: 'Eve' },
    },
  ]);
  const players = standings.map((row) => ({ id: row.id, name: row.name }));
  const ranked = rankScores(standings, players, resultInitials(players, []));
  assert.deepEqual(ranked.positive.map((row) => [row.name, row.points, row.medal]), [
    ['Ada', 50, 1],
    ['Eve', 10, 2],
  ]);
  assert.deepEqual(ranked.negative.map((row) => [row.name, row.points, row.medal]), [
    ['Dee', -10, undefined],
    ['Cam', -40, undefined],
  ]);
  assert.deepEqual(ranked.even.map((row) => row.name), ['Bea']);
  assert.deepEqual(ranked.order, ['a', 'e', 'b', 'd', 'c'], 'one order for the whole page');
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
      players: ['a', 'b'],
      scores: { a: [10], b: [0] },
      names: { a: 'Ada', b: 'Bea' },
    },
  ]);

  assert.deepEqual(sheet.games.map((game) => game.name), ['NIGHT', 'LATE']);
  assert.equal(scoreCell(sheet.games[0].scores, sheet.players.find((player) => player.name === 'Bea')?.id ?? ''), '0');
  assert.equal(scoreCell(sheet.games[1].scores, sheet.players.find((player) => player.name === 'Bea')?.id ?? ''), '—');
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

test('results stop at 50 players and a game stops at 20 (the players_per_game guardrail)', () => {
  const tooMany = [{ players: Array.from({ length: MAX_RESULTS_PLAYERS + 1 }, (_, index) => `p${index}`), scores: {} }];
  assert.equal(resultsPlayerCount(tooMany), 51);
  assert.equal(resultsPlayerCount([{ players: ['a', 'EX', 'a'], scores: {} }]), 1);
  assert.equal(RESULTS_PLAYER_LIMIT, 'Results can include at most 50 players.');
  assert.equal(SEATED_PLAYER_LIMIT, 'A game holds at most 20 players.');
});

test('the share image names EZ Score: Rummy, keeps eight a side, and says who generated it by initials', () => {
  const standings = Array.from({ length: SHARE_SIDE_CAP + 3 }, (_, index) => ({ id: `p${index}`, name: `P${index} Last`, points: index + 1, games: 1, place: 1 }));
  const card = buildScoresCard({
    title: 'Results',
    date: 'Wed, Oct 28 · 6:40 PM',
    standings,
    generatedByName: 'Sree Koneru',
    link: 'ezscore.mindweavetech.com/r/x',
  });
  assert.equal(card.brand, 'EZ Score: Rummy');
  assert.equal(card.title, 'Results');
  assert.equal(card.positive.length, SHARE_SIDE_CAP);
  assert.equal(card.moreLine, 'and 3 more · full list in the link below');
  assert.equal(card.positive[0].name, `P${SHARE_SIDE_CAP + 2} Last`);
  assert.equal(card.positive[0].medal, 1);
  assert.equal(card.positive[3].medal, undefined);
  assert.equal(card.generatedBy, 'Generated by SK', 'initials, never the full name');
  assert.equal(card.negative.length, 0);

  const resultsCard = buildResultsShareCard({
    standings: [
      { id: 'a', name: 'Ada', points: 30, games: 1, place: 1 },
      { id: 'b', name: 'Bea', points: -30, games: 1, place: 2 },
    ],
    games: [{ name: 'ABC', label: 'S12', scores: { a: 30, b: -30 } }, { name: 'DEF', label: 'S13', scores: { a: 0, b: 0 } }],
    createdAtLabel: 'Wed, Oct 28 · 6:40 PM',
    resultId: '7f3a2c00-0000-4000-8000-00000000abcd',
    generatedByName: 'Harish Gadupudi',
    footer: 'Result ID · 00ABCD',
  });
  assert.equal(resultsCard.code, '00ABCD');
  assert.equal(resultsCard.date, 'Saved Wed, Oct 28 · 6:40 PM');
  assert.equal(resultsCard.summary, '2 games · 2 players');
  assert.equal(resultsCard.gamesLine, 'Games S12, S13 · saved Wed, Oct 28 · 6:40 PM');
  assert.equal(resultsCard.link, 'ezscore.mindweavetech.com/r/7f3a2c00-0000-4000-8000-00000000abcd');
  assert.equal(resultsCard.generatedBy, 'Generated by HG');
  assert.equal(resultsCard.moreLine, null);
  assert.deepEqual(resultsCard.negative.map((line) => line.points), ['-30']);
  const preview = buildResultsShareCard({ standings: resultsCard.positive.map((line) => ({ id: line.id, name: line.name, points: 1, games: 1, place: 1 })), games: [], createdAtLabel: 'x' });
  assert.equal(preview.link, null, 'a preview has no page to link to');
  assert.equal(preview.code, undefined);
});

test('the full details carry the scores, the band table, the legend, the games block and the rounds', () => {
  const { standings, sheet } = presentResults([
    {
      id: 'g1',
      name: 'ALPHA',
      label: 'G7',
      date: '2026-10-28T15:00:00.000Z',
      players: ['a', 'b'],
      scores: { a: [20], b: [-20] },
      names: { a: 'Ada', b: 'Bea' },
    },
    {
      id: 'g2',
      name: 'BETA',
      label: 'G3',
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
    games: sheet.games.map((game) => ({ ...game, creatorName: 'Ada', adminNames: ['Bea'] })),
    resultId: '00000000-0000-4000-8000-0000000abcde',
    saved: true,
  });
  assert.deepEqual(details.table.rows.map((row) => row.name), ['Ada', 'Bea'], 'rows follow the ranked order');
  assert.deepEqual(details.table.header, [['G7', 'G3']], 'games keep their own numbers; the band is as wide as its two games');
  assert.equal(details.gameCount, 2);
  assert.equal(details.playerCount, 2, 'Ada played both games but is counted once');
  assert.equal(details.countLine, '2 games · 2 players');
  assert.equal(details.code, '0ABCDE');
  assert.equal(details.roundTables.length, 2);
  assert.deepEqual(details.roundTables[0].initials, ['AD', 'BE']);
  assert.deepEqual(details.roundTables[0].rows, [{ round: 1, cells: ['+20', '-20'] }]);
  assert.deepEqual(details.roundTables[0].totals, ['+20', '-20']);
  assert.deepEqual(details.roundTables[0].blocks[0].heads.map((head) => [head.initials, head.total]), [['AD', '+20'], ['BE', '-20']]);
  assert.equal(details.roundTables[1].totalsOnly, false);
  assert.deepEqual(details.table.rows[1].bands[0][1], { text: '—', tone: 'dash' });
  assert.deepEqual(details.table.rows[0].bands[0][0], { text: '+20', tone: 'win' });
  assert.equal(details.table.rows[0].total, '+25');
  assert.deepEqual(details.legend.map((entry) => entry.initials), ['AD', 'BE']);
  assert.equal(details.games[0].label, 'G7');
  assert.equal(details.games[0].code, 'ALPHA');
  assert.equal(details.games[0].creator, 'Ada');
  assert.deepEqual(details.games[0].admins, ['Bea']);
  assert.equal(details.games[0].start.time, clockOf('2026-10-28T15:00:00.000Z'));
  assert.match(details.games[0].start.date, /^\w+day, October 28$/);
  const html = resultsDetailsHtml(details);
  assert.match(html, /EZ Score: Rummy/);
  assert.match(html, /Saved Wed, Oct 28 · 6:40 PM/);
  assert.match(html, /2 games · 2 players/);
  assert.match(html, /<h2>Scores<\/h2>/);
  assert.match(html, /class="medal m1"/);
  assert.doesNotMatch(html, /Top 3|1st/, 'the Top 3 section is gone; medals carry the rank');
  assert.match(html, /How you got there/);
  assert.match(html, /class="box n2 head"/);
  assert.equal((html.match(/class="box n2"/g) ?? []).length, 2, 'one two-game band per player row');
  assert.match(html, /Games in this result/);
  assert.match(html, /<span class="when"><b>[^<]+<\/b> \w+day, October 28<\/span>/, 'time bold, then the date');
  assert.match(html, /<i class="gid">Game ID ALPHA<\/i>/, 'the game id is last and italic');
  assert.match(html, /Creator Ada · Admins Bea/);
  assert.match(html, /<table class="rb">/);
  assert.match(html, /font-size: 16px/);
  assert.match(html, /page-break-after: always/);
  assert.match(html, /ezscore\.mindweavetech\.com\/r\/00000000-0000-4000-8000-0000000abcde/);
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
    games: [{ id: 'g', name: 'ALPHA', label: 'G1', scores: {} }],
  });
  const pdf = new TextDecoder().decode(resultsDetailsPdf(many));
  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(pdf, /G1/);
  assert.match(pdf, /P00/);
  assert.match(pdf, /P49/);
  const pageCount = pdf.match(/\/Count (\d+)/);
  assert.ok(pageCount && Number(pageCount[1]) >= 2);
  assert.match(pdf, /Even: P00/);
});

test('only an admin of every selected game can declare', () => {
  assert.equal(canDeclareResults([host], 'host'), true);
  assert.equal(canDeclareResults([rita], 'host'), false);
  assert.equal(canDeclareResults([host, rita], 'host'), false);
  assert.equal(canDeclareResults([], 'host'), false);
  assert.equal(canDeclareResults([host], null), false);
});

test('game headers use h:mm with AM/PM (nov 10: upper case, always shown)', async () => {
  const { sheetGameLabel, gameLabelFor } = await import('@/utils/results');
  const d = new Date(2026, 9, 28, 22, 5);
  assert.equal(clockOf(d.toISOString()), '10:05 PM');
  assert.equal(clockOf(new Date(2026, 9, 28, 0, 7).toISOString()), '12:07 AM');
  assert.equal(clockOf(new Date(2026, 9, 28, 11, 51).toISOString()), '11:51 AM');
  // A game keeps its own number whatever position it has in a result.
  assert.equal(sheetGameLabel({ label: 'G7', name: 'ABC123' }), 'G7');
  assert.equal(sheetGameLabel({ name: 'ABC123' }), 'ABC123', 'older results without a stored number show the code, never a positional G1');
  assert.equal(gameLabelFor({ gameNumber: 7 }), 'S7');
  assert.equal(gameLabelFor({ gameNumber: 7, gameType: 'pool' }), 'P7');
  assert.equal(gameLabelFor({ gameNumber: 7, gameLabel: 'S2' }), 'S2', 'the server label wins');
  assert.equal(gameLabelFor({ gameNumber: null }), undefined);
});

import { closedSelectionWarning, resultsCountLine, resultsPdfFileName, resultsShowMode, selectableResultGames, summaryFrom as summaryOf, topThree } from '../utils/results';

test('round 2: show results saves only when every selected game is finished', () => {
  assert.equal(resultsShowMode([{ isComplete: true }, { isComplete: true }]), 'save');
  assert.equal(resultsShowMode([{ isComplete: true }, { isComplete: false }]), 'preview');
  assert.equal(resultsShowMode([]), 'preview');
});

test('build 3: the Results list keeps Closed games selectable and warns instead of blocking', () => {
  const listed = selectableResultGames([
    { id: 'open', closedAt: null },
    { id: 'done' },
    { id: 'closed', closedAt: '2026-10-29T10:00:00Z' },
  ]);
  assert.deepEqual(listed.map((g) => g.id), ['open', 'done', 'closed']);
  assert.equal(closedSelectionWarning([{ closedAt: null, gameNumber: 1 }, { gameNumber: 2 }]), null);
  const one = closedSelectionWarning([{ closedAt: '2026-10-29T10:00:00Z', gameNumber: 2 }, { gameNumber: 3 }]);
  assert.match(one!, /S2 is already counted/);
  assert.match(one!, /counts it twice/);
  const two = closedSelectionWarning([{ closedAt: '2026-10-29T10:00:00Z', gameNumber: 2 }, { closedAt: '2026-10-30T10:00:00Z', gameNumber: 5 }]);
  assert.match(two!, /S2 and S5 are already counted/);
});

test('round 2: past results carry the top 3, players, and games', () => {
  const standings = [
    { id: 'a', name: 'Ada', points: 30, games: 2, place: 1 },
    { id: 'b', name: 'Bea', points: 10, games: 2, place: 2 },
    { id: 'c', name: 'Cy', points: 0, games: 2, place: 3 },
    { id: 'd', name: 'Di', points: -40, games: 2, place: 4 },
  ];
  assert.deepEqual(topThree(standings).map((r) => r.name), ['Ada', 'Bea', 'Cy']);
  const summary = summaryOf({ id: 'r1', declaredAt: '2026-10-29T10:00:00Z', declaredBy: 'u', gameIds: ['g1', 'g2'], standings, sheet: { players: [], games: [] } });
  assert.equal(summary.playerCount, 4);
  assert.equal(summary.gameCount, 2);
  assert.equal(summary.top.length, 3);
  assert.equal(resultsCountLine(2, 4), '2 games · 4 players');
  assert.equal(resultsCountLine(1, 1), '1 game · 1 player');
});

test('round 2: the PDF has a readable name', () => {
  assert.equal(resultsPdfFileName(new Date(2026, 9, 29, 7, 5)), 'EZScore-Rummy-Results-2026-10-29-0705.pdf');
});

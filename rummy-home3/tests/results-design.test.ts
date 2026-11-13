import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildResultsDetails, buildRoundTable, RESULTS_DESIGN_CSS, resultsDetailsHtml, ROUND_BLOCK_SIZE } from '../utils/resultsDetails';
import {
  BAND_SIZE,
  bandRangesOf,
  buildBandTable,
  capSplit,
  evenLine,
  gamesInResult,
  gamesLine,
  generatedByLine,
  legendText,
  medalsFor,
  moreLine,
  playerSubline,
  rankScores,
  resultInitials,
  resultLinkText,
  SHARE_SIDE_CAP,
  startParts,
} from '../utils/resultsDesign';
import { presentResults } from '../utils/results';
import { buildResultsShareCard } from '../utils/shareCard';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

const players = [
  { id: 'h', name: 'Harish Gadupudi', playerNo: 2 },
  { id: 's', name: 'Sree Koneru', playerNo: 1 },
  { id: 'p1', name: 'Player 1', playerNo: 10 },
  { id: 'p2', name: 'Player 2', playerNo: null },
  { id: 'p4', name: 'Player 4', playerNo: 4 },
];

// Games carry their own number (S12 stays S12); the short code is separate.
const gameOf = (index: number, scores: Record<string, number>) => ({ id: `g${index}`, name: `C0DE${index}`, label: `S${index + 11}`, date: `2026-11-05T${String(10 + (index % 12)).padStart(2, '0')}:45:00`, scores });

const twoGames = [
  gameOf(1, { h: 80, p1: -20, s: -40 }),
  gameOf(2, { h: -60, p1: -40, p2: -120, p4: 160, s: 100 }),
];
const totals = { h: 20, s: 60, p1: -60, p2: -120, p4: 160 };
const standings = [
  { id: 'p4', name: 'Player 4', points: 160, games: 1, place: 1 },
  { id: 's', name: 'Sree Koneru', points: 60, games: 2, place: 2 },
  { id: 'h', name: 'Harish Gadupudi', points: 20, games: 2, place: 3 },
  { id: 'p1', name: 'Player 1', points: -60, games: 2, place: 4 },
  { id: 'p2', name: 'Player 2', points: -120, games: 1, place: 5 },
];

test('design: only positive totals are ranked; ties share a medal (two silvers, no bronze); negatives read closest to zero first', () => {
  assert.deepEqual([...medalsFor([{ id: 'a', points: 9 }, { id: 'b', points: 5 }, { id: 'c', points: 5 }, { id: 'd', points: 1 }]).entries()], [['a', 1], ['b', 2], ['c', 2]]);
  assert.deepEqual([...medalsFor([{ id: 'a', points: 9 }, { id: 'b', points: 9 }, { id: 'c', points: 5 }]).entries()], [['a', 1], ['b', 1], ['c', 3]]);
  assert.equal(medalsFor([]).size, 0);
  const ranked = rankScores(standings, players, resultInitials(players, twoGames));
  assert.deepEqual(ranked.positive.map((row) => [row.name, row.medal, row.sub]), [
    ['Player 4', 1, '#4 · PLY'],
    ['Sree Koneru', 2, '#1 · SK'],
    ['Harish Gadupudi', 3, '#2 · HG'],
  ]);
  assert.deepEqual(ranked.negative.map((row) => [row.text, row.sub]), [['-60', '#10 · PL'], ['-120', 'PLA']], 'closest to zero first; no Player ID → initials alone');
  assert.deepEqual(ranked.order, ['p4', 's', 'h', 'p1', 'p2']);
  assert.equal(evenLine(ranked.even), null);
  assert.equal(evenLine([{ name: 'Sree Koneru' }, { name: 'Harish' }]), 'Even: Sree, Harish');
  assert.equal(playerSubline('RK', { playerNo: 8 }), '#8 · RK', 'Player ID first, then the initials');
  assert.equal(playerSubline(undefined, { playerNo: 8 }), '#8');
});

test('design: the band table pads every band to five so the header box and each row box are the same shape', () => {
  assert.equal(BAND_SIZE, 5);
  assert.deepEqual(bandRangesOf(7), [{ start: 0, end: 5 }, { start: 5, end: 7 }]);
  assert.deepEqual(bandRangesOf(0), []);
  const seven = Array.from({ length: 7 }, (_, index) => gameOf(index + 1, { h: index % 2 ? 40 : -40, s: index % 2 ? -40 : 40 }));
  const table = buildBandTable({ games: seven, players, totals: { h: -40, s: 40 }, labels: resultInitials(players, seven), order: ['s', 'h', 'p1'] });
  assert.equal(table.bandCount, 2);
  assert.deepEqual(table.header, [['S12', 'S13', 'S14', 'S15', 'S16'], ['S17', 'S18', '', '', '']]);
  assert.deepEqual(table.rows.map((row) => row.initials), ['SK', 'HG', 'PL'], 'rows follow the ranked order');
  assert.equal(table.rows[0].total, '+40');
  assert.equal(table.rows[1].totalTone, 'neg');
  table.rows.forEach((row) => {
    assert.equal(row.bands.length, 2, 'every row has as many boxes as the header');
    row.bands.forEach((band) => assert.equal(band.length, BAND_SIZE, 'every box has five cells'));
  });
  assert.deepEqual(table.rows[0].bands[0].map((cell) => cell.tone), ['win', 'neg', 'win', 'neg', 'win']);
  assert.deepEqual(table.rows[0].bands[1].map((cell) => cell.tone), ['neg', 'win', 'blank', 'blank', 'blank']);
  assert.deepEqual(table.rows[2].bands[0][0], { text: '—', tone: 'dash' }, 'not seated is a dash');
  assert.equal(legendText({ initials: 'SK', playerNo: 1, name: 'Sree Koneru' }), 'SK #1 Sree Koneru');
  assert.equal(legendText({ initials: 'PLA', playerNo: null, name: 'Player 2' }), 'PLA Player 2');
});

test('design: "Games in this result" leads with the start time, then the date; the Game ID is last; creator and admins follow', () => {
  const now = new Date(2026, 10, 13);
  const parts = startParts('2026-11-05T19:45:00', now);
  assert.equal(parts.time, '7:45 PM');
  assert.equal(parts.date, 'Thursday, November 5');
  assert.equal(startParts('2025-11-05T19:45:00', now).date, 'Wednesday, November 5, 2025', 'a past year says so');
  assert.deepEqual(startParts(undefined), { time: '', date: '' });
  const [info] = gamesInResult([{ ...twoGames[1], rounds: { h: [1, 2, 3] }, creatorName: 'Sree Koneru', adminNames: ['Sree Koneru', 'Harish Gadupudi'], reused: true }], now);
  assert.equal(info.label, 'S13');
  assert.equal(info.code, 'C0DE2');
  assert.equal(info.playerCount, 5);
  assert.equal(info.roundCount, 3);
  assert.equal(info.creator, 'Sree Koneru');
  assert.equal(info.reused, true);
  const details = buildResultsDetails({ createdAtLabel: 'x', standings, players, games: [{ ...twoGames[1], creatorName: 'Sree Koneru', adminNames: ['Sree Koneru', 'Harish Gadupudi'] }], now });
  const html = resultsDetailsHtml(details);
  const block = html.slice(html.indexOf('<div class="gm">'), html.indexOf('</div></div>', html.indexOf('<div class="gm">')));
  assert.match(block, /<span class="lab">S13<\/span><span class="when"><b>\d+:\d\d [AP]M<\/b> \w+day, November 5<\/span>/, 'only the time is bold');
  assert.match(block, /5 players · <i class="gid">Game ID C0DE2<\/i>/, 'no rounds known → players only, then the id in italics');
  assert.match(block, /Creator Sree Koneru · Admins Harish Gadupudi/, 'the creator is not repeated under Admins');
  assert.ok(block.indexOf('class="when"') < block.indexOf('class="gid"'), 'time and date before the id');
});

test('design: the PDF pages run Scores → How you got there → Games → Round by round; seven games draw two boxes per row', () => {
  const seven = Array.from({ length: 7 }, (_, index) => ({ ...gameOf(index + 1, { h: 10, s: 10, p1: -20 }), rounds: { h: [10], s: [10], p1: [-20] } }));
  const sevenStandings = [
    { id: 's', name: 'Sree Koneru', points: 70, place: 1, games: 7 },
    { id: 'h', name: 'Harish Gadupudi', points: 70, place: 1, games: 7 },
    { id: 'p1', name: 'Player 1', points: -140, place: 3, games: 7 },
  ];
  const details = buildResultsDetails({ createdAtLabel: 'Wed, Nov 4 · 11:19 AM', standings: sevenStandings, players, games: seven, saved: true, resultId: '00000000-0000-4000-8000-00000000abcd', footer: 'Result ID · 00ABCD' });
  assert.equal(details.table.bandCount, 2);
  assert.deepEqual(details.scores.positive.map((row) => row.medal), [1, 1], 'a tie for first is two golds');
  const html = resultsDetailsHtml(details);
  const body = html.slice(html.indexOf('<body>'));
  const markers = ['Saved Wed, Nov 4 · 11:19 AM', '7 games · 3 players', '<h2>Scores</h2>', 'class="medal m1"', '<h2>How you got there', 'class="box head"', 'class="legend"', '<h2>Games in this result</h2>', '<span class="lab">S12</span>', '<h2>Round by round</h2>', '<table class="rb">']
    .map((marker) => body.indexOf(marker));
  assert.ok(markers.every((index) => index >= 0), `missing markers ${markers}`);
  assert.deepEqual(markers, [...markers].sort((a, b) => a - b), 'sections run top to bottom in the asked order');
  assert.equal((body.match(/class="box head"/g) ?? []).length, 2, 'two header boxes for seven games');
  assert.equal((body.match(/class="box"/g) ?? []).length, 6, 'two boxes for each of the three rows — the header shape repeated');
  assert.equal((body.match(/<div class="page">/g) ?? []).length, 4, 'four phone pages');
  assert.doesNotMatch(body, /Top 3/);
  assert.match(body, /00ABCD/);
  assert.match(body, /ezscore\.mindweavetech\.com\/r\/00000000-0000-4000-8000-00000000abcd/);
  assert.match(body, /class="c blank"/, 'the short band is padded, so the box keeps its shape');
});

test('design: round tables break into blocks of five players with the game total in the head under each player', () => {
  const twelve = Array.from({ length: 12 }, (_, index) => ({ id: `q${index}`, name: `Q${String(index).padStart(2, '0')} Name`, playerNo: 100 + index }));
  const game = { id: 'g', name: 'C0DE', label: 'S20', date: '2026-11-05T19:45:00', scores: Object.fromEntries(twelve.map((p, i) => [p.id, i - 6])), rounds: Object.fromEntries(twelve.map((p, i) => [p.id, [i - 6, 0]])) };
  const table = buildRoundTable(game, 0, twelve);
  assert.equal(ROUND_BLOCK_SIZE, 5);
  assert.equal(table.blocks.length, 3, '12 players → 5 + 5 + 2');
  assert.deepEqual(table.blocks.map((block) => block.heads.length), [5, 5, 2]);
  assert.equal(table.blocks[0].heads[0].total, '-6');
  assert.equal(table.blocks[0].heads[0].playerNo, 100);
  assert.deepEqual(table.blocks[2].rows[0].cells, ['+4', '+5']);
  assert.equal(table.start.time, '7:45 PM');
  const saved = buildRoundTable({ ...game, rounds: undefined }, 0, twelve);
  assert.equal(saved.totalsOnly, true, 'results saved before rounds were kept fall back to totals');
  assert.deepEqual(saved.rows, []);
  const html = resultsDetailsHtml(buildResultsDetails({ createdAtLabel: 'x', standings: twelve.map((p, i) => ({ id: p.id, name: p.name, points: i - 6, games: 1, place: 1 })), players: twelve, games: [game] }));
  assert.equal((html.match(/<table class="rb">/g) ?? []).length, 3);
  const heads = html.match(/<thead>.*?<\/thead>/g) ?? [];
  assert.equal(heads.length, 3);
  heads.forEach((head) => assert.ok((head.match(/<th>/g) ?? []).length <= ROUND_BLOCK_SIZE, 'no block is wider than five players'));
});

test('design: the share image is summary only — eight a side, "and N more", games line, generator initials, link', () => {
  assert.equal(SHARE_SIDE_CAP, 8);
  const many = Array.from({ length: 30 }, (_, index) => ({ id: `m${index}`, name: `M${index} Name`, points: index < 15 ? 500 - index * 10 : -(index - 14) * 10, games: 1, place: index + 1 }));
  const ranked = rankScores(many, many.map((row) => ({ id: row.id, name: row.name })), new Map());
  const capped = capSplit(ranked);
  assert.equal(capped.positive.length, 8);
  assert.equal(capped.negative.length, 8);
  assert.equal(capped.moreCount, 14);
  assert.equal(moreLine(14, true), 'and 14 more · full list in the link below');
  assert.equal(moreLine(14, false), 'and 14 more');
  assert.equal(moreLine(0, true), null);
  assert.equal(gamesLine(['S12', 'S13'], 'saved', 'Fri, Nov 13 · 9:58 PM'), 'Games S12, S13 · saved Fri, Nov 13 · 9:58 PM');
  assert.equal(gamesLine(['S12'], 'shown', 'x'), 'Game S12 · shown x');
  assert.equal(generatedByLine('Sree Koneru'), 'Generated by SK');
  assert.equal(generatedByLine('  '), null);
  assert.equal(resultLinkText('abc'), 'ezscore.mindweavetech.com/r/abc');
  const card = buildResultsShareCard({ standings: many, games: twoGames, createdAtLabel: 'Fri, Nov 13 · 9:58 PM', resultId: '11111111-0000-4000-8000-000000000000', generatedByName: 'Sree Koneru' });
  assert.equal(card.positive.length, 8);
  assert.equal(card.negative[0].points, '-10', 'closest to zero first on the image too');
  assert.equal(card.moreLine, 'and 14 more · full list in the link below');
  assert.ok(!('breakdown' in card), 'no per-game grid on the image');
  assert.ok(!JSON.stringify(card).includes('Sree Koneru'), 'the generator appears by initials only');
});

test('design: the /r/ web page carries the same CSS as the PDF, draws medals, bands and the edited / deleted states', () => {
  const page = src('public/r/index.html');
  // The band and medal rules are byte-identical between the PDF and the web page.
  ['.box {', '.box.head {', '.medal {', '.m1 {', '.pl {', '.gid {'].forEach((rule) => {
    const line = RESULTS_DESIGN_CSS.split('\n').find((candidate) => candidate.trim().startsWith(rule));
    assert.ok(line, `rule ${rule} in the CSS`);
    assert.ok(page.includes(line!.trim()), `web page shares the rule ${rule}`);
  });
  assert.match(page, /#15803D/);
  assert.doesNotMatch(page, /#FBF1E1|#17402F/, 'the parchment palette is gone');
  assert.match(page, /This result was edited/);
  assert.match(page, /This result was deleted/);
  assert.match(page, /@media \(min-width: 900px\)/, 'desktop unwraps the bands');
  assert.match(page, /p_version/);
  assert.match(page, /public_result/);
  assert.doesNotMatch(page, /Top 3|placeLabel/);
  const live = src('public/scorecard.html');
  assert.match(live, /blocks of|block/i);
  assert.match(live, /#15803D/);
});

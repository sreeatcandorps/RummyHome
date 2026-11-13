import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { totalAcrossGames, buildResultSheet, podiumPlaces } from '../utils/results';
import { buildResultsDetails, resultsDetailsHtml, resultsDetailsPdf } from '../utils/resultsDetails';
import { buildResultsShareCard, buildScoresCard } from '../utils/shareCard';
import { buildScorecardSheet } from '../utils/scorecardSheet';
import { buildFinalScoresSheet } from '../utils/finalScoresSheet';
import { sectionsByLetter, mergeSearchResults, sortMyPlayers, appendPage } from '../utils/myPlayersList';
import { rotationStarts, nextDealer, withDealer } from '../utils/dealerRotation';
import { scoreTone } from '../utils/scoreTone';
import { calculateFinalTotals } from '../utils/scoring';

/**
 * Volume tests for the app's own compute (final launch batch, item 9): the pure builders every
 * screen, PDF, share image and the web page use, fed the largest sizes the guardrails allow and
 * beyond. Timings print as TAP diagnostics; the bounds are loose (a phone is slower than this
 * VM, so anything near them is a finding, not a pass).
 */

const timings: string[] = [];
function timed<T>(label: string, fn: () => T, budgetMs: number): T {
  const t0 = performance.now();
  const out = fn();
  const ms = performance.now() - t0;
  timings.push(`${label}: ${ms.toFixed(1)} ms`);
  assert.ok(ms < budgetMs, `${label} took ${ms.toFixed(0)} ms (budget ${budgetMs} ms)`);
  return out;
}

const player = (i: number) => `p${String(i).padStart(2, '0')}`;
const name = (i: number) => `Guest ${String(i).padStart(5, '0')} ${String.fromCharCode(65 + ((i * 7) % 26))}name`;

/** One game of `seats` players and `rounds` rounds, one rummy winner per round, like ci/volume/volume.sql. */
function game(seats: number, rounds: number) {
  const players = Array.from({ length: seats }, (_, i) => player(i));
  const scores: Record<string, number[]> = Object.fromEntries(players.map((id) => [id, [] as number[]]));
  for (let r = 1; r <= rounds; r += 1) {
    const winner = (r * 7) % seats;
    let pot = 0;
    players.forEach((id, i) => {
      if (i === winner) return;
      const loss = 5 + ((r * 31 + i * 17) % 15) * 5;
      scores[id].push(-loss);
      pot += loss;
    });
    scores[players[winner]].splice(r - 1, 0, pot);
  }
  return { players, scores };
}

test('volume: one game with 2/10/20 players and 50/100/200/500 rounds (scorecard totals, dividers, colours, final-scores image)', () => {
  for (const seats of [2, 10, 20]) {
    for (const rounds of [50, 100, 200, 500]) {
      const g = game(seats, rounds);
      const label = `${seats}p × ${rounds}r`;
      const totals = timed(`totals ${label}`, () => calculateFinalTotals(g.scores), 50);
      assert.equal(Object.values(totals).reduce((a, b) => a + b, 0), 0, 'every round sums to zero');
      const dealerIds = Array.from({ length: rounds }, (_, i) => g.players[i % seats]);
      const starts = timed(`rotation dividers ${label}`, () => rotationStarts({ players: g.players, dealerIds }, rounds), 20);
      assert.equal(starts.length, Math.floor((rounds - 1) / seats), 'one divider per completed rotation');
      timed(`score tones ${label}`, () => g.players.forEach((id) => g.scores[id].forEach((v) => scoreTone(v, 80))), 50);
      const sheet = timed(`final-scores sheet ${label}`, () => buildFinalScoresSheet({
        game: { id: 'g', gameNumber: 3, date: '2026-11-12T10:00:00Z', isComplete: true },
        players: g.players.map((id, i) => ({ id, name: name(i) })),
        scores: g.scores,
      }), 200);
      assert.equal(sheet.players.length, seats);
      const card = timed(`scorecard sheet ${label}`, () => buildScorecardSheet({
        gameNumber: 3, gameLabel: 'S3', gameType: 'stake', when: 'Nov 12', isComplete: true,
        players: g.players.map((id, i) => ({ id, name: name(i) })), scores: g.scores,
      }), 200);
      assert.ok(card);
    }
  }
});

test('volume: results across 50 games × 20 players (standings, sheet, PDF, HTML, share image)', () => {
  const games = Array.from({ length: 50 }, (_, i) => {
    const g = game(20, 10);
    return {
      id: `g${i}`, name: `S${i + 1}`, label: `S${i + 1}`, date: new Date(Date.UTC(2026, 10, 1, i)).toISOString(),
      players: g.players, scores: g.scores,
      names: Object.fromEntries(g.players.map((id, j) => [id, name(j)])),
    };
  });
  const standings = timed('standings 50 × 20', () => totalAcrossGames(games), 100);
  assert.equal(standings.length, 20);
  assert.equal(podiumPlaces(standings).length >= 1, true);
  const sheet = timed('result sheet 50 × 20', () => buildResultSheet(games, standings), 100);
  assert.equal(sheet.games.length, 50);
  const details = timed('results details 50 × 20', () => buildResultsDetails({
    createdAtLabel: 'Thu, Nov 12 · 4:30 PM',
    standings,
    players: sheet.players.map((p, i) => ({ ...p, playerNo: 15000 + i })),
    games: sheet.games,
  }), 300);
  assert.equal(details.table.rows.length, 20);
  assert.equal(details.table.bandCount, 10, '50 games → 10 bands of 5');
  const html = timed('results HTML 50 × 20', () => resultsDetailsHtml(details), 300);
  assert.ok(html.length > 10_000, `HTML is ${html.length} chars`);
  const pdf = timed('results PDF 50 × 20', () => resultsDetailsPdf(details), 1500);
  assert.ok(pdf.byteLength > 10_000, `PDF is ${pdf.byteLength} bytes`);
  const image = timed('results share image 50 × 20', () => buildResultsShareCard({
    standings, games: sheet.games, players: sheet.players, createdAtLabel: 'Nov 12',
  }), 300);
  assert.ok(image.positive.length + image.negative.length > 0);
  timings.push(`results sizes: HTML ${(html.length / 1024).toFixed(0)} KB, PDF ${(pdf.byteLength / 1024).toFixed(0)} KB`);
  const single = timed('game share image 20p × 500r', () => buildScoresCard({
    title: 'Game S3', date: 'Nov 12',
    standings: Array.from({ length: 20 }, (_, i) => ({ id: player(i), name: name(i), points: 500 - i * 37, games: 1, place: i + 1 })),
  }), 100);
  assert.ok(single.positive.length > 0);
});

test('volume: My players with 100 / 1,000 / 10,000 rows (sections, sort, search merge, paging)', () => {
  for (const size of [100, 1000, 10000]) {
    const players = Array.from({ length: size }, (_, i) => ({
      id: `u${i}`, name: name(i), status: 'unregistered', gamesTogether: (i * 13) % 40, sortName: name(i).toLowerCase(),
    }));
    const sections = timed(`A-Z sections ${size}`, () => sectionsByLetter(players, 'me'), size >= 10000 ? 150 : 50);
    assert.equal(sections.reduce((n, s) => n + s.data.length, 0), size, 'every player is in exactly one section');
    const sorted = timed(`sort by name ${size}`, () => sortMyPlayers(players as any, 'name'), size >= 10000 ? 300 : 100);
    assert.equal(sorted.length, size);
    const merged = timed(`merge search ${size}`, () => mergeSearchResults(players.slice(0, 50), players.slice(25, 100)), 20);
    assert.equal(merged.length, 100, 'local and server hits merge without duplicates');
    let list: typeof players = [];
    timed(`append 100-row pages ${size}`, () => { for (let i = 0; i < size; i += 100) list = appendPage(list, players.slice(i, i + 100)); }, size >= 10000 ? 500 : 100);
    assert.equal(list.length, size);
  }
});

test('volume: 500 rounds of dealer rotation with players joining mid-game', () => {
  let g: { players: string[]; dealerIds: (string | null)[] } = { players: Array.from({ length: 9 }, (_, i) => player(i)), dealerIds: [] };
  timed('500 rounds of nextDealer/withDealer', () => {
    for (let r = 0; r < 500; r += 1) {
      if (r === 9) g = { ...g, players: [...g.players, player(9)] };
      if (r === 250) g = { ...g, players: [...g.players, player(10)] };
      g = { ...g, dealerIds: withDealer(g.dealerIds, r, nextDealer(g, r)) };
    }
  }, 100);
  const starts = rotationStarts(g, 500);
  assert.equal(starts[0], 10, 'the tenth player joined after round 9, so the first rotation is 10 rounds');
  assert.ok(starts.every((s, i) => i === 0 || s - starts[i - 1] >= 10), 'no rotation is shorter than the table');
});

test.after(() => {
  for (const line of timings) console.log(`# volume ${line}`);
});

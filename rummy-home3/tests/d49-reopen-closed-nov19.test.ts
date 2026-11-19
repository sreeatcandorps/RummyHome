import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { canReopenGame, reopenUncloses } from '../utils/gameStatus';
import { reopenClosedLines, RESULT_STALE_CHIP, resultStaleFrom, resultStaleLines, summaryFrom } from '../utils/results';

const src = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');
const when = (iso: string) => `WHEN(${iso})`;

// ---- D49 B (Sree, Nov 19): a Closed game can be reopened; its result stays as saved, marked Out of date ----

test('D49: the one Reopen door opens for a Closed game and says which reopen un-closes', () => {
  assert.equal(canReopenGame({ isComplete: true, closedAt: '2026-11-19T01:00:00Z' }), true);
  assert.equal(reopenUncloses({ closedAt: '2026-11-19T01:00:00Z' }), true);
  assert.equal(reopenUncloses({ closedAt: null }), false);
  assert.equal(reopenUncloses({}), false);
});

test('D49: the Reopen dialog names the result (date, ID, games, who) and its other games', () => {
  const lines = reopenClosedLines({
    id: '9a6f9b9e-5f8c-4b57-a1d6-1234567890ab',
    declaredAt: '2026-11-18T20:00:00Z',
    declaredByName: 'Sree',
    gameCount: 3,
    otherGameLabels: ['S4', 'P2'],
  }, when);
  assert.match(lines.body, /saved WHEN\(2026-11-18T20:00:00Z\)/);
  assert.match(lines.body, /ID 7890AB/, 'the same six characters the share footer prints');
  assert.match(lines.body, /3 games, by Sree/);
  assert.match(lines.body, /keeps the numbers it has now/);
  assert.match(lines.body, /Out of date/);
  assert.equal(lines.others, 'Its other games (S4, P2) go back to Completed too.');

  const one = reopenClosedLines({ id: 'r1', declaredAt: '2026-11-18T20:00:00Z', declaredByName: '', gameCount: 2, otherGameLabels: ['P1'] }, when);
  assert.match(one.body, /2 games\)/, 'no name: no ", by"');
  assert.equal(one.others, 'Its other game (P1) goes back to Completed too.');

  const alone = reopenClosedLines({ id: 'r1', declaredAt: '2026-11-18T20:00:00Z', declaredByName: 'Sree', gameCount: 1, otherGameLabels: [] }, when);
  assert.match(alone.body, /1 game, by Sree/);
  assert.equal(alone.others, null);

  const unknown = reopenClosedLines(null, when);
  assert.match(unknown.body, /part of a saved result/);
  assert.match(unknown.body, /Out of date/);
  assert.equal(unknown.others, null);
});

test('D49: the stamp is parsed from the RPC row and rides on the list summary', () => {
  assert.equal(resultStaleFrom({}), undefined);
  assert.equal(resultStaleFrom({ staleAt: null }), undefined);
  const stale = resultStaleFrom({ staleAt: '2026-11-19T02:00:00Z', staleByName: 'Sree', staleGameId: 'g1', staleGameLabel: 'S4' });
  assert.deepEqual(stale, { at: '2026-11-19T02:00:00Z', byName: 'Sree', gameId: 'g1', gameLabel: 'S4' });
  const summary = summaryFrom({ id: 'r', declaredAt: '2026-11-18T20:00:00Z', declaredBy: 'u', gameIds: ['g1'], standings: [], stale } as never);
  assert.deepEqual(summary.stale, stale);
  assert.equal(RESULT_STALE_CHIP, 'Out of date');
});

test('D49: the result page banner says what happened, that the numbers do not change, and what to do', () => {
  const lines = resultStaleLines({ at: '2026-11-19T02:00:00Z', byName: 'Sree', gameId: 'g1', gameLabel: 'S4' }, when);
  assert.equal(lines.title, 'Out of date');
  assert.match(lines.body, /^Game S4 was reopened WHEN\(2026-11-19T02:00:00Z\) by Sree, after this result was saved\./);
  assert.match(lines.body, /do not change/);
  assert.match(lines.next, /back to Completed/);
  assert.match(lines.next, /new result/);
  const noLabel = resultStaleLines({ at: '2026-11-19T02:00:00Z', byName: 'an admin' }, when);
  assert.match(noLabel.body, /^A game in this result was reopened/);
});

test('D49: screens — scorecard dialog, Results chip, result banner; service and migration do the bookkeeping', () => {
  const scorecard = src('app/(screens)/games/[id].tsx');
  assert.match(scorecard, /testID="game-menu-reopen"/);
  assert.match(scorecard, /Reopen this Closed game\?/);
  assert.match(scorecard, /testID="reopen-closed-note"/);
  assert.match(scorecard, /testID="reopen-open-result"/, 'the result page (where Delete lives) is one tap away');
  assert.match(scorecard, /testID="reopen-confirm"/);
  assert.match(scorecard, /'Reopen anyway' : 'Reopen'/);

  const list = src('app/(screens)/results/index.tsx');
  assert.match(list, /item\.stale \? <Tag label=\{RESULT_STALE_CHIP\} tone="warning"/);

  const page = src('app/(screens)/results/[id].tsx');
  assert.match(page, /<ResultStaleBanner[\s\S]*?stale=\{result\.stale\}/);
  const banner = src('components/results/ResultStaleBanner.tsx');
  assert.match(banner, /testID="result-stale-banner"/);
  assert.match(banner, /testID="result-stale-new"/);
  assert.match(banner, /testID="result-stale-delete"/);

  const games = src('services/games.ts');
  assert.doesNotMatch(games, /\.is\('closed_at', null\)/, 'the hosted update no longer refuses a Closed game');
  assert.match(games, /uncloses \? \{ closed_at: null \} : \{\}/);
  assert.match(games, /markStaleForReopen/, 'local store does the trigger work');

  const results = src('services/results.ts');
  assert.match(results, /rpc\('result_for_game'/);
  assert.match(results, /async markStaleForReopen/);

  const sql = src('supabase/migrations/050_reopen_closed_game.sql');
  assert.match(sql, /add column if not exists stale_at timestamptz/);
  assert.match(sql, /create trigger games_reopen_closed/);
  assert.match(sql, /drop trigger if exists games_closed_guard on public\.games/, 'the refusal is gone');
  assert.match(sql, /create trigger rounds_closed_guard/, 'scores still cannot change while Closed');
  assert.match(sql, /create trigger scores_closed_guard/);
  assert.match(sql, /function public\.result_for_game\(p_game_id uuid\)/);
  assert.match(sql, /is Out of date · its numbers do not change/, 'the Log row');
  const rollback = src('supabase/rollback/rollback_050_reopen_closed_game.sql');
  for (const needle of ['result_for_game', 'result_stale_json', 'drop column if exists stale_at']) assert.match(rollback, new RegExp(needle));
});

test('D49: help and decisions carry B and the simplicity principle', () => {
  const help = src('constants/helpTopics.ts');
  assert.match(help, /id: 'reopen-closed'/);
  assert.match(help, /\*\*Out of date\*\* on a result means one of its games was reopened/);
  assert.doesNotMatch(help, /reopen-blocked/);
  const decisions = src('docs/decisions.md');
  assert.match(decisions, /D49/);
  assert.match(decisions, /Out of date/);
  const agents = readFileSync(path.join(process.cwd(), '..', 'AGENTS.md'), 'utf8');
  assert.match(agents, /simple/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { dealerForRound, nextDealer, rotationStarts, withDealer } from '../utils/dealerRotation';
import { dealerIdsFrom } from '../utils/bundles';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

test('031: the deal follows the actual rotation; a player added mid-game makes the next rotation longer', () => {
  // Three seats, dealers stored A B C A B C; D joins after round 6.
  const abc = ['a', 'b', 'c'];
  const dealers = ['a', 'b', 'c', 'a', 'b', 'c'];
  assert.equal(nextDealer({ players: abc, dealerIds: dealers }, 6), 'a');
  const withD = [...abc, 'd'];
  assert.equal(nextDealer({ players: withD, dealerIds: dealers }, 6), 'd', 'D sits after C, so D deals round 7');
  const dealers7 = [...dealers, 'd'];
  assert.equal(nextDealer({ players: withD, dealerIds: dealers7 }, 7), 'a', 'then A again: that rotation was 4 rounds');
  const dealers11 = [...dealers7, 'a', 'b', 'c', 'd'];
  assert.equal(nextDealer({ players: withD, dealerIds: dealers11 }, 11), 'a');
  assert.deepEqual(rotationStarts({ players: withD, dealerIds: [...dealers11, 'a'] }, 12), [3, 7, 11], 'dividers above rounds 4, 8 and 12: 3, 4, then 4 rounds');

  // The brief's example: 9 players; a tenth joins after round 9 (the ninth player just dealt).
  // The tenth sits last, so they deal round 10 and the first rotation is 10 rounds; the next is 10 too.
  const nine = Array.from({ length: 9 }, (_, i) => `p${i}`);
  let game: { players: string[]; dealerIds: (string | null)[] } = { players: nine, dealerIds: [] };
  for (let round = 0; round < 9; round += 1) game = { ...game, dealerIds: withDealer(game.dealerIds, round, nextDealer(game, round)) };
  assert.deepEqual(game.dealerIds, nine);
  game = { ...game, players: [...nine, 'p9'] };
  assert.equal(nextDealer(game, 9), 'p9', 'the new player deals round 10');
  for (let round = 9; round < 20; round += 1) game = { ...game, dealerIds: withDealer(game.dealerIds, round, nextDealer(game, round)) };
  assert.equal(game.dealerIds[10], 'p0', 'p0 deals round 11: the second rotation starts there');
  assert.equal(game.dealerIds[19], 'p9');
  assert.deepEqual(rotationStarts({ ...game, dealerIds: withDealer(game.dealerIds, 20, nextDealer(game, 20)) }, 21), [10, 20], '10 rounds, then 10');

  // Added just after the first dealer dealt instead: 9 rounds, then 10.
  let late: { players: string[]; dealerIds: (string | null)[] } = { players: nine, dealerIds: [] };
  for (let round = 0; round < 10; round += 1) late = { ...late, dealerIds: withDealer(late.dealerIds, round, nextDealer(late, round)) };
  late = { ...late, players: [...nine, 'p9'] };
  for (let round = 10; round < 19; round += 1) late = { ...late, dealerIds: withDealer(late.dealerIds, round, nextDealer(late, round)) };
  assert.equal(late.dealerIds[18], 'p9', 'the tenth player deals round 19');
  assert.equal(nextDealer(late, 19), 'p0');
  assert.deepEqual(rotationStarts({ ...late, dealerIds: withDealer(late.dealerIds, 19, 'p0') }, 20), [9, 19], '9 rounds, then 10');
});

test('031: a dealer who left falls back to the seat-order rule; games before 031 behave as before', () => {
  const abc = ['a', 'b', 'c'];
  assert.equal(nextDealer({ players: abc, dealerIds: ['a', 'b', 'x'] }, 3), 'a', '(3 mod 3) = seat 0');
  assert.equal(nextDealer({ players: abc }, 4), 'b', 'no stored dealers: seat-order rule');
  assert.equal(dealerForRound({ players: abc }, 5), 'c');
  assert.equal(dealerForRound({ players: abc, dealerIds: [null, 'c'] }, 0), 'a', 'an unknown round uses the seat-order rule');
  assert.deepEqual(rotationStarts({ players: abc }, 7), [3, 6], 'a pre-031 game draws the line every N rounds');
  assert.deepEqual(rotationStarts({ players: abc }, 1), []);
  assert.equal(nextDealer({ players: [] }, 0), undefined);
  assert.deepEqual(withDealer(undefined, 2, 'c'), [null, null, 'c']);
});

test('031: dealers come from the bundle or the legacy rounds join; undone rounds are ignored', () => {
  assert.deepEqual(dealerIdsFrom({ '1': 'a', '2': 'b', '4': null }), ['a', 'b', null, null]);
  assert.deepEqual(dealerIdsFrom(null, [
    { rounds: { round_number: 2, undone_at: null, dealer_profile_id: 'b' } },
    { rounds: { round_number: 1, undone_at: null, dealer_profile_id: 'a' } },
    { rounds: { round_number: 1003, undone_at: '2025-11-01', dealer_profile_id: 'z' } },
  ]), ['a', 'b']);
  assert.equal(dealerIdsFrom(undefined, [{ rounds: { round_number: 1, undone_at: null } }]), undefined, 'a pre-031 select without the column leaves dealerIds unset');
  assert.equal(dealerIdsFrom(undefined, []), undefined);

  const service = src('services/games.ts');
  assert.match(service, /legacyGameFromServer\(bundle\.game, legacyScoreRows\(bundle\.scores\), bundle\.game_players \?\? \[\], bundle\.dealers\)/);
  assert.match(service, /rounds\(round_number, undone_at, dealer_profile_id\)/, 'the single-game legacy select carries the dealer');
  assert.match(service, /withDealer\(game\.dealerIds, roundIndex, nextDealer\(game, roundIndex\)\)/, 'local games store the dealer per round');

  const screen = src('app/(screens)/games/[id].tsx');
  assert.match(screen, /nextDealer\(rotation, maxRounds\)/);
  assert.match(screen, /rotationStarts=\{rotationStartRounds\}/);
  assert.doesNotMatch(screen, /seats\[roundIndex % seats\.length\]/, 'the fixed modulo rule is gone from the screen');

  const table = src('components/game/ScoreTable.tsx');
  assert.match(table, /rotationStart && \[styles\.rotationDivider, \{ borderTopColor: colors\.primary \}\]/);
  assert.equal((table.match(/rotationStart && \[styles\.rotationDivider/g) ?? []).length, 2, 'the line spans the round column and the score row');
  assert.match(table, /&& prev\.rotationStart === next\.rotationStart/, 'the memoised row redraws when the divider changes');

  for (const rel of ['web/scorecard.html', 'public/scorecard.html']) {
    const page = src(rel);
    assert.match(page, /tr\.rotation td \{ border-top: 2px solid/, `${rel}: divider style`);
    assert.match(page, /dealers\[String\(round\)\] === firstDealer \? ' class="rotation"'/, `${rel}: divider where the first dealer deals again`);
  }
  const migration = src('supabase/migrations/031_round_robin.sql');
  assert.match(migration, /v_dealer := v_players\[\(v_prev_pos % array_length\(v_players, 1\)\) \+ 1\];/, 'server: the seat after the previous dealer');
  assert.match(migration, /'dealers', v_dealers/);
  assert.match(migration, /'maxCount', \(g\.settings->>'maxCount'\)::integer/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { dealerForRound, nextDealer, roundRuleDealer, rotationStarts, withDealer } from '../utils/dealerRotation';
import { dealerIdsFrom } from '../utils/bundles';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

test('031 / 057: the deal follows the actual rotation, anticlockwise; a player added mid-game makes the next rotation longer', () => {
  // Three seats, dealers stored A C B A C B (057: the seat before the last dealer); D takes seat 4 after round 6.
  const abc = ['a', 'b', 'c'];
  const dealers = ['a', 'c', 'b', 'a', 'c', 'b'];
  assert.equal(nextDealer({ players: abc, dealerIds: dealers }, 6), 'a');
  const withD = [...abc, 'd'];
  assert.equal(nextDealer({ players: withD, dealerIds: dealers }, 6), 'a', 'A is still the seat before B');
  const dealers7 = [...dealers, 'a'];
  assert.equal(nextDealer({ players: withD, dealerIds: dealers7 }, 7), 'd', 'then D: the seat before A, round the circle');
  const dealers10 = [...dealers7, 'd', 'c', 'b'];
  assert.equal(nextDealer({ players: withD, dealerIds: dealers10 }, 10), 'a');
  assert.deepEqual(rotationStarts({ players: withD, dealerIds: [...dealers10, 'a'] }, 11), [3, 6, 10], 'dividers above rounds 4, 7 and 11: 3, 3, then 4 rounds');

  // The brief's example: 9 players; a tenth takes seat 10 after round 9. Seat 10 deals straight after seat 1,
  // so the first rotation is 9 rounds and the next is 10.
  const nine = Array.from({ length: 9 }, (_, i) => `p${i}`);
  let game: { players: string[]; dealerIds: (string | null)[] } = { players: nine, dealerIds: [] };
  for (let round = 0; round < 9; round += 1) game = { ...game, dealerIds: withDealer(game.dealerIds, round, nextDealer(game, round)) };
  assert.deepEqual(game.dealerIds, ['p0', 'p8', 'p7', 'p6', 'p5', 'p4', 'p3', 'p2', 'p1']);
  game = { ...game, players: [...nine, 'p9'] };
  assert.equal(nextDealer(game, 9), 'p0', 'p0 deals round 10: the second rotation starts there');
  for (let round = 9; round < 19; round += 1) game = { ...game, dealerIds: withDealer(game.dealerIds, round, nextDealer(game, round)) };
  assert.equal(game.dealerIds[10], 'p9', 'the new player deals round 11, straight after p0');
  assert.equal(game.dealerIds[18], 'p1');
  assert.deepEqual(rotationStarts({ ...game, dealerIds: withDealer(game.dealerIds, 19, nextDealer(game, 19)) }, 20), [9, 19], '9 rounds, then 10');
});

test('031 / 057: a dealer who left falls back to the round rule; saved rounds before 031 keep the seat-order rule', () => {
  const abc = ['a', 'b', 'c'];
  assert.equal(nextDealer({ players: abc, dealerIds: ['a', 'c', 'x'] }, 3), 'a', 'round 4 of 3 seats by the round rule: seat 1');
  assert.equal(nextDealer({ players: abc }, 4), 'c', 'no stored dealers: the round rule, seat 1 then 3 2 1 3 …');
  assert.equal(roundRuleDealer(abc, 0), 'a');
  assert.equal(roundRuleDealer(abc, 1), 'c');
  assert.equal(roundRuleDealer(abc, 2), 'b');
  assert.equal(roundRuleDealer([], 2), undefined);
  assert.equal(dealerForRound({ players: abc }, 5), 'c', 'a saved round with no stored dealer: who dealt it then');
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
  assert.match(service, /withDealer\(game\.dealerIds, roundIndex, nextDealer\(rotation, roundIndex\)\)/, 'local games store the dealer per round (052: the rotation skips out seats)');

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

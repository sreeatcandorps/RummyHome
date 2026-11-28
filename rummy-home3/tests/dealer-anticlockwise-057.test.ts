import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { HELP_TOPICS } from '../constants/helpTopics';
import { dealsAfter, nextDealer, opensFor, planJoin, planReentry, roundRuleDealer, withDealer } from '../utils/dealerRotation';
import { SEATING_STEPS } from '../utils/tutorials';

// Q63 (Sree, Nov 27): "the dealer always moves counterclockwise … whoever gets the open card gets to deal".
const read = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');
const SEATS = ['Ravi', 'Priya', 'Sunil', 'Kiran', 'Meena'];

/** Six rounds dealt by the app's rule, with who gets the first open card in each. */
function sixRounds(players: string[]) {
  let game: { players: string[]; dealerIds: (string | null)[] } = { players, dealerIds: [] };
  const opens: string[] = [];
  for (let round = 0; round < 6; round += 1) {
    const dealer = nextDealer(game, round);
    opens.push(opensFor(game, dealer)!);
    game = { ...game, dealerIds: withDealer(game.dealerIds, round, dealer) };
  }
  return { deals: game.dealerIds, opens };
}

test('057: the 5-player × 6-round table of docs/dealer-anticlockwise.md', () => {
  const { deals, opens } = sixRounds(SEATS);
  assert.deepEqual(deals, ['Ravi', 'Meena', 'Kiran', 'Sunil', 'Priya', 'Ravi']);
  assert.deepEqual(opens, ['Meena', 'Kiran', 'Sunil', 'Priya', 'Ravi', 'Meena']);
  for (let round = 1; round < 6; round += 1) assert.equal(deals[round], opens[round - 1], `round ${round + 1} is dealt by round ${round}'s first open card`);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((r) => roundRuleDealer(SEATS, r)), deals, 'the round rule gives the same table');
  const doc = read('docs/dealer-anticlockwise.md');
  assert.match(doc, /Ravi[^\n]*Meena[^\n]*Kiran[^\n]*Sunil[^\n]*Priya[^\n]*Ravi/, 'the doc shows the same deal order');
});

test('057: the deal skips a pool seat that is out, going down', () => {
  const pool = { players: SEATS, dealerIds: ['Ravi', 'Meena'], outIds: new Set(['Kiran']) };
  assert.equal(nextDealer(pool, 2), 'Sunil', 'Kiran (the seat before Meena) is out');
  assert.equal(dealsAfter(pool, 'Kiran'), 'Sunil', 'after an out seat, the next seat down that is in');
  assert.equal(dealsAfter({ players: SEATS, outIds: new Set(['Meena']) }, 'Ravi'), 'Kiran', 'below seat 1 wraps to the highest seat still in');
});

test('057: the dealer\'s left is the seat after the dealer — cards last, deals last; nobody else\'s turn moves', () => {
  const g = { players: SEATS, dealerIds: ['Ravi', 'Meena', 'Kiran', 'Sunil', 'Priya', 'Ravi'] };
  assert.equal(nextDealer(g, 6), 'Meena');
  // The doc's worked example: rounds 1-2 played (Ravi, Meena); Kiran deals round 3 and Tara joins.
  const tara = planJoin({ ...g, dealerIds: g.dealerIds.slice(0, 2) }, 2, 'Tara');
  assert.equal(tara.dealer, 'Kiran');
  assert.deepEqual(tara.players, ['Ravi', 'Priya', 'Sunil', 'Kiran', 'Tara', 'Meena'], 'Tara takes seat 5, after Kiran');
  let game: { players: string[]; dealerIds: (string | null)[]; nextDealerOverride: typeof tara.nextDealerOverride } = { players: tara.players, dealerIds: g.dealerIds.slice(0, 2), nextDealerOverride: tara.nextDealerOverride };
  const later: string[] = [];
  const opens: string[] = [];
  for (let round = 2; round < 9; round += 1) {
    const dealer = nextDealer(game, round)!;
    later.push(dealer);
    opens.push(opensFor(game, dealer)!);
    game = { ...game, dealerIds: withDealer(game.dealerIds, round, dealer), nextDealerOverride: game.nextDealerOverride?.round === round + 1 ? null : game.nextDealerOverride };
  }
  assert.deepEqual(later, ['Kiran', 'Sunil', 'Priya', 'Ravi', 'Meena', 'Tara', 'Kiran'], 'Kiran keeps round 3; Tara deals last, round 8');
  assert.equal(opens[0], 'Sunil', 'she does not get the first open card of round 3');
  assert.equal(opens[4], 'Tara', 'she opens round 7, then deals round 8');

  const back = planReentry({ players: SEATS, dealerIds: ['Ravi', 'Meena'], outIds: new Set(['Priya']), nextDealerOverride: null }, 2, 'Priya');
  assert.equal(back.dealer, 'Kiran');
  assert.deepEqual(back.players, ['Ravi', 'Sunil', 'Kiran', 'Priya', 'Meena'], 'a re-entry sits after the dealer too');
  assert.equal(back.dealersLeft, true);
});

test('057: help and the seating tutorial say the deal follows the open card', () => {
  const help = JSON.stringify(HELP_TOPICS);
  assert.doesNotMatch(help, /moves up one seat/, 'D58\'s "up one seat" is gone');
  assert.match(help, /the highest seat gets the first open card and deals round 2/);
  assert.match(help, /After each round the deal moves anticlockwise to the player who got the first open card/);
  assert.equal(SEATING_STEPS[0].line, 'One card each. The lowest card deals; the highest card gets the first open card and deals next.');
});

test('057: several joiners are seated last pick first, so they read in pick order', () => {
  const screen = read('app/(screens)/games/new.tsx');
  assert.match(screen, /for \(const pickRow of joinOrder\(staged\.filter\(\(p\) => !savedIds\.has\(p\.id\)\), playedRounds\(game\.scores\)\)\)/);
  assert.match(read('utils/addPlayers.ts'), /for \(const joiner of joinOrder\(joiners, roundCount\)\)/, 'the notice plans them the same way');
});

test('057: migration, rollback and replay — written, not applied; same signatures', () => {
  const sql = read('supabase/migrations/057_dealer_anticlockwise.sql');
  assert.match(sql, /Written, not applied to live/);
  assert.match(sql, /create or replace function public\.round_rule_dealer\(p_rotation uuid\[\], p_round integer\)/);
  assert.match(sql, /revoke all on function public\.round_rule_dealer\(uuid\[\], integer\) from public, anon, authenticated;/);
  assert.match(sql, /return p_rotation\[\(\(v_pos - 2 \+ v_n\) % v_n\) \+ 1\];/, 'next_in_rotation: the seat before');
  for (const fn of ['save_round(\n  p_game_id uuid', 'set_seating_order(p_game_id uuid, p_profile_ids uuid[])', 'add_seated_player(p_game_id uuid, p_profile_id uuid, p_label text default null)', 'reenter_player(p_game_id uuid, p_profile_id uuid, p_seat integer default null)']) {
    assert.ok(sql.includes(`create or replace function public.${fn}`), fn);
  }
  assert.ok(!/drop\s+table|delete\s+from|alter\s+table|drop\s+function/i.test(sql), 'functions only, nothing dropped');
  const rollback = read('supabase/rollback/rollback_057_dealer_anticlockwise.sql');
  assert.match(rollback, /drop function if exists public\.round_rule_dealer\(uuid\[\], integer\);/);
  for (const fn of ['next_in_rotation', 'save_round', 'set_seating_order', 'add_seated_player', 'reenter_player']) assert.match(rollback, new RegExp(`create or replace function public\\.${fn}\\(`), fn);
  const hook = read('../ci/db/replay-rollbacks.sh');
  assert.ok(hook.includes('rollback_057_dealer_anticlockwise.sql') && hook.includes('057_dealer_anticlockwise'));
  assert.ok(read('supabase/tests/46_dealer_anticlockwise_057.sql').includes('select plan('));
});

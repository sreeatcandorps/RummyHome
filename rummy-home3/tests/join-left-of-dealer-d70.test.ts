import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { dealsAfter, joinOrder, nextDealer, planJoin } from '../utils/dealerRotation';
import { joinSeatNotice } from '../utils/addPlayers';

const read = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');
const names: Record<string, string> = { A: 'Anu', B: 'Bala', C: 'Chitra', D: 'Dev', N: 'Ravi', R: 'Kiran' };
const nameOf = (id: string) => names[id] ?? '?';
const table = (dealerIds: string[], extra: Record<string, unknown> = {}) => ({ players: ['A', 'B', 'C', 'D'], dealerIds, ...extra });

/** The next `count` dealers after `roundCount` rounds, the way save_round deals them (057: anticlockwise). */
function dealsFrom(game: ReturnType<typeof table>, roundCount: number, count: number): string[] {
  const out: string[] = [];
  let dealer = nextDealer(game, roundCount);
  for (let i = 0; i < count; i += 1) {
    out.push(dealer!);
    dealer = dealsAfter(game, dealer);
  }
  return out;
}

test('D70: before round 1 the newcomer takes the last seat and nothing is pinned', () => {
  const plan = planJoin(table([]), 0, 'N');
  assert.deepEqual(plan.players, ['A', 'B', 'C', 'D', 'N']);
  assert.equal(plan.seat, 4);
  assert.equal(plan.dealer, undefined);
  assert.equal(plan.nextDealerOverride, null);
});

test('D70 / 057: dealer in the middle — the newcomer sits between the dealer and the seat after, and the dealer keeps the deal', () => {
  const g = table(['A', 'D']);
  assert.equal(nextDealer(g, 2), 'C');
  const plan = planJoin(g, 2, 'N');
  assert.deepEqual(plan.players, ['A', 'B', 'C', 'N', 'D'], 'seat 4, the dealer\'s left; D moves up one');
  assert.equal(plan.seat, 3);
  assert.deepEqual(plan.nextDealerOverride, { playerId: 'C', round: 3, keepsSequence: false }, 'N is now the seat before D, so C is pinned');
  const after = { ...g, players: plan.players, nextDealerOverride: plan.nextDealerOverride };
  assert.deepEqual(dealsFrom(after, 2, 5), ['C', 'B', 'A', 'D', 'N'], 'nobody\'s turn moves; N deals last');
});

test('D70 / 057: dealer at seat 1 — the newcomer takes seat 2', () => {
  const g = table(['A', 'D', 'C', 'B']);
  assert.equal(nextDealer(g, 4), 'A');
  const plan = planJoin(g, 4, 'N');
  assert.deepEqual(plan.players, ['A', 'N', 'B', 'C', 'D']);
  assert.deepEqual(plan.nextDealerOverride, { playerId: 'A', round: 5, keepsSequence: false });
  const after = { ...g, players: plan.players, nextDealerOverride: plan.nextDealerOverride };
  assert.deepEqual(dealsFrom(after, 4, 5), ['A', 'D', 'C', 'B', 'N']);
});

test('D70 / 057: dealer at the last seat — the newcomer takes the new last seat, nobody\'s number moves', () => {
  const g = table(['A']);
  assert.equal(nextDealer(g, 1), 'D');
  const plan = planJoin(g, 1, 'N');
  assert.deepEqual(plan.players, ['A', 'B', 'C', 'D', 'N']);
  assert.deepEqual(plan.nextDealerOverride, { playerId: 'D', round: 2, keepsSequence: false }, 'N is now the seat before A, so D is pinned');
  const after = { ...g, players: plan.players, nextDealerOverride: plan.nextDealerOverride };
  assert.deepEqual(dealsFrom(after, 1, 5), ['D', 'C', 'B', 'A', 'N']);
});

test('D70: a second newcomer also sits straight after the dealer, so picks are seated last first; a Dealer-sheet choice is kept', () => {
  const g = table(['A', 'D']);
  const first = planJoin(g, 2, 'N');
  const second = planJoin({ ...g, players: first.players, nextDealerOverride: first.nextDealerOverride }, 2, 'R');
  assert.deepEqual(second.players, ['A', 'B', 'C', 'R', 'N', 'D']);
  assert.deepEqual(second.nextDealerOverride, { playerId: 'C', round: 3, keepsSequence: false });
  assert.deepEqual(joinOrder(['N', 'R'], 2), ['R', 'N'], 'seated R then N, they read N R');
  assert.deepEqual(joinOrder(['N', 'R'], 0), ['N', 'R'], 'before round 1 each takes the last seat in pick order');
  let seated: Parameters<typeof planJoin>[0] = g;
  for (const id of joinOrder(['N', 'R'], 2)) {
    const plan = planJoin(seated, 2, id);
    seated = { ...seated, players: plan.players, nextDealerOverride: plan.nextDealerOverride };
  }
  assert.deepEqual(seated.players, ['A', 'B', 'C', 'N', 'R', 'D']);

  const sheet = table(['A'], { nextDealerOverride: { playerId: 'B', round: 2, keepsSequence: false } });
  const plan = planJoin(sheet, 1, 'N');
  assert.equal(plan.dealer, 'B', 'the dealer named on the Dealer sheet');
  assert.deepEqual(plan.players, ['A', 'B', 'N', 'C', 'D']);
  assert.deepEqual(plan.nextDealerOverride, { playerId: 'B', round: 2, keepsSequence: false }, 'unchanged');
});

test('D70: pool — a seat that is out is skipped, never removed; the newcomer still sits to the dealer\'s left', () => {
  const g = { players: ['A', 'B', 'C'], dealerIds: ['A', 'C'], outIds: new Set(['B']) };
  assert.equal(nextDealer(g, 2), 'A', 'C dealt round 2; B, the seat before, is out');
  const plan = planJoin(g, 2, 'N');
  assert.deepEqual(plan.players, ['A', 'N', 'B', 'C']);
  assert.deepEqual(plan.nextDealerOverride, { playerId: 'A', round: 3, keepsSequence: false });
  assert.equal(nextDealer({ ...g, players: plan.players, nextDealerOverride: plan.nextDealerOverride }, 2), 'A');
});

test('D70: the notice names the seat and the two neighbours', () => {
  const ravi = [{ id: 'N', name: 'Ravi' }];
  assert.equal(joinSeatNotice(table(['A', 'D']), 2, ravi, nameOf), 'Ravi sits at seat 4, between Chitra and Dev — left of the dealer.');
  assert.equal(joinSeatNotice(table(['A', 'D', 'C', 'B']), 4, ravi, nameOf), 'Ravi sits at seat 2, between Anu and Bala — left of the dealer.', 'dealer at seat 1');
  assert.equal(joinSeatNotice(table(['A']), 1, ravi, nameOf), 'Ravi sits at seat 5, between Dev and Anu — left of the dealer.', 'dealer at the last seat: round the circle');
  assert.equal(
    joinSeatNotice(table(['A', 'D']), 2, [{ id: 'N', name: 'Ravi' }, { id: 'R', name: 'Kiran' }], nameOf),
    'Ravi and Kiran sit at seats 4–5, between Chitra and Dev — left of the dealer.',
  );
  assert.equal(joinSeatNotice(table([]), 0, ravi, nameOf), null, 'before round 1: no notice, the last seat');
  assert.equal(joinSeatNotice(table(['A', 'D']), 2, [], nameOf), null, 'nobody new picked');
});

test('D70: 054 replaces the add_seated_player seat; the app, the tip and help agree', () => {
  const sql = read('supabase/migrations/054_join_left_of_dealer.sql');
  assert.match(sql, /create or replace function public\.add_seated_player\(p_game_id uuid, p_profile_id uuid, p_label text default null\)/);
  assert.match(sql, /security definer\s+set search_path = public, pg_temp/);
  assert.match(sql, /v_next := v_dealer_order;/, 'the newcomer takes the dealer\'s seat; the dealer moves up one');
  assert.match(sql, /next_dealer_profile_id = v_dealing, next_dealer_round = v_live \+ 1, next_dealer_keeps_sequence = false/, 'the dealer keeps this round');
  assert.match(sql, /revoke all on function public\.add_seated_player\(uuid, uuid, text\) from public, anon;/);
  assert.match(sql, /grant execute on function public\.add_seated_player\(uuid, uuid, text\) to authenticated;/);
  assert.doesNotMatch(sql, /create or replace function public\.reenter_player/, 're-entry is not changed');
  assert.match(read('supabase/rollback/rollback_054_join_left_of_dealer.sql'), /052 \(D57\)/, 'the rollback restores the 052 body');
  assert.match(read('services/games.ts'), /const join = planJoin\(rotation, playedRounds\(game\.scores\), profileId\);/, 'a local game seats the same way');
  assert.match(read('app/(screens)/games/new.tsx'), /testID="join-seat-notice"/);
  assert.match(read('app/(screens)/games/players.tsx'), /A player added now sits to the dealer\\u2019s left and deals last\./);
  const help = read('constants/helpTopics.ts');
  assert.match(help, /a new player sits to the dealer\\u2019s left and deals last/);
  assert.doesNotMatch(help, /dealer\\'s seat \+ 1/);
});

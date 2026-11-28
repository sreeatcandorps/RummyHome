import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { dealsAfter, nextDealer, opensFor, planDealerChange, plannedDealer, rotationOf } from '../utils/dealerRotation';
import { cardSays, consequenceLine, dealerUnchanged, nextRoundChip } from '../utils/dealerSheet';
import { dotTone, kindLabel } from '../utils/eventLog';

const read = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');

// Sree's table: A B C D in seats 1..4; since 057 (Q63) the deal moves anticlockwise — to the seat before the
// dealer, the player who got the first open card: A D C B A …
const ini = (id: string | undefined) => id ?? '—';
const game = (dealerIds: string[], extra: Record<string, unknown> = {}) => ({ players: ['A', 'B', 'C', 'D'], dealerIds, ...extra });

test('052 D58 / 057: the deal goes to the seat before the dealer, who got the open card; an out seat is skipped both ways', () => {
  const g = game(['A', 'D', 'C', 'B', 'A']);
  assert.equal(nextDealer(g, 5), 'D');
  assert.equal(opensFor(g, 'D'), 'C');
  assert.equal(opensFor(g, 'A'), 'D', 'seat 1 opens for seat 4 — the circle wraps');
  const pool = { ...game(['A', 'D', 'C', 'B', 'A', 'D']), outIds: new Set(['C']) };
  assert.deepEqual(rotationOf(pool), ['A', 'B', 'D']);
  assert.equal(nextDealer(pool, 6), 'B', 'C is out: the seat before D still in');
  assert.equal(opensFor(pool, 'D'), 'B', 'and the open card skips C too');
  assert.equal(dealsAfter(pool, 'C'), 'B', 'after an out dealer, the next seat down that is in');
  assert.equal(nextDealer({ ...pool, dealerIds: ['A', 'D', 'C', 'B', 'A', 'C'] }, 6), 'B', 'the last dealer went out: the next seat down still in');
});

test('052 D60: the override names who deals the round being played, for that round only', () => {
  const g = game(['A', 'D', 'C', 'B', 'A'], { nextDealerOverride: { playerId: 'C', round: 6, keepsSequence: false } });
  assert.equal(plannedDealer(g, 5), 'D');
  assert.equal(nextDealer(g, 5), 'C');
  assert.equal(nextDealer({ ...g, nextDealerOverride: { playerId: 'C', round: 7, keepsSequence: false } }, 5), 'D', 'an override for another round is ignored');
  assert.equal(nextDealer({ ...g, outIds: new Set(['C']) }, 5), 'D', 'an override naming an out seat is ignored');
});

test('052 planDealerChange: the next round, follow vs this round only', () => {
  const g = game(['A', 'D', 'C', 'B', 'A']); // round 6 planned: D deals, C opens
  const follow = planDealerChange(g, 5, { round: 6, dealerId: 'B', follow: true });
  assert.deepEqual(follow.nextDealerOverride, { playerId: 'B', round: 6, keepsSequence: false });
  assert.deepEqual(follow.after, { round: 7, dealer: 'A', opens: 'D' }, 'round 7 follows from B');
  const keep = planDealerChange(g, 5, { round: 6, dealerId: 'B', follow: false });
  assert.deepEqual(keep.nextDealerOverride, { playerId: 'B', round: 6, keepsSequence: true });
  assert.deepEqual(keep.after, { round: 7, dealer: 'C', opens: 'B' }, 'round 7 goes on as if D had dealt 6');
  const same = planDealerChange(g, 5, { round: 6, dealerId: 'D', follow: true });
  assert.equal(same.nextDealerOverride, null, 'the planned dealer with follow clears any override');
});

test('052 planDealerChange: a played round, follow re-deals the later rounds; this round only touches one', () => {
  const g = game(['A', 'D', 'C', 'B', 'A']);
  const follow = planDealerChange(g, 5, { round: 2, dealerId: 'C', follow: true });
  assert.deepEqual(follow.dealerIds, ['A', 'C', 'B', 'A', 'D']);
  assert.deepEqual(follow.after, { round: 6, dealer: 'C', opens: 'B' });
  assert.equal(follow.nextDealerOverride, null);
  const keep = planDealerChange(g, 5, { round: 2, dealerId: 'C', follow: false });
  assert.deepEqual(keep.dealerIds, ['A', 'C', 'C', 'B', 'A']);
  assert.deepEqual(keep.after, { round: 6, dealer: 'D', opens: 'C' }, 'the next round is untouched');
});

test('052 planDealerChange: the last round, this round only, carries the card\u2019s sequence into the next round', () => {
  const g = game(['A', 'D', 'C', 'B', 'A']);
  const keep = planDealerChange(g, 5, { round: 5, dealerId: 'C', follow: false });
  assert.deepEqual(keep.dealerIds, ['A', 'D', 'C', 'B', 'C']);
  assert.deepEqual(keep.nextDealerOverride, { playerId: 'D', round: 6, keepsSequence: false }, 'round 6 stays D, the seat before the A the card had');
  assert.deepEqual(keep.after, { round: 6, dealer: 'D', opens: 'C' });
  const follow = planDealerChange(g, 5, { round: 5, dealerId: 'C', follow: true });
  assert.deepEqual(follow.after, { round: 6, dealer: 'B', opens: 'A' });
});

test('052 the sheet\u2019s lines: card says, consequences, nothing-to-save', () => {
  const g = game(['A', 'D', 'C', 'B', 'A']);
  assert.equal(nextRoundChip(6), 'Next · 6');
  assert.equal(cardSays(g, 5, 6, ini), 'Card says: Round 6 · D deals · C opens');
  assert.equal(cardSays(g, 5, 2, ini), 'Card says: Round 2 · D deals · C opens');
  assert.equal(consequenceLine(g, 5, { round: 6, dealerId: 'B', follow: true }, ini), 'Round 7: A deals, D opens');
  assert.equal(consequenceLine(g, 5, { round: 6, dealerId: 'B', follow: false }, ini), 'Round 7: C deals, B opens · only round 6 changes');
  assert.equal(consequenceLine(g, 5, { round: 2, dealerId: 'C', follow: true }, ini), 'Round 6: C deals, B opens · rounds 3–5 re-dealt');
  assert.equal(consequenceLine(g, 5, { round: 5, dealerId: 'C', follow: false }, ini), 'Round 6: D deals, C opens · only round 5 changes');
  assert.equal(dealerUnchanged(g, 5, { round: 6, dealerId: 'D', follow: true }), true, 'the planned dealer, follow: nothing to save');
  assert.equal(dealerUnchanged(g, 5, { round: 6, dealerId: 'D', follow: false }), false, 'the planned dealer, this round only: saved as a change');
  assert.equal(dealerUnchanged(g, 5, { round: 6, dealerId: 'B', follow: true }), false);
  assert.equal(dealerUnchanged(g, 5, { round: 2, dealerId: 'D', follow: false }), true, 'a played round, same dealer, this round only');
  assert.equal(dealerUnchanged(g, 5, { round: 2, dealerId: 'D', follow: true }), true, 'same dealer, follow, nothing drifted');
  assert.equal(dealerUnchanged(game(['A', 'D', 'A', 'A', 'A']), 5, { round: 2, dealerId: 'D', follow: true }), false, 'same dealer, follow, later rounds drifted: re-deals them');
  const withOverride = game(['A', 'D', 'C', 'B', 'A'], { nextDealerOverride: { playerId: 'C', round: 6, keepsSequence: false } });
  assert.equal(dealerUnchanged(withOverride, 5, { round: 6, dealerId: 'C', follow: true }), true);
});

test('052 the pieces are wired: menu item, DEALS badge opens the sheet, OPENS tag, Log kind, migration, help', () => {
  const screen = read('app/(screens)/games/[id].tsx');
  assert.match(screen, /title=\{DEALER_MENU_ITEM\}[^\n]*testID="game-menu-dealer"/);
  assert.match(screen, /onDealerPress=\{chrome\.taps && canChangeSeating\(game, canScoreNow\) \? \(\) => setDealerSheet\(true\) : undefined\}/);
  assert.match(screen, /opensId=\{opensId\}/);
  assert.match(screen, /<DealerSheet/);
  assert.match(screen, /gamesService\.setRoundDealer\(game\.id, change\)/);
  const table = read('components/game/ScoreTable.tsx');
  assert.match(table, /testID="score-deals-badge"/);
  assert.match(table, /testID="score-opens-badge"/);
  const sheet = read('components/game/DealerSheet.tsx');
  for (const id of ['dealer-sheet', 'dealer-round-next', 'dealer-card-says', 'dealer-follow', 'dealer-keep', 'dealer-cancel', 'dealer-done']) assert.match(sheet, new RegExp(`testID="${id}"`), id);
  assert.match(sheet, /testID=\{`dealer-round-\$\{n\}`\}/);
  assert.match(sheet, /testID=\{`dealer-pick-\$\{ini\(id\)\}`\}/);
  assert.equal(kindLabel('dealer_changed'), 'Dealer');
  assert.equal(dotTone({ kind: 'dealer_changed', level: 'important' } as any), 'amber');
  const sql = read('supabase/migrations/052_dealer.sql');
  assert.match(sql, /'dealer_changed'\)\);/, 'the kind is in the constraint');
  assert.match(sql, /create or replace function public\.set_round_dealer\(p_game_id uuid, p_round_number integer, p_dealer uuid, p_follow boolean default true\)/);
  assert.match(sql, /next_dealer_profile_id/);
  assert.match(sql, /v_dealing := public\.current_dealer\(p_game_id\);/, 'D57: the newcomer sits after whoever is dealing');
  assert.match(read('supabase/rollback/rollback_052_dealer.sql'), /drop function if exists public\.set_round_dealer/);
  const service = read('services/games.ts');
  assert.match(service, /supabase\.rpc\('set_round_dealer', \{ p_game_id: gameId, p_round_number: change\.round, p_dealer: change\.dealerId, p_follow: change\.follow \}\)/);
  assert.match(service, /nextDealerOverride: game\.next_dealer_profile_id/);
  const help = read('constants/helpTopics.ts');
  assert.match(help, /item: 'Dealer', does: 'Pick any round/);
  assert.match(help, /Someone joins mid-game: they sit to the dealer\\'s left, so they deal last/);
});

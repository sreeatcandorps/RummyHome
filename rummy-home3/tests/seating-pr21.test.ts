import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  canChangeSeating,
  EVERY_PLAYER_NEEDS_A_SEAT,
  isPermutation,
  midGameSeatingNote,
  nextDealerFor,
  placeAt,
  sameOrder,
  SEATING_MENU_SUBLINE,
  seatingSubline,
  seatRowHeight,
  seatRowLabel,
  stepSeat,
} from '../utils/seating';
import { withStoredPointsRules } from '../utils/gameSettings';
import { GameSettings } from '../types/game';

const read = (file: string) => readFileSync(path.join(__dirname, '..', file), 'utf8');
const four = ['sree', 'harish', 'priya', 'zed'];
const DEFAULT_POINTS_SETTINGS = { gameType: 'stake', dropAmount: -10, mdAmount: -30, maxCount: -80, expense: false } as unknown as GameSettings;

// ---------- X21-1: placing and stepping ----------
test('placeAt moves a player to a seat and shifts the rows between', () => {
  assert.deepEqual(placeAt(four, 'zed', 0), ['zed', 'sree', 'harish', 'priya']);
  assert.deepEqual(placeAt(four, 'sree', 3), ['harish', 'priya', 'zed', 'sree']);
  assert.deepEqual(placeAt(four, 'harish', 2), ['sree', 'priya', 'harish', 'zed']);
  assert.deepEqual(placeAt(four, 'harish', 1), four, 'same seat is a no-op');
  assert.deepEqual(placeAt(four, 'nobody', 1), four, 'unknown player is a no-op');
  assert.deepEqual(placeAt(four, 'sree', 99), ['harish', 'priya', 'zed', 'sree'], 'clamps to the last seat');
  assert.deepEqual(placeAt(four, 'zed', -5), ['zed', 'sree', 'harish', 'priya'], 'clamps to seat 1');
  assert.notEqual(placeAt(four, 'zed', 0), four, 'returns a new array');
});

test('stepSeat moves one seat and stops at the ends', () => {
  assert.deepEqual(stepSeat(four, 'harish', -1), ['harish', 'sree', 'priya', 'zed']);
  assert.deepEqual(stepSeat(four, 'harish', 1), ['sree', 'priya', 'harish', 'zed']);
  assert.deepEqual(stepSeat(four, 'sree', -1), four, 'seat 1 cannot go up');
  assert.deepEqual(stepSeat(four, 'zed', 1), four, 'the last seat cannot go down');
});

test('a 20-player order stays a permutation through many moves', () => {
  const twenty = Array.from({ length: 20 }, (_, i) => `p${i + 1}`);
  let order = twenty;
  for (let i = 0; i < 200; i += 1) {
    const id = twenty[(i * 7) % 20];
    order = i % 3 === 0 ? stepSeat(order, id, i % 2 ? 1 : -1) : placeAt(order, id, (i * 11) % 20);
    assert.ok(isPermutation(twenty, order), `still every player once after move ${i}`);
  }
  assert.deepEqual(placeAt(twenty, 'p20', 0)[0], 'p20');
  assert.equal(placeAt(twenty, 'p20', 0)[19], 'p19');
});

test('sameOrder and isPermutation', () => {
  assert.ok(sameOrder(four, [...four]));
  assert.ok(!sameOrder(four, ['sree', 'priya', 'harish', 'zed']));
  assert.ok(isPermutation(four, ['zed', 'priya', 'harish', 'sree']));
  assert.ok(!isPermutation(four, ['sree', 'sree', 'harish', 'zed']), 'a duplicate is not a permutation');
  assert.ok(!isPermutation(four, ['sree', 'harish', 'priya']), 'a missing player is not');
  assert.ok(!isPermutation(four, [...four, 'viewer']), 'an extra one is not');
  assert.equal(EVERY_PLAYER_NEEDS_A_SEAT, 'Every player needs a seat.');
});

test('row sizes: 48 dp at every count (v12 point 6 — the Android minimum touch target; the list scrolls)', () => {
  for (const n of [4, 8, 9, 16, 20]) assert.equal(seatRowHeight(n), 48);
});

// ---------- X21-2 (PR 24): the once-per-game pop-up is gone; the order is a New game step ----------
test('no pop-up: the scorecard never prompts, new games carry seatingPrompted true, the gate is gone', () => {
  const seating = read('utils/seating.ts');
  assert.ok(!seating.includes('shouldPromptSeating'), 'PR 24: no pop-up gate');
  assert.ok(!seating.includes('showsPlayerChips'), 'PR 24: no Players chip column');
  const games = read('services/games.ts');
  assert.match(games, /seatingPrompted: true/, 'a new game owes no pop-up: its order was set before Start');
  assert.ok(!games.includes('markSeatingPrompted'), 'nothing flips the flag any more');
});

test('the menu item: admins on Active games only (Q21.7)', () => {
  assert.ok(canChangeSeating({ isComplete: false }, true));
  assert.ok(!canChangeSeating({ isComplete: false }, false));
  assert.ok(!canChangeSeating({ isComplete: true }, true), 'completed games lock the order');
  assert.ok(!canChangeSeating({ isComplete: false, closedAt: '2026-11-15' }, true));
  assert.ok(!canChangeSeating({ isComplete: false, deletedAt: '2026-11-15' }, true));
  assert.ok(!canChangeSeating(null, true));
});

test('copy: sublines, the mid-game note, row labels', () => {
  assert.equal(seatingSubline({ pool: false, seatCount: 4, outCount: 0 }), SEATING_MENU_SUBLINE);
  assert.equal(seatingSubline({ pool: true, seatCount: 6, outCount: 1 }), 'Pool · 6 seats · 1 out');
  assert.equal(seatingSubline({ pool: true, seatCount: 20, outCount: 19 }), 'Pool · 20 seats · 19 out');
  assert.equal(midGameSeatingNote(0), null);
  assert.match(midGameSeatingNote(1)!, /^1 round played\./);
  assert.match(midGameSeatingNote(30)!, /^30 rounds played\. Saved rounds keep their dealers/);
  assert.equal(seatRowLabel({ seat: 3, name: 'Harish Gadupudi', dealsNext: true, out: true }), 'Seat 3, Harish Gadupudi, deals next, out');
  assert.equal(seatRowLabel({ seat: null, name: 'Sree', dealsNext: false }), 'Not numbered, Sree');
  assert.ok(!read('utils/seating.ts').includes('Keep this order'), 'PR 24: no "Keep this order"');
});

// ---------- X21-3: who deals next under the new order ----------
test('nextDealerFor: seat 1 with no rounds, the seat before the last dealer otherwise (057, anticlockwise)', () => {
  assert.equal(nextDealerFor(four, [], 0), 'sree');
  assert.equal(nextDealerFor(['zed', ...four.slice(0, 3)], [], 0), 'zed', 'moving someone to seat 1 makes them deal round 1');
  assert.equal(nextDealerFor(four, ['sree', 'zed'], 2), 'priya', 'round 3: the seat before the round 2 dealer');
  assert.equal(nextDealerFor(['sree', 'priya', 'harish', 'zed'], ['sree', 'zed'], 2), 'harish', 'under the new order Harish sits at 3, so he deals next');
  assert.equal(nextDealerFor(four, ['sree', 'zed', 'priya', 'harish'], 4), 'sree', 'wraps around');
  assert.equal(nextDealerFor([], [], 0), undefined);
});

test('nextDealerFor in a pool skips players who are out (041 save_round)', () => {
  const out = new Set(['priya']);
  assert.equal(nextDealerFor(four, ['sree', 'zed'], 2, out), 'harish', 'Priya is out, so the deal skips to Harish');
  assert.equal(nextDealerFor(four, ['sree', 'zed', 'priya'], 3, out), 'harish', 'the last dealer went out this round: the next seat down still in');
  assert.equal(nextDealerFor(['priya', 'sree', 'harish', 'zed'], ['zed', 'harish', 'sree'], 3, out), 'zed', 'wrapping past an out seat');
  assert.equal(nextDealerFor(four, [], 0, new Set(four)), undefined, 'everyone out: nobody deals');
});

test('withStoredPointsRules carries seatingPrompted from the stored settings (bookkeeping the Log ignores)', () => {
  const base = withStoredPointsRules(DEFAULT_POINTS_SETTINGS, { dropAmount: -10, mdAmount: -30, maxCount: -80, seatingPrompted: false });
  assert.equal(base.seatingPrompted, false, 'a game from the PR 21 build keeps false');
  assert.equal(withStoredPointsRules(DEFAULT_POINTS_SETTINGS, { seatingPrompted: true }).seatingPrompted, true);
  assert.equal(withStoredPointsRules(DEFAULT_POINTS_SETTINGS, { dropAmount: -10 }).seatingPrompted, undefined, 'older games have no key');
});

// ---------- the wiring ----------
test('createGame seats players in the Order of players, and the RPC path is set_seating_order', () => {
  const games = read('services/games.ts');
  assert.match(games, /supabase\.rpc\('set_seating_order'/, 'the sheet and the arrows go through the RPC');
  assert.match(games, /async setSeatingOrder\(gameId: string, order: string\[\]\)/);
  assert.match(read('app/(screens)/games/new.tsx'), /newGameSeats\(displayOrder\(order\)\)/, 'PR 24: the seats are the order built on the step');
  assert.ok(!/from\('game_players'\)\s*\.update\(\{\s*player_order/.test(games), 'no client-side player_order writes remain');
});

test('the scorecard: the ⋮ item and the full-page circle (D138), no pop-up; Players · Admins arrows mid-game', () => {
  const scorecard = read('app/(screens)/games/[id].tsx');
  assert.ok(!scorecard.includes('shouldPromptSeating'), 'PR 24: no pop-up');
  assert.match(scorecard, /testID="game-menu-seating"/);
  assert.match(scorecard, /<SeatingSheet/);
  assert.ok(!scorecard.includes('markSeatingPrompted'));
  const players = read('app/(screens)/games/players.tsx');
  assert.ok(!/every\(\(column\) => \(column\?\.length \?\? 0\) === 0\)/.test(players), 'the arrows no longer need zero rounds');
  const sheet = read('components/game/SeatingSheet.tsx');
  for (const id of ['seating-sheet', 'seating-done', 'seating-cancel', 'seating-clear']) assert.match(sheet, new RegExp(`testID="${id}"`), id);
  assert.ok(!sheet.includes('seating-chips') && !sheet.includes('seat-chip-'), 'PR 24: the Players chip column is gone');
  assert.ok(!sheet.includes('Keep this order'));
  const list = read('components/game/OrderOfPlayers.tsx');
  // D138: the circle. Discs keep -row- / -label- / -no-; name and #ID moved into the middle card (-selected-, -flash-).
  for (const id of ['-row-', '-no-', '-number-', '-up-', '-down-', '-label-', '-selected', '-flash', '-flash-name', '-flash-seat', '-flash-deals', '-highest-card', '-deal-direction']) assert.match(list, new RegExp(`testID=\\{\`\\$\\{testIDPrefix\\}${id}`), id);
  assert.match(list, /testID=\{`\$\{testIDPrefix\}-deals-next`\}/);
});

test('the Log knows the new kind and the migration ignores the pop-up flag', () => {
  assert.match(read('utils/eventLog.ts'), /seating_changed: 'Seating'/);
  const migration = read('supabase/migrations/044_seating_order.sql');
  assert.match(migration, /'seating_changed'\)\);/, 'the kind is in the constraint');
  assert.match(migration, /create or replace function public\.set_seating_order\(p_game_id uuid, p_profile_ids uuid\[\]\)/);
  assert.match(migration, /where k <> 'seatingPrompted'/, 'marking the pop-up seen never logs a settings change');
  assert.match(migration, /\(public\.initials_candidates\(ps->>'name'\)\)\[1\]/, 'Log initials fall back to the scorecard default (022)');
  assert.match(read('constants/helpTopics.ts'), /\*\*Order of players\*\*: set before Start by tapping players from the highest card to the lowest/);
});

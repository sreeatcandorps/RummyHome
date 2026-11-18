import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  canChangeSeating,
  EVERY_PLAYER_NEEDS_A_SEAT,
  isPermutation,
  KEEP_THIS_ORDER,
  midGameSeatingNote,
  nextDealerFor,
  pickedCounter,
  pickedUpText,
  placeAt,
  sameOrder,
  SEATING_MENU_SUBLINE,
  SEATING_POPUP_SUBLINE,
  seatingSubline,
  seatRowHeight,
  seatRowLabel,
  shouldPromptSeating,
  showsPlayerChips,
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

test('row sizes: 40 dp to 8 players, 32 to 16, 30 at 17–20; chips on wide layouts', () => {
  assert.equal(seatRowHeight(4), 40);
  assert.equal(seatRowHeight(8), 40);
  assert.equal(seatRowHeight(9), 32);
  assert.equal(seatRowHeight(16), 32);
  assert.equal(seatRowHeight(20), 30);
  const phone = { width: 360, height: 780 };
  assert.ok(!showsPlayerChips(4, phone), 'four players on a phone: rows only');
  assert.ok(showsPlayerChips(8, phone), 'eight players: the Players column');
  assert.ok(showsPlayerChips(20, phone));
  assert.ok(showsPlayerChips(4, { width: 780, height: 360 }), 'landscape');
  assert.ok(showsPlayerChips(4, { width: 800, height: 1200 }), 'tablet');
});

// ---------- X21-2: when the pop-up shows ----------
test('the pop-up: once per game, admins, ≥ 2 seats, no rounds, the flag still false', () => {
  const fresh = { isComplete: false, settings: { seatingPrompted: false } };
  assert.ok(shouldPromptSeating({ game: fresh, canScore: true, seatCount: 4, roundCount: 0 }));
  assert.ok(!shouldPromptSeating({ game: fresh, canScore: false, seatCount: 4, roundCount: 0 }), 'a player or viewer never sees it');
  assert.ok(!shouldPromptSeating({ game: fresh, canScore: true, seatCount: 1, roundCount: 0 }), 'one seat has nothing to order');
  assert.ok(!shouldPromptSeating({ game: fresh, canScore: true, seatCount: 4, roundCount: 1 }), 'a saved round closes the window');
  assert.ok(!shouldPromptSeating({ game: { ...fresh, settings: { seatingPrompted: true } }, canScore: true, seatCount: 4, roundCount: 0 }), 'answered once');
  assert.ok(!shouldPromptSeating({ game: { isComplete: false, settings: {} }, canScore: true, seatCount: 4, roundCount: 0 }), 'older games (no flag) never pop');
  assert.ok(!shouldPromptSeating({ game: { isComplete: false, settings: null }, canScore: true, seatCount: 4, roundCount: 0 }));
  assert.ok(!shouldPromptSeating({ game: { ...fresh, isComplete: true }, canScore: true, seatCount: 4, roundCount: 0 }), 'completed');
  assert.ok(!shouldPromptSeating({ game: { ...fresh, deletedAt: '2026-11-15' }, canScore: true, seatCount: 4, roundCount: 0 }), 'deleted');
  assert.ok(!shouldPromptSeating({ game: null, canScore: true, seatCount: 4, roundCount: 0 }));
});

test('the menu item: admins on Active games only (Q21.7)', () => {
  assert.ok(canChangeSeating({ isComplete: false }, true));
  assert.ok(!canChangeSeating({ isComplete: false }, false));
  assert.ok(!canChangeSeating({ isComplete: true }, true), 'completed games lock the order');
  assert.ok(!canChangeSeating({ isComplete: false, closedAt: '2026-11-15' }, true));
  assert.ok(!canChangeSeating({ isComplete: false, deletedAt: '2026-11-15' }, true));
  assert.ok(!canChangeSeating(null, true));
});

test('copy: sublines, the mid-game note, picked-up text, row labels', () => {
  assert.equal(seatingSubline({ pool: false, seatCount: 4, outCount: 0, fromMenu: false }), SEATING_POPUP_SUBLINE);
  assert.equal(seatingSubline({ pool: false, seatCount: 4, outCount: 0, fromMenu: true }), SEATING_MENU_SUBLINE);
  assert.equal(seatingSubline({ pool: true, seatCount: 6, outCount: 1, fromMenu: true }), 'Pool · 6 seats · 1 out');
  assert.equal(seatingSubline({ pool: true, seatCount: 20, outCount: 19, fromMenu: false }), 'Pool · 20 seats · 19 out');
  assert.equal(midGameSeatingNote(0), null);
  assert.match(midGameSeatingNote(1)!, /^1 round played\./);
  assert.match(midGameSeatingNote(30)!, /^30 rounds played\. Saved rounds keep their dealers/);
  assert.equal(pickedUpText('Zed Zero'), 'Zed Zero picked up — choose a seat');
  assert.equal(pickedCounter(false, 8), 'Picked up 0 · Seated 8');
  assert.equal(pickedCounter(true, 8), 'Picked up 1 · Seated 7');
  assert.equal(seatRowLabel({ seat: 3, name: 'Harish Gadupudi', dealsNext: true, out: true }), 'Seat 3, Harish Gadupudi, deals next, out');
  assert.equal(seatRowLabel({ seat: 1, name: 'Sree', dealsNext: false, picked: true }), 'Seat 1, Sree, picked up');
  assert.equal(KEEP_THIS_ORDER, 'Keep this order');
});

// ---------- X21-3: who deals next under the new order ----------
test('nextDealerFor: seat 1 with no rounds, the seat after the last dealer otherwise', () => {
  assert.equal(nextDealerFor(four, [], 0), 'sree');
  assert.equal(nextDealerFor(['zed', ...four.slice(0, 3)], [], 0), 'zed', 'moving someone to seat 1 makes them deal round 1');
  assert.equal(nextDealerFor(four, ['sree', 'harish'], 2), 'priya', 'round 3: the seat after round 2 dealer');
  assert.equal(nextDealerFor(['sree', 'priya', 'harish', 'zed'], ['sree', 'harish'], 2), 'zed', 'under the new order Harish sits at 3, so Zed deals next');
  assert.equal(nextDealerFor(four, ['sree', 'harish', 'priya', 'zed'], 4), 'sree', 'wraps around');
  assert.equal(nextDealerFor([], [], 0), undefined);
});

test('nextDealerFor in a pool skips players who are out (041 save_round)', () => {
  const out = new Set(['priya']);
  assert.equal(nextDealerFor(four, ['sree', 'harish'], 2, out), 'zed', 'Priya is out, so the deal skips to Zed');
  assert.equal(nextDealerFor(four, ['sree', 'harish', 'priya'], 3, out), 'zed', 'the last dealer went out this round: the next seat still in');
  assert.equal(nextDealerFor(['zed', 'sree', 'harish', 'priya'], ['sree', 'harish', 'priya'], 3, out), 'zed', 'wrapping past an out seat');
  assert.equal(nextDealerFor(four, [], 0, new Set(four)), undefined, 'everyone out: nobody deals');
});

test('withStoredPointsRules carries seatingPrompted from the stored settings (the gate reads game.settings)', () => {
  const base = withStoredPointsRules(DEFAULT_POINTS_SETTINGS, { dropAmount: -10, mdAmount: -30, maxCount: -80, seatingPrompted: false });
  assert.equal(base.seatingPrompted, false, 'a fresh game keeps false');
  assert.equal(withStoredPointsRules(DEFAULT_POINTS_SETTINGS, { seatingPrompted: true }).seatingPrompted, true);
  assert.equal(withStoredPointsRules(DEFAULT_POINTS_SETTINGS, { dropAmount: -10 }).seatingPrompted, undefined, 'older games have no key');
  assert.ok(shouldPromptSeating({ game: { isComplete: false, settings: base }, canScore: true, seatCount: 4, roundCount: 0 }), 'so the pop-up gate opens for a fresh game');
});

// ---------- the wiring ----------
test('createGame writes seatingPrompted false, and the RPC path is set_seating_order', () => {
  const games = read('services/games.ts');
  assert.match(games, /seatingPrompted: false/, 'new games carry the pop-up flag');
  assert.match(games, /supabase\.rpc\('set_seating_order'/, 'the sheet and the arrows go through the RPC');
  assert.match(games, /async markSeatingPrompted\(gameId: string\)/);
  assert.match(games, /async setSeatingOrder\(gameId: string, order: string\[\]\)/);
  assert.ok(!/from\('game_players'\)\s*\.update\(\{\s*player_order/.test(games), 'no client-side player_order writes remain');
});

test('the scorecard: pop-up gating, the ⋮ item, the sheet; Players · Admins arrows mid-game', () => {
  const scorecard = read('app/(screens)/games/[id].tsx');
  assert.match(scorecard, /shouldPromptSeating\(/);
  assert.match(scorecard, /testID="game-menu-seating"/);
  assert.match(scorecard, /<SeatingSheet/);
  assert.match(scorecard, /markSeatingPrompted\(/);
  const players = read('app/(screens)/games/players.tsx');
  assert.ok(!/every\(\(column\) => \(column\?\.length \?\? 0\) === 0\)/.test(players), 'the arrows no longer need zero rounds');
  const sheet = read('components/game/SeatingSheet.tsx');
  for (const id of ['seating-sheet', 'seating-done', 'seating-cancel', 'seat-deals-next', 'seating-chips']) assert.match(sheet, new RegExp(`testID="${id}"`), id);
  for (const id of ['seat-row-', 'seat-name-', 'seat-up-', 'seat-down-', 'seat-chip-']) assert.match(sheet, new RegExp(`testID={\`${id}`), id);
});

test('the Log knows the new kind and the migration ignores the pop-up flag', () => {
  assert.match(read('utils/eventLog.ts'), /seating_changed: 'Seating'/);
  const migration = read('supabase/migrations/044_seating_order.sql');
  assert.match(migration, /'seating_changed'\)\);/, 'the kind is in the constraint');
  assert.match(migration, /create or replace function public\.set_seating_order\(p_game_id uuid, p_profile_ids uuid\[\]\)/);
  assert.match(migration, /where k <> 'seatingPrompted'/, 'marking the pop-up seen never logs a settings change');
  assert.match(migration, /\(public\.initials_candidates\(ps->>'name'\)\)\[1\]/, 'Log initials fall back to the scorecard default (022)');
  assert.match(read('constants/helpTopics.ts'), /\*\*Seating order\*\*: after Start the app asks who sits where/);
});

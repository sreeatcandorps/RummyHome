import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Game } from '../types/game';
import { nextDealer, planReentry } from '../utils/dealerRotation';
import { afterRound } from '../utils/pool';
import { revealOffset } from '../utils/sheetScroll';
import { backInLine, planGameReentry, reentrySeatHint, reentrySeatLine, reentrySeatWarning, roundSavedSummary, seatLeftOf, shortNames } from '../utils/reentrySeat';

// design-review-2 §10.6 / D139, mirrored for 057 (the deal moves anticlockwise). Seats 1 Sree · 2 Harish (out) ·
// 3 Venkat (out) · 4 Priya · 5 Anil; rounds 1-2 dealt by Sree and Anil, so Priya deals round 3 (the pictures'
// "round 8").
const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');
const NAMES: Record<string, string> = { S: 'Sree Koneru', A: 'Anil Sharma', P: 'Priya Kumar', V: 'Venkat Rao', H: 'Harish Gadupudi' };
const nameOf = (id: string) => NAMES[id] ?? id;
const short = shortNames(Object.keys(NAMES), nameOf);
const SEATS = ['S', 'H', 'V', 'P', 'A'];
const table = (players = SEATS, out = ['V', 'H'], dealerIds = ['S', 'A']) => ({ players, dealerIds, outIds: new Set(out), nextDealerOverride: null });

test('D139 / 057 planReentry: by default he sits on the dealer\'s left (the seat after), the dealer keeps the round, he deals last', () => {
  const plan = planReentry(table(), 2, 'H');
  assert.deepEqual(plan.players, ['S', 'V', 'P', 'H', 'A'], 'seat 4, between Priya and Anil; Venkat and Priya move down one');
  assert.equal(plan.from, 1);
  assert.equal(plan.seat, 3);
  assert.equal(plan.defaultSeat, 3);
  assert.equal(plan.dealer, 'P');
  assert.equal(plan.opens, 'S', 'the seat before the dealer opens (D58), and deals next');
  assert.equal(plan.dealersLeft, true);
  assert.equal(plan.round, 3);
  assert.equal(plan.firstDeal, 6, 'Priya 3, Sree 4, Anil 5, Harish 6: last in the cycle');
  assert.deepEqual(plan.nextDealerOverride, { playerId: 'P', round: 3, keepsSequence: false }, 'pinned: he now sits straight before the last dealer');
});

test('D139 planReentry: Keep seat 2 is today\'s behaviour; a tap on a name sits him on that person\'s left', () => {
  const keep = planReentry(table(), 2, 'H', 1);
  assert.deepEqual(keep.players, SEATS);
  assert.equal(keep.dealersLeft, false);
  assert.equal(keep.opens, 'H', 'only Venkat (out) between him and Priya: he gets the open card');
  assert.equal(keep.firstDeal, 4, 'he deals straight after coming back');
  assert.equal(keep.nextDealerOverride, null, 'no pin: the plan is unchanged');

  assert.equal(seatLeftOf(SEATS, 'H', 'A'), 4);
  const anil = planReentry(table(), 2, 'H', seatLeftOf(SEATS, 'H', 'A'));
  assert.deepEqual(anil.players, ['S', 'V', 'P', 'A', 'H']);
  assert.equal(anil.opens, 'S');
  assert.equal(anil.firstDeal, 5, 'Priya 3, Sree 4, Harish 5');
  assert.equal(anil.nextDealerOverride, null);

  assert.equal(seatLeftOf(SEATS, 'H', 'P'), 3, 'a tap on the dealer is the default seat');
  assert.equal(seatLeftOf(SEATS, 'H', 'S'), 1, 'left of seat 1 is seat 2');
  assert.throws(() => planReentry(table(), 2, 'H', 5), /Seat must be 1 to 5\./);
  assert.throws(() => planReentry(table(), 2, 'H', -1), /Seat must be 1 to 5\./);
});

test('D139 planReentry: the dealer at the last seat → the seat after him, round the end; already on the dealer\'s left → no move', () => {
  // Sree Harish Anil; Harish out in round 1; Anil dealt round 2, Sree round 3, so Anil (seat 3) deals round 4.
  const last = planReentry({ players: ['S', 'H', 'A'], dealerIds: ['S', 'A', 'S'], outIds: new Set(['H']), nextDealerOverride: null }, 3, 'H');
  assert.deepEqual(last.players, ['S', 'A', 'H']);
  assert.equal(last.dealer, 'A');
  assert.equal(last.dealersLeft, true);
  assert.deepEqual(last.nextDealerOverride, { playerId: 'A', round: 4, keepsSequence: false });

  // Sree Anil Venkat Harish Priya, Priya dealt round 2: Anil deals round 3, only Venkat (out) between him and Harish.
  const there = planReentry(table(['S', 'A', 'V', 'H', 'P'], ['V', 'H'], ['S', 'P']), 2, 'H');
  assert.equal(there.dealer, 'A');
  assert.deepEqual(there.players, ['S', 'A', 'V', 'H', 'P']);
  assert.equal(there.seat, there.from);
  assert.equal(there.defaultSeat, there.from, 'so the sheet offers no Keep seat');
  assert.equal(there.dealersLeft, true);
});

test('D139 planReentry: two re-entries in a row sit side by side; a Dealer-sheet override is the dealer', () => {
  const first = planReentry(table(), 2, 'H');
  const second = planReentry({ ...table(first.players, ['V']), nextDealerOverride: first.nextDealerOverride }, 2, 'V');
  assert.deepEqual(second.players, ['S', 'P', 'V', 'H', 'A'], 'Venkat sits between the dealer and Harish');
  assert.equal(second.dealer, 'P');

  const sheet = planReentry({ ...table(), nextDealerOverride: { playerId: 'S', round: 3, keepsSequence: false } }, 2, 'H');
  assert.equal(sheet.dealer, 'S', 'Sree really deals round 3 (D60)');
  assert.deepEqual(sheet.players, SEATS, 'seat 2 is Sree\'s left: Harish is already there');
});

test('D139 the seat line names the seat and the two players still in beside it; another seat warns, never refuses', () => {
  const out = new Set(['V', 'H']);
  const plan = planReentry(table(), 2, 'H');
  assert.equal(reentrySeatLine(plan, 'H', out, short), 'Harish sits at seat 4, between Priya and Anil — left of the dealer.');
  assert.equal(reentrySeatHint(plan, 'H', out, 96, short), 'Harish comes back at 96, gets cards last in round 3 and deals last, after Anil. Tap a name to sit on that person\'s left instead.');
  assert.equal(reentrySeatWarning(plan, 'H', short), null);

  const anil = planReentry(table(), 2, 'H', 4);
  assert.equal(reentrySeatLine(anil, 'H', out, short), 'Harish sits at seat 5, between Anil and Sree.');
  assert.equal(reentrySeatWarning(anil, 'H', short), 'Not the dealer\'s left: Sree opens round 3, Harish deals round 5.');
  assert.equal(reentrySeatHint(anil, 'H', out, 96, short), null);

  const keep = planReentry(table(), 2, 'H', 1);
  assert.equal(reentrySeatLine(keep, 'H', out, short), 'Harish keeps seat 2, between Sree and Priya.', 'Venkat is out, so not named');
  assert.equal(reentrySeatWarning(keep, 'H', short), 'Not the dealer\'s left: Harish opens round 3 and deals round 4.');

  const there = planReentry(table(['S', 'A', 'V', 'H', 'P'], ['V', 'H'], ['S', 'P']), 2, 'H');
  assert.equal(reentrySeatLine(there, 'H', out, short), 'Harish keeps seat 4 — already left of the dealer.');
});

const seat = (outRound: number | null, entries = 1, reentryScore: number | null = null, reenteredRound: number | null = null) => ({ outRound, reenteredRound, reentryScore, entries });

test('D139 smoke/16b (game U): the seat lines the flow asserts are what the helpers say', () => {
  const ids = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
  const names: Record<string, string> = { S: 'Sree Test', A: 'Test Alpha', B: 'Test Bravo', C: 'Test Charlie', D: 'Test Delta', E: 'Test Echo', F: 'Test Foxtrot', G: 'Test Golf', H: 'Test Hotel', I: 'Test India', J: 'Test Juliet', K: 'Test Kilo' };
  const name = shortNames(ids, (id) => names[id]);
  const earlier = ['G', 'H', 'I', 'J', 'K'];
  // The seed's three rounds keep their dealers (Sree, Alpha, Bravo); 057 deals round 4 to Alpha, the seat before Bravo.
  assert.equal(nextDealer({ players: ids, dealerIds: ['S', 'A', 'B'] }, 3), 'A');
  const at = (players: string[], out: string[], nextDealerOverride: ReturnType<typeof planReentry>['nextDealerOverride'] = null) =>
    ({ players, dealerIds: ['S', 'A', 'B', 'A'], outIds: new Set(out), nextDealerOverride });
  const flow = read('e2e/smoke/16b-pool-round-saved-12p.yaml');
  const says = (text: string) => { assert.ok(flow.includes(`"${text}"`), `the flow asserts: ${text}`); return text; };

  let out = ['A', 'B', 'C', ...earlier];
  assert.equal(`Next: round 5 · ${name(nextDealer(at(ids, out), 4)!)} deals`, says('Next: round 5 · Sree deals'), 'Alpha is out: the next seat down, Sree');
  const charlie = planReentry(at(ids, out), 4, 'C');
  assert.equal(charlie.dealer, 'S');
  assert.equal(reentrySeatLine(charlie, 'C', new Set(out), name), says('Test Charlie keeps seat 4 — already left of the dealer.'));
  assert.equal(charlie.defaultSeat, charlie.from, 'no Keep seat button');

  out = ['A', 'B', ...earlier];
  const golf = planReentry(at(charlie.players, out, charlie.nextDealerOverride), 4, 'G');
  assert.deepEqual(golf.players.slice(0, 5), ['S', 'G', 'A', 'B', 'C']);
  assert.equal(reentrySeatLine(golf, 'G', new Set(out), name), says('Test Golf sits at seat 2, between Sree and Test Charlie — left of the dealer.'));
  assert.equal(golf.from + 1, 8, 'Keep seat 8');
  const echo = planReentry(at(charlie.players, out, charlie.nextDealerOverride), 4, 'G', seatLeftOf(golf.players, 'G', 'E'));
  assert.equal(golf.players.indexOf('E') + 1, 7, 'after-seat-7 is Echo');
  assert.equal(reentrySeatLine(echo, 'G', new Set(out), name), says('Test Golf sits at seat 7, between Test Echo and Test Foxtrot.'));
  assert.ok(reentrySeatWarning(echo, 'G', name));
  assert.equal(echo.players.indexOf('S') + 1, 1, 'after-seat-1 is Sree');
  assert.equal(seatLeftOf(echo.players, 'G', 'S'), golf.defaultSeat, 'a tap on Sree is the default again');

  const back = { players: golf.players, scores: {}, poolSeats: { G: seat(null, 2, 42, 5), C: seat(null, 2, 41, 5), A: seat(4), B: seat(4), H: seat(1), I: seat(1), J: seat(1), K: seat(1) } } as unknown as Game;
  assert.equal(backInLine(back, 'G', name), says('↺ Back in at 42 · seat 2, left of Sree'));
  assert.equal(backInLine(back, 'C', name), says('↺ Back in at 41 · seat 5, left of Test Golf'));

  out = ['A', 'B', 'I', 'J', 'K'];
  const hotel = planReentry(at(golf.players, [...out, 'H'], golf.nextDealerOverride), 4, 'H');
  assert.equal(hotel.dealer, 'S', 'Sree still deals round 5');
  assert.equal(reentrySeatLine(hotel, 'H', new Set([...out, 'H']), name), says('Test Hotel sits at seat 2, between Sree and Test Golf — left of the dealer.'));
  assert.equal(roundSavedSummary(3, 4, 41), says('3 out this round · 4 still in · re-entry at 41'));
  assert.equal(roundSavedSummary(2, 5, 42), says('2 out this round · 5 still in · re-entry at 42'));
  assert.match(read('supabase/seed-e2e.sql'), /'GAMEU1'/);
});

test('D139 names: first names unless two players share one (v17: three "Player"s)', () => {
  const twins = shortNames(['a', 'b', 'c'], (id) => ({ a: 'Player One', b: 'Player Two', c: 'Ravi Kumar' })[id] ?? id);
  assert.equal(twins('a'), 'Player One');
  assert.equal(twins('b'), 'Player Two');
  assert.equal(twins('c'), 'Ravi');
});

test('D139 afterRound: this round\'s outs from outRound, every one; earlier outs only when they may come back', () => {
  const players = ['S', 'A', 'P', 'V', 'H', 'G'];
  const scores = Object.fromEntries(players.map((id) => [id, [0, 0, 0, 0, 0, 0, 0]])) as Record<string, number[]>;
  scores.P = [10, 10, 10, 10, 20, 20, 15]; // 95 still in
  scores.V = [20, 20, 20, 20, 20, 0, 4]; // 104
  scores.H = [20, 20, 20, 20, 20, 0, 12]; // 112
  const before = { players, poolSeats: { S: seat(null), A: seat(null), P: seat(null), V: seat(null), H: seat(null), G: seat(6), K: seat(3) } } as unknown as Game;
  const after = {
    players,
    scores,
    isComplete: false,
    settings: { gameType: 'pool', poolLimit: 101, reentryLimit: 1, reentryPlus: 1 },
    poolSeats: { S: seat(null), A: seat(null), P: seat(null), V: seat(7), H: seat(7), G: seat(6), K: seat(3, 2) },
  } as unknown as Game;
  const summary = afterRound(before, after, 7);
  assert.equal(summary.round, 7);
  assert.deepEqual(summary.outThisRound, ['V', 'H']);
  assert.deepEqual(summary.outEarlier, ['G'], 'K used his one re-entry: not listed');
  assert.equal(summary.reentryAt, 96, 'Priya 95 + 1');
  assert.equal(roundSavedSummary(2, 3, 96), '2 out this round · 3 still in · re-entry at 96');
  assert.equal(roundSavedSummary(0, 4, null), 'Nobody out this round · 4 still in');
});

test('D139 after Re-enter the row reads "↺ Back in at 96 · seat 3, left of Priya"', () => {
  const game = {
    players: ['S', 'P', 'H', 'A', 'V'],
    scores: {},
    poolSeats: { S: seat(null), A: seat(null), H: seat(null, 2, 96, 8), P: seat(null), V: seat(7) },
  } as unknown as Game;
  assert.equal(backInLine(game, 'H', short), '↺ Back in at 96 · seat 3, left of Priya');
  const loaded = planGameReentry({ ...game, poolSeats: { ...game.poolSeats, H: seat(7) }, scores: { S: [0, 0], A: [0, 0], P: [0, 0], V: [0, 0], H: [0, 0] }, dealerIds: ['S', 'A'] } as unknown as Game, 'H');
  assert.equal(loaded.round, 3, 'a loaded game plans for the round being played');
});

test('D139 an opened row scrolls fully into view, its buttons first when it is taller than the list (CI #183, Pixel 4a)', () => {
  assert.equal(revealOffset({ top: 230, bottom: 670 }, 0, 525), 145, 'below the fold: its bottom meets the list\'s bottom');
  assert.equal(revealOffset({ top: 100, bottom: 400 }, 0, 525), null, 'already in view: no jump');
  assert.equal(revealOffset({ top: 100, bottom: 400 }, 300, 525), 100, 'above the view: its top meets the list\'s top');
  assert.equal(revealOffset({ top: 100, bottom: 800 }, 0, 525), 275, 'taller than the list: Re-enter at N stays in view');
  const sheet = read('components/game/RoundSavedSheet.tsx');
  assert.match(sheet, /reveal=\{reveal\}/);
  assert.match(sheet, /onLayout=\{open \?/, 'the opened row reports its box');
  assert.match(read('components/ui/BottomSheet.tsx'), /scrollTo\(\{ y, animated: true \}\)/);
});

test('D139 Round saved is a sheet: no dialog, Re-enter keeps it open, the test IDs of the spec', () => {
  const screen = read('app/(screens)/score-entry.tsx');
  assert.doesNotMatch(screen, /<Dialog visible=\{!!afterSave\}/, 'the Round saved dialog is gone');
  assert.doesNotMatch(screen, /Dialog\.Title[^>]*>Round saved/);
  const handler = screen.slice(screen.indexOf('onReenter={async (id, seat) =>'), screen.indexOf('onClose={() => { setAfterSave(null); router.back(); }}'));
  assert.ok(handler.length > 0 && !/router\.back\(\)/.test(handler), 'Re-enter does not leave the screen');
  assert.match(screen, /gamesService\.reenterPlayer\(game\.id, id, seat\)/);

  const sheet = read('components/game/RoundSavedSheet.tsx');
  for (const id of ['after-row-${id}', 'after-reenter-${id}']) assert.ok(sheet.includes(`testID={\`${id}\`}`), id);
  assert.match(sheet, /testID="after-done">Close<\/Button>/);
  assert.match(sheet, /mode="contained" icon="flag-checkered" onPress=\{onComplete\}[^>]*testID="after-complete">Complete the pool<\/Button>/, 'filled when one is left');
  assert.match(sheet, /`Round \$\{summary\.round\} saved`/);
  assert.match(sheet, /<BottomSheet /);

  const panel = read('components/game/ReentrySeatPanel.tsx');
  assert.match(panel, /idPrefix = 'after'/);
  for (const id of ['-reenter-confirm', '-keep-seat', '-seat-${index + 1}', '-seat-line', '-seat-warning']) assert.ok(panel.includes(`\${idPrefix}${id}`), id);
  assert.match(panel, /`Re-enter at \$\{score\}`/);
  assert.match(panel, /`Keep seat \$\{plan\.from \+ 1\}`/);

  const standings = read('app/(screens)/games/[id].tsx');
  assert.match(standings, /<ReentrySheet/, 'Standings\' Re-enter shows the same line and choice');
  assert.match(standings, /onReenter=\{game\.isComplete \|\| deleted \? undefined : setReentering\}/);
});

test('D139 the service sends the seat only when one was picked, and falls back on a server without 056', () => {
  const service = read('services/games.ts');
  assert.match(service, /async reenterPlayer\(gameId: string, profileId: string, seat\?: number\)/);
  assert.match(service, /seat === undefined \? args : \{ \.\.\.args, p_seat: seat \}/);
  assert.match(service, /if \(error && seat !== undefined && missingRpc\(error\)\) \(\{ error \} = await supabase\.rpc\('reenter_player', args\)\);/);
  assert.match(service, /const plan = planGameReentry\(game, profileId, seat === undefined \? undefined : seat - 1\);/, 'a game on this phone seats the same way');
  assert.match(read('types/database.ts'), /reenter_player: \{\s*Args: \{ p_game_id: string; p_profile_id: string; p_seat\?: number \| null \};/);
});

test('D139 migration 056: one reenter_player with an optional seat; written with rollback and replay, not applied', () => {
  const sql = read('supabase/migrations/056_reentry_left_of_dealer.sql');
  assert.match(sql, /drop function if exists public\.reenter_player\(uuid, uuid\);/);
  assert.match(sql, /create or replace function public\.reenter_player\(p_game_id uuid, p_profile_id uuid, p_seat integer default null\)/);
  assert.match(sql, /security definer\s+set search_path = public, pg_temp/);
  assert.match(sql, /next_dealer_profile_id = v_dealing, next_dealer_round = v_live \+ 1, next_dealer_keeps_sequence = false/, 'the dealer keeps this round (054)');
  assert.match(sql, /'Seat must be 1 to %\.'/);
  assert.match(sql, /'seatFrom', v_from, 'seat', v_to/);
  assert.match(sql, /revoke all on function public\.reenter_player\(uuid, uuid, integer\) from public, anon;/);
  assert.match(sql, /grant execute on function public\.reenter_player\(uuid, uuid, integer\) to authenticated;/);
  assert.match(sql, /Written, not applied to live/);
  assert.ok(!/drop\s+table|delete\s+from|alter\s+table/i.test(sql), 'functions only');
  const rollback = read('supabase/rollback/rollback_056_reentry_left_of_dealer.sql');
  assert.match(rollback, /drop function if exists public\.reenter_player\(uuid, uuid, integer\);/);
  assert.match(rollback, /create or replace function public\.reenter_player\(p_game_id uuid, p_profile_id uuid\)/);
  assert.match(rollback, /public\.pool_entry_plus\(g\.settings, 'reentryPlus'\)/, 'the 047 body');
  const hook = read('../ci/db/replay-rollbacks.sh');
  assert.ok(hook.includes('rollback_056_reentry_left_of_dealer.sql') && hook.includes('056_reentry_left_of_dealer'));
  assert.ok(read('supabase/tests/45_reentry_left_of_dealer_056.sql').includes("select plan("));
});

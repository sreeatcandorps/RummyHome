import type { Game } from '@/types/game';
import { neighboursIn, planReentry, ReentryPlan } from '@/utils/dealerRotation';
import { playedRounds } from '@/utils/editRound';
import { playersOut } from '@/utils/pool';

/**
 * The re-entry seat (056, D139; design-review-2 §10.6): the words of the opened row on Round saved and in
 * Standings. Sree (Nov 21): "warn and say … his seat is going to be so-and-so number … in between these two
 * people … the admin can move the players around". Same sentence shape as Add players (`joinSeatNotice`).
 */

type SeatGame = Pick<Game, 'players' | 'poolSeats' | 'dealerIds' | 'nextDealerOverride' | 'scores'>;

/** The deal as the server sees it: seat order, who dealt, who is out, the Dealer-sheet override. */
export const reentryTable = (game: SeatGame) => ({
  players: game.players,
  dealerIds: game.dealerIds,
  outIds: new Set(playersOut(game)),
  nextDealerOverride: game.nextDealerOverride ?? null,
});

/** `planReentry` for a loaded game; `seat` is 0-based. */
export const planGameReentry = (game: SeatGame, playerId: string, seat?: number): ReentryPlan =>
  planReentry(reentryTable(game), playedRounds(game.scores), playerId, seat);

/** "Sit on that person's left" (a tap on a name in the strip): the seat straight after theirs, once he is out of his (057). */
export function seatLeftOf(players: readonly string[], playerId: string, otherId: string): number {
  return players.filter((id) => id !== playerId).indexOf(otherId) + 1;
}

/** First names, unless two players at the table share one: then the full name for those two (v17: three "Player"s). */
export function shortNames(ids: readonly string[], nameOf: (id: string) => string): (id: string) => string {
  const first = (id: string) => nameOf(id).trim().split(/\s+/)[0] || nameOf(id);
  const counts = new Map<string, number>();
  ids.forEach((id) => counts.set(first(id).toLowerCase(), (counts.get(first(id).toLowerCase()) ?? 0) + 1));
  return (id: string) => ((counts.get(first(id).toLowerCase()) ?? 0) > 1 ? nameOf(id) : first(id));
}

const afterOf = (plan: ReentryPlan, playerId: string, outIds: ReadonlySet<string>) => {
  const back = new Set(outIds);
  back.delete(playerId);
  return neighboursIn({ players: plan.players, outIds: back }, playerId);
};

/**
 * Line 1 of the opened row: "Harish sits at seat 3, between Anil and Priya — left of the dealer."
 * Neighbours are the seats still in. Already there: "Harish keeps seat 4 — already left of the dealer."
 */
export function reentrySeatLine(plan: ReentryPlan, playerId: string, outIds: ReadonlySet<string>, name: (id: string) => string): string {
  const who = name(playerId);
  const seat = plan.seat + 1;
  if (plan.seat === plan.from && plan.defaultSeat === plan.from && plan.dealersLeft) return `${who} keeps seat ${seat} — already left of the dealer.`;
  const { before, after } = afterOf(plan, playerId, outIds);
  const verb = plan.seat === plan.from ? 'keeps' : 'sits at';
  const between = before && after && before !== after ? `, between ${name(before)} and ${name(after)}` : '';
  return `${who} ${verb} seat ${seat}${between}${plan.dealersLeft ? ' — left of the dealer' : ''}.`;
}

/** The grey line under the strip when he sits on the dealer's left: cards last this round, and he deals last (057). */
export function reentrySeatHint(plan: ReentryPlan, playerId: string, outIds: ReadonlySet<string>, score: number, name: (id: string) => string): string | null {
  if (!plan.dealersLeft || !plan.dealer) return null;
  const { after } = afterOf(plan, playerId, outIds);
  const dealsAfter = after && after !== plan.dealer ? `, after ${name(after)}` : '';
  return `${name(playerId)} comes back at ${score}, gets cards last in round ${plan.round} and deals last${dealsAfter}. Tap a name to sit on that person's left instead.`;
}

/** The brass warning for any other seat: what changes, never a refusal (D50). */
export function reentrySeatWarning(plan: ReentryPlan, playerId: string, name: (id: string) => string): string | null {
  if (plan.dealersLeft || !plan.dealer) return null;
  const opens = plan.opens ? `${name(plan.opens)} opens round ${plan.round}` : null;
  const himFirst = plan.opens === playerId;
  const deals = plan.firstDeal ? `${himFirst ? '' : `${name(playerId)} `}deals round ${plan.firstDeal}` : null;
  const parts = himFirst && opens && deals ? `${opens} and ${deals}` : [opens, deals].filter(Boolean).join(', ');
  return `Not the dealer's left${parts ? `: ${parts}` : ''}.`;
}

/** The row once he is back: "↺ Back in at 96 · seat 3, left of Priya" (Priya is the seat before his still in). */
export function backInLine(game: SeatGame, playerId: string, name: (id: string) => string): string {
  const seat = game.poolSeats?.[playerId];
  const { before } = neighboursIn({ players: game.players, outIds: new Set(playersOut(game)) }, playerId);
  const where = `seat ${game.players.indexOf(playerId) + 1}${before ? `, left of ${name(before)}` : ''}`;
  return `↺ Back in at ${seat?.reentryScore ?? '?'} · ${where}`;
}

/** The Round saved summary line: "2 out this round · 3 still in · re-entry at 96" (no re-entry part when re-entries are off). */
export function roundSavedSummary(outThisRound: number, stillIn: number, reentryAt: number | null): string {
  const out = outThisRound ? `${outThisRound} out` : 'Nobody out';
  return `${out} this round · ${stillIn} still in${reentryAt === null ? '' : ` · re-entry at ${reentryAt}`}`;
}

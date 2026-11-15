import { GameSettings } from '@/types/game';
import { nextDealer } from '@/utils/dealerRotation';

/**
 * Seating order (PR 21). The order IS `game_players.player_order`: nothing new is stored. These are
 * the pure pieces of the Seating sheet — moving a player to a seat, the ▲ ▼ steps, the row sizes,
 * when the pop-up shows (once per game, `settings.seatingPrompted`), the copy, and who deals next
 * under the order being built (the same rule the scorecard and `save_round` use).
 */

/** Move `id` to `seat` (0-based); the rows between source and target shift one seat towards the gap. */
export function placeAt<T>(order: readonly T[], id: T, seat: number): T[] {
  const from = order.indexOf(id);
  if (from < 0) return [...order];
  const to = Math.max(0, Math.min(order.length - 1, Math.trunc(seat)));
  if (from === to) return [...order];
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

/** One seat up (-1) or down (+1); a step off either end is a no-op. */
export function stepSeat<T>(order: readonly T[], id: T, direction: -1 | 1): T[] {
  const from = order.indexOf(id);
  if (from < 0) return [...order];
  const to = from + direction;
  if (to < 0 || to >= order.length) return [...order];
  return placeAt(order, id, to);
}

/** Whether two orders are the same list in the same order. */
export const sameOrder = <T>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((value, index) => value === b[index]);

/** Whether `next` is a permutation of `base` (every id once, nothing added or lost). */
export function isPermutation<T>(base: readonly T[], next: readonly T[]): boolean {
  if (base.length !== next.length) return false;
  const seen = new Set(next);
  return seen.size === next.length && base.every((id) => seen.has(id));
}

/** Row height: 40 dp to 8 players (one screen), 32 dp from 9, 30 dp at 17–20 (S03 / S04). */
export function seatRowHeight(count: number): number {
  if (count <= 8) return 40;
  if (count <= 16) return 32;
  return 30;
}

/** The Players chip column appears on wide layouts: ≥ 8 players, landscape or a tablet (S02). */
export function showsPlayerChips(count: number, layout: { width: number; height: number }): boolean {
  return count >= 8 || layout.width > layout.height || layout.width >= 600;
}

export type SeatingPromptGame = {
  isComplete: boolean;
  settings?: Partial<Pick<GameSettings, 'seatingPrompted'>> | null;
  closedAt?: string | null;
  deletedAt?: string | null;
};

/**
 * The pop-up (S01, §3.2): once per game, right after Start, to an admin, with ≥ 2 seats and no rounds.
 * Only games started with this build carry `seatingPrompted: false`; older zero-round games (and the demo
 * seed) never had the key and never pop — the ⋮ menu item is always there for them.
 */
export function shouldPromptSeating(input: { game: SeatingPromptGame | null | undefined; canScore: boolean; seatCount: number; roundCount: number }): boolean {
  const { game } = input;
  if (!game || !input.canScore) return false;
  if (game.isComplete || game.closedAt || game.deletedAt) return false;
  if (input.seatCount < 2 || input.roundCount > 0) return false;
  return game.settings?.seatingPrompted === false;
}

/** The sheet's menu item and Done exist only while the game is Active (Q21.7). */
export const canChangeSeating = (game: { isComplete: boolean; closedAt?: string | null; deletedAt?: string | null } | null | undefined, canScore: boolean) =>
  Boolean(game) && canScore && !game!.isComplete && !game!.closedAt && !game!.deletedAt;

// ---------- copy ----------
export const SEATING_TITLE = 'Seating order';
export const SEATING_MENU_ITEM = 'Seating order';
export const KEEP_THIS_ORDER = 'Keep this order';
export const SEATING_DONE = 'Done';
export const SEATING_POPUP_SUBLINE = 'Pops up once, right after Start. Admins only.';
export const SEATING_MENU_SUBLINE = 'Mid-game · admins only · logged';
export const SEATING_POPUP_NOTE = 'Seat 1 deals round 1 and the deal goes round by seat. Tap a player, then the seat they belong in, or use the arrows.';
export const EVERY_PLAYER_NEEDS_A_SEAT = 'Every player needs a seat.';

/** "Pool · 6 seats · 1 out" for a pool; "4 seats" otherwise. */
export function seatingSubline(input: { pool: boolean; seatCount: number; outCount: number; fromMenu: boolean }): string {
  if (input.pool) return `Pool · ${input.seatCount} ${input.seatCount === 1 ? 'seat' : 'seats'} · ${input.outCount} out`;
  return input.fromMenu ? SEATING_MENU_SUBLINE : SEATING_POPUP_SUBLINE;
}

/** The yellow note on the mid-game sheet (S05 B). Null when no rounds exist. */
export function midGameSeatingNote(roundCount: number): string | null {
  if (roundCount <= 0) return null;
  return `${roundCount === 1 ? '1 round' : `${roundCount} rounds`} played. Saved rounds keep their dealers; the next deal follows the new order. Columns on the scorecard move with the seats.`;
}

/** "Priya picked up — choose a seat" (announced and shown while a player is held). */
export const pickedUpText = (name: string) => `${name} picked up — choose a seat`;

/** "Picked up 1 · Seated 7" under the Players column (S02). */
export const pickedCounter = (picked: boolean, seatCount: number) => `Picked up ${picked ? 1 : 0} · Seated ${seatCount - (picked ? 1 : 0)}`;

/** One accessible row: "Seat 3, Harish Gadupudi, deals next, out". */
export function seatRowLabel(input: { seat: number; name: string; dealsNext: boolean; out?: boolean; picked?: boolean }): string {
  const parts = [`Seat ${input.seat}`, input.name];
  if (input.dealsNext) parts.push('deals next');
  if (input.out) parts.push('out');
  if (input.picked) parts.push('picked up');
  return parts.join(', ');
}

/**
 * Who deals next under the order being built: the seat after the last saved round's dealer in that
 * order (no rounds → seat 1). A pool skips players who are out, as `save_round` does.
 */
export function nextDealerFor(order: readonly string[], dealerIds: (string | null | undefined)[] | null | undefined, roundCount: number, outIds: ReadonlySet<string> = new Set()): string | undefined {
  const rotation = order.filter((id) => !outIds.has(id));
  if (!rotation.length) return undefined;
  const last = roundCount > 0 ? dealerIds?.[roundCount - 1] : null;
  if (last && outIds.has(last) && order.includes(last)) {
    // The last dealer is out (pool): the next seat still in after them, in the full order (041 save_round).
    const at = order.indexOf(last);
    for (let step = 1; step <= order.length; step += 1) {
      const candidate = order[(at + step) % order.length];
      if (!outIds.has(candidate)) return candidate;
    }
  }
  return nextDealer({ players: rotation, dealerIds }, roundCount);
}

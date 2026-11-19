import { nextDealer } from '@/utils/dealerRotation';

/**
 * Order of players (PR 21 as "Seating order"; PR 24 reshaped it on Sree's v11 feedback). The order
 * IS `game_players.player_order`: nothing new is stored. These are the pure pieces of the Order of
 * players list — numbering players by tapping them, undoing the last number, the ▲ ▼ steps, Clear,
 * the row sizes, the copy, and who deals next under the order being built (the same rule the
 * scorecard and `save_round` use). The once-per-game pop-up is gone: a new game sets its order as a
 * step before Start, and admins change it any time from ⋮.
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

/**
 * Row height. v12 point 6 (Sree, Nov 19): never below the platform minimum touch target — 48 dp on
 * Android (Material), 44 pt on iOS — whatever the count; the list scrolls instead of shrinking.
 * Before: 40 / 32 / 30 dp by count (S03 / S04), which he found too small to tap at 20 players.
 */
export const SEAT_ROW_MIN_HEIGHT = 48;
export function seatRowHeight(_count: number): number {
  return SEAT_ROW_MIN_HEIGHT;
}

/**
 * PR 24 — the Order of players list; D56 (Sree, Nov 19, v12 point 7) turned the taps into a countdown.
 * Players tap in the order of the cards they drew, highest first: the first tap is seat N (the top row),
 * the next seat N-1, and so on; the LAST tap is seat 1, which deals round 1 and is the first scorecard
 * column. Numbered players sit at the top, highest seat first, so the list reads N … 1 downwards and
 * the dealer ends up at the bottom of the numbered block; the rest wait below in their current order.
 * Tapping the most recent tap takes it back (undo); tapping any other numbered player only highlights
 * them. ▲ ▼ move a numbered player one seat (▲ = a higher seat, up the list). Clear takes every number
 * back. Done / Next need everyone numbered. `numbered` is kept in SEAT order (seat 1 first) so the
 * saved `player_order` is read straight off it.
 */
export type OrderDraft = {
  /** Every seated player in today's order (the fallback order for the unnumbered). */
  base: string[];
  /** The numbered players, seat 1 first. */
  numbered: string[];
  /** The last player touched (highlighted, one at a time). */
  focus: string | null;
};

/** A fresh draft: nobody numbered (game start), or everyone in today's order (mid-game, so one move is one tap). */
export const startOrder = (base: readonly string[], prefilled = false): OrderDraft => ({ base: [...base], numbered: prefilled ? [...base] : [], focus: null });

/** The unnumbered players, in their base order. */
const unnumbered = (draft: OrderDraft): string[] => draft.base.filter((id) => !draft.numbered.includes(id));

/** The seat order (seat 1 first) — what Done / Start save. Meaningful once everyone is numbered. */
export const displayOrder = (draft: OrderDraft): string[] => [...draft.numbered, ...unnumbered(draft)];

/** The rows as shown: numbered players highest seat first (the first tap on top), then the rest in their base order. */
export const displayRows = (draft: OrderDraft): string[] => [...draft.numbered].reverse().concat(unnumbered(draft));

/**
 * 1-based seat number, or null while the player is unnumbered. Seats count DOWN from the table size
 * while the order is being built: with 8 players the first tap shows 8, the second 7 … so a number
 * never changes once given (D56).
 */
export const seatNumberOf = (draft: OrderDraft, id: string): number | null => {
  const at = draft.numbered.indexOf(id);
  return at < 0 ? null : at + 1 + (draft.base.length - draft.numbered.length);
};

/** The most recent tap: the lowest seat so far (seat 1 once everyone is numbered). Tapping it again undoes it. */
export const isLastNumbered = (draft: OrderDraft, id: string) => draft.numbered.length > 0 && draft.numbered[0] === id;
/** The first tap: the highest card, seat N. */
export const isFirstNumbered = (draft: OrderDraft, id: string) => draft.numbered.length > 0 && draft.numbered[draft.numbered.length - 1] === id;
export const orderComplete = (draft: OrderDraft) => draft.numbered.length === draft.base.length;

/** A tap: number an unnumbered player (the lowest seat so far), un-number the most recent one, or just highlight. */
export function tapPlayer(draft: OrderDraft, id: string): OrderDraft {
  if (!draft.base.includes(id)) return draft;
  if (!draft.numbered.includes(id)) return { ...draft, numbered: [id, ...draft.numbered], focus: id };
  if (isLastNumbered(draft, id)) return { ...draft, numbered: draft.numbered.slice(1), focus: id };
  return { ...draft, focus: id };
}

/**
 * ▲ / ▼ on a numbered player; unnumbered players have no arrows. `direction` is the seat change:
 * +1 = a higher seat = one row UP the list (the list reads N … 1), -1 = a lower seat = one row down.
 */
export function stepNumbered(draft: OrderDraft, id: string, direction: -1 | 1): OrderDraft {
  if (!draft.numbered.includes(id)) return draft;
  return { ...draft, numbered: stepSeat(draft.numbered, id, direction), focus: id };
}

/** Clear: every number back, nothing highlighted. */
export const clearOrder = (draft: OrderDraft): OrderDraft => ({ ...draft, numbered: [], focus: null });

/** Whether Done would change anything (mid-game: Done stays off until it would). */
export const orderChanged = (draft: OrderDraft) => !sameOrder(draft.base, displayOrder(draft));

/** The player ID (#42) joins the row only where it fits: a row 330 dp wide or more (a phone row inside the card is ~347 dp). */
export const showsPlayerCode = (rowWidth: number) => rowWidth >= 330;

/** The sheet's menu item and Done exist only while the game is Active (Q21.7). */
export const canChangeSeating = (game: { isComplete: boolean; closedAt?: string | null; deletedAt?: string | null } | null | undefined, canScore: boolean) =>
  Boolean(game) && canScore && !game!.isComplete && !game!.closedAt && !game!.deletedAt;

// ---------- copy ----------
export const SEATING_TITLE = 'Order of players';
export const SEATING_MENU_ITEM = 'Order of players';
export const SEATING_DONE = 'Done';
export const SEATING_CLEAR = 'Clear';
export const SEATING_MENU_SUBLINE = 'Mid-game · admins only · logged';
/** Under the title on the New game step and the mid-game sheet. */
export const ORDER_HOW_TO = 'Tap players from the highest card to the lowest. The last tap is seat 1 and deals round 1; the deal then goes round by seat. Tap the latest one again to take it back.';
/** Small tag on the first tap's row while the order is being built. */
export const HIGHEST_CARD_TAG = 'highest card';
export const EVERY_PLAYER_NEEDS_A_SEAT = 'Every player needs a seat.';

/** "Pool · 6 seats · 1 out" for a pool; the mid-game subline otherwise. */
export function seatingSubline(input: { pool: boolean; seatCount: number; outCount: number }): string {
  if (input.pool) return `Pool · ${input.seatCount} ${input.seatCount === 1 ? 'seat' : 'seats'} · ${input.outCount} out`;
  return SEATING_MENU_SUBLINE;
}

/** "3 of 8 numbered" under the list while the order is being built; "Everyone numbered" when done. */
export const numberedCounter = (numbered: number, total: number) => (numbered >= total ? 'Everyone numbered' : `${numbered} of ${total} numbered`);

/** The yellow note on the mid-game sheet (S05 B). Null when no rounds exist. */
export function midGameSeatingNote(roundCount: number): string | null {
  if (roundCount <= 0) return null;
  return `${roundCount === 1 ? '1 round' : `${roundCount} rounds`} played. Saved rounds keep their dealers; the next deal follows the new order. Columns on the scorecard move with the seats.`;
}

/** One accessible row: "Seat 3, Harish Gadupudi, deals next, out"; "Not numbered, Priya" before a tap. */
export function seatRowLabel(input: { seat: number | null; name: string; dealsNext: boolean; out?: boolean }): string {
  const parts = [input.seat == null ? 'Not numbered' : `Seat ${input.seat}`, input.name];
  if (input.dealsNext) parts.push('deals next');
  if (input.out) parts.push('out');
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

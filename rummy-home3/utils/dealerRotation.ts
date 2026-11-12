/**
 * The deal follows the actual rotation (final launch batch, item 6).
 *
 * Who dealt each saved round is stored with the round (`rounds.dealer_profile_id`, carried
 * to the app as `Game.dealerIds`, one entry per round index). The next dealer is the seat
 * after the last round's dealer in the CURRENT seat order, so a player added mid-game makes
 * the next rotation one round longer (9 rounds, then 10). A divider is drawn above each
 * round where the game's first dealer deals again: one full rotation done.
 *
 * Games saved before 031 (or local games) have no stored dealers; those fall back to the
 * old seat-order rule, which is what the server used to store anyway.
 */

type RotationGame = {
  players: string[];
  dealerIds?: (string | null | undefined)[] | null;
};

/** The seat-order rule used before 031 and for a round whose dealer is unknown. */
export function seatOrderDealer(seats: string[], roundIndex: number): string | undefined {
  return seats.length ? seats[roundIndex % seats.length] : undefined;
}

/** Who dealt a saved round: the stored dealer when known, else the seat-order rule. */
export function dealerForRound(game: RotationGame, roundIndex: number): string | undefined {
  const stored = game.dealerIds?.[roundIndex];
  if (stored) return stored;
  return seatOrderDealer(game.players, roundIndex);
}

/**
 * Who deals the next round (`roundCount` rounds already saved): the seat after the last
 * round's dealer in the current seat order. A last dealer who has left the game, or no
 * rounds yet, falls back to the seat-order rule, as the server does.
 */
export function nextDealer(game: RotationGame, roundCount: number): string | undefined {
  const seats = game.players;
  if (!seats.length) return undefined;
  if (roundCount <= 0) return seats[0];
  const last = game.dealerIds?.[roundCount - 1];
  const at = last ? seats.indexOf(last) : -1;
  if (at >= 0) return seats[(at + 1) % seats.length];
  return seatOrderDealer(seats, roundCount);
}

/**
 * Round indexes (0-based) that start a new rotation: every round after the first where the
 * first round's dealer deals again. The scorecard draws a divider above each of them.
 * With seats A B C and dealers A B C A B C A the result is [3, 6]; if D joined after round
 * 3 and dealers are A B C A B C D A the result is [3, 7] (the second rotation is longer).
 */
export function rotationStarts(game: RotationGame, roundCount: number): number[] {
  if (roundCount < 2) return [];
  const first = dealerForRound(game, 0);
  if (!first) return [];
  const starts: number[] = [];
  for (let round = 1; round < roundCount; round += 1) {
    if (dealerForRound(game, round) === first) starts.push(round);
  }
  return starts;
}

/** `dealerIds` after saving round `roundIndex` with `dealerId` (local games keep the list themselves). */
export function withDealer(dealerIds: (string | null | undefined)[] | null | undefined, roundIndex: number, dealerId: string | undefined) {
  const next = [...(dealerIds ?? [])];
  while (next.length < roundIndex) next.push(null);
  next[roundIndex] = dealerId ?? null;
  return next;
}

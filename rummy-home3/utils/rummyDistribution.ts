/**
 * Rummy winners share the points needed to bring a round back to zero.
 *
 * `entriesTotal` is the sum of every non-winning score in the round (drops,
 * middle drops, counts and any typed plus). It is normally negative, and the
 * winners split its opposite as evenly as whole points allow, the remainder
 * going to the players selected first. When the others add up to a plus the
 * pot is negative (037, PR 3): the share is then minus — the only way the round
 * balances — and two winners split it -16 / -15, the first tapped taking the
 * larger piece (D3.3).
 */
export function distributeRummyWinnings(
  entriesTotal: number,
  winnerIds: string[],
): Record<string, number> {
  if (winnerIds.length === 0) return {};

  const pot = -entriesTotal;
  const sign = pot < 0 ? -1 : 1;
  const size = Math.abs(pot);
  const base = Math.floor(size / winnerIds.length);
  let remainder = size - base * winnerIds.length;

  return winnerIds.reduce<Record<string, number>>((acc, winnerId) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    // -0 would print as "-0": keep zero plain.
    acc[winnerId] = sign * (base + extra) || 0;
    return acc;
  }, {});
}

/** True when a Rummy winner would end the round at or below zero (D3.2: the confirm only then). */
export function rummyShareNeedsConfirm(shares: Record<string, number>): boolean {
  return Object.values(shares).some((share) => share <= 0);
}

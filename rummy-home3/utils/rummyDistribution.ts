/**
 * Rummy winners share the points needed to bring a round back to zero.
 *
 * `entriesTotal` is the sum of every non-winning score in the round (drops,
 * middle drops, counts, expenses) and is normally negative. The winners split
 * its absolute value as evenly as whole points allow, with any remainder going
 * to the players selected first.
 */
export function distributeRummyWinnings(
  entriesTotal: number,
  winnerIds: string[],
): Record<string, number> {
  if (winnerIds.length === 0) return {};

  const pot = Math.max(0, -entriesTotal);
  const base = Math.floor(pot / winnerIds.length);
  let remainder = pot - base * winnerIds.length;

  return winnerIds.reduce<Record<string, number>>((acc, winnerId) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    acc[winnerId] = base + extra;
    return acc;
  }, {});
}

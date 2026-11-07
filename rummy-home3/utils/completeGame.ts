/**
 * What the Complete game page checks before the button is enabled. Pure so it
 * can be unit tested: round count, that every round adds to 0, and totals.
 */
export type CompletionCheck = {
  ok: boolean;
  roundCount: number;
  /** Rounds (1-based) whose scores do not add to 0. */
  unbalancedRounds: number[];
  /** Sum of every player's total; 0 when the sheet balances. */
  totalSum: number;
  /** One sentence for the page. */
  line: string;
  /** Why the game cannot be completed yet, or null. */
  problem: string | null;
};

export function completionCheck(scores: Record<string, number[]>, playerIds: string[]): CompletionCheck {
  const columns = playerIds.map((id) => scores[id] ?? []);
  const roundCount = columns.reduce((max, column) => Math.max(max, column.length), 0);
  const unbalancedRounds: number[] = [];
  for (let index = 0; index < roundCount; index += 1) {
    const sum = columns.reduce((acc, column) => acc + (Number(column[index]) || 0), 0);
    if (sum !== 0) unbalancedRounds.push(index + 1);
  }
  const totalSum = columns.reduce((acc, column) => acc + column.reduce((s, v) => s + (Number(v) || 0), 0), 0);

  if (roundCount === 0) {
    // Allowed, as before: an abandoned table can still be closed out.
    return { ok: false, roundCount, unbalancedRounds, totalSum, line: 'No rounds yet. The game will be completed with no scores.', problem: null };
  }
  if (unbalancedRounds.length > 0) {
    const list = unbalancedRounds.map((n) => `round ${n}`).join(', ');
    return {
      ok: false,
      roundCount,
      unbalancedRounds,
      totalSum,
      line: `Scores do not add to 0 in ${list}.`,
      problem: `Fix ${list} with Edit round first. Every round must add to 0.`,
    };
  }
  return {
    ok: true,
    roundCount,
    unbalancedRounds,
    totalSum,
    line: `${roundCount === 1 ? '1 round' : `${roundCount} rounds`} · every round adds to 0.`,
    problem: null,
  };
}

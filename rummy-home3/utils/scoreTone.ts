/** How a single round score is shown on the scorecard. */
export type ScoreTone = 'positive' | 'zero' | 'negative' | 'bigNegative';

/**
 * A loss counts as "big" from half the Full count upwards (a full count of 80
 * makes -40 and worse red). Wins stay green; small losses are plain.
 */
export function bigNegativeThreshold(fullCount: number | undefined | null): number | null {
  if (!fullCount || fullCount <= 0) return null;
  return Math.ceil(fullCount / 2);
}

export function scoreTone(score: number, fullCount?: number | null): ScoreTone {
  if (score > 0) return 'positive';
  if (score === 0) return 'zero';
  const threshold = bigNegativeThreshold(fullCount);
  return threshold !== null && Math.abs(score) >= threshold ? 'bigNegative' : 'negative';
}

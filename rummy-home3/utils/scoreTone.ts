/** How a single round score is shown on the scorecard. */
export type ScoreTone = 'positive' | 'zero' | 'negative' | 'bigNegative';

/**
 * A loss counts as "big" from half the Full count upwards (a full count of 80
 * makes -40 and worse red). Wins stay green; small losses are plain.
 */
export function bigNegativeThreshold(fullCount: number | undefined | null): number | null {
  // Settings store Full count as a loss (-80) in older games and as 80 in newer ones.
  const magnitude = Math.abs(Number(fullCount) || 0);
  if (magnitude === 0) return null;
  return Math.ceil(magnitude / 2);
}

export function scoreTone(score: number, fullCount?: number | null): ScoreTone {
  if (score > 0) return 'positive';
  if (score === 0) return 'zero';
  const threshold = bigNegativeThreshold(fullCount);
  return threshold !== null && Math.abs(score) >= threshold ? 'bigNegative' : 'negative';
}

/**
 * How a round score is typed on the scorecard and in round entry/edit:
 * wins green and bold, every loss red (small or big) at the same size and not
 * bold, a saved 0 muted. `colorKey` names the theme colour so the rule is
 * testable without a theme.
 */
export type ScoreTextStyle = { colorKey: 'positive' | 'negative' | 'outline'; fontWeight: '800' | '600' };

export function scoreTextStyle(tone: ScoreTone): ScoreTextStyle {
  if (tone === 'positive') return { colorKey: 'positive', fontWeight: '800' };
  if (tone === 'zero') return { colorKey: 'outline', fontWeight: '600' };
  return { colorKey: 'negative', fontWeight: '600' };
}

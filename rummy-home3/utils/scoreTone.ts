/** How a single round score is shown on the scorecard. */
export type ScoreTone = 'positive' | 'zero' | 'negative' | 'bigNegative';

/**
 * The standard for every game (Nov 12): a win is highlighted green; a penalty whose size is
 * MORE than half the maximum possible score is red text with no background; every other
 * score, a small loss or a 0, is plain black. No red backgrounds anywhere on the scorecard.
 */

/**
 * The smallest loss that counts as big: more than half the Full count (a full count of 80
 * makes -41 and worse red; -40 is exactly half and stays black).
 */
export function bigNegativeThreshold(fullCount: number | undefined | null): number | null {
  // Settings store Full count as a loss (-80) in older games and as 80 in newer ones.
  const magnitude = Math.abs(Number(fullCount) || 0);
  if (magnitude === 0) return null;
  return Math.floor(magnitude / 2) + 1;
}

export function scoreTone(score: number, fullCount?: number | null): ScoreTone {
  if (score > 0) return 'positive';
  if (score === 0) return 'zero';
  const threshold = bigNegativeThreshold(fullCount);
  return threshold !== null && Math.abs(score) >= threshold ? 'bigNegative' : 'negative';
}

/**
 * How a round score is typed on the scorecard and in round entry/edit: a win green and bold
 * (on the green highlight), a big penalty red text, everything else plain black at the same
 * size. `colorKey` names the theme colour so the rule is testable without a theme.
 */
export type ScoreTextStyle = { colorKey: 'positive' | 'negative' | 'onSurface'; fontWeight: '800' | '600'; highlight: boolean };

export function scoreTextStyle(tone: ScoreTone): ScoreTextStyle {
  if (tone === 'positive') return { colorKey: 'positive', fontWeight: '800', highlight: true };
  if (tone === 'bigNegative') return { colorKey: 'negative', fontWeight: '600', highlight: false };
  return { colorKey: 'onSurface', fontWeight: '600', highlight: false };
}

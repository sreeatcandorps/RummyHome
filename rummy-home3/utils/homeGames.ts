/**
 * Home lists games in two groups: every live game, then Recent (finished ones).
 * Pure so the grouping and the date filter can be unit tested.
 */

export type HomeGame = { isComplete?: boolean; closedAt?: string | null; date: string };

export type RecentChip = 'all' | 'last10d';

/** Last 10 days is the default and sits first; All is the secondary choice. */
export const RECENT_CHIPS: { value: RecentChip; label: string }[] = [
  { value: 'last10d', label: 'Last 10 days' },
  { value: 'all', label: 'All' },
];

export const DEFAULT_RECENT_CHIP: RecentChip = 'last10d';

export const RECENT_WINDOW_DAYS = 10;

/** Live is any game still being scored. Recent is Completed or Closed. */
export function splitHomeGames<T extends HomeGame>(games: T[]): { live: T[]; recent: T[] } {
  return {
    live: games.filter((game) => !game.isComplete),
    recent: games.filter((game) => Boolean(game.isComplete)),
  };
}

/** Rolling window from now. A game dated in the future still shows. */
export function isWithinLastDays(value: string, days: number, now = new Date()): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() >= now.getTime() - days * 24 * 60 * 60 * 1000;
}

export function filterRecentGames<T extends HomeGame>(games: T[], chip: RecentChip, now = new Date()): T[] {
  if (chip === 'all') return games;
  return games.filter((game) => isWithinLastDays(game.date, RECENT_WINDOW_DAYS, now));
}

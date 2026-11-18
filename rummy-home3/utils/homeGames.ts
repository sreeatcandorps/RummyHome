/**
 * Home lists games in two groups: every live game, then Recent (every finished
 * one, newest finish first). There is no Recent filter (Nov 10): the chips drew
 * the eye away from the games. Pure so the grouping can be unit tested.
 */

export type HomeGame = { id?: string; isComplete?: boolean; closedAt?: string | null; completedAt?: string | null; date: string };

/**
 * When a finished game finished. Completed games carry completed_at and keep
 * it when they are Closed; older rows without it fall back to closed_at, then
 * to the game date, so the order is always defined.
 */
export function finishedAt<T extends HomeGame>(game: T): string {
  return game.completedAt || game.closedAt || game.date;
}

const timeOf = (value: string) => {
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

/** Most recently finished first; ties fall back to game date, then id, so the order is stable. */
export function sortRecentGames<T extends HomeGame>(games: T[]): T[] {
  return [...games].sort((a, b) =>
    timeOf(finishedAt(b)) - timeOf(finishedAt(a))
    || timeOf(b.date) - timeOf(a.date)
    || (a.id ?? '').localeCompare(b.id ?? ''));
}

/** Live is any game still being scored. Recent is Completed or Closed, newest finish first. */
export function splitHomeGames<T extends HomeGame>(games: T[]): { live: T[]; recent: T[] } {
  return {
    live: games.filter((game) => !game.isComplete),
    recent: sortRecentGames(games.filter((game) => Boolean(game.isComplete))),
  };
}

/** Rolling window from now. A game dated in the future still shows. */
export function isWithinLastDays(value: string, days: number, now = new Date()): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() >= now.getTime() - days * 24 * 60 * 60 * 1000;
}

/** Recent shows this many games at first and reveals this many more per "Show more" tap (PR 10b, Q10.4). */
export const RECENT_PAGE = 20;

export type RecentPaging = {
  /** How many Recent rows to draw. */
  visible: number;
  /**
   * What the Show more control does: `reveal` draws more of the games already loaded,
   * `fetch` asks the server for the next page, `none` hides the control (every game is shown).
   */
  action: 'reveal' | 'fetch' | 'none';
  /** Games not yet drawn, counting only the ones already loaded. */
  hidden: number;
};

/**
 * Pure paging rule: reveal from what Home already has (one round-trip on open), and only
 * when that runs out ask for the next page — unless the last page was short, which means
 * the server has nothing more.
 */
export function recentPaging(finishedCount: number, shown: number, mayHaveMore: boolean): RecentPaging {
  const visible = Math.min(Math.max(shown, RECENT_PAGE), finishedCount);
  const hidden = finishedCount - visible;
  if (hidden > 0) return { visible, action: 'reveal', hidden };
  return { visible, action: mayHaveMore ? 'fetch' : 'none', hidden: 0 };
}

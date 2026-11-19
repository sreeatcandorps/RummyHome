export type GameStatus = 'Active' | 'Completed' | 'Closed';

/**
 * One palette for Active / Completed / Closed everywhere: Home cards, Results rows, and help chips.
 * Active is the soft green tint, Completed the info blue, Closed grey (docs/design/02-design-system.md §5.2).
 */
export const GAME_STATUS_TONE: Record<GameStatus, 'primary' | 'info' | 'neutral'> = {
  Active: 'primary',
  Completed: 'info',
  Closed: 'neutral',
};

export const GAME_STATUS_ICON: Record<GameStatus, string> = {
  Active: 'circle-medium',
  Completed: 'flag-checkered',
  Closed: 'lock-outline',
};

/**
 * A Completed game can be reopened. D49 (Sree, Nov 19, option B): a Closed one too — its result stays
 * as saved, marked Out of date, and the other games in that result go back to Completed. Before D49 a
 * Closed game was refused here.
 */
export function canReopenGame(game: { isComplete?: boolean; closedAt?: string | null }): boolean {
  return Boolean(game.isComplete);
}

/** D49: the reopen is the one that un-closes a game and dates its result. */
export function reopenUncloses(game: { closedAt?: string | null }): boolean {
  return Boolean(game.closedAt);
}

export const REOPEN_BLOCKED_MESSAGE = 'Only a Completed game can be reopened.';

/**
 * D46 C (Sree, Nov 18): reopening a pool that already has awards clears them — the awards came
 * from the standings the reopen is about to change. Points games and pools without awards: nothing.
 */
export function reopenClearsAwards(game: { gameType?: string; awardedAt?: string | null }): boolean {
  return game.gameType === 'pool' && Boolean(game.awardedAt);
}

export const REOPEN_CLEARS_AWARDS_NOTE = 'The awards are cleared too: they were worked out from the standings as they stand now. Give them again after the next Complete.';

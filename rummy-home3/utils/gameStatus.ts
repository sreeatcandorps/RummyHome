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

/** A Completed game can be reopened until it is Closed (part of a declared result). */
export function canReopenGame(game: { isComplete?: boolean; closedAt?: string | null }): boolean {
  return Boolean(game.isComplete) && !game.closedAt;
}

export const REOPEN_BLOCKED_MESSAGE = 'This game is Closed: it is part of declared results and cannot be reopened.';

export type GameStatus = 'Active' | 'Completed' | 'Closed';

/** One palette for Active / Completed / Closed everywhere: Home cards, Results rows, and help chips. */
export const GAME_STATUS_TONE: Record<GameStatus, 'positive' | 'primary' | 'neutral'> = {
  Active: 'positive',
  Completed: 'primary',
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

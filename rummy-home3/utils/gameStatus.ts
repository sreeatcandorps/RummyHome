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

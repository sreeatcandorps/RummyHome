import { Game } from '@/types/game';
import { gameTypeColors } from '@/constants/theme';
import { isLocalToday, isWithinLast24Hours } from '@/utils/localDay';

export { isLocalToday, isWithinLast24Hours };

/** "Mon, Jul 27 · 6:27 PM" — the primary way players recognise a game. */
export function formatGameDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  const day = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${day} · ${time}`;
}

/** Short, human-shareable identifier. Falls back to the tail of the uuid. */
export function gameIdLabel(game: Pick<Game, 'id' | 'shareCode'>): string {
  return game.shareCode ?? game.id.slice(-6).toUpperCase();
}

/** Game type label for display: "Points" for stake games, "Pool" for pool games. */
export function gameTypeLabel(gameType: Game['gameType']): string {
  return gameType === 'pool' ? 'Pool' : 'Points';
}

export function gameTypeTint(gameType: Game['gameType'], tints: typeof gameTypeColors = gameTypeColors) {
  return gameType === 'pool' ? tints.pool : tints.stake;
}

/** G-number badge label (e.g. "G1", "G2"). Returns null if no number assigned. */
export function gameNumberLabel(game: Pick<Game, 'gameNumber'>): string | null {
  return game.gameNumber != null ? `G${game.gameNumber}` : null;
}

/** Game status for card display: Active, Completed, or Closed. */
export function gameStatusLabel(game: Pick<Game, 'isComplete' | 'closedAt'>): 'Active' | 'Completed' | 'Closed' {
  if (game.closedAt) return 'Closed';
  return game.isComplete ? 'Completed' : 'Active';
}

/** True if the game has been included in a declared result. */
export function isGameClosed(game: Pick<Game, 'closedAt'>): boolean {
  return Boolean(game.closedAt);
}

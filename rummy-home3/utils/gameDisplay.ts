import { Game } from '@/types/game';
import { gameTypeColors } from '@/constants/theme';

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

export function gameTypeLabel(gameType: Game['gameType']): string {
  return gameType === 'pool' ? 'Pool' : 'Stake';
}

export function gameTypeTint(gameType: Game['gameType']) {
  return gameType === 'pool' ? gameTypeColors.pool : gameTypeColors.stake;
}

import { Game } from '@/types/game';
import { Player } from '@/types/player';

/**
 * Last-known game and seats, per game id, kept for the life of the app process.
 *
 * Screens seed their first render from here (stale-while-revalidate): coming
 * back to the scorecard after saving a round shows the new round at once while
 * the fresh copy loads, instead of a spinner. Every read from the database
 * refreshes the entry, so it is never older than the last successful fetch.
 */
const games = new Map<string, Game>();
const seats = new Map<string, Player[]>();

export const gameCache = {
  peekGame: (gameId: string | null | undefined): Game | null => (gameId ? games.get(gameId) ?? null : null),
  peekSeats: (gameId: string | null | undefined): Player[] | null => (gameId ? seats.get(gameId) ?? null : null),
  putGame(game: Game | null | undefined) {
    if (game) games.set(game.id, game);
    return game ?? null;
  },
  putSeats(gameId: string, list: Player[]) {
    seats.set(gameId, list);
    return list;
  },
  forget(gameId: string) {
    games.delete(gameId);
    seats.delete(gameId);
  },
  clear() {
    games.clear();
    seats.clear();
  },
  /** For tests and diagnostics. */
  size: () => games.size,
};

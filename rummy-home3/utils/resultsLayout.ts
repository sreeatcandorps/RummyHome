import { buildPlayerInitials } from '@/utils/playerInitials';
import { formatPoints, gameShortLabel, playersByFirstName, scoreCell } from '@/utils/results';

/** The share image breaks totals down per game only up to this many games. */
export const SHARE_BREAKDOWN_MAX_GAMES = 5;
export const SHARE_BREAKDOWN_OMITTED = 'Full details in PDF';

export type SheetLikeGame = { scores: Record<string, number> };

/** Players seated in at least one of the games, each counted once. */
export function uniquePlayerCount(games: SheetLikeGame[]): number {
  const ids = new Set<string>();
  games.forEach((game) => Object.keys(game.scores).forEach((id) => ids.add(id)));
  return ids.size;
}

export type ShareBreakdown = {
  /** "G1" … then "Total". */
  columns: string[];
  rows: { initials: string; name: string; cells: string[]; total: string }[];
};

/**
 * The compact grid under the totals on the share image: initials down the side,
 * G1..G5 across, Total last. Null past SHARE_BREAKDOWN_MAX_GAMES so the image stays short.
 */
export function buildShareBreakdown(input: {
  players: { id: string; name: string }[];
  games: SheetLikeGame[];
  totals: Record<string, number>;
}): ShareBreakdown | null {
  if (input.games.length === 0 || input.games.length > SHARE_BREAKDOWN_MAX_GAMES) return null;
  const players = playersByFirstName(input.players);
  const initials = buildPlayerInitials(players.map((player) => player.name));
  return {
    columns: [...input.games.map((_, index) => gameShortLabel(index)), 'Total'],
    rows: players.map((player, index) => ({
      initials: initials[index],
      name: player.name,
      cells: input.games.map((game) => scoreCell(game.scores, player.id)),
      total: formatPoints(input.totals[player.id] ?? 0),
    })),
  };
}

/** True when the image should say "Full details in PDF" instead of drawing the grid. */
export function shareBreakdownOmitted(gameCount: number): boolean {
  return gameCount > SHARE_BREAKDOWN_MAX_GAMES;
}

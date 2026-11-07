import { firstAppearanceOrder, initialsById } from '@/utils/playerInitials';
import { formatPoints, playersByFirstName, scoreCell, sheetGameLabel } from '@/utils/results';

/** Up to this many games sit across the share grid; more than that and the games go down the side instead. */
export const SHARE_BREAKDOWN_MAX_GAMES = 5;
/** Note under the grid when every game is on the image but rounds are only in the PDF. */
export const SHARE_BREAKDOWN_OMITTED = 'Round by round in the PDF';

export type SheetLikeGame = { scores: Record<string, number>; name?: string; label?: string };

/** Players seated in at least one of the games, each counted once. */
export function uniquePlayerCount(games: SheetLikeGame[]): number {
  const ids = new Set<string>();
  games.forEach((game) => Object.keys(game.scores).forEach((id) => ids.add(id)));
  return ids.size;
}

export type ShareBreakdown = {
  /**
   * gamesAcross: initials down the side, G labels across, Total last (up to 5 games).
   * gamesDown: G labels down the side, initials across, a Total row last — every game fits,
   * however many, with small numbers.
   */
  orientation: 'gamesAcross' | 'gamesDown';
  /** Column headers after the corner cell. gamesAcross: G labels then "Total"; gamesDown: initials. */
  columns: string[];
  /** Full names for the initials, in column (gamesDown) or row (gamesAcross) order. */
  legend: { initials: string; name: string }[];
  rows: { head: string; cells: string[]; total?: boolean }[];
  gameCount: number;
  /** Compact type when there is a lot to fit. */
  dense: boolean;
};

/**
 * The grid under the totals on the share image. Every selected game is on it:
 * games go across for five or fewer, down the side for more.
 */
export function buildShareBreakdown(input: {
  players: { id: string; name: string }[];
  games: SheetLikeGame[];
  totals: Record<string, number>;
}): ShareBreakdown | null {
  if (input.games.length === 0) return null;
  const players = playersByFirstName(input.players);
  const initials = initialsById(firstAppearanceOrder(input.players, input.games));
  const legend = players.map((player) => ({ initials: initials.get(player.id) ?? '?', name: player.name }));
  const labels = input.games.map((game, index) => sheetGameLabel({ label: game.label, name: game.name ?? `G${index + 1}` }));
  const total = (player: { id: string }) => formatPoints(input.totals[player.id] ?? 0);
  if (input.games.length <= SHARE_BREAKDOWN_MAX_GAMES) {
    return {
      orientation: 'gamesAcross',
      columns: [...labels, 'Total'],
      legend,
      rows: players.map((player, index) => ({
        head: legend[index].initials,
        cells: [...input.games.map((game) => scoreCell(game.scores, player.id)), total(player)],
      })),
      gameCount: input.games.length,
      dense: players.length > 8,
    };
  }
  return {
    orientation: 'gamesDown',
    columns: legend.map((entry) => entry.initials),
    legend,
    rows: [
      ...input.games.map((game, index) => ({
        head: labels[index],
        cells: players.map((player) => scoreCell(game.scores, player.id)),
      })),
      { head: 'Total', cells: players.map(total), total: true },
    ],
    gameCount: input.games.length,
    dense: players.length > 6 || input.games.length > 12,
  };
}

/** "AP Anil Peddi · HG Harish …" wrapped so every name stays on the image. */
export function legendLines(legend: { initials: string; name: string }[], maxChars = 88): string[] {
  const lines: string[] = [];
  let current = '';
  legend.forEach((entry) => {
    const part = `${entry.initials} ${entry.name}`;
    if (current && `${current} · ${part}`.length > maxChars) {
      lines.push(current);
      current = part;
    } else {
      current = current ? `${current} · ${part}` : part;
    }
  });
  if (current) lines.push(current);
  return lines;
}

/** True when the grid shows game totals only and the rounds live in the PDF. */
export function shareBreakdownOmitted(gameCount: number): boolean {
  return gameCount > SHARE_BREAKDOWN_MAX_GAMES;
}

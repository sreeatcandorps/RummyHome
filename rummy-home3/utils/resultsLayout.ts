import { firstAppearanceOrder, initialsById } from '@/utils/playerInitials';
import { formatPoints, playersByFirstName, scoreCell, sheetGameLabel } from '@/utils/results';

/** At most this many game columns in one band of the share grid; more games wrap into further bands. */
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

/**
 * One header row of up to five game labels (the last band also carries "Total"),
 * followed by one score row per player.
 */
export type ShareBand = {
  /** G labels for this band, then "Total" on the last band. */
  columns: string[];
  /** One row per player, in the same order in every band. */
  rows: { head: string; cells: string[] }[];
  /** True when the last column is the Total column. */
  hasTotal: boolean;
};

export type ShareBreakdown = {
  /** Players down the side, games across, wrapped into bands of up to five games (G1–G5, then G6–G10 …). */
  bands: ShareBand[];
  /** Full names for the initials, in row order. */
  legend: { initials: string; name: string }[];
  gameCount: number;
  /** Compact type when there is a lot to fit. */
  dense: boolean;
};

/** Split n items into runs of `size`: [0..5), [5..10) … */
export function bandRanges(count: number, size = SHARE_BREAKDOWN_MAX_GAMES): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  for (let start = 0; start < count; start += size) ranges.push({ start, end: Math.min(count, start + size) });
  return ranges;
}

/**
 * The grid under the totals on the share image. Every selected game is on it:
 * players are rows, games are columns, and past five games the header wraps
 * into another band of headers with matching score rows, so it always fits.
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
  const ranges = bandRanges(input.games.length);
  const bands: ShareBand[] = ranges.map(({ start, end }, bandIndex) => {
    const last = bandIndex === ranges.length - 1;
    const games = input.games.slice(start, end);
    return {
      columns: [...labels.slice(start, end), ...(last ? ['Total'] : [])],
      rows: players.map((player, index) => ({
        head: legend[index].initials,
        cells: [...games.map((game) => scoreCell(game.scores, player.id)), ...(last ? [total(player)] : [])],
      })),
      hasTotal: last,
    };
  });
  return {
    bands,
    legend,
    gameCount: input.games.length,
    dense: players.length > 8,
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

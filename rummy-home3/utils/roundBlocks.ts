import { chunkBy, ResultsRoundTable, RoundBlock } from '@/utils/resultsDetails';

/** The round-number column at the left of every block, in dp. */
export const ROUND_COLUMN_WIDTH = 40;
/** A score cell is never narrower than this; a two-line head (initials over total) needs it. */
export const MIN_CELL_WIDTH = 56;
/** About how wide one tabular digit (or sign) is at 14 px, plus the cell padding. */
const CHAR_WIDTH = 9;
const CELL_PADDING = 10;

/**
 * v12 point 13 (Sree, Nov 19): "I see 5 players and then scores, but I can't see the fifth one.
 * It's cutting off." How many players fit side by side at a readable size in `width` dp: the
 * widest text in the table sets the cell width, the round column takes its share first, and the
 * answer is clamped between 1 and the PDF's block size (5, 4 or 3 by the widest text).
 */
export function screenBlockSize(width: number, widestChars: number, maxPerBlock: number): number {
  if (width <= 0) return maxPerBlock;
  const cell = Math.max(MIN_CELL_WIDTH, widestChars * CHAR_WIDTH + CELL_PADDING);
  return Math.max(1, Math.min(maxPerBlock, Math.floor((width - ROUND_COLUMN_WIDTH) / cell)));
}

/** The same players, totals and rounds re-cut into blocks of `size` (the data's own blocks are the PDF's). */
export function rechunkRoundTable(table: ResultsRoundTable, size: number): RoundBlock[] {
  if (size === table.blockSize) return table.blocks;
  const positions = table.initials.map((_, position) => position);
  return chunkBy(positions, size).map((block) => ({
    heads: block.map((position) => ({ initials: table.initials[position], playerNo: table.playerNos[position] ?? null, total: table.totals[position] })),
    rows: table.rows.map((row) => ({ round: row.round, cells: block.map((position) => row.cells[position]) })),
  }));
}

import { LegendEntry } from '@/utils/resultsDesign';

/**
 * v12 point 14 (Sree, Nov 19): the abbreviation key is a two-column table of initials · name · #ID.
 * A narrow card (under 300 dp) falls back to one column so names are not squeezed.
 */
export const LEGEND_TWO_COLUMNS_FROM = 300;

export function legendColumns(width: number): 1 | 2 {
  return width >= LEGEND_TWO_COLUMNS_FROM ? 2 : 1;
}

/** Rows read down each column, so the key reads in seat order: 1–3 on the left, 4–6 on the right. */
export function legendRows(entries: LegendEntry[], columns: 1 | 2): (LegendEntry | null)[][] {
  const perColumn = Math.ceil(entries.length / columns);
  return Array.from({ length: perColumn }, (_, row) =>
    Array.from({ length: columns }, (_, column) => entries[column * perColumn + row] ?? null),
  );
}

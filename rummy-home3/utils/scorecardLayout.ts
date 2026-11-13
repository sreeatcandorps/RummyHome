/**
 * PR 4 — the scorecard table's sizes come from its type, never from a fixed number.
 * Pure (no React Native imports) so the unit tests can load it.
 */

/** Header and cell text stop growing with the phone's font size here, so 20 columns still fit. */
export const TABLE_MAX_FONT_SCALE = 1.2;

/** Below this a column can no longer show "-1234" legibly, so the table scrolls sideways instead. */
export const MIN_COLUMN_WIDTH = 38;

/** The dealer's column carries a 4 dp bar along its bottom edge. */
export const DEALER_BAR = 4;

export type TextMetrics = { fontSize: number; lineHeight: number };

const metrics = (fontSize: number, ratio = 1.2): TextMetrics => ({ fontSize, lineHeight: Math.ceil(fontSize * ratio) });

/** Score cells: 18 pt on a roomy column, down to 13 pt at the 38 dp minimum. */
export function cellFontSize(columnWidth: number): number {
  if (columnWidth >= 64) return 18;
  if (columnWidth >= 52) return 16;
  if (columnWidth >= 44) return 15;
  return 13;
}

/**
 * The three header lines — initials, signed total, and the DEALS / crown / seat-bar line —
 * step down together as the column narrows. Totals read a size up from the cells except on
 * narrow columns, where a 4-digit total must still fit.
 */
export function headerType(columnWidth: number): { initials: TextMetrics; total: TextMetrics; deals: TextMetrics } {
  const cell = cellFontSize(columnWidth);
  return {
    initials: metrics(cell - 1),
    total: metrics(columnWidth >= 56 ? cell + 2 : cell - 1),
    deals: metrics(columnWidth >= 52 ? 9 : 8, 1.35),
  };
}

/** The DEALS word fits from 44 dp up; narrower columns show the cards icon instead of "DEA…". */
export function dealsBadge(columnWidth: number): 'text' | 'icon' {
  return columnWidth >= 44 ? 'text' : 'icon';
}

/** The font scale the table actually renders at (the Texts carry the same `maxFontSizeMultiplier`). */
export const effectiveFontScale = (fontScale: number) => Math.min(Math.max(fontScale, 1), TABLE_MAX_FONT_SCALE);

/** Vertical padding above and below the header's three lines. */
export const headerPadding = (compact: boolean) => (compact ? 3 : 4);

/**
 * Header height = the three line heights at the effective font scale + the dealer bar + padding.
 * Nothing is clipped at any font size because the box is sized from the text, not the other way round.
 */
export function headerHeight(columnWidth: number, compact: boolean, fontScale = 1): number {
  const scale = effectiveFontScale(fontScale);
  const type = headerType(columnWidth);
  const lines = (type.initials.lineHeight + type.total.lineHeight + type.deals.lineHeight) * scale;
  return Math.ceil(lines + DEALER_BAR + headerPadding(compact) * 2);
}

/** A score row is one line of cell text plus breathing room; it grows with the font scale and never clips. */
export function rowHeight(columnWidth: number, columnCount: number, compact: boolean, fontScale = 1): number {
  const scale = effectiveFontScale(fontScale);
  const line = Math.ceil(cellFontSize(columnWidth) * 1.25 * scale);
  const floor = compact ? 34 : columnCount > 8 ? 42 : 48;
  return Math.max(floor, line + 10);
}

export type ColumnLayout = {
  roundColumnWidth: number;
  columnWidth: number;
  contentWidth: number;
  scrollsSideways: boolean;
};

/** Columns share the width left of the round column; under the minimum they keep 38 dp and the table scrolls. */
export function columnLayout(tableWidth: number, columnCount: number, compact: boolean): ColumnLayout {
  const roundColumnWidth = compact ? 48 : 42;
  const available = Math.max(tableWidth - roundColumnWidth, 0);
  const fitWidth = columnCount ? available / columnCount : available;
  const columnWidth = Math.max(MIN_COLUMN_WIDTH, fitWidth);
  return { roundColumnWidth, columnWidth, contentWidth: columnWidth * columnCount, scrollsSideways: fitWidth < MIN_COLUMN_WIDTH };
}

/** The strip chip: "10 players" from the seats in the game, not from who has scores. */
export function playersChipLabel(seatCount: number): string {
  return `${seatCount} ${seatCount === 1 ? 'player' : 'players'}`;
}

export type FooterLine = { label: string; value: string };

/**
 * Under the table: the creator, one line per admin, and the unique game id (the 6-character share
 * code, D4.1). "Game S16" is in the strip above, so it is not repeated here.
 */
export function scorecardFooterLines(
  game: { createdBy?: string | null; shareCode?: string | null },
  members: { id: string; name: string; seatRole?: string | null }[],
  creatorName?: string | null,
): FooterLine[] {
  const creator = creatorName ?? members.find((m) => m.id === game.createdBy)?.name ?? null;
  const admins = members.filter((m) => m.seatRole === 'game_admin' && m.id !== game.createdBy);
  const lines: FooterLine[] = [];
  if (creator) lines.push({ label: 'Creator', value: creator });
  for (const admin of admins) lines.push({ label: 'Admin', value: admin.name });
  if (game.shareCode) lines.push({ label: 'Unique game ID', value: game.shareCode.toUpperCase() });
  return lines;
}

/** Landscape has no room for four lines: the same pieces joined on one line. */
export const footerOneLine = (lines: FooterLine[]) => lines.map((line) => `${line.label}: ${line.value}`).join(' · ');

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

/**
 * F13.22 — initials are never clipped. Bold capitals and digits are estimated per glyph (W and M
 * are the widest at ~0.95 em, I / J / 1 the narrowest) and the label's font steps down until the
 * whole label fits the width it has. The estimate is deliberately generous (a touch wider than
 * Roboto Bold) so the text layer never has to truncate; `adjustsFontSizeToFit` stays on the Text as
 * a native safety net for fonts the estimate does not know.
 */
const WIDE_GLYPHS = new Set(['W', 'M']);
const NARROW_GLYPHS = new Set(['I', 'J', '1']);
const glyphEm = (ch: string) => (WIDE_GLYPHS.has(ch) ? 0.95 : NARROW_GLYPHS.has(ch) ? 0.42 : 0.74);

/** Estimated advance width in dp of `text` set bold at `fontSize` with `letterSpacing` between glyphs. */
export function estimateTextWidth(text: string, fontSize: number, letterSpacing = 0): number {
  const glyphs = [...text];
  return glyphs.reduce((w, ch) => w + glyphEm(ch) * fontSize, 0) + letterSpacing * Math.max(0, glyphs.length - 1);
}

/** Smaller than this the label is unreadable; the width budget is sized so it is never reached. */
export const INITIALS_MIN_FONT = 8;
export const INITIALS_LETTER_SPACING = 0.2;
/** A score column's horizontal padding (styles.cell) plus its hairline border. */
export const COLUMN_INSET = 2 * 2 + 1;

/** The width a column header's initials may use. */
export const initialsWidthIn = (columnWidth: number) => Math.max(0, columnWidth - COLUMN_INSET);

/**
 * The largest font size (half-point steps) at or under `base` at which `label` fits `available`
 * dp once the phone's font scale is applied; never under INITIALS_MIN_FONT.
 */
export function fitInitialsFontSize(label: string, available: number, base: number, fontScale = 1): number {
  let size = base;
  while (size > INITIALS_MIN_FONT && estimateTextWidth(label, size * fontScale, INITIALS_LETTER_SPACING) > available) size -= 0.5;
  return size;
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
 * Nov 18 (Sree): the pool header lost its #number line, so Points and Pool headers are the same height;
 * `pool` stays in the signature for the callers and the slack that kept the dealer column from
 * shrinking its initials (CI run 1 of PR 24).
 */
export function headerHeight(columnWidth: number, compact: boolean, fontScale = 1, pool = false): number {
  const scale = effectiveFontScale(fontScale);
  const type = headerType(columnWidth);
  const lines = (type.initials.lineHeight + type.total.lineHeight + type.deals.lineHeight) * scale;
  return Math.ceil(lines + DEALER_BAR + headerPadding(compact) * 2 + (pool ? POOL_HEADER_SLACK : 0));
}
export const POOL_HEADER_SLACK = DEALER_BAR;

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

export const roundColumnWidthFor = (compact: boolean) => (compact ? 48 : 42);

/**
 * Columns share the width left of the round column; under the minimum they keep 38 dp and the table scrolls.
 * D90: `visible` caps how many player columns share that width (portrait 5 · 7 · Max); the rest are a
 * sideways swipe away. Fewer players than the cap share the width as before. Unset: no cap (landscape).
 */
export function columnLayout(tableWidth: number, columnCount: number, compact: boolean, visible?: number): ColumnLayout {
  const roundColumnWidth = roundColumnWidthFor(compact);
  const available = Math.max(tableWidth - roundColumnWidth, 0);
  const shown = visible ? Math.min(columnCount, Math.max(1, visible)) : columnCount;
  const fitWidth = shown ? available / shown : available;
  const columnWidth = Math.max(MIN_COLUMN_WIDTH, fitWidth);
  return { roundColumnWidth, columnWidth, contentWidth: columnWidth * columnCount, scrollsSideways: shown < columnCount || fitWidth < MIN_COLUMN_WIDTH };
}

/** D90 (Sree, Nov 24): "5, 7, and then max" — the portrait scorecard's column choices. */
export type ColumnChoice = 5 | 7 | 'max';
export const COLUMN_CHOICE_DEFAULT: ColumnChoice = 5;
export const COLUMN_CHOICE_KEY = 'scorecardColumns';
export const COLUMN_CHOICE_LABEL: Record<`${ColumnChoice}`, string> = { 5: '5', 7: '7', max: 'Max' };

/** Max: as many player columns as fit at MIN_COLUMN_WIDTH, from the table's own width (never fewer than one). */
export function maxColumns(tableWidth: number, compact: boolean): number {
  return Math.max(1, Math.floor(Math.max(tableWidth - roundColumnWidthFor(compact), 0) / MIN_COLUMN_WIDTH));
}

/** How many player columns a choice shows on this table; 5 and 7 never exceed Max. */
export function visibleColumns(choice: ColumnChoice, tableWidth: number, compact: boolean): number {
  const max = maxColumns(tableWidth, compact);
  return choice === 'max' ? max : Math.min(choice, max);
}

/** The segments on offer: "5 · 7 · Max", or "5 · Max" when 7 would show the same columns as Max. */
export function columnChoices(tableWidth: number, compact: boolean): ColumnChoice[] {
  return maxColumns(tableWidth, compact) > 7 ? [5, 7, 'max'] : [5, 'max'];
}

/** A stored 7 on a phone where 7 is Max reads as Max, so the segment control always has one lit. */
export function shownChoice(choice: ColumnChoice, choices: ColumnChoice[]): ColumnChoice {
  return choices.includes(choice) ? choice : 'max';
}

export const readColumnChoice = (raw: string | null | undefined): ColumnChoice =>
  raw === '7' ? 7 : raw === 'max' ? 'max' : raw === '5' ? 5 : COLUMN_CHOICE_DEFAULT;
export const writeColumnChoice = (choice: ColumnChoice): string => String(choice);

/**
 * Pinch snaps, never zooms smoothly: once the fingers' distance has grown or shrunk by this factor the
 * table steps one choice (spread = fewer, bigger columns; pinch = more), and the gesture measures afresh.
 */
export const PINCH_SNAP = 1.25;

/** +1 = one step towards Max (fingers together), -1 = one step towards 5 (fingers apart), 0 = not yet. */
export function pinchStep(ratio: number): -1 | 0 | 1 {
  if (!(ratio > 0)) return 0;
  if (ratio >= PINCH_SNAP) return -1;
  if (ratio <= 1 / PINCH_SNAP) return 1;
  return 0;
}

export function stepColumnChoice(choice: ColumnChoice, choices: ColumnChoice[], step: -1 | 0 | 1): ColumnChoice {
  const at = choices.indexOf(shownChoice(choice, choices));
  return choices[Math.min(choices.length - 1, Math.max(0, at + step))];
}

/**
 * D89 (Sree, Nov 24): "landscape is landscape, no buttons, nothing, no three dots, just to see the
 * scorecard." Which parts of the scorecard screen are drawn: in landscape only the table, and a tap on it
 * opens nothing. `landscapeEditing` is the park switch (LANDSCAPE_EDITING in hooks/useLayout): on, landscape
 * gets today's chrome back.
 */
export type ScorecardChrome = {
  /** The Stack header: back, title, Share, Help, ⋮. */
  header: boolean;
  /** Tags, Actual toggle, deleted banner, completed line + Give awards, pool-over hint. */
  strip: boolean;
  /** Undo / Add round / Complete. */
  bottomBar: boolean;
  /** Creator / Admin / Unique game ID under the rounds. */
  footer: boolean;
  /** Round number, header total and DEALS badge taps. */
  taps: boolean;
};

export function scorecardChrome(landscape: boolean, landscapeEditing: boolean): ScorecardChrome {
  const on = !landscape || landscapeEditing;
  return { header: on, strip: on, bottomBar: on, footer: on, taps: on };
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

/**
 * PR 24 (Sree, Nov 17): the footer sits inside the scorecard, right under the last round row, and is
 * quiet — 70% of the labelLarge it used to be (14 → 10), italic, never bold — in both orientations
 * and for both kinds. It scrolls with the rounds.
 */
export const FOOTER_SCALE = 0.7;
const FOOTER_BASE_FONT = 14;
export const footerType = (): TextMetrics & { fontStyle: 'italic'; fontWeight: '400' } => ({
  fontSize: Math.round(FOOTER_BASE_FONT * FOOTER_SCALE),
  lineHeight: Math.ceil(FOOTER_BASE_FONT * FOOTER_SCALE * 1.4),
  fontStyle: 'italic',
  fontWeight: '400',
});

/**
 * Pool portrait (Nov 18, Sree): the card is not a fixed share of the screen (PR 24's 70 / 30 is gone).
 * It hugs its content — round rows (one placeholder row at 0 rounds), one empty row, the footer lines —
 * and is capped at `maxRows` round-row heights; the standings take the rest. Returns the card body
 * height for a content height, or the cap.
 */
export function poolCardBodyHeight(contentHeight: number, rowHeight: number, maxRows: number): number {
  return Math.min(Math.max(0, contentHeight), maxRows * rowHeight);
}

/** Sree (Nov 18): the pool card in portrait is at most five round rows tall; at 0 rounds it is five lines (row · empty row · Creator · Admin · ID). */
export const POOL_CARD_MAX_ROWS = 5;

/** How far the hugging card scrolls so the newest round sits at the bottom of its viewport (the empty row and footer stay below). */
export function newestRoundOffset(roundCount: number, rowHeight: number, viewportHeight: number): number {
  return Math.max(0, roundCount * rowHeight - viewportHeight);
}

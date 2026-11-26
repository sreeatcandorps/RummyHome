/**
 * Add players by initials (D112, design-review-2 §8.3a): the rows on top, the keyboard below,
 * one Save for every ready row, then a "saved" list with Edit / Remove and one Done.
 *
 * A row is two boxes of one character each: a letter, then a letter or a digit. A new player
 * carries no name, only the letters typed; the only name the screen can show is someone
 * already in My players who holds the same letters.
 */
import { MAX_SEATED_PLAYERS } from '@/constants/limits';
import { clashSentence, normalizeInitials, pickFreeInitials } from '@/utils/initials';

export type DraftRow = { first: string; last: string };

/** Rows on the screen at most; a new row appears only while this is not reached. */
export const ADD_ROWS_MAX = MAX_SEATED_PLAYERS;

export const ADD_SUBLINE = 'First-name letter · last-name letter. The cursor moves on by itself.';
export const NEW_PLAYER_NOTE = 'new player';
export const ONE_LETTER_NOTE = 'one letter';
/** The keyboard's own action key (Android shows the label; iOS has no Save key and shows Done). */
export const KEYBOARD_SAVE_LABEL = 'Save';
export const ADD_MORE_LABEL = '+ Add more';
export const DONE_LABEL = 'Done';
export const DISCARD_LABEL = 'Discard';

const LETTER = /^[A-Z]$/;
const LETTER_OR_DIGIT = /^[A-Z0-9]$/;

/** Both boxes filled with a valid character: this row is saved by Save. */
export function isReady(row: DraftRow): boolean {
  return LETTER.test(normalizeInitials(row.first)) && LETTER_OR_DIGIT.test(normalizeInitials(row.last));
}

/** One box filled (or a refused character in one): left out of the count and kept on screen. */
export function isHalf(row: DraftRow): boolean {
  return !isReady(row) && Boolean(row.first || row.last);
}

export function readyRows<T extends DraftRow>(rows: T[]): T[] {
  return rows.filter(isReady);
}

export function readyCount(rows: DraftRow[]): number {
  return readyRows(rows).length;
}

export const typedOf = (row: DraftRow) => normalizeInitials(row.first + row.last);

const players = (n: number) => `${n} ${n === 1 ? 'player' : 'players'}`;

/** The button in the bar above the keyboard: "Save 2 players"; plain "Save" (disabled) when none is ready. */
export function saveButtonLabel(ready: number): string {
  return ready > 0 ? `Save ${players(ready)}` : 'Save';
}

/** The count to the left of the Save button: "2 ready · 1 needs a 2nd letter". */
export function readyLine(ready: number, half: number): string {
  const base = `${ready} ready`;
  if (half === 0) return base;
  return `${base} · ${half} ${half === 1 ? 'needs' : 'need'} a 2nd letter`;
}

/** What the next character typed in a box becomes: one upper-case character, or '' when cleared. */
export function oneChar(text: string): string {
  return normalizeInitials(text).slice(-1);
}

/** Where the cursor goes once a box fills: first box → last box; last box → next row's first box. */
export function nextFocus(rowIndex: number, cell: 'first' | 'last'): { row: number; cell: 'first' | 'last' } {
  return cell === 'first' ? { row: rowIndex, cell: 'last' } : { row: rowIndex + 1, cell: 'first' };
}

/** A new empty row appears when the last row fills, up to the cap. */
export function needsNewRow(rows: DraftRow[], max = ADD_ROWS_MAX): boolean {
  const last = rows[rows.length - 1];
  return rows.length < max && (!last || isReady(last));
}

export type Prediction = {
  typed: string;
  /** What the database will store: the typed form when free, else the first free digit form (SK2). */
  stored: string;
  /** Who in My players already holds the typed letters. */
  holder: string | null;
  /** 1-based row number of an earlier row in this batch with the same letters. */
  sameAsRow: number | null;
};

/**
 * The initials each ready row will get, in row order, so a clash shows while typing and
 * nothing surprises after Save. `taken` maps label → name for My players (saved players of
 * this visit included). Half rows get null.
 */
export function predictRows(rows: DraftRow[], taken: ReadonlyMap<string, string>): (Prediction | null)[] {
  const used = new Set(taken.keys());
  const firstRowOf = new Map<string, number>();
  return rows.map((row, index) => {
    if (!isReady(row)) return null;
    const typed = typedOf(row);
    const stored = pickFreeInitials(typed, used);
    used.add(stored);
    const sameAsRow = taken.has(typed) ? null : firstRowOf.get(typed) ?? null;
    if (!firstRowOf.has(typed)) firstRowOf.set(typed, index + 1);
    return { typed, stored, holder: taken.get(typed) ?? null, sameAsRow };
  });
}

/** A holder whose name is only their initials says nothing; "SK is already SK" reads as a bug. */
const nameless = (holder: string, typed: string) => normalizeInitials(holder) === normalizeInitials(typed);

/** The line beside a ready row while typing: "SK · new player", or the clash sentence. */
export function typingNote(p: Prediction): string {
  if (p.stored === p.typed) return `${p.typed} · ${NEW_PLAYER_NOTE}`;
  if (p.holder && !nameless(p.holder, p.typed)) return clashSentence(p.typed, p.holder, p.stored);
  if (p.sameAsRow) return `Row ${p.sameAsRow} is already ${p.typed}. This new player is ${p.stored}.`;
  return `${p.typed} is already taken. This new player is ${p.stored}.`;
}

export type SavedEntry = { typed: string; initials: string; takenBy: string | null };

/** The initials were changed from what was typed (the row gets ! instead of ✓). */
export function initialsChanged(entry: SavedEntry): boolean {
  return normalizeInitials(entry.initials) !== normalizeInitials(entry.typed);
}

/** The note beside a saved row: "new player", or "Harish G is already HG". */
export function savedNote(entry: SavedEntry): string {
  if (!initialsChanged(entry)) return NEW_PLAYER_NOTE;
  const typed = normalizeInitials(entry.typed);
  if (entry.takenBy && !nameless(entry.takenBy, typed)) return `${entry.takenBy} is already ${typed}`;
  return `${typed} is already taken`;
}

/** The heading over the saved list: "8 players saved and seated" (from a game) or "8 players saved" (My players). */
export function savedHeading(count: number, seated: boolean): string {
  return `${players(count)} saved${seated ? ' and seated' : ''}`;
}

/** The line over the seated chips after Save: "Playing in this game · 12 · the 8 new ones in green". */
export function seatedLine(seated: number, fresh: number): string {
  const base = `Playing in this game · ${seated}`;
  if (fresh === 0) return base;
  return `${base} · ${fresh === 1 ? 'the new one' : `the ${fresh} new ones`} in green`;
}

/** "SK", "SK and HG", "SK, HG and VR", "SK, HG, VR and 2 more". */
export function listInitials(labels: string[], show = 3): string {
  if (labels.length <= 1) return labels[0] ?? '';
  if (labels.length <= show) return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
  return `${labels.slice(0, show).join(', ')} and ${labels.length - show} more`;
}

/** The back dialog's title: "SK is not saved yet" / "SK and HG are not saved yet". */
export function unsavedTitle(ready: string[]): string {
  return `${listInitials(ready)} ${ready.length === 1 ? 'is' : 'are'} not saved yet`;
}

/** The back dialog's body; one-letter rows are named and left out either way. */
export function unsavedBody(half: string[]): string {
  const lead = 'You typed letters but did not tap Save.';
  if (half.length === 0) return lead;
  const one = half.length === 1;
  return `${lead} ${listInitials(half)} ${one ? 'has' : 'have'} only one letter, so ${one ? 'it is' : 'they are'} left out either way.`;
}

/** The back dialog's main button: "Save SK and go back"; from two rows "Save 2 players and go back". */
export function unsavedSaveLabel(ready: string[]): string {
  return `Save ${ready.length === 1 ? ready[0] : players(ready.length)} and go back`;
}

/** Back asks only when there is something Save would keep; one-letter rows alone are dropped quietly. */
export function backNeedsDialog(rows: DraftRow[]): boolean {
  return readyCount(rows) > 0;
}

/** The pinned line when early rows have scrolled out of view: "↑ rows 1–2 (SK, HG) scrolled up · swipe down to see them". */
export function hiddenRowsLine(hidden: string[]): string | null {
  if (hidden.length === 0) return null;
  const labels = hidden.length > 3 ? `${hidden.slice(0, 3).join(', ')} …` : hidden.join(', ');
  const rows = hidden.length === 1 ? 'row 1' : `rows 1–${hidden.length}`;
  return `↑ ${rows} (${labels}) scrolled up · swipe down to see ${hidden.length === 1 ? 'it' : 'them'}`;
}

/** How far to scroll so the bottom of row `index` sits at the bottom of the visible list. */
export function scrollTargetFor(rowBottom: number, viewport: number, current: number): number | null {
  const target = Math.max(0, rowBottom - viewport);
  return target > current ? target : null;
}

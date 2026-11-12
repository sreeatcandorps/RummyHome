import { ScoreType } from '@/types/database';
import { distributeRummyWinnings } from '@/utils/rummyDistribution';

/**
 * State for the Add round screen, kept free of React so the rules can be
 * tested on their own.
 *
 * Flow: tap one or more players, then type a number or tap a preset. Rummy
 * players get the balancing points, split evenly, so the round adds to 0.
 */

export type PresetKind = 'drop' | 'middle_drop' | 'count';

export type PresetValues = {
  drop: number;
  middle_drop: number;
  count: number;
};

export type ConfirmedEntry = {
  value: number;
  scoreType: ScoreType;
};

export type Draft = {
  /** Digits typed so far, no sign. */
  digits: string;
  /** Minus is the default sign. */
  negative: boolean;
  /**
   * A digit was pressed in this draft. False right after a filled cell is
   * opened for editing, so the first digit replaces the prefilled value.
   */
  typed: boolean;
  /**
   * The user changed something (a digit or the sign). Moving away then
   * writes the number; leaving a prefilled value untouched does not.
   */
  edited: boolean;
};

export type RoundEntryState = {
  /** Confirmed, non-Rummy scores. */
  entries: Record<string, ConfirmedEntry>;
  /** Players who share the Rummy points, in the order they were tapped. */
  rummyIds: string[];
  /** Players the next number or preset applies to, in tap order. */
  selectedIds: string[];
  draft: Draft;
  /** Players whose score was just written; the screen flashes these cells. */
  lastSavedIds: string[];
};

export const MAX_DIGITS = 4;

export const emptyDraft = (): Draft => ({ digits: '', negative: true, typed: false, edited: false });

export const initialRoundEntryState = (): RoundEntryState => ({
  entries: {},
  rummyIds: [],
  selectedIds: [],
  draft: emptyDraft(),
  lastSavedIds: [],
});

/** True when the typed number would be written if the user moved on. */
export function hasPendingEntry(state: RoundEntryState): boolean {
  return state.selectedIds.length > 0 && state.draft.edited && state.draft.digits !== '';
}

export function draftValue(draft: Draft): number | undefined {
  if (draft.digits === '') return undefined;
  const magnitude = parseInt(draft.digits, 10);
  if (Number.isNaN(magnitude)) return undefined;
  // A typed 0 is a real score (the player neither won nor lost), never -0.
  if (magnitude === 0) return 0;
  return draft.negative ? -magnitude : magnitude;
}

/** Rummy points per player for the current confirmed entries. */
export function rummyShares(state: RoundEntryState): Record<string, number> {
  const total = Object.values(state.entries).reduce((sum, entry) => sum + entry.value, 0);
  return distributeRummyWinnings(total, state.rummyIds);
}

/** The score a player holds right now, confirmed or from the Rummy split. */
export function confirmedValue(state: RoundEntryState, playerId: string): number | undefined {
  if (state.rummyIds.includes(playerId)) return rummyShares(state)[playerId];
  return state.entries[playerId]?.value;
}

/** Sum of everything on the sheet. Save round needs this to be 0. */
export function balance(state: RoundEntryState): number {
  const entriesTotal = Object.values(state.entries).reduce((sum, entry) => sum + entry.value, 0);
  const shares = rummyShares(state);
  const rummyTotal = state.rummyIds.reduce((sum, id) => sum + (shares[id] ?? 0), 0);
  return entriesTotal + rummyTotal;
}

/**
 * Save round is allowed only when the round is balanced and someone has lost
 * points. A sheet of nothing but zeros is not a round.
 */
export function canSaveRound(state: RoundEntryState): boolean {
  const effective = commitPending(state);
  const someoneLost = Object.values(effective.entries).some((entry) => entry.value < 0);
  return balance(effective) === 0 && someoneLost;
}

/** The round as the scorecard stores it. */
export function toRoundScores(state: RoundEntryState): { playerId: string; value: number; scoreType: ScoreType }[] {
  const shares = rummyShares(state);
  return [
    ...Object.entries(state.entries).map(([playerId, entry]) => ({
      playerId,
      value: entry.value,
      scoreType: entry.scoreType,
    })),
    ...state.rummyIds.map((playerId) => ({
      playerId,
      value: shares[playerId] ?? 0,
      scoreType: 'rummy' as ScoreType,
    })),
  ];
}

function withoutIds<T>(record: Record<string, T>, ids: string[]): Record<string, T> {
  if (ids.length === 0) return record;
  const next = { ...record };
  ids.forEach((id) => {
    delete next[id];
  });
  return next;
}

function writeEntries(state: RoundEntryState, ids: string[], entry: ConfirmedEntry): RoundEntryState {
  const entries = { ...state.entries };
  ids.forEach((id) => {
    entries[id] = entry;
  });
  return {
    ...state,
    entries,
    rummyIds: state.rummyIds.filter((id) => !ids.includes(id)),
    selectedIds: [],
    draft: emptyDraft(),
    lastSavedIds: ids,
  };
}

/** Writes the typed number to every selected player. No-op without digits. */
export function saveScore(state: RoundEntryState): RoundEntryState {
  const value = draftValue(state.draft);
  if (value === undefined || state.selectedIds.length === 0) return state;
  // A typed positive number is a hand-entered win; everything else is a loss.
  const scoreType: ScoreType = value > 0 ? 'rummy' : 'count';
  return writeEntries(state, state.selectedIds, { value, scoreType });
}

/** Auto-save: writes a typed number the user never confirmed with Save score. */
export function commitPending(state: RoundEntryState): RoundEntryState {
  return hasPendingEntry(state) ? saveScore(state) : state;
}

/** Drop, Middle drop, or Full count for every selected player. */
export function applyPreset(state: RoundEntryState, kind: PresetKind, values: PresetValues): RoundEntryState {
  if (state.selectedIds.length === 0) return state;
  return writeEntries(state, state.selectedIds, { value: values[kind], scoreType: kind });
}

/**
 * Every selected player becomes a Rummy winner. Winners split the points the
 * rest of the table lost; see `distributeRummyWinnings` for uneven splits.
 */
export function applyRummy(state: RoundEntryState): RoundEntryState {
  if (state.selectedIds.length === 0) return state;
  const added = state.selectedIds.filter((id) => !state.rummyIds.includes(id));
  return {
    ...state,
    entries: withoutIds(state.entries, state.selectedIds),
    rummyIds: [...state.rummyIds, ...added],
    selectedIds: [],
    draft: emptyDraft(),
    lastSavedIds: state.selectedIds,
  };
}

/** X on a cell: drops the player's score and any number being typed for them. */
export function clearPlayer(state: RoundEntryState, playerId: string): RoundEntryState {
  const stillSelected = state.selectedIds.filter((id) => id !== playerId);
  return {
    ...state,
    entries: withoutIds(state.entries, [playerId]),
    rummyIds: state.rummyIds.filter((id) => id !== playerId),
    selectedIds: stillSelected,
    draft: stillSelected.length === 0 ? emptyDraft() : state.draft,
    lastSavedIds: [],
  };
}

/** Opens one filled cell for editing with its value prefilled. */
function prefilledDraft(value: number | undefined, negative: boolean): Draft {
  if (value === undefined) return { ...emptyDraft(), negative };
  return { digits: String(Math.abs(value)), negative: value <= 0, typed: false, edited: false };
}

/**
 * Tapping a cell.
 *
 * - With a typed number waiting, the tap first auto-saves it to the current
 *   selection. If the tapped cell was part of that selection the tap was a
 *   confirm and nothing stays selected; otherwise the tapped player becomes
 *   the new selection.
 * - Otherwise the tap toggles the player in the selection. A lone selected
 *   player with a score opens for editing (value prefilled, first digit
 *   replaces it). Growing to two or more players drops the prefill.
 */
export function tapPlayer(state: RoundEntryState, playerId: string): RoundEntryState {
  if (hasPendingEntry(state)) {
    const saved = saveScore(state);
    if (state.selectedIds.includes(playerId)) return saved;
    return {
      ...saved,
      selectedIds: [playerId],
      draft: prefilledDraft(confirmedValue(saved, playerId), true),
    };
  }

  const alreadySelected = state.selectedIds.includes(playerId);
  const selectedIds = alreadySelected
    ? state.selectedIds.filter((id) => id !== playerId)
    : [...state.selectedIds, playerId];

  // The sign chosen before tapping anyone is kept, so "+ then 41" works too.
  const draft = selectedIds.length === 1
    ? prefilledDraft(confirmedValue(state, selectedIds[0]), state.draft.negative)
    : { ...emptyDraft(), negative: state.draft.negative };

  return { ...state, selectedIds, draft, lastSavedIds: [] };
}

/** Keypad digit. Ignored with nothing selected; a lone 0 never starts a number. */
export function pressDigit(state: RoundEntryState, digit: string): RoundEntryState {
  if (state.selectedIds.length === 0) return state;
  if (!/^\d$/.test(digit)) return state;

  const base = state.draft.typed ? state.draft.digits : '';
  // "0" is a real entry (an explicit zero). A digit after a lone 0 replaces it: 0 → 5, not 05.
  if (base === '0') {
    return { ...state, draft: { ...state.draft, digits: digit, typed: true, edited: true }, lastSavedIds: [] };
  }
  if (base.length >= MAX_DIGITS) return state;

  return { ...state, draft: { ...state.draft, digits: base + digit, typed: true, edited: true }, lastSavedIds: [] };
}

/** The +/- toggle. Flipping the sign on a prefilled value counts as an edit. */
export function setNegative(state: RoundEntryState, negative: boolean): RoundEntryState {
  if (state.draft.negative === negative) return state;
  return { ...state, draft: { ...state.draft, negative, edited: true } };
}

export type CellStatus = 'empty' | 'selected' | 'pending' | 'confirmed';

export type CellTone = 'neutral' | 'selected' | 'confirmed';

/**
 * Colour family for a cell: beige while nothing is entered, light yellow while
 * the player is selected (or a number is being typed for them), light green
 * once a score is confirmed for this round.
 */
export function cellTone(status: CellStatus): CellTone {
  if (status === 'selected' || status === 'pending') return 'selected';
  if (status === 'confirmed') return 'confirmed';
  return 'neutral';
}

/**
 * The Add round palette, as theme colour names so the screen and the tests
 * agree (docs/design/02-design-system.md, Add round). A cell you are working on or have saved sits
 * on white, with a green ring while it is selected; empty cells rest on the sunken beige.
 */
export type EntryFill = 'cellNeutral' | 'primaryContainer' | 'secondaryContainer' | 'positiveContainer' | 'tertiaryContainer' | 'surface';

export const CELL_FILL: Record<CellTone, EntryFill> = {
  neutral: 'cellNeutral',
  selected: 'surface',
  confirmed: 'surface',
};

export type ActionKind = 'sign' | 'preset' | 'rummy';

/** Fill of a key on the action row. The active sign is the soft green; Rummy is always blue; presets rest on surface and flash green when tapped. */
export function actionFill(kind: ActionKind, active = false): EntryFill {
  if (kind === 'sign') return active ? 'primaryContainer' : 'surface';
  if (kind === 'rummy') return 'tertiaryContainer';
  return 'surface';
}

/** How long a tapped preset glows green before settling. */
export const PRESET_FLASH_MS = 420;
export const PRESET_FLASH_FILL: EntryFill = 'positiveContainer';

/**
 * What a cell shows: a confirmed score (green), the number being typed for it
 * (pending), just a selection ring, or nothing.
 */
export function cellView(state: RoundEntryState, playerId: string): { status: CellStatus; value?: number } {
  const selected = state.selectedIds.includes(playerId);
  const confirmed = confirmedValue(state, playerId);

  if (selected) {
    const typed = state.draft.edited ? draftValue(state.draft) : undefined;
    if (typed !== undefined) return { status: 'pending', value: typed };
    return { status: 'selected', value: confirmed };
  }

  if (confirmed !== undefined) return { status: 'confirmed', value: confirmed };
  return { status: 'empty' };
}

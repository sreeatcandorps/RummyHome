import { GameSettings } from '@/types/game';

/**
 * Multiplier (PR 14, docs/multiplier-design.md). A Points game carries one multiplier in
 * `settings.multiplier` (integer 1–10,000, absent = 1); a pool never has one. Scores are stored as
 * the points the admin typed; every reader multiplies by the game's one value when it shows, shares
 * or saves a number. The multiplier can change at any time and always applies to the whole game.
 */
export const MULTIPLIER_MIN = 1;
export const MULTIPLIER_MAX = 10_000;
export const MULTIPLIER_DEFAULT = 1;
/** Sree's suggestion 2: a multiplier at or past this asks once ("×1,000? A Full count is 80,000 points."). */
export const MULTIPLIER_CONFIRM_FROM = 1_000;
/** Short forms start here: 10,000 → "10K"; 1,000,000 → "1M". */
export const SHORT_FROM = 10_000;
export const MILLION = 1_000_000;
export const BILLION = 1_000_000_000;
/** A short form, sign included, never passes this many characters (the 38 dp column floor holds five). */
export const SHORT_MAX_CHARS = 5;

export const MULTIPLIER_RANGE_TEXT = 'Multiplier is 1 to 10,000.';

/** The one reader of the key: a whole number 1–10,000, 1 when absent or odd; a pool always reads 1. */
export function multiplierOf(settings: Partial<GameSettings> | Record<string, unknown> | null | undefined, gameType: 'stake' | 'pool' | null | undefined = 'stake'): number {
  if (gameType === 'pool') return MULTIPLIER_DEFAULT;
  const raw = (settings as { multiplier?: unknown } | null | undefined)?.multiplier;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return MULTIPLIER_DEFAULT;
  return Math.min(MULTIPLIER_MAX, Math.max(MULTIPLIER_MIN, Math.floor(raw)));
}

/** The game's multiplier from a Game-shaped object. */
export function pointsGameMultiplier(game: { gameType?: 'stake' | 'pool' | null; settings?: Partial<GameSettings> | null } | null | undefined): number {
  if (!game) return MULTIPLIER_DEFAULT;
  return multiplierOf(game.settings, game.gameType ?? 'stake');
}

/** Whether a game shows anything about its multiplier (chip, toggle, small lines): only past ×1. */
export const hasMultiplier = (multiplier: number) => multiplier > 1;

/** Precedence (D14.4): the game's own value › the user's default › 1. */
export function resolveMultiplier(gameValue: unknown, userDefault: unknown): number {
  const asNumber = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= MULTIPLIER_MIN ? Math.min(MULTIPLIER_MAX, Math.floor(v)) : null);
  return asNumber(gameValue) ?? asNumber(userDefault) ?? MULTIPLIER_DEFAULT;
}

/** The actual value of one score: entered × multiplier. Nothing is rounded here. */
export const actual = (entered: number, multiplier: number) => (Number(entered) || 0) * multiplier;

/** Every column multiplied (for the surfaces that leave the screen); ×1 returns the same object. */
export function multiplyScores<T extends Record<string, (number | undefined)[] | undefined>>(scores: T, multiplier: number): T {
  if (multiplier === 1) return scores;
  const out: Record<string, (number | undefined)[] | undefined> = {};
  Object.entries(scores).forEach(([id, column]) => {
    if (!column) { out[id] = column; return; }
    const next: (number | undefined)[] = [];
    column.forEach((value, index) => { if (value !== undefined) next[index] = actual(value, multiplier); });
    next.length = column.length;
    out[id] = next;
  });
  return out as T;
}

/** "1,234,567" — exact, with thousands separators, sign kept (a plus only when asked). */
export function formatExact(value: number, signed = true): string {
  const n = Math.trunc(Number(value) || 0);
  const abs = Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0, useGrouping: true });
  if (n < 0) return `-${abs}`;
  return signed && n > 0 ? `+${abs}` : abs;
}

/**
 * The one short-form rule (D14.5, §3.2): up to 9,999 the whole number; from 10,000 thousands with a
 * K; from 1,000,000 millions with an M; never more than five characters including the sign; half
 * away from zero; no trailing ".0"; a value that rounds up to 1000K becomes 1M; 0 is "0".
 */
export function shortNumber(value: number, options: { plus?: boolean } = {}): string {
  const n = Math.trunc(Number(value) || 0);
  if (n === 0) return '0';
  const sign = n < 0 ? '-' : options.plus ? '+' : '';
  const abs = Math.abs(n);
  if (abs < SHORT_FROM) return `${sign}${abs}`;
  // Figures allowed for the number itself: 5 − sign − unit letter.
  const room = SHORT_MAX_CHARS - sign.length - 1;
  const unit = (scaled: number, letter: string): string => {
    const whole = Math.floor(scaled);
    const wholeDigits = String(whole).length;
    const decimals = Math.max(0, room - wholeDigits - 1);
    const factor = 10 ** decimals;
    const rounded = Math.round(scaled * factor) / factor;
    let text = rounded.toFixed(decimals);
    if (text.includes('.')) text = text.replace(/0+$/, '').replace(/\.$/, '');
    if (text.length > room) text = String(Math.round(scaled));
    return `${sign}${text}${letter}`;
  };
  if (abs < MILLION) {
    const text = unit(abs / 1000, 'K');
    // 999,500 rounds to "1000K" (five figures): say 1M instead.
    if (/^[+-]?1000K$/.test(text)) return `${sign}1M`;
    return text;
  }
  if (abs < BILLION) {
    const text = unit(abs / MILLION, 'M');
    if (/^[+-]?1000M$/.test(text)) return `${sign}1B`;
    return text;
  }
  // Only the extreme row of §2.1 gets here (a ×10,000 result of six nights); the same five-character rule holds.
  return unit(abs / BILLION, 'B');
}

/** Whether a short form was needed for any of these values (the footer then reads "(exact)"). */
export const anyShortened = (values: number[]) => values.some((v) => Math.abs(Math.trunc(Number(v) || 0)) >= SHORT_FROM);

/** "×100", "×10,000" — the chip and sub-line label. */
export const multiplierLabel = (multiplier: number) => `×${multiplier.toLocaleString('en-US')}`;

/** "A 30 is 3,000 · a Full count is 8,000" — the live example under the field (D14.3). */
export function multiplierExample(multiplier: number, fullCount: number | null | undefined): string {
  const full = Math.abs(Number(fullCount) || 80);
  if (multiplier <= 1) return `A 30 is 30 · a Full count is ${formatExact(full, false)}. ×1 unless you change it.`;
  return `A 30 is ${formatExact(30 * multiplier, false)} · a Full count is ${formatExact(full * multiplier, false)}`;
}

/**
 * The digits field: digits only, 1–10,000, leading zeros stripped; empty or 0 reads as 1; past the
 * cap is refused with the range text (Q14.13).
 */
export function parseMultiplierInput(text: string): { value: number; error: null } | { value: null; error: string } {
  const digits = (text ?? '').replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
  if (!digits || digits === '0') return { value: MULTIPLIER_DEFAULT, error: null };
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n) || n > MULTIPLIER_MAX) return { value: null, error: MULTIPLIER_RANGE_TEXT };
  return { value: Math.max(MULTIPLIER_MIN, n), error: null };
}

/** What the field shows for a stored value: "" at ×1 so the default reads as "nothing to pick". */
export const multiplierFieldText = (multiplier: number | undefined | null) => (multiplier && multiplier > 1 ? String(multiplier) : '');

/** Keeps the field to digits and the cap's five characters. */
export const multiplierFieldInput = (text: string) => text.replace(/[^0-9]/g, '').slice(0, 5);

// ---------- changing the multiplier (D14.2 final, §3.7, M22) ----------

export const APPLY_WHOLE_GAME = 'Apply to whole game';
export const START_NEW_GAME_INSTEAD = 'Start a new game instead';

/** Confirm text when rounds exist; null when nothing needs confirming (no rounds, or no change). */
export function multiplierChangeConfirm(roundCount: number, from: number, to: number): string | null {
  if (roundCount <= 0 || from === to) return null;
  return `${roundCount === 1 ? '1 round' : `${roundCount} rounds`} already played. The new multiplier will apply to the whole game, including ${roundCount === 1 ? 'that round' : 'those rounds'}. Or end this game and start a new one with the new multiplier.`;
}

/** Suggestion 2: a stray zero is cheap to catch once. Null when no confirm is needed. */
export function highMultiplierConfirm(multiplier: number, fullCount: number | null | undefined): string | null {
  if (multiplier < MULTIPLIER_CONFIRM_FROM) return null;
  const full = Math.abs(Number(fullCount) || 80);
  return `${multiplierLabel(multiplier)}? A Full count is ${formatExact(full * multiplier, false)} points.`;
}

// ---------- the view toggle (D14.8, Q14.7) ----------

export const ACTUAL_TOGGLE_KEY = 'scorecardShowActualPoints';
export const ACTUAL_TOGGLE_DEFAULT = true;
export const ACTUAL_LABEL = 'Actual points';
export const ENTERED_LABEL = 'Entered points';

/** Yellow banner while the toggle is off. */
export const enteredBanner = (multiplier: number) => `Showing entered points. ${multiplierLabel(multiplier)} still applies — totals, Results and shares use the actual points.`;

/** AsyncStorage holds "0" / "1"; anything else is the default. */
export const readActualToggle = (raw: string | null | undefined): boolean => (raw === '0' ? false : raw === '1' ? true : ACTUAL_TOGGLE_DEFAULT);
export const writeActualToggle = (on: boolean): string => (on ? '1' : '0');

// ---------- the Exact points sheet (D14.7, M11, M21) ----------

export type ExactLine = { id: string; name: string; label: string; total: number; exact: string; entered: string | null };

/** One line per player, exact actual total, "entered 1,234 × 100" under it when the multiplier is on. */
export function exactLines(input: { players: { id: string; name: string; label?: string }[]; totals: Record<string, number>; multiplier: number }): ExactLine[] {
  return [...input.players]
    .map((player) => {
      const entered = input.totals[player.id] ?? 0;
      const total = actual(entered, input.multiplier);
      return {
        id: player.id,
        name: player.name,
        label: player.label ?? '',
        total,
        exact: formatExact(total),
        entered: input.multiplier > 1 ? `entered ${formatExact(entered)} × ${input.multiplier.toLocaleString('en-US')}` : null,
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

/** "×100 applies to every round. Change it in Game settings — the whole game follows." */
export const exactSheetHint = (multiplier: number) => (multiplier > 1
  ? `${multiplierLabel(multiplier)} applies to every round. Change it in Game settings — the whole game follows.`
  : 'No multiplier on this game: every number is as entered.');

/** "Totals add to 0" / "Totals add to +10" / "… (exact)" when any short form is on the card (§3.4). */
export function totalsFooter(sum: number, shortened: boolean): string {
  const base = sum === 0 ? 'Totals add to 0' : `Totals add to ${formatExact(sum)}`;
  return shortened ? `${base} (exact)` : base;
}

/** "×100 · exact points" under a shared picture or PDF heading; null at ×1 (suggestion 3). */
export const exactSubline = (multiplier: number) => (multiplier > 1 ? `${multiplierLabel(multiplier)} · exact points` : null);

/** Digits in a value (no sign, no separators): the share image goes to one column from 8 (Q14.11). */
export const digitCount = (value: number) => String(Math.abs(Math.trunc(Number(value) || 0))).length;
export const SHARE_ONE_COLUMN_FROM_DIGITS = 8;

/** PDF blocks: five players a block to 7 characters, four to 9, three past that (Q14.12). */
export function pdfBlockSize(widestChars: number): number {
  if (widestChars <= 7) return 5;
  if (widestChars <= 9) return 4;
  return 3;
}

/** The widest text in a list, in characters. */
export const widestChars = (texts: string[]) => texts.reduce((max, text) => Math.max(max, text.length), 0);

/** Accessibility: "total plus twelve million four hundred thousand" is too much; read the exact figure with its sign instead. */
export const spokenExact = (value: number) => (value < 0 ? `minus ${formatExact(-value, false)}` : value > 0 ? `plus ${formatExact(value, false)}` : '0');

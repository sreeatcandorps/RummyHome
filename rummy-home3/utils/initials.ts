/**
 * Initials: the short label a player gets in scorecard columns.
 *
 * Rules (Sree, 11 Nov 2026):
 * - Two letters by default: first initial + last initial (one word: its first two letters).
 * - When two people in the same list share the two letters, the one who was there first
 *   keeps them and the other gets three letters built from the name (Suresh Kumar → SUK,
 *   then SKU, then SRK …). A digit is used only when every letter form is taken.
 * - The owner may type any 2–3 letters (A–Z, upper-cased) instead.
 * - Labels are unique within one owner's My players, never across owners.
 *
 * `initialsCandidates` is mirrored by `public.initials_candidates(text)` in migration
 * 022 so the database trigger and the app always agree on the default for a name.
 */

export const INITIALS_PATTERN = /^[A-Z]{2,3}$/;
/** What the database accepts: letters, or a letter followed by letters/digits when letters ran out. */
export const STORED_INITIALS_PATTERN = /^[A-Z][A-Z0-9]{1,2}$/;

const LIGATURES: Record<string, string> = { Æ: 'AE', Œ: 'OE', ß: 'SS', Ø: 'O', Ð: 'D', Þ: 'TH', Ł: 'L', Đ: 'D' };

/** Upper-case A–Z words of a name; accents dropped, digits and symbols ignored. */
export function nameWords(name: string | null | undefined): string[] {
  const upper = (name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[ÆŒßØÐÞŁĐ]/g, (ch) => LIGATURES[ch] ?? '');
  return upper
    .split(/[^A-Z]+/)
    .filter(Boolean);
}

/** The ordered default forms for a name: two letters, then three-letter forms, then digit forms. */
export function initialsCandidates(name: string | null | undefined): string[] {
  const words = nameWords(name);
  const w = words.length ? words : ['PLAYER'];
  const first = w[0];
  const last = w[w.length - 1];
  const out: string[] = [];
  const push = (label: string) => {
    if (label.length >= 2 && label.length <= 3 && !out.includes(label)) out.push(label);
  };

  if (w.length >= 2) {
    push(first[0] + last[0]);
    push(first.slice(0, 2) + last[0]);
    push(first[0] + last.slice(0, 2));
    if (w.length >= 3) push(first[0] + w[1][0] + last[0]);
    for (let i = 2; i < first.length; i += 1) push(first[0] + first[i] + last[0]);
    for (let i = 2; i < last.length; i += 1) push(first[0] + last[0] + last[i]);
  } else {
    push(first.length >= 2 ? first.slice(0, 2) : first[0] + 'X');
    push(first.slice(0, 3));
    for (let i = 3; i < first.length; i += 1) push(first[0] + first[1] + first[i]);
  }

  const base = out[0];
  for (let d = 2; d <= 9; d += 1) push(base + d);
  for (let d = 10; d <= 99; d += 1) push(first[0] + d);
  return out;
}

/**
 * Do stored initials still fit this name? False after a rename that leaves the letters
 * unrelated to the name (Suresh Kumar → Suresh K. Nair keeps SK and fits; → Ravi Kiran
 * does not). Initials never change by themselves; the app shows a small note instead.
 */
export function initialsFitName(initials: string | null | undefined, name: string | null | undefined): boolean {
  if (!initials) return true;
  const value = normalizeInitials(initials);
  if (initialsCandidates(name).includes(value)) return true;
  // Like every generated form: starts with the first initial, every other letter is somewhere in the name.
  const words = nameWords(name);
  const letters = new Set(words.join(''));
  return words.length > 0 && value[0] === words[0][0] && [...value.slice(1)].every((letter) => letters.has(letter));
}

export const NAME_CHANGED_NOTE = 'Name changed. The initials no longer match.';

/** The two-letter default for a name (SK for Sree Koneru, RA for Ravi). */
export function defaultInitials(name: string | null | undefined): string {
  return initialsCandidates(name)[0];
}

/**
 * Three-letter forms of the name that are not taken, best first. Digit forms come last
 * and only when `limit` cannot be met with letters.
 */
export function suggestInitials(name: string | null | undefined, taken: Iterable<string>, limit = 3): string[] {
  const used = new Set(Array.from(taken, normalizeInitials));
  const candidates = initialsCandidates(name).slice(1);
  const letters = candidates.filter((c) => INITIALS_PATTERN.test(c) && !used.has(c));
  if (letters.length >= limit) return letters.slice(0, limit);
  const digits = candidates.filter((c) => !INITIALS_PATTERN.test(c) && !used.has(c));
  return [...letters, ...digits].slice(0, limit);
}

/** The first default form of `name` not in `taken`. */
export function firstFreeInitials(name: string | null | undefined, taken: Iterable<string>): string {
  const used = new Set(Array.from(taken, normalizeInitials));
  return initialsCandidates(name).find((c) => !used.has(c)) ?? defaultInitials(name);
}

export const normalizeInitials = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, '');

export const INITIALS_HELP = 'Shown in scorecard columns. Must be different from everyone else in your My players.';

/** Why typed initials cannot be saved, or null when they can. `taken` maps label → name of who has it. */
export function initialsProblem(text: string, taken: Map<string, string>): string | null {
  const value = normalizeInitials(text);
  if (!value) return 'Type 2 or 3 letters.';
  if (!/^[A-Z]+$/.test(value)) return 'Letters only, A to Z.';
  if (value.length < 2) return 'Type at least 2 letters.';
  if (value.length > 3) return 'Up to 3 letters.';
  const owner = taken.get(value);
  return owner ? `${value} is ${owner}.` : null;
}

export type InitialsRow = {
  id: string;
  name: string;
  /** Stored initials; null means "use the default rule". */
  initials?: string | null;
  /** Older rows keep the short form; ISO date or any comparable string. */
  addedAt?: string | null;
};

/**
 * Give every row a unique label. Rows with stored initials keep them (in order, the
 * oldest wins a clash and later duplicates are re-derived); rows without get the first
 * free default form of their name, oldest first. Returns labels by id.
 */
export function assignInitials(rows: InitialsRow[], reserved: Iterable<string> = []): Map<string, string> {
  const ordered = [...rows].sort((a, b) => (a.addedAt ?? '').localeCompare(b.addedAt ?? ''));
  const taken = new Set(Array.from(reserved, normalizeInitials));
  const labels = new Map<string, string>();
  const pending: InitialsRow[] = [];
  for (const row of ordered) {
    const stored = row.initials ? normalizeInitials(row.initials) : '';
    if (stored && STORED_INITIALS_PATTERN.test(stored) && !taken.has(stored)) {
      taken.add(stored);
      labels.set(row.id, stored);
    } else {
      pending.push(row);
    }
  }
  for (const row of pending) {
    const label = firstFreeInitials(row.name, taken);
    taken.add(label);
    labels.set(row.id, label);
  }
  return labels;
}

export type InitialsConflict = {
  /** The two-letter (or stored) label both sides claim. */
  label: string;
  /** Who keeps it: the creator, or the oldest row. */
  keeper: InitialsRow;
  /** Everyone else who claimed it, each with suggestions not used by anyone in the list. */
  others: { row: InitialsRow; suggestions: string[] }[];
};

/**
 * Groups of rows that claim the same label. `keeperId` (the game creator) always keeps
 * the label; otherwise the oldest row does. Suggestions avoid every label in the list.
 */
export function findInitialsConflicts(rows: InitialsRow[], keeperId?: string | null): InitialsConflict[] {
  const labelOf = (row: InitialsRow) => (row.initials ? normalizeInitials(row.initials) : defaultInitials(row.name));
  const groups = new Map<string, InitialsRow[]>();
  for (const row of rows) {
    const label = labelOf(row);
    groups.set(label, [...(groups.get(label) ?? []), row]);
  }
  const everyLabel = new Set(groups.keys());
  const conflicts: InitialsConflict[] = [];
  for (const [label, members] of groups) {
    if (members.length < 2) continue;
    const sorted = [...members].sort((a, b) => {
      if (a.id === keeperId) return -1;
      if (b.id === keeperId) return 1;
      return (a.addedAt ?? '').localeCompare(b.addedAt ?? '');
    });
    const [keeper, ...rest] = sorted;
    const used = new Set(everyLabel);
    conflicts.push({
      label,
      keeper,
      others: rest.map((row) => {
        const suggestions = suggestInitials(row.name, used);
        if (suggestions[0]) used.add(suggestions[0]);
        return { row, suggestions };
      }),
    });
  }
  return conflicts.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Column labels for the seats of one game: stored seat labels win; seats without one get
 * the first free default form, in seat order. Never two columns with the same label.
 */
export function seatLabels<T extends { id: string; name: string; label?: string | null }>(seats: T[]): Map<string, string> {
  return assignInitials(seats.map((seat, index) => ({ id: seat.id, name: seat.name, initials: seat.label, addedAt: String(index).padStart(4, '0') })));
}

/**
 * Final labels for a game's seats once the organiser has answered every conflict:
 * keepers keep the shared label, each other player gets their choice (or the first
 * suggestion), and everyone else keeps their stored or default form. Always unique.
 */
export function resolveInitials(rows: InitialsRow[], conflicts: InitialsConflict[], choices: Record<string, string>): Map<string, string> {
  const decided = new Map<string, string>();
  for (const conflict of conflicts) {
    decided.set(conflict.keeper.id, conflict.label);
    for (const { row, suggestions } of conflict.others) {
      const choice = normalizeInitials(choices[row.id] ?? suggestions[0] ?? '');
      if (choice) decided.set(row.id, choice);
    }
  }
  return assignInitials(rows.map((row) => (decided.has(row.id) ? { ...row, initials: decided.get(row.id), addedAt: `!${row.addedAt ?? ''}` } : row)));
}

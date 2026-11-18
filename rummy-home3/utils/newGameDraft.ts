import { MAX_SEATED_PLAYERS } from '@/constants/limits';
import type { PointsRules } from '@/utils/gameSettings';

/**
 * The seats of the New game being set up, shared with the screens pushed on
 * top of it (Add New Players, Add player from database) so they can show and
 * edit the same list. Lives only in memory: starting or leaving New game clears it.
 */
export type DraftPick = { id: string; name: string; playerCode?: string };

let picks: DraftPick[] = [];
/** PR 14 ("Start a new game instead"): the rules New game should open with, read once. */
let prefillRules: PointsRules | null = null;
const listeners = new Set<(picks: DraftPick[]) => void>();

const emit = () => listeners.forEach((fn) => fn(picks));

export function addDraftPick(current: DraftPick[], pick: DraftPick): DraftPick[] {
  if (current.some((row) => row.id === pick.id)) return current.map((row) => (row.id === pick.id ? { ...row, ...pick } : row));
  if (current.length >= MAX_SEATED_PLAYERS) return current;
  return [...current, pick];
}

export function removeDraftPick(current: DraftPick[], id: string): DraftPick[] {
  return current.filter((row) => row.id !== id);
}

export const newGameDraft = {
  get: (): DraftPick[] => picks,
  set(next: DraftPick[]) {
    picks = next;
    emit();
  },
  add(pick: DraftPick) {
    const next = addDraftPick(picks, pick);
    if (next !== picks) { picks = next; emit(); }
  },
  remove(id: string) {
    const next = removeDraftPick(picks, id);
    if (next.length !== picks.length) { picks = next; emit(); }
  },
  clear() {
    if (picks.length === 0) return;
    picks = [];
    emit();
  },
  /** Queue rules for the next New game (the scorecard's "Start a new game instead"). */
  setRules(rules: PointsRules | null) {
    prefillRules = rules;
  },
  /** The queued rules, cleared on read so a later New game starts from the user's defaults again. */
  takeRules(): PointsRules | null {
    const rules = prefillRules;
    prefillRules = null;
    return rules;
  },
  subscribe(fn: (picks: DraftPick[]) => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};

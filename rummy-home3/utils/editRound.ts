import { Game } from '@/types/game';
import { RoundEntryState } from '@/utils/roundEntry';

/** Rounds that have at least one score written, from the stored score columns. */
export function playedRounds(scores: Game['scores']): number {
  return Object.values(scores ?? {}).reduce((max, column) => Math.max(max, column?.length ?? 0), 0);
}

/** Round numbers a user may pick to edit: 1..N, newest first. */
export function editableRounds(scores: Game['scores']): number[] {
  const n = playedRounds(scores);
  return Array.from({ length: n }, (_, index) => n - index);
}

/**
 * Where a retired round row goes so a fresh row can take its number. Numbers
 * past 1000 never collide with real rounds and the row is already marked undone.
 */
export const RETIRED_ROUND_OFFSET = 1000;
export const retiredRoundNumber = (roundNumber: number, attempt = 0) => RETIRED_ROUND_OFFSET * (attempt + 1) + roundNumber;

/**
 * The saved scores of one round, loaded into the Add round sheet so every
 * cell starts green with its number and can be tapped to change.
 */
export function entryFromRound(game: Pick<Game, 'players' | 'scores'>, roundNumber: number): RoundEntryState {
  const index = roundNumber - 1;
  const entries: RoundEntryState['entries'] = {};
  for (const playerId of game.players) {
    const value = game.scores?.[playerId]?.[index];
    if (typeof value === 'number') entries[playerId] = { value, scoreType: value > 0 ? 'rummy' : 'count' };
  }
  return {
    entries,
    rummyIds: [],
    selectedIds: [],
    draft: { digits: '', negative: true, typed: false, edited: false },
    lastSavedIds: [],
  };
}

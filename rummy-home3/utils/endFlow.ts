import { Game } from '@/types/game';
import { isPoolGame } from '@/utils/pool';

/**
 * The end of a game (Nov 18 end-flow review). One rule set for Points and Pool:
 * - Complete is a dialog on the scorecard (no Complete page).
 * - Points: Complete → the Final screen. Pool: Complete → Awards → the Final screen.
 * - The Final screen's bar is Share + Done. Done is the one label that ends a game and it always
 *   goes Home; the header arrow goes back to the completed scorecard.
 * - No "Add to Results" or Results copy anywhere in this flow. Results is its own errand from Home.
 */
export const HOME_ROUTE = '/(tabs)' as const;

export const FINAL_SCORES_ROUTE = '/(screens)/games/final-scores' as const;
export const AWARD_ROUTE = '/(screens)/games/award' as const;

/** Awards opened from Complete goes on to the Final screen; from anywhere else it returns to its caller. */
export const AWARD_NEXT_FINAL = 'final';

export type EndFlowRoute = { pathname: typeof FINAL_SCORES_ROUTE | typeof AWARD_ROUTE; params: Record<string, string> };

/** Where the scorecard (or the after-save sheet) goes once the server has completed the game. */
export function afterCompleteRoute(game: Pick<Game, 'id' | 'gameType'>): EndFlowRoute {
  if (isPoolGame(game)) return { pathname: AWARD_ROUTE, params: { id: game.id, next: AWARD_NEXT_FINAL } };
  return { pathname: FINAL_SCORES_ROUTE, params: { id: game.id } };
}

/** Where the Awards page goes after Save or Not now. */
export function afterAwardsRoute(game: Pick<Game, 'id'>, next: string | undefined): EndFlowRoute | null {
  return next === AWARD_NEXT_FINAL ? { pathname: FINAL_SCORES_ROUTE, params: { id: game.id } } : null;
}

/** The Final screen shows Done (→ Home) only on a finished game; an active game's PDF share has no Done. */
export const showsDone = (game: Pick<Game, 'isComplete'> | null | undefined) => Boolean(game?.isComplete);

/** The Complete dialog's body: what gets locked, who is in, and what comes next. */
export function completeDialogBody(input: { pool: boolean; roundCount: number; inCount: number; outCount: number }): string {
  const rounds = input.roundCount === 1 ? '1 round' : `${input.roundCount} rounds`;
  if (input.roundCount === 0) {
    return `No rounds were played. The ${input.pool ? 'pool' : 'game'} will be completed with no scores.`;
  }
  if (input.pool) {
    const who = `${input.inCount} ${input.inCount === 1 ? 'player' : 'players'} in, ${input.outCount} out`;
    const early = input.inCount > 1 ? ' More than one player is still in.' : '';
    return `${rounds} will be locked. ${who}.${early} Next you give the awards. You can reopen the pool later from the ⋮ menu.`;
  }
  return `${rounds} will be locked. Every round adds to 0. You can reopen the game later from the ⋮ menu.`;
}

/** "Fix round 3 first" — the first round that does not add to 0 (Points only). */
export function blockedDialogTitle(unbalancedRounds: number[]): string {
  return `Fix round ${unbalancedRounds[0]} first`;
}

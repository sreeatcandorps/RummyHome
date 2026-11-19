/**
 * The Dealer sheet (052, D60) — copy and the pure pieces the sheet and its tests share.
 *
 * Sree, Nov 19: "it should just be a menu of its own … sometimes you realize after the dealing that
 * the last round was not dealt by this person … keep it more simple and not do the next round/last
 * round." One flow for any round: which round, who really deals, follow from here or this round only.
 */
import { DealerChange, dealerForRound, nextDealer, opensFor, planDealerChange } from '@/utils/dealerRotation';
import type { DealerOverride } from '@/types/game';

export const DEALER_TITLE = 'Dealer';
export const DEALER_MENU_ITEM = 'Dealer';
export const DEALER_SUBLINE = 'Admins only · logged · scores never change';
export const DEALER_STEP_ROUND = 'Which round?';
export const DEALER_STEP_WHO = 'Who really deals?';
export const DEALER_STEP_THEN = 'Then';
export const DEALER_FOLLOW = 'Follow from here';
export const DEALER_KEEP = 'This round only';
export const DEALER_DONE = 'Done';
/** The chip for the round being played: "Next · 6". */
export const nextRoundChip = (round: number) => `Next · ${round}`;

type SheetGame = {
  players: string[];
  dealerIds?: (string | null | undefined)[] | null;
  outIds?: ReadonlySet<string> | null;
  nextDealerOverride?: DealerOverride | null;
};

/** "Card says: Round 6 · DX deals · CX opens" — what the scorecard shows for the chosen round today. */
export function cardSays(game: SheetGame, roundCount: number, round: number, ini: (id: string | undefined) => string): string {
  const dealer = round === roundCount + 1 ? nextDealer(game, roundCount) : dealerForRound(game, round - 1);
  const opens = opensFor(game, dealer);
  return `Card says: Round ${round} · ${ini(dealer)} deals${opens ? ` · ${ini(opens)} opens` : ''}`;
}

/** The dealer the card has for `round` (the chip that starts selected). */
export function currentDealerOf(game: SheetGame, roundCount: number, round: number): string | undefined {
  return round === roundCount + 1 ? nextDealer(game, roundCount) : dealerForRound(game, round - 1);
}

/**
 * The consequence line under each choice: "Round 7: BX deals, AX opens", with "· only round 6 changes"
 * on the this-round-only line for a played round that is not the last.
 */
export function consequenceLine(game: SheetGame, roundCount: number, change: DealerChange, ini: (id: string | undefined) => string): string {
  const plan = planDealerChange(game, roundCount, change);
  const base = `Round ${plan.after.round}: ${ini(plan.after.dealer)} deals${plan.after.opens ? `, ${ini(plan.after.opens)} opens` : ''}`;
  if (change.follow) {
    const later = roundCount - change.round;
    return later > 0 ? `${base} · rounds ${change.round + 1}–${roundCount} re-dealt` : base;
  }
  return `${base} · only round ${change.round} changes`;
}

/** Nothing to save: the card already has this dealer and the sequence would not move. */
export function dealerUnchanged(game: SheetGame, roundCount: number, change: DealerChange): boolean {
  const current = currentDealerOf(game, roundCount, change.round);
  if (current !== change.dealerId) return false;
  if (change.round === roundCount + 1) {
    const pending = game.nextDealerOverride && game.nextDealerOverride.round === change.round ? game.nextDealerOverride : null;
    // No override: the planned dealer with follow is what the card has; this round only is not.
    if (!pending) return change.follow;
    return pending.keepsSequence === !change.follow;
  }
  if (!change.follow) return true;
  // Follow from an unchanged dealer still re-deals the later rounds when they drifted.
  const plan = planDealerChange(game, roundCount, change);
  return plan.dealerIds.every((id, i) => id === (dealerForRound(game, i) ?? null));
}

/**
 * The deal follows the actual rotation (final launch batch, item 6).
 *
 * Who dealt each saved round is stored with the round (`rounds.dealer_profile_id`, carried
 * to the app as `Game.dealerIds`, one entry per round index). The next dealer is the seat
 * after the last round's dealer in the CURRENT seat order, so a player added mid-game makes
 * the next rotation one round longer (9 rounds, then 10). A divider is drawn above each
 * round where the game's first dealer deals again: one full rotation done.
 *
 * 052 (D58, D60): a seat that is out of a pool is skipped, never removed; the first open card
 * goes to the seat before the dealer that is still in. The Dealer sheet can name who really deals
 * the round being played (`Game.nextDealerOverride`, applied by the server to that round only) or
 * fix a played round, following from there or keeping the sequence.
 *
 * 054 (D70): a player who joins mid-game sits to the dealer's left, the seat that deals last (`planJoin`).
 *
 * Games saved before 031 (or local games) have no stored dealers; those fall back to the
 * old seat-order rule, which is what the server used to store anyway.
 */

import type { DealerOverride } from '@/types/game';

type RotationGame = {
  players: string[];
  dealerIds?: (string | null | undefined)[] | null;
  /** Seats skipped by the deal (pool: out). Absent = everyone is in. */
  outIds?: ReadonlySet<string> | null;
  nextDealerOverride?: DealerOverride | null;
};

/** The seat-order rule used before 031 and for a round whose dealer is unknown. */
export function seatOrderDealer(seats: string[], roundIndex: number): string | undefined {
  return seats.length ? seats[roundIndex % seats.length] : undefined;
}

/** Who dealt a saved round: the stored dealer when known, else the seat-order rule. */
export function dealerForRound(game: RotationGame, roundIndex: number): string | undefined {
  const stored = game.dealerIds?.[roundIndex];
  if (stored) return stored;
  return seatOrderDealer(game.players, roundIndex);
}

/** The seats the deal goes round: today's order without the seats that are out. */
export function rotationOf(game: Pick<RotationGame, 'players' | 'outIds'>): string[] {
  return game.outIds ? game.players.filter((id) => !game.outIds!.has(id)) : game.players;
}

/**
 * The seat after `after` in the rotation (052 `next_in_rotation`). When `after` is not in it
 * (out, or gone), the next seat up that is, in the full order; past the end wraps to seat 1.
 */
export function seatAfter(game: Pick<RotationGame, 'players' | 'outIds'>, after: string | null | undefined): string | undefined {
  const rotation = rotationOf(game);
  if (!rotation.length) return undefined;
  if (!after) return rotation[0];
  const at = rotation.indexOf(after);
  if (at >= 0) return rotation[(at + 1) % rotation.length];
  const inFull = game.players.indexOf(after);
  if (inFull < 0) return rotation[0];
  for (let step = 1; step <= game.players.length; step += 1) {
    const candidate = game.players[(inFull + step) % game.players.length];
    if (rotation.includes(candidate)) return candidate;
  }
  return rotation[0];
}

/** The seat before `dealer` that is still in: the first open card (D58). */
export function opensFor(game: Pick<RotationGame, 'players' | 'outIds'>, dealer: string | null | undefined): string | undefined {
  const rotation = rotationOf(game);
  if (!dealer || rotation.length < 2) return undefined;
  const at = rotation.indexOf(dealer);
  if (at < 0) return undefined;
  return rotation[(at - 1 + rotation.length) % rotation.length];
}

/**
 * Who the sequence says deals the next round (`roundCount` rounds already saved), ignoring any
 * override: the seat after the last round's dealer; no rounds yet → seat 1 of the rotation. A last
 * dealer who has left the game falls back to the seat-order rule, as the server does.
 */
export function plannedDealer(game: RotationGame, roundCount: number): string | undefined {
  const rotation = rotationOf(game);
  if (!rotation.length) return undefined;
  if (roundCount <= 0) return rotation[0];
  const last = game.dealerIds?.[roundCount - 1];
  if (last && game.players.includes(last)) return seatAfter(game, last);
  return seatOrderDealer(rotation, roundCount);
}

/** Who deals the next round: the Dealer-sheet override for that round when it names a seat in play, else the plan. */
export function nextDealer(game: RotationGame, roundCount: number): string | undefined {
  const override = game.nextDealerOverride;
  if (override && override.round === roundCount + 1 && rotationOf(game).includes(override.playerId)) return override.playerId;
  return plannedDealer(game, roundCount);
}

/**
 * Round indexes (0-based) that start a new rotation: every round after the first where the
 * first round's dealer deals again. The scorecard draws a divider above each of them.
 * With seats A B C and dealers A B C A B C A the result is [3, 6]; if D joined after round
 * 3 and dealers are A B C A B C D A the result is [3, 7] (the second rotation is longer).
 */
export function rotationStarts(game: RotationGame, roundCount: number): number[] {
  if (roundCount < 2) return [];
  const first = dealerForRound(game, 0);
  if (!first) return [];
  const starts: number[] = [];
  for (let round = 1; round < roundCount; round += 1) {
    if (dealerForRound(game, round) === first) starts.push(round);
  }
  return starts;
}

/** `dealerIds` after saving round `roundIndex` with `dealerId` (local games keep the list themselves). */
export function withDealer(dealerIds: (string | null | undefined)[] | null | undefined, roundIndex: number, dealerId: string | undefined): (string | null)[] {
  const next: (string | null)[] = (dealerIds ?? []).map((id) => id ?? null);
  while (next.length < roundIndex) next.push(null);
  next[roundIndex] = dealerId ?? null;
  return next;
}

// ---------- the Dealer sheet (052, D60) ----------

export type DealerChange = {
  /** 1-based round: a played one, or roundCount + 1 for the round being played. */
  round: number;
  dealerId: string;
  /** true = follow from here (every later round is re-dealt); false = this round only. */
  follow: boolean;
};

export type DealerPlan = {
  /** `dealerIds` after the change (played rounds only; the next round is not stored). */
  dealerIds: (string | null)[];
  /** The override the server keeps for the round being played, or null when nothing is pending. */
  nextDealerOverride: DealerOverride | null;
  /** The round after the one changed: who deals and who opens. */
  after: { round: number; dealer: string | undefined; opens: string | undefined };
};

/**
 * What a Dealer-sheet change does, worked out the way `set_round_dealer` and `save_round` (052) do
 * it, so the sheet can show the consequence before Done and a local game can apply it itself.
 */
export function planDealerChange(game: RotationGame, roundCount: number, change: DealerChange): DealerPlan {
  const dealerIds: (string | null)[] = Array.from({ length: roundCount }, (_, i) => dealerForRound(game, i) ?? null);
  const nextRound = roundCount + 1;
  if (change.round === nextRound) {
    const planned = plannedDealer(game, roundCount);
    const nextDealerOverride: DealerOverride | null =
      change.follow && change.dealerId === planned ? null : { playerId: change.dealerId, round: nextRound, keepsSequence: !change.follow };
    const dealer = change.follow ? seatAfter(game, change.dealerId) : seatAfter(game, planned);
    return { dealerIds, nextDealerOverride, after: { round: nextRound + 1, dealer, opens: opensFor(game, dealer) } };
  }
  const index = change.round - 1;
  const old = dealerIds[index];
  dealerIds[index] = change.dealerId;
  if (change.follow) {
    let prev: string | undefined = change.dealerId;
    for (let i = index + 1; i < roundCount; i += 1) {
      prev = seatAfter(game, prev);
      dealerIds[i] = prev ?? null;
    }
    const dealer = seatAfter(game, prev);
    return { dealerIds, nextDealerOverride: null, after: { round: nextRound, dealer, opens: opensFor(game, dealer) } };
  }
  if (change.round === roundCount) {
    // Keep the sequence on the last round: the next round goes on from the dealer the card had.
    const dealer = seatAfter(game, old);
    const nextDealerOverride = dealer ? { playerId: dealer, round: nextRound, keepsSequence: false } : null;
    return { dealerIds, nextDealerOverride, after: { round: nextRound, dealer, opens: opensFor(game, dealer) } };
  }
  const dealer = nextDealer(game, roundCount);
  return { dealerIds, nextDealerOverride: game.nextDealerOverride ?? null, after: { round: nextRound, dealer, opens: opensFor(game, dealer) } };
}

// ---------- joining mid-game (054, D70) ----------

export type JoinPlan = {
  /** The seat order with the newcomer in it. */
  players: string[];
  /** The newcomer's seat, 0-based. */
  seat: number;
  /** Who deals the round being played; undefined before round 1. */
  dealer: string | undefined;
  nextDealerOverride: DealerOverride | null;
};

/**
 * Where a player who joins sits, the way `add_seated_player` (054) does it: before round 1 the last
 * seat; after that the dealer's left — the seat before whoever deals the round being played, which
 * deals last (Sree, Q13: "New players always sit on the left side of the dealer"). A dealer at seat 1
 * already has the last seat on their left. The dealer keeps this round's deal: when the newcomer
 * lands straight after the last round's dealer, the round is pinned to the dealer (follow).
 */
export function planJoin(game: RotationGame, roundCount: number, joinerId: string): JoinPlan {
  const dealer = roundCount > 0 ? nextDealer(game, roundCount) : undefined;
  const at = dealer ? game.players.indexOf(dealer) : -1;
  const seat = at > 0 ? at : game.players.length;
  const players = [...game.players.slice(0, seat), joinerId, ...game.players.slice(seat)];
  let nextDealerOverride = game.nextDealerOverride ?? null;
  if (dealer && plannedDealer({ ...game, players }, roundCount) !== plannedDealer(game, roundCount)) {
    nextDealerOverride = { playerId: dealer, round: roundCount + 1, keepsSequence: false };
  }
  return { players, seat, dealer, nextDealerOverride };
}

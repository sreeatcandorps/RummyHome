/**
 * The deal follows the actual rotation (final launch batch, item 6).
 *
 * Who dealt each saved round is stored with the round (`rounds.dealer_profile_id`, carried
 * to the app as `Game.dealerIds`, one entry per round index). 057 (Q63, Sree Nov 27: "the dealer
 * always moves counterclockwise … whoever gets the open card gets to deal"): the next dealer is the
 * seat BEFORE the last round's dealer in the CURRENT seat order — seat 1 deals round 1, then the last
 * seat, then the one before it. A player added mid-game makes the next rotation one round longer
 * (9 rounds, then 10). A divider is drawn above each round where the game's first dealer deals
 * again: one full rotation done.
 *
 * 052 (D58, D60): a seat that is out of a pool is skipped, never removed; the first open card
 * goes to the seat before the dealer that is still in, who deals next. The Dealer sheet can name who
 * really deals the round being played (`Game.nextDealerOverride`, applied by the server to that round
 * only) or fix a played round, following from there or keeping the sequence.
 *
 * 054 (D70): a player who joins mid-game sits to the dealer's left, the seat that deals last — since 057
 * the seat after the dealer (`planJoin`). 056 (D139): so does a player who re-enters a pool, unless the
 * admin picks a seat (`planReentry`).
 *
 * Games saved before 031 (or old local games) have no stored dealers; those rounds are drawn with the
 * seat-order rule the server used then (`seatOrderDealer`), and the next round falls back to
 * `roundRuleDealer`, as `save_round` (057) does.
 */

import type { DealerOverride } from '@/types/game';

type RotationGame = {
  players: string[];
  dealerIds?: (string | null | undefined)[] | null;
  /** Seats skipped by the deal (pool: out). Absent = everyone is in. */
  outIds?: ReadonlySet<string> | null;
  nextDealerOverride?: DealerOverride | null;
};

/** The seat-order rule used before 031: who dealt a saved round whose dealer is unknown. */
export function seatOrderDealer(seats: string[], roundIndex: number): string | undefined {
  return seats.length ? seats[roundIndex % seats.length] : undefined;
}

/** Who dealt a saved round: the stored dealer when known, else the seat-order rule. */
export function dealerForRound(game: RotationGame, roundIndex: number): string | undefined {
  const stored = game.dealerIds?.[roundIndex];
  if (stored) return stored;
  return seatOrderDealer(game.players, roundIndex);
}

/** Round `roundIndex` (0-based) by the anticlockwise rule alone: seat 1, then the last seat, then the one before (057 `round_rule_dealer`). */
export function roundRuleDealer(seats: string[], roundIndex: number): string | undefined {
  const n = seats.length;
  return n ? seats[(n - (Math.max(roundIndex, 0) % n)) % n] : undefined;
}

/** The seats the deal goes round: today's order without the seats that are out. */
export function rotationOf(game: Pick<RotationGame, 'players' | 'outIds'>): string[] {
  return game.outIds ? game.players.filter((id) => !game.outIds!.has(id)) : game.players;
}

/**
 * Who deals after `after` (057 `next_in_rotation`): the seat before it in the rotation — the player who got
 * the first open card. When `after` is not in it (out, or gone), the next seat down that is, in the full
 * order; below seat 1 wraps to the last seat. No dealer yet: seat 1.
 */
export function dealsAfter(game: Pick<RotationGame, 'players' | 'outIds'>, after: string | null | undefined): string | undefined {
  const rotation = rotationOf(game);
  if (!rotation.length) return undefined;
  if (!after) return rotation[0];
  const at = rotation.indexOf(after);
  if (at >= 0) return rotation[(at - 1 + rotation.length) % rotation.length];
  const inFull = game.players.indexOf(after);
  if (inFull < 0) return rotation[0];
  const n = game.players.length;
  for (let step = 1; step <= n; step += 1) {
    const candidate = game.players[(inFull - step + n) % n];
    if (rotation.includes(candidate)) return candidate;
  }
  return rotation[0];
}

/** The seat before `dealer` that is still in: the first open card (D58), and since 057 the next dealer. */
export function opensFor(game: Pick<RotationGame, 'players' | 'outIds'>, dealer: string | null | undefined): string | undefined {
  const rotation = rotationOf(game);
  if (!dealer || rotation.length < 2) return undefined;
  const at = rotation.indexOf(dealer);
  if (at < 0) return undefined;
  return rotation[(at - 1 + rotation.length) % rotation.length];
}

/**
 * Who the sequence says deals the next round (`roundCount` rounds already saved), ignoring any
 * override: the seat before the last round's dealer; no rounds yet → seat 1 of the rotation. A last
 * dealer who has left the game falls back to the round rule, as the server does.
 */
export function plannedDealer(game: RotationGame, roundCount: number): string | undefined {
  const rotation = rotationOf(game);
  if (!rotation.length) return undefined;
  if (roundCount <= 0) return rotation[0];
  const last = game.dealerIds?.[roundCount - 1];
  if (last && game.players.includes(last)) return dealsAfter(game, last);
  return roundRuleDealer(rotation, roundCount);
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
 * With seats A B C and dealers A C B A C B A the result is [3, 6]; if D joined after round
 * 3 and dealers are A C B A C B D A the result is [3, 7] (the second rotation is longer).
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
    const dealer = change.follow ? dealsAfter(game, change.dealerId) : dealsAfter(game, planned);
    return { dealerIds, nextDealerOverride, after: { round: nextRound + 1, dealer, opens: opensFor(game, dealer) } };
  }
  const index = change.round - 1;
  const old = dealerIds[index];
  dealerIds[index] = change.dealerId;
  if (change.follow) {
    let prev: string | undefined = change.dealerId;
    for (let i = index + 1; i < roundCount; i += 1) {
      prev = dealsAfter(game, prev);
      dealerIds[i] = prev ?? null;
    }
    const dealer = dealsAfter(game, prev);
    return { dealerIds, nextDealerOverride: null, after: { round: nextRound, dealer, opens: opensFor(game, dealer) } };
  }
  if (change.round === roundCount) {
    // Keep the sequence on the last round: the next round goes on from the dealer the card had.
    const dealer = dealsAfter(game, old);
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
 * Where a player who joins sits, the way `add_seated_player` (057) does it: before round 1 the last
 * seat; after that the dealer's left — the seat after whoever deals the round being played, which gets
 * cards last and deals last (Sree, Q13: "New players always sit on the left side of the dealer"). The
 * dealer keeps this round's deal: when the newcomer lands straight before the last round's dealer, the
 * round is pinned to the dealer (follow). Two joiners in a row both land straight after the dealer, so
 * the second ends up nearer the dealer (`joinOrder` seats a pick list so it reads in pick order).
 */
export function planJoin(game: RotationGame, roundCount: number, joinerId: string): JoinPlan {
  const dealer = roundCount > 0 ? nextDealer(game, roundCount) : undefined;
  const at = dealer ? game.players.indexOf(dealer) : -1;
  const seat = at >= 0 ? at + 1 : game.players.length;
  const players = [...game.players.slice(0, seat), joinerId, ...game.players.slice(seat)];
  let nextDealerOverride = game.nextDealerOverride ?? null;
  if (dealer && plannedDealer({ ...game, players }, roundCount) !== plannedDealer(game, roundCount)) {
    nextDealerOverride = { playerId: dealer, round: roundCount + 1, keepsSequence: false };
  }
  return { players, seat, dealer, nextDealerOverride };
}

/**
 * The order to seat several joiners so they sit in `picked` order: once rounds exist each one lands
 * straight after the dealer, pushing the earlier ones along, so they are seated last pick first.
 */
export function joinOrder<T>(picked: readonly T[], roundCount: number): T[] {
  return roundCount > 0 ? [...picked].reverse() : [...picked];
}

// ---------- re-entering a pool (056, D139) ----------

export type ReentryPlan = {
  /** The round being played (saved rounds + 1); everything below is for it. */
  round: number;
  /** The seat order with him in his new seat. */
  players: string[];
  /** His seat before and after, 0-based. */
  from: number;
  seat: number;
  /** The dealer's left, 0-based: where he sits unless the admin picks a seat. */
  defaultSeat: number;
  /** He ends up straight after the dealer among the seats still in: cards last this round, and he deals last. */
  dealersLeft: boolean;
  /** Who deals the round being played (kept). */
  dealer: string | undefined;
  /** Who opens the round being played once he is back (D58). */
  opens: string | undefined;
  /** The first round he deals if nobody else goes out. */
  firstDeal: number | undefined;
  nextDealerOverride: DealerOverride | null;
};

/**
 * Where a player who re-enters sits, the way `reenter_player` (057) does it: by default the dealer's left —
 * the seat after whoever deals the round being played, worked out with him out of his old seat, as
 * `planJoin` seats a newcomer (Sree, Nov 21: "they have to always sit to the left side of the person that
 * is dealing. Even if someone re-enters"). Already there (only out seats between him and the dealer): he
 * stays. `seat` (0-based) is a seat the admin picked. The dealer keeps this round's deal (the 054 pin).
 */
export function planReentry(game: RotationGame, roundCount: number, playerId: string, seat?: number): ReentryPlan {
  const outIds = new Set(game.outIds ?? []);
  outIds.add(playerId);
  const before = { ...game, outIds };
  const dealer = nextDealer(before, roundCount);
  const from = game.players.indexOf(playerId);
  const rest = game.players.filter((id) => id !== playerId);
  const n = game.players.length;

  let defaultSeat = from;
  if (dealer && from >= 0) {
    const inPlay = new Set(rotationOf(before));
    let i = game.players.indexOf(dealer);
    do i = (i + 1) % n; while (game.players[i] !== playerId && !inPlay.has(game.players[i]));
    if (game.players[i] !== playerId) defaultSeat = rest.indexOf(dealer) + 1;
  }
  if (seat !== undefined && (!Number.isInteger(seat) || seat < 0 || seat >= n)) throw new Error(`Seat must be 1 to ${n}.`);
  const target = from < 0 ? from : seat ?? defaultSeat;
  const players = from < 0 ? game.players : [...rest.slice(0, target), playerId, ...rest.slice(target)];
  const backIn = new Set(outIds);
  backIn.delete(playerId);
  const after = { ...game, players, outIds: backIn };

  let nextDealerOverride = game.nextDealerOverride ?? null;
  if (dealer && plannedDealer(after, roundCount) !== plannedDealer(before, roundCount)) {
    nextDealerOverride = { playerId: dealer, round: roundCount + 1, keepsSequence: false };
  }
  const opens = opensFor(after, dealer);

  let firstDeal: number | undefined;
  let prev = nextDealerOverride?.keepsSequence ? plannedDealer(after, roundCount) : dealer;
  for (let step = 1; prev && step <= players.length; step += 1) {
    prev = dealsAfter(after, prev);
    if (prev === playerId) { firstDeal = roundCount + 1 + step; break; }
  }
  const dealersLeft = Boolean(dealer) && neighboursIn(after, playerId).before === dealer;
  return { round: roundCount + 1, players, from, seat: target, defaultSeat, dealersLeft, dealer, opens, firstDeal, nextDealerOverride };
}

/** The seats still in on either side of `playerId` (out seats skipped), or undefined when there is nobody else. */
export function neighboursIn(game: Pick<RotationGame, 'players' | 'outIds'>, playerId: string): { before: string | undefined; after: string | undefined } {
  const rotation = rotationOf(game);
  const at = rotation.indexOf(playerId);
  if (at < 0 || rotation.length < 2) return { before: undefined, after: undefined };
  return { before: rotation[(at - 1 + rotation.length) % rotation.length], after: rotation[(at + 1) % rotation.length] };
}

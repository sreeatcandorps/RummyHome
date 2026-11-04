export type PrizePlayer = {
  id: string;
  name?: string;
  points: number;
};

export type PrizeGame = {
  id: string;
  gameType: 'stake' | 'pool';
  prize?: number | null;
  /** Confirmed coins per player. When set, these replace the calculated shares. */
  prizeShares?: Record<string, number> | null;
  players: PrizePlayer[];
};

export type PrizeLeg = {
  profileId: string;
  amount: number;
};

export type PrizeEntry = {
  id: string;
  note?: string | null;
  createdAt: string;
  legs: PrizeLeg[];
};

const sumValues = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** Split `total` across `count` people. Remainder coins go to the earliest seats. */
export function splitCoins(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.trunc(total / count);
  let remainder = total - base * count;
  const step = remainder < 0 ? -1 : 1;
  return Array.from({ length: count }, () => {
    if (remainder === 0) return base;
    remainder -= step;
    return base + step;
  });
}

/**
 * Pool: the prize goes to the player with the highest points (ties split it).
 * Everyone else splits the cost so the coins add to 0. A full tie moves nothing.
 */
export function poolPrizeShares(players: PrizePlayer[], prize: number): Record<string, number> {
  const shares = Object.fromEntries(players.map((player) => [player.id, 0]));
  if (players.length === 0 || !Number.isInteger(prize) || prize === 0) return shares;

  const best = Math.max(...players.map((player) => player.points));
  const winners = players.filter((player) => player.points === best);
  const payers = players.filter((player) => player.points !== best);
  if (winners.length === 0 || payers.length === 0) return shares;

  splitCoins(prize, winners.length).forEach((amount, index) => {
    shares[winners[index].id] = amount;
  });
  splitCoins(-prize, payers.length).forEach((amount, index) => {
    shares[payers[index].id] = amount;
  });
  return shares;
}

/** Stake: each player's coins start as their points, unless the confirm step edited them. */
export function stakePrizeShares(players: PrizePlayer[], overrides?: Record<string, number> | null): Record<string, number> {
  if (overrides) return { ...overrides };
  return Object.fromEntries(players.map((player) => [player.id, player.points]));
}

export function sharesForGame(game: PrizeGame): Record<string, number> {
  if (game.prizeShares) return { ...game.prizeShares };
  if (game.gameType === 'pool' && game.prize != null) return poolPrizeShares(game.players, game.prize);
  return stakePrizeShares(game.players);
}

export function openingBalances(games: PrizeGame[]): Record<string, number> {
  const balances: Record<string, number> = {};
  games.forEach((game) => {
    const shares = sharesForGame(game);
    Object.entries(shares).forEach(([profileId, amount]) => {
      balances[profileId] = (balances[profileId] ?? 0) + amount;
    });
  });
  return balances;
}

export function sumLegs(legs: PrizeLeg[]): number {
  return sumValues(legs.map((leg) => leg.amount));
}

export function validateLegs(legs: PrizeLeg[]): { ok: true } | { ok: false; error: string } {
  if (legs.length < 2) return { ok: false, error: 'Add at least two people to this entry.' };
  if (legs.some((leg) => !leg.profileId)) return { ok: false, error: 'Every leg needs a player.' };
  if (legs.some((leg) => !Number.isInteger(leg.amount))) return { ok: false, error: 'Use whole coins.' };
  const total = sumLegs(legs);
  if (total !== 0) return { ok: false, error: `Legs must add to 0. They add to ${total}.` };
  return { ok: true };
}

export function applyLegs(balances: Record<string, number>, legs: PrizeLeg[]): Record<string, number> {
  const next = { ...balances };
  legs.forEach((leg) => {
    next[leg.profileId] = (next[leg.profileId] ?? 0) + leg.amount;
  });
  return next;
}

export function balancesAfterEntries(opening: Record<string, number>, entries: PrizeEntry[]): Record<string, number> {
  return entries.reduce((balances, entry) => applyLegs(balances, entry.legs), { ...opening });
}

export function isSettled(balances: Record<string, number>): boolean {
  const values = Object.values(balances);
  return values.length > 0 && values.every((value) => value === 0);
}

export function coinSum(balances: Record<string, number>): number {
  return sumValues(Object.values(balances));
}

/** Leader's points, used as the stake prize shown on the confirm step. */
export function suggestedStakePrize(players: PrizePlayer[]): number {
  if (players.length === 0) return 0;
  return Math.max(...players.map((player) => player.points));
}

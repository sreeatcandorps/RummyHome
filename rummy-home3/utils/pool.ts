import { multiplyScores, pointsGameMultiplier } from '@/utils/multiplier';
import { Game, GameSettings, PoolSeat } from '@/types/game';

/**
 * Pool rules (PR 13, docs/pool-design.md). Pure functions so the scorecard, Add round, Awards and
 * the tests agree on who is out, who may re-enter, and what each round must contain.
 *
 * A pool is rummy scored upside down: the round's winner(s) score 0 and everyone else ADDS their
 * hand. Reach the limit and you are out ("100 in, 101 out"). A player who is out may come back at
 * the highest score still in — as often as the Re-entries setting allows (042: Unlimited by default,
 * or Limited to N per player).
 */

export const POOL_LIMITS = [101, 201, 251] as const;
export const POOL_CUSTOM_MIN = 51;
export const POOL_CUSTOM_MAX = 999;
export const DEFAULT_POOL_LIMIT = 101;
/** Pool values are plus points (the sheet stores them positive). */
export const DEFAULT_POOL_VALUES = { drop: 25, middleDrop: 50, fullCount: 130 } as const;
/** Re-entries per player (042): null = Unlimited (the default), N = Limited to N, 0 = none. */
export const DEFAULT_POOL_REENTRY_LIMIT: number | null = null;
export const POOL_REENTRY_LIMIT_MAX = 99;
/** What one entry into the pool is worth on the Awards screen (editable there, F13.4). */
export const DEFAULT_POOL_ENTRY = 100;

export const isPoolGame = (game: Pick<Game, 'gameType'> | null | undefined) => game?.gameType === 'pool';

export const poolLimitOf = (settings: GameSettings | null | undefined) => {
  const n = settings?.poolLimit;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : DEFAULT_POOL_LIMIT;
};

/** The re-entry limit a game plays with: null = Unlimited. Reads the 041 switch for older games. */
export function reentryLimitOf(settings: GameSettings | null | undefined): number | null {
  if (!settings) return DEFAULT_POOL_REENTRY_LIMIT;
  if (settings.reentryLimit !== undefined) {
    return typeof settings.reentryLimit === 'number' && Number.isFinite(settings.reentryLimit) ? Math.max(0, Math.floor(settings.reentryLimit)) : null;
  }
  if (settings.reentry === false) return 0;
  return DEFAULT_POOL_REENTRY_LIMIT;
}

export const reentryOn = (settings: GameSettings | null | undefined) => reentryLimitOf(settings) !== 0;

/** "Unlimited" / "1 re-entry" / "3 re-entries" / "None". */
export function reentryLimitLabel(limit: number | null): string {
  if (limit === null) return 'Unlimited';
  if (limit === 0) return 'None';
  return `${limit} re-entr${limit === 1 ? 'y' : 'ies'}`;
}

export const EMPTY_SEAT: PoolSeat = { outRound: null, reenteredRound: null, reentryScore: null, entries: 1 };

export const seatOf = (game: Pick<Game, 'poolSeats'> | null | undefined, playerId: string): PoolSeat =>
  game?.poolSeats?.[playerId] ?? EMPTY_SEAT;

/** The pool total: the re-entry score plus every score from the (re-)entry round on. */
export function poolTotal(scores: number[] | undefined, seat: PoolSeat = EMPTY_SEAT): number {
  const from = seat.reenteredRound ? seat.reenteredRound - 1 : 0;
  const base = seat.reenteredRound ? seat.reentryScore ?? 0 : 0;
  return (scores ?? []).reduce((sum, value, index) => (index >= from && typeof value === 'number' ? sum + value : sum), base);
}

export const isOut = (seat: PoolSeat | undefined) => Boolean(seat?.outRound);

/** How many more points keep a player in. 0 once they are out. */
export const pointsLeft = (total: number, limit: number) => Math.max(0, limit - total);

/**
 * Drops before a player is out, counting the one that puts them out (F13.13): with 50 left and a
 * 25 drop, "2 drops left" — the second one ends it.
 */
export function dropsLeft(total: number, limit: number, drop: number): number {
  const left = pointsLeft(total, limit);
  if (left <= 0 || drop <= 0) return 0;
  return Math.ceil(left / drop);
}

export type PoolStanding = {
  playerId: string;
  total: number;
  left: number;
  drops: number;
  out: boolean;
  outRound: number | null;
  reentered: boolean;
  entries: number;
};

/** Players still in, lowest score first; then players who are out, in the order they went out. */
export function poolStandings(game: Pick<Game, 'players' | 'scores' | 'settings' | 'poolSeats'>): PoolStanding[] {
  const limit = poolLimitOf(game.settings);
  const drop = Math.abs(game.settings?.dropAmount ?? DEFAULT_POOL_VALUES.drop);
  const rows = game.players.map((playerId) => {
    const seat = seatOf(game, playerId);
    const total = poolTotal(game.scores[playerId], seat);
    return {
      playerId,
      total,
      left: isOut(seat) ? 0 : pointsLeft(total, limit),
      drops: isOut(seat) ? 0 : dropsLeft(total, limit, drop),
      out: isOut(seat),
      outRound: seat.outRound,
      reentered: Boolean(seat.reenteredRound) && seat.entries > 1,
      entries: seat.entries,
    };
  });
  return rows.sort((a, b) => {
    if (a.out !== b.out) return a.out ? 1 : -1;
    if (a.out && b.out) return (a.outRound ?? 0) - (b.outRound ?? 0) || a.total - b.total;
    return a.total - b.total;
  });
}

export const playersIn = (game: Pick<Game, 'players' | 'poolSeats'>) => game.players.filter((id) => !isOut(seatOf(game, id)));
export const playersOut = (game: Pick<Game, 'players' | 'poolSeats'>) => game.players.filter((id) => isOut(seatOf(game, id)));

/** The score a re-entering player would start at: the highest among those still in. */
export function reentryScore(game: Pick<Game, 'players' | 'scores' | 'poolSeats'>): number {
  const totals = playersIn(game).map((id) => poolTotal(game.scores[id], seatOf(game, id)));
  return totals.length ? Math.max(...totals) : 0;
}

export type ReentryBlock = 'in' | 'off' | 'used' | 'nobody' | 'completed';

/** Why a player cannot re-enter right now, or null when they can (042: within the Re-entries limit). */
export function reentryBlock(game: Pick<Game, 'players' | 'poolSeats' | 'settings' | 'isComplete'>, playerId: string): ReentryBlock | null {
  const seat = seatOf(game, playerId);
  if (game.isComplete) return 'completed';
  if (!isOut(seat)) return 'in';
  const limit = reentryLimitOf(game.settings);
  if (limit === 0) return 'off';
  // entries counts the first entry too, so re-entries used = entries - 1
  if (limit !== null && seat.entries - 1 >= limit) return 'used';
  if (playersIn(game).length === 0) return 'nobody';
  return null;
}

export const eligibleForReentry = (game: Pick<Game, 'players' | 'poolSeats' | 'settings' | 'isComplete'>) =>
  game.players.filter((id) => reentryBlock(game, id) === null);

export const REENTRY_BLOCK_TEXT: Record<ReentryBlock, string> = {
  in: 'Still in the pool.',
  off: 'Re-entries are off for this pool. Allow them in Game settings.',
  used: 'Used every re-entry this pool allows.',
  nobody: 'Nobody is still in the pool.',
  completed: 'The pool is completed. Reopen it to re-enter a player.',
};

/** The pool is over when one player (or none) is still in. */
export const lastPlayerStanding = (game: Pick<Game, 'players' | 'poolSeats'>) => playersIn(game).length <= 1;

export type PoolRoundScore = { playerId: string; value: number };

/**
 * What a saved pool round must contain (13.3): plus points only, at least one 0 (the winner — more
 * than one is fine, D6), every player still in scored, nobody who is out, and someone who lost.
 */
export function validatePoolRound(scores: PoolRoundScore[], inIds: string[], names: (id: string) => string): string | null {
  if (scores.some((s) => s.value < 0)) return 'Pool scores are plus points. Type the hand as a positive number; the winner is 0.';
  if (!scores.some((s) => s.value === 0)) return 'Every round has a winner at 0. Tap the winner, then Rummy.';
  const scored = new Set(scores.map((s) => s.playerId));
  const outScored = scores.filter((s) => !inIds.includes(s.playerId));
  if (outScored.length) return `${outScored.map((s) => names(s.playerId)).join(', ')} is out of the pool and cannot be scored.`;
  const missing = inIds.filter((id) => !scored.has(id));
  if (missing.length) return `Every player still in needs a score: ${missing.map(names).join(', ')}.`;
  if (!scores.some((s) => s.value > 0)) return 'Nobody lost this round. Type the hands before saving.';
  return null;
}

/** True when a typed hand is more than the Full count: the one confirm Add round keeps for a pool (D6/D7). */
export const overFullCount = (value: number | undefined, fullCount: number | null | undefined) =>
  value !== undefined && Math.abs(Number(fullCount) || 0) > 0 && value > Math.abs(Number(fullCount) || 0);

export type AfterRound = {
  /** Players this round put out, with their total. */
  newlyOut: { playerId: string; total: number }[];
  /** Players who may re-enter now (includes earlier outs still eligible). */
  eligible: string[];
  /** Score a re-entering player would start at. */
  reentryAt: number;
  lastStanding: boolean;
};

/**
 * What to show right after a round is saved (D4): who went out, who may come back and at what
 * score. `before` is the game as it was; `after` the reloaded one.
 */
export function afterRound(before: Pick<Game, 'players' | 'poolSeats'>, after: Pick<Game, 'players' | 'scores' | 'poolSeats' | 'settings' | 'isComplete'>): AfterRound {
  const wasIn = new Set(playersIn(before));
  const newlyOut = playersOut(after)
    .filter((id) => wasIn.has(id))
    .map((id) => ({ playerId: id, total: poolTotal(after.scores[id], seatOf(after, id)) }));
  return {
    newlyOut,
    eligible: eligibleForReentry(after),
    reentryAt: reentryScore(after),
    lastStanding: lastPlayerStanding(after),
  };
}

/** Pool status words on the scorecard and the home cards (F13.11). */
export function poolStatusLabel(game: Pick<Game, 'gameType' | 'isComplete' | 'closedAt' | 'awardedAt'>): 'Awards pending' | 'Awarded' | null {
  if (!isPoolGame(game) || !game.isComplete) return null;
  return game.awardedAt ? 'Awarded' : 'Awards pending';
}

export const GIVE_AWARDS_FIRST = 'Give awards first';

/** A completed pool joins a result only once its awards are given (D10). */
export const poolNeedsAwards = (game: Pick<Game, 'gameType' | 'isComplete' | 'awardedAt'>) =>
  isPoolGame(game) && game.isComplete && !game.awardedAt;

/** A custom limit is any whole number from 51 to 999 (F13.9). */
export function parsePoolLimit(text: string): number | null {
  const digits = text.replace(/[^0-9]/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  if (n < POOL_CUSTOM_MIN || n > POOL_CUSTOM_MAX) return null;
  return n;
}

/** "100 is in, 101 is out" for the limit picker. */
export const limitHint = (limit: number) => `${limit - 1} is in, ${limit} is out.`;

/**
 * What a game puts into a result (D10): a Points game its rounds, an awarded pool its awards as
 * one line per player (the pool scores themselves never count). An unawarded pool contributes
 * nothing; the picker keeps it out.
 */
export function resultScoresOf(game: Pick<Game, 'gameType' | 'players' | 'scores' | 'awardedAt' | 'prizeShares'> & { settings?: Game['settings'] }): Record<string, number[]> {
  // PR 14 (D14.9): a Points game contributes entered × its multiplier — Results are always actual points.
  if (!isPoolGame(game)) return multiplyScores(game.scores, pointsGameMultiplier(game));
  if (!game.awardedAt) return Object.fromEntries(game.players.map((id) => [id, []]));
  return Object.fromEntries(game.players.map((id) => [id, [game.prizeShares?.[id] ?? 0]]));
}

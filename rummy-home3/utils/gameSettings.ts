import { GameSettings } from '@/types/game';
import { DEFAULT_PROFILE_SETTINGS } from '@/utils/scoring';
import { MULTIPLIER_DEFAULT, MULTIPLIER_MAX, MULTIPLIER_MIN, MULTIPLIER_RANGE_TEXT, multiplierOf } from '@/utils/multiplier';
import { DEFAULT_POOL_LIMIT, DEFAULT_POOL_REENTRY_LIMIT, DEFAULT_POOL_VALUES, POOL_CUSTOM_MAX, POOL_CUSTOM_MIN, POOL_REENTRY_LIMIT_MAX, reentryLimitOf } from '@/utils/pool';

/**
 * The rules a user or a game can change. Points games store penalties negative (a drop is -10);
 * a pool is scored upside down and stores plus points (a drop is 25). `PointsRules` keeps its name
 * for the many callers; `gameKind` says which set the numbers belong to.
 */
export type GameKind = 'points' | 'pool';
/** Both kinds are offered from PR 13 on. */
export const OFFERED_GAME_KINDS: GameKind[] = ['points', 'pool'];

export type PointsRules = {
  gameKind: GameKind;
  /** Points for a drop. Negative for Points, positive for a pool. */
  drop: number;
  middleDrop: number;
  /** Full count. Negative for Points (default -80), positive for a pool (default 130). */
  fullCount: number;
  /** Pool only: the score that puts a player out (100 in, 101 out). */
  poolLimit?: number;
  /** Pool only (042): re-entries per player — null = Unlimited, N = Limited to N (0 = none). */
  reentryLimit?: number | null;
  /** Points only (PR 14): the game's multiplier, 1–10,000; absent reads as 1. */
  multiplier?: number;
};

export const DEFAULT_POINTS_RULES: PointsRules = {
  gameKind: 'points',
  drop: DEFAULT_PROFILE_SETTINGS.stakeDrop,
  middleDrop: DEFAULT_PROFILE_SETTINGS.stakeMiddleDrop,
  fullCount: DEFAULT_PROFILE_SETTINGS.maxCount,
  multiplier: MULTIPLIER_DEFAULT,
};

export const DEFAULT_POOL_RULES: PointsRules = {
  gameKind: 'pool',
  drop: DEFAULT_POOL_VALUES.drop,
  middleDrop: DEFAULT_POOL_VALUES.middleDrop,
  fullCount: DEFAULT_POOL_VALUES.fullCount,
  poolLimit: DEFAULT_POOL_LIMIT,
  reentryLimit: DEFAULT_POOL_REENTRY_LIMIT,
};

export const defaultRulesFor = (kind: GameKind): PointsRules => (kind === 'pool' ? DEFAULT_POOL_RULES : DEFAULT_POINTS_RULES);

/** Points games are stored as 'stake' for older rows. */
export const gameTypeForKind = (kind: GameKind) => (kind === 'pool' ? 'pool' : 'stake') as 'stake' | 'pool';
export const kindForGameType = (gameType: 'stake' | 'pool' | null | undefined): GameKind => (gameType === 'pool' ? 'pool' : 'points');

/** Users type a positive number; a Points sheet stores it negative, a pool stores it as typed. */
export function parseRuleInput(text: string, kind: GameKind = 'points'): number | null {
  const digits = text.replace(/[^0-9]/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  if (n <= 0 || n > 500) return null;
  return kind === 'pool' ? n : -n;
}

export function validateRules(rules: PointsRules): string | null {
  if (rules.gameKind === 'pool') {
    if (rules.drop <= 0 || rules.middleDrop <= 0 || rules.fullCount <= 0) return 'Drop, Middle drop, and Full count must be more than 0.';
    if (rules.middleDrop < rules.drop) return 'Middle drop is usually bigger than Drop.';
    const limit = rules.poolLimit ?? DEFAULT_POOL_LIMIT;
    if (!Number.isInteger(limit) || limit < POOL_CUSTOM_MIN || limit > POOL_CUSTOM_MAX) return `The pool limit is a whole number from ${POOL_CUSTOM_MIN} to ${POOL_CUSTOM_MAX}.`;
    const re = rules.reentryLimit;
    if (re != null && (!Number.isInteger(re) || re < 0 || re > POOL_REENTRY_LIMIT_MAX)) return `Re-entries is a whole number from 0 to ${POOL_REENTRY_LIMIT_MAX}, or Unlimited.`;
    return null;
  }
  if (rules.drop >= 0 || rules.middleDrop >= 0 || rules.fullCount >= 0) {
    return 'Drop, Middle drop, and Full count must be less than 0.';
  }
  if (Math.abs(rules.middleDrop) < Math.abs(rules.drop)) return 'Middle drop is usually bigger than Drop.';
  const m = rules.multiplier ?? MULTIPLIER_DEFAULT;
  if (!Number.isInteger(m) || m < MULTIPLIER_MIN || m > MULTIPLIER_MAX) return MULTIPLIER_RANGE_TEXT;
  return null;
}

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** The saved defaults for one kind. Pool keys are poolLimit / poolDrop / poolMiddleDrop / poolFullCount / poolReentry. */
export function rulesFromProfileDefaults(defaults: Record<string, unknown> | null | undefined, kind?: GameKind): PointsRules {
  const d = defaults ?? {};
  const wanted: GameKind = kind ?? (d.gameKind === 'pool' ? 'pool' : 'points');
  if (wanted === 'pool') {
    return {
      gameKind: 'pool',
      drop: Math.abs(num(d.poolDrop, DEFAULT_POOL_RULES.drop)),
      middleDrop: Math.abs(num(d.poolMiddleDrop, DEFAULT_POOL_RULES.middleDrop)),
      fullCount: Math.abs(num(d.poolFullCount, DEFAULT_POOL_RULES.fullCount)),
      poolLimit: num(d.poolLimit, DEFAULT_POOL_LIMIT),
      reentryLimit: reentryLimitOf({ reentryLimit: d.poolReentryLimit as number | null | undefined, reentry: d.poolReentry as boolean | undefined } as GameSettings),
    };
  }
  return {
    gameKind: 'points',
    drop: num(d.pointsDrop ?? d.stakeDrop, DEFAULT_POINTS_RULES.drop),
    middleDrop: num(d.pointsMiddleDrop ?? d.stakeMiddleDrop, DEFAULT_POINTS_RULES.middleDrop),
    fullCount: num(d.maxCount ?? d.fullCount, DEFAULT_POINTS_RULES.fullCount),
    multiplier: multiplierOf({ multiplier: d.multiplier }),
  };
}

/** Both kinds' defaults from one saved object (Settings shows both blocks). */
export function allRulesFromProfileDefaults(defaults: Record<string, unknown> | null | undefined): { startsAs: GameKind; points: PointsRules; pool: PointsRules } {
  return {
    startsAs: defaults?.gameKind === 'pool' ? 'pool' : 'points',
    points: rulesFromProfileDefaults(defaults, 'points'),
    pool: rulesFromProfileDefaults(defaults, 'pool'),
  };
}

/** The keys one kind's rules write into the saved defaults; the other kind's keys are left alone. */
export function rulesToProfileDefaults(rules: PointsRules): Record<string, unknown> {
  if (rules.gameKind === 'pool') {
    return {
      poolLimit: rules.poolLimit ?? DEFAULT_POOL_LIMIT,
      poolDrop: rules.drop,
      poolMiddleDrop: rules.middleDrop,
      poolFullCount: rules.fullCount,
      poolReentryLimit: rules.reentryLimit ?? DEFAULT_POOL_REENTRY_LIMIT,
    };
  }
  return {
    stakeDrop: rules.drop,
    stakeMiddleDrop: rules.middleDrop,
    maxCount: rules.fullCount,
    multiplier: rules.multiplier ?? MULTIPLIER_DEFAULT,
  };
}

export function rulesFromGame(settings: GameSettings, gameType: 'stake' | 'pool' = 'stake'): PointsRules {
  if (gameType === 'pool') {
    return {
      gameKind: 'pool',
      drop: Math.abs(settings.dropAmount),
      middleDrop: Math.abs(settings.mdAmount),
      fullCount: Math.abs(settings.maxCount),
      poolLimit: settings.poolLimit ?? DEFAULT_POOL_LIMIT,
      reentryLimit: reentryLimitOf(settings),
    };
  }
  return {
    gameKind: 'points',
    drop: settings.dropAmount,
    middleDrop: settings.mdAmount,
    fullCount: settings.maxCount,
    multiplier: multiplierOf(settings, 'stake'),
  };
}

/** Applies the rules saved on a server game (either key style) over the defaults. */
export function withStoredPointsRules(base: GameSettings, stored: any): GameSettings {
  if (!stored) return base;
  const drop = stored.dropAmount ?? stored.stakeDrop;
  const md = stored.mdAmount ?? stored.stakeMiddleDrop;
  const fullCount = stored.maxCount ?? stored.fullCount;
  return {
    ...base,
    dropAmount: typeof drop === 'number' ? drop : base.dropAmount,
    mdAmount: typeof md === 'number' ? md : base.mdAmount,
    maxCount: typeof fullCount === 'number' ? fullCount : base.maxCount,
    poolLimit: typeof stored.poolLimit === 'number' ? stored.poolLimit : base.poolLimit,
    reentry: typeof stored.reentry === 'boolean' ? stored.reentry : base.reentry,
    reentryLimit: 'reentryLimit' in stored || typeof stored.reentry === 'boolean' ? reentryLimitOf(stored as GameSettings) : base.reentryLimit,
    ...(typeof stored.multiplier === 'number' ? { multiplier: multiplierOf(stored) } : {}),
    // PR 21: the once-per-game Seating pop-up flag rides along (false from Start, true once answered).
    ...(typeof stored.seatingPrompted === 'boolean' ? { seatingPrompted: stored.seatingPrompted } : {}),
  };
}

/**
 * The ⋮ item for Game settings (Q11.12): a pool with saved rounds says so on the item itself,
 * "Game settings · locked" — the limit cannot change; Drop / Middle drop / Full count and Re-entries still can.
 */
export function gameSettingsMenuTitle(pool: boolean, roundCount: number): string {
  return pool && roundCount > 0 ? 'Game settings · locked' : 'Game settings';
}

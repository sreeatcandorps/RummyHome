import { GameSettings } from '@/types/game';
import { DEFAULT_PROFILE_SETTINGS } from '@/utils/scoring';

/**
 * Points rules a user or a game can change. Pool is kept in the data model
 * (gameType 'pool') but is not offered when creating a game yet.
 */
export type GameKind = 'points' | 'pool';
export const OFFERED_GAME_KINDS: GameKind[] = ['points'];

export type PointsRules = {
  gameKind: GameKind;
  /** Points for a drop. Stored negative like every other penalty. */
  drop: number;
  middleDrop: number;
  /** Full count. Stored negative. Default -80. */
  fullCount: number;
};

export const DEFAULT_POINTS_RULES: PointsRules = {
  gameKind: 'points',
  drop: DEFAULT_PROFILE_SETTINGS.stakeDrop,
  middleDrop: DEFAULT_PROFILE_SETTINGS.stakeMiddleDrop,
  fullCount: DEFAULT_PROFILE_SETTINGS.maxCount,
};

/** The app's internal game type for a kind. Points games are stored as 'stake' for older rows. */
export const gameTypeForKind = (kind: GameKind) => (kind === 'pool' ? 'pool' : 'stake') as 'stake' | 'pool';

/** Users type a positive number; the score sheet stores it negative. */
export function parseRuleInput(text: string): number | null {
  const digits = text.replace(/[^0-9]/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  if (n <= 0 || n > 500) return null;
  return -n;
}

export function validateRules(rules: PointsRules): string | null {
  if (rules.drop >= 0 || rules.middleDrop >= 0 || rules.fullCount >= 0) {
    return 'Drop, Middle drop, and Full count must be less than 0.';
  }
  if (Math.abs(rules.middleDrop) < Math.abs(rules.drop)) return 'Middle drop is usually bigger than Drop.';
  return null;
}

export function rulesFromProfileDefaults(defaults: Record<string, unknown> | null | undefined): PointsRules {
  const d = defaults ?? {};
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  return {
    gameKind: d.gameKind === 'pool' ? 'pool' : 'points',
    drop: num(d.pointsDrop ?? d.stakeDrop, DEFAULT_POINTS_RULES.drop),
    middleDrop: num(d.pointsMiddleDrop ?? d.stakeMiddleDrop, DEFAULT_POINTS_RULES.middleDrop),
    fullCount: num(d.maxCount ?? d.fullCount, DEFAULT_POINTS_RULES.fullCount),
  };
}

export function rulesToProfileDefaults(rules: PointsRules) {
  return {
    gameKind: rules.gameKind,
    stakeDrop: rules.drop,
    stakeMiddleDrop: rules.middleDrop,
    maxCount: rules.fullCount,
  };
}

export function rulesFromGame(settings: GameSettings): PointsRules {
  return {
    gameKind: 'points',
    drop: settings.dropAmount,
    middleDrop: settings.mdAmount,
    fullCount: settings.maxCount,
  };
}

/** Applies the drop rules saved on a server game (either key style) over the defaults. */
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
  };
}

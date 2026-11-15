import { GameKind, parseRuleInput, PointsRules, validateRules } from '@/utils/gameSettings';
import { DEFAULT_POOL_LIMIT, parsePoolLimit, POOL_CUSTOM_MAX, POOL_CUSTOM_MIN, POOL_LIMITS, POOL_REENTRY_LIMIT_MAX } from '@/utils/pool';

/** The Rules form's text state and its parsing, kept out of the component so the tests can run it without React Native. */
export type RulesDraft = {
  gameKind: GameKind;
  drop: string;
  middleDrop: string;
  fullCount: string;
  /** Pool only: the chosen limit as text ("101"). */
  poolLimit: string;
  /** Pool only: the Custom chip is active, so the limit field shows. */
  customLimit: boolean;
  /** Pool only (042): Unlimited, or Limited with the count in reentryCount. */
  reentryMode: 'unlimited' | 'limited';
  /** Pool only: the Limited count as text ("1"). */
  reentryCount: string;
};

/** Points fields show the minus sign; pool fields are plain plus numbers. */
export const showRule = (value: number) => (Number.isFinite(value) ? String(value) : '');

export const draftFromRules = (r: PointsRules): RulesDraft => ({
  gameKind: r.gameKind,
  drop: showRule(r.drop),
  middleDrop: showRule(r.middleDrop),
  fullCount: showRule(r.fullCount),
  poolLimit: String(r.poolLimit ?? DEFAULT_POOL_LIMIT),
  customLimit: r.gameKind === 'pool' && !(POOL_LIMITS as readonly number[]).includes(r.poolLimit ?? DEFAULT_POOL_LIMIT),
  reentryMode: r.reentryLimit == null ? 'unlimited' : 'limited',
  reentryCount: r.reentryLimit == null ? '1' : String(r.reentryLimit),
});

/** The Limited count, or null for Unlimited; -1 when the Limited field does not hold a whole number 0–99. */
export function parseReentryLimit(draft: Pick<RulesDraft, 'reentryMode' | 'reentryCount'>): number | null {
  if (draft.reentryMode === 'unlimited') return null;
  const digits = draft.reentryCount.replace(/[^0-9]/g, '');
  if (!digits) return -1;
  const n = parseInt(digits, 10);
  return n > POOL_REENTRY_LIMIT_MAX ? -1 : n;
}

/** The draft back into rules, or the message to show. */
export function rulesFromDraft(draft: RulesDraft): { rules: PointsRules; error: null } | { rules: null; error: string } {
  const drop = parseRuleInput(draft.drop, draft.gameKind);
  const middleDrop = parseRuleInput(draft.middleDrop, draft.gameKind);
  const fullCount = parseRuleInput(draft.fullCount, draft.gameKind);
  if (drop == null || middleDrop == null || fullCount == null) return { rules: null, error: 'Type a number for Drop, Middle drop, and Full count.' };
  const rules: PointsRules = draft.gameKind === 'pool'
    ? (() => {
        const poolLimit = parsePoolLimit(draft.poolLimit);
        return { gameKind: 'pool' as const, drop, middleDrop, fullCount, poolLimit: poolLimit ?? -1, reentryLimit: parseReentryLimit(draft) };
      })()
    : { gameKind: 'points', drop, middleDrop, fullCount };
  if (rules.gameKind === 'pool' && rules.poolLimit === -1) return { rules: null, error: `The pool limit is a whole number from ${POOL_CUSTOM_MIN} to ${POOL_CUSTOM_MAX}.` };
  if (rules.gameKind === 'pool' && rules.reentryLimit === -1) return { rules: null, error: `Re-entries is a whole number from 0 to ${POOL_REENTRY_LIMIT_MAX}, or Unlimited.` };
  const problem = validateRules(rules);
  return problem ? { rules: null, error: problem } : { rules, error: null };
}

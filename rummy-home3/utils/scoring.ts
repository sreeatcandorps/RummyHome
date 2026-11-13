import { GameType, ProfileDefaults, ScoreType } from '@/types/database';
import { GameSettings } from '@/types/game';

export type RoundScoreInput = {
  playerId: string | null;
  value: number;
  scoreType: ScoreType;
};

export const DEFAULT_PROFILE_SETTINGS: ProfileDefaults = {
  gameType: 'stake',
  expenseEnabled: false,
  expenseAmount: -10,
  stakeDrop: -10,
  stakeMiddleDrop: -30,
  poolDrop: -25,
  poolMiddleDrop: -50,
  maxCount: -80,
  poolAmount: 100,
  poolDefaultDeposit: -100,
};

export const settingsForGameType = (gameType: GameType): ProfileDefaults => ({
  ...DEFAULT_PROFILE_SETTINGS,
  gameType,
});

export const legacySettingsForGameType = (
  gameType: GameType,
  expenseEnabled = false,
  expenseAmount = DEFAULT_PROFILE_SETTINGS.expenseAmount,
): GameSettings => ({
  expense: expenseEnabled,
  expenseAmount,
  dropAmount: gameType === 'stake' ? DEFAULT_PROFILE_SETTINGS.stakeDrop : DEFAULT_PROFILE_SETTINGS.poolDrop,
  mdAmount: gameType === 'stake' ? DEFAULT_PROFILE_SETTINGS.stakeMiddleDrop : DEFAULT_PROFILE_SETTINGS.poolMiddleDrop,
  maxCount: DEFAULT_PROFILE_SETTINGS.maxCount,
  poolAmount: gameType === 'pool' ? DEFAULT_PROFILE_SETTINGS.poolAmount : undefined,
});

export const getDropValue = (gameType: GameType, settings: ProfileDefaults = DEFAULT_PROFILE_SETTINGS) =>
  gameType === 'stake' ? settings.stakeDrop : settings.poolDrop;

export const getMiddleDropValue = (gameType: GameType, settings: ProfileDefaults = DEFAULT_PROFILE_SETTINGS) =>
  gameType === 'stake' ? settings.stakeMiddleDrop : settings.poolMiddleDrop;

export const getRoundTotal = (scores: RoundScoreInput[]) =>
  scores.reduce((total, score) => total + score.value, 0);

export const validateRoundScores = (scores: RoundScoreInput[]) => {
  if (scores.length === 0) {
    return { valid: false, error: 'At least one score is required.' };
  }

  const total = getRoundTotal(scores);
  if (total !== 0) {
    return { valid: false, error: `Round total must be 0. Current total is ${total}.` };
  }

  const rummyScores = scores.filter((score) => score.scoreType === 'rummy');
  if (rummyScores.length === 0) {
    return { valid: false, error: 'At least one rummy score is required to balance the round.' };
  }

  if (scores.some((score) => score.scoreType === 'expense' || !score.playerId)) {
    return { valid: false, error: 'Every score belongs to a player.' };
  }

  const invalidNegative = scores.find(
    (score) => ['drop', 'middle_drop', 'count'].includes(score.scoreType) && score.value > 0,
  );
  if (invalidNegative) {
    return { valid: false, error: 'Drop, middle drop, and count scores must be zero or negative.' };
  }

  // 037: a Rummy share may be negative when the other players add up to a plus; the
  // sum-to-0 rule above is what keeps the round honest.
  return { valid: true, error: null };
};

export const calculateDealerId = (playerIds: string[], roundNumber: number) => {
  if (playerIds.length === 0) return null;
  return playerIds[(roundNumber - 1) % playerIds.length];
};

export const calculateFinalTotals = (scores: Record<string, number[]>) =>
  Object.fromEntries(
    Object.entries(scores).map(([playerId, playerScores]) => [
      playerId,
      playerScores.reduce((sum, value) => sum + value, 0),
    ]),
  );

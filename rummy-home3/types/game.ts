export type GameSettings = {
  expense: boolean;
  expenseAmount: number;
  dropAmount: number;
  mdAmount: number;
  maxCount: number;
  poolAmount?: number;
};

export type Game = {
  id: string;
  date: string;
  isComplete: boolean;
  players: string[];
  scores: Record<string, number[]>;
  currentRound: number;
  gameType: 'stake' | 'pool';
  settings: GameSettings;
  shareCode?: string;
  /** Unguessable token for the public live scorecard. */
  viewToken?: string;
  createdBy?: string;
  /** Pool prize in coins. Stake games leave this empty and use points. */
  prize?: number | null;
  /** Coins confirmed when the game was completed. */
  prizeShares?: Record<string, number> | null;
  spectators?: string[];
  adminIds?: string[];
};

export interface Round {
  playerScores: Record<string, number>;
  roundNumber: number;
}
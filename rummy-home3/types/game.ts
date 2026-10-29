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
  /** Game admins with no score column. */
  unseatedAdminIds?: string[];
  /** Per-creator sequential game number (G1, G2...). Assigned at creation, never changes. */
  gameNumber?: number | null;
  /** When included in a declared result. A closed game is part of finalized results. */
  closedAt?: string | null;
};

export interface Round {
  playerScores: Record<string, number>;
  roundNumber: number;
}
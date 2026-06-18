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
};

export interface Round {
  playerScores: Record<string, number>;
  roundNumber: number;
}
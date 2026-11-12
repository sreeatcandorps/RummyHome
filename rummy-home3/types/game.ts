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
  /** When Complete game was pressed. Kept when the game is later Closed. */
  completedAt?: string | null;
  /** Local (no Supabase) games only: column label per seat, fixed at seat time. Server games carry it on the seat row. */
  labels?: Record<string, string>;
  /** Soft delete (023). A deleted game is gone for everyone until restored; only the id, number and this stamp are readable. */
  deletedAt?: string | null;
  deletedBy?: string | null;
  /** Whether the viewer may restore a deleted game (the deleter, or a creator/admin). */
  canRestore?: boolean;
};

export interface Round {
  playerScores: Record<string, number>;
  roundNumber: number;
}
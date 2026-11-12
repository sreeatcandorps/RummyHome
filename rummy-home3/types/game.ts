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
  /** Numeric part of the visible number. Pre-028 servers: per-creator sequence. Assigned at creation, never changes. */
  gameNumber?: number | null;
  /** The visible number (028): S<n> for Points, P<n> for Pool. Assigned by the server at creation, never changes; shown instead of the id. */
  gameLabel?: string | null;
  /** When included in a declared result. A closed game is part of finalized results. */
  closedAt?: string | null;
  /** When Complete game was pressed. Kept when the game is later Closed. */
  completedAt?: string | null;
  /** Local (no Supabase) games only: column label per seat, fixed at seat time. Server games carry it on the seat row. */
  labels?: Record<string, string>;
  /** Who dealt each saved round, by round index (031). Missing before 031; the seat-order rule fills in. */
  dealerIds?: (string | null | undefined)[];
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
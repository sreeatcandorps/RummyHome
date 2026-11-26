export type GameSettings = {
  expense: boolean;
  expenseAmount: number;
  dropAmount: number;
  mdAmount: number;
  maxCount: number;
  poolAmount?: number;
  /** Pool (041): the score that puts a player out (100 in, 101 out). */
  poolLimit?: number;
  /** Pool (041, read-only since 042): the old on/off switch. false reads as reentryLimit 0, true as Unlimited. */
  reentry?: boolean;
  /** Pool (042): re-entries per player. null / absent = Unlimited; N = Limited to N (0 = none). */
  reentryLimit?: number | null;
  /** Pool (047, PR 24): a re-entry starts at the highest score still in (0) or that + 1 (1). Absent = 0 (the 041 rule). */
  reentryPlus?: 0 | 1;
  /** Pool (047, PR 24): a late joiner starts at the highest score still in (0) or that + 1 (1). Absent = 0. */
  lateEntryPlus?: 0 | 1;
  /** Points (043, PR 14): one multiplier for the whole game, 1–10,000; absent = 1. Never on a pool. */
  multiplier?: number;
  /** Seating order (PR 21): false from Start until the admin answers the once-per-game pop-up; absent on older games (never asked). */
  seatingPrompted?: boolean;
};

/** Pool (041) seat state, from game_players. Absent for Points games and pre-041 servers. */
export type PoolSeat = {
  /** The live round whose save put the player at or over the limit; null = still in. */
  outRound: number | null;
  /** The round they came back for (re-entry or late join); their total restarts at reentryScore from there. */
  reenteredRound: number | null;
  reentryScore: number | null;
  /** 1 for a first entry, 2 after a re-entry. Counts in the awards. */
  entries: number;
};

/** Pool (041): what the awards were based on, saved beside them. */
export type AwardNote = {
  preset?: 'winner' | 'left' | 'split' | 'drops' | 'custom';
  presetLabel?: string;
  entry?: number;
  poolTotal?: number;
  givenOut?: number;
};

export type DealerOverride = { playerId: string; round: number; keepsSequence: boolean };

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
  /** Pool (041): awards per player, saved on the Awards screen once the pool is Completed. Null = awards pending. */
  prizeShares?: Record<string, number> | null;
  /** Pool (041): when awards were last saved. Null = awards pending; such a pool cannot join a result. */
  awardedAt?: string | null;
  awardNote?: AwardNote | null;
  /** Pool (041): per-seat out / re-entry state. */
  poolSeats?: Record<string, PoolSeat>;
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
  /**
   * 052 (D60): who really deals the round being played, set from the Dealer sheet. Applies to `round`
   * only; `keepsSequence` = "this round only" (the round after goes on from the planned dealer).
   */
  nextDealerOverride?: DealerOverride | null;
  /** Soft delete (023). A deleted game is gone for everyone until restored. Since 045 the creator, admins and scored players still read it (read-only). */
  deletedAt?: string | null;
  deletedBy?: string | null;
  /** Whether the viewer may restore a deleted game (the deleter, or a creator/admin). */
  canRestore?: boolean;
  /** 045: what the deleted-game banner says. Absent on a live game and on a pre-045 server. */
  deletion?: GameDeletion;
};

/** One "Ask an admin to restore" (045). */
export type RestoreRequest = { profileId: string; name: string; requestedAt: string };

/** The 045 `deletion` block of a deleted game's bundle. */
export type GameDeletion = {
  deletedAt: string;
  deletedBy: string | null;
  deletedByName: string;
  deletedByMe: boolean;
  /** When the nightly purge erases it for good (deletedAt + 30 days). */
  purgeAt: string | null;
  canRestore: boolean;
  /** When the viewer asked, or null. */
  myRequestAt: string | null;
  requests: RestoreRequest[];
};

export interface Round {
  playerScores: Record<string, number>;
  roundNumber: number;
}
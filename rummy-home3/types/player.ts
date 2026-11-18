import type { PlayerStatus } from '@/utils/playerIdentity';

export interface Player {
  id: string;
  name: string;
  /** Short public code players share to be added to games. */
  playerCode?: string;
  email?: string;
  phone?: string;
  gamesPlayed?: number;
  gamesWon?: number;
  inviteStatus?: 'pending' | 'accepted';
  role: 'admin' | 'player';
  /** Role inside one game. Absent on the global player list. */
  seatRole?: 'game_admin' | 'player' | 'spectator';
  /** False for a non-player admin. Absent means seated, so older rows still score. */
  seated?: boolean;
  /** How many games this person has been in with the signed-in account. */
  gamesTogether?: number;
  /** Supabase profile created by the demo seeder. Real accounts omit this or set it false. */
  isDemo?: boolean;
  /** Registered, Unregistered, or a deleted state. Absent means registered (older rows). */
  status?: PlayerStatus;
  /** For an unregistered player: the creator who manages them. */
  managedBy?: string;
  firstName?: string;
  lastName?: string;
  zipCode?: string;
  /** Public player ID number, shown as #42. Never used to sign in. */
  playerNo?: number;
  /** Set when the account's email has been confirmed. */
  emailVerified?: boolean;
  /**
   * In the signed-in owner's My players: the stored scorecard label for this player
   * (unique in that list, migration 022). Absent on a pre-022 server; the app then
   * derives one with utils/initials.
   */
  initials?: string;
  /** In My players: when the owner added this player (ISO). Older rows keep the short initials on a clash. */
  addedAt?: string;
  /** On a game seat: the column label fixed when the seat was created (022). */
  label?: string;
} 
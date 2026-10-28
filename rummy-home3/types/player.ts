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
} 
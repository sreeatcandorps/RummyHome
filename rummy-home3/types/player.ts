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
  /** Supabase profile created by the demo seeder. Real accounts omit this or set it false. */
  isDemo?: boolean;
} 
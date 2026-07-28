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
} 
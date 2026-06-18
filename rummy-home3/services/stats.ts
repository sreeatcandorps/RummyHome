import { gamesService } from '@/services/games';
import { tokensService } from '@/services/tokens';
import { calculateFinalTotals } from '@/utils/scoring';

export type PlayerStats = {
  profileId: string;
  gamesPlayed: number;
  gamesWon: number;
  activeGames: number;
  completedGames: number;
  tokenBalance: number;
};

export const statsService = {
  async getPlayerStats(profileId: string): Promise<PlayerStats> {
    const [games, balances] = await Promise.all([
      gamesService.listGamesForCurrentUser(profileId),
      tokensService.getBalances(),
    ]);

    const completedGames = games.filter((game) => game.isComplete);
    const gamesWon = completedGames.filter((game) => {
      const totals = calculateFinalTotals(game.scores);
      const playerTotal = totals[profileId] ?? 0;
      const bestScore = Math.max(...Object.values(totals), Number.NEGATIVE_INFINITY);
      return playerTotal === bestScore;
    }).length;

    return {
      profileId,
      gamesPlayed: games.length,
      gamesWon,
      activeGames: games.filter((game) => !game.isComplete).length,
      completedGames: completedGames.length,
      tokenBalance: balances[profileId] ?? 0,
    };
  },
};

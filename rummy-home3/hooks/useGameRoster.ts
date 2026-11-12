import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { authService } from '@/services/auth';
import { gamesService } from '@/services/games';
import { isSupabaseConfigured } from '@/services/supabase';
import { storage } from '@/utils/storage';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { REQUEST_TIMEOUT_MS, withTimeout } from '@/utils/withTimeout';

/** The game, its seated players (score columns) and whether the viewer may run it. */
export function useGameRoster(id: string | undefined) {
  const cachedGame = gamesService.peekGame(id);
  const cachedSeats = gamesService.peekSeats(id);
  const [game, setGame] = useState<Game | null>(cachedGame);
  const [players, setPlayers] = useState<Player[]>(() => (cachedSeats ?? []).filter((player) => player.seatRole !== 'spectator' && player.seated !== false && player.id !== 'EX'));
  const [roster, setRoster] = useState<Player[]>(cachedSeats ?? []);
  const [canScore, setCanScore] = useState(false);
  const [loading, setLoading] = useState(!cachedGame);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      const userId = isSupabaseConfigured ? await authService.getCurrentUserId() : await storage.getCurrentPlayer();
      const [currentGame, gamePlayers] = await withTimeout(Promise.all([
        gamesService.getGame(id),
        gamesService.listGamePlayers(id),
      ]), REQUEST_TIMEOUT_MS, 'Couldn’t open this game.');
      const access = await gamesService.accessFor(id, userId, { game: currentGame, seats: gamePlayers });
      if (currentGame) {
        setGame(currentGame);
        setRoster(gamePlayers);
        setPlayers(gamePlayers.filter((player) => player.seatRole !== 'spectator' && player.seated !== false && player.id !== 'EX'));
        setCanScore(access.canScore);
        setError(null);
      } else {
        setError('This game is not available.');
      }
    } catch (caught) {
      setError(formatSupabaseError(caught));
    } finally {
      setLoading(false);
    }
  }, [id]);

  // useFocusEffect also runs on mount, so one load per open.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { game, setGame, players, roster, canScore, loading, error, reload };
}

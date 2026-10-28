import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { ResultsBoard } from '@/components/results/ResultsBoard';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { Screen } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { spacing, useAppTheme } from '@/constants/theme';
import { authService } from '@/services/auth';
import { gamesService } from '@/services/games';
import { resultsService } from '@/services/results';
import { isSupabaseConfigured } from '@/services/supabase';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { formatGameDateTime, gameIdLabel, gameTypeLabel } from '@/utils/gameDisplay';
import { canDeclareResults, GameResultSummary, totalAcrossGames } from '@/utils/results';
import { storage } from '@/utils/storage';
import { formatSupabaseError } from '@/utils/supabaseErrors';

function seatedNames(players: Player[]): Record<string, string> {
  const names: Record<string, string> = {};
  players.forEach((player) => {
    if (player.id === 'EX' || player.seated === false || player.seatRole === 'spectator') return;
    if (player.name?.trim()) names[player.id] = player.name.trim();
  });
  return names;
}

export default function ResultsScreen() {
  const { colors } = useAppTheme();
  const [games, setGames] = useState<Game[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<GameResultSummary[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const id = isSupabaseConfigured ? await authService.getCurrentUserId() : await storage.getCurrentPlayer();
      const player = await authService.getCurrentPlayer();
      if (!id) {
        setError('Not signed in.');
        return;
      }
      setUserId(id);
      const visible = await gamesService.listGamesForCurrentUser(id, {
        includeScores: true,
        email: player?.email,
      });
      const finished = visible.filter((game) => game.isComplete);
      setGames(finished);
      const listed = await Promise.all(finished.map((game) => gamesService.listGamePlayers(game.id).catch(() => [] as Player[])));
      const merged: Record<string, string> = {};
      listed.forEach((players) => Object.assign(merged, seatedNames(players)));
      setNames(merged);
      setSaved(await resultsService.list());
      setChecked((current) => current.filter((gameId) => finished.some((game) => game.id === gameId)));
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const selected = useMemo(
    () => checked.map((id) => games.find((game) => game.id === id)).filter((game): game is Game => Boolean(game)),
    [checked, games],
  );

  const standings = useMemo(
    () => totalAcrossGames(selected.map((game) => ({
      players: game.players,
      scores: game.scores,
      names,
    }))),
    [selected, names],
  );

  const allowed = canDeclareResults(selected, userId);

  const toggle = (id: string) => {
    setChecked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const declare = async () => {
    if (!userId || !allowed) return;
    setBusy(true);
    setError(null);
    try {
      const result = await resultsService.declare({ games: selected, names, userId });
      router.push(`/(screens)/results/${result.id}`);
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text variant="bodyLarge">
        Check finished games. Places update as you go. The totals table is the full list.
      </Text>
      {error ? (
        <View>
          <Text style={{ color: colors.error }}>{error}</Text>
          <Button onPress={load}>Retry</Button>
        </View>
      ) : null}
      {loading && games.length === 0 ? <LoadingRows /> : null}
      {!loading && games.length === 0 ? (
        <Text variant="bodyLarge">No finished games yet. Complete a game, then its points can be added up here.</Text>
      ) : null}
      {games.map((game) => {
        const on = checked.includes(game.id);
        const label = gameIdLabel(game);
        return (
          <Button
            key={game.id}
            mode={on ? 'contained' : 'outlined'}
            onPress={() => toggle(game.id)}
            style={styles.row}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${label} select game`}
          >
            {`${on ? '✓ ' : ''}${formatGameDateTime(game.date)}  ${label}  ${gameTypeLabel(game.gameType)}`}
          </Button>
        );
      })}
      {selected.length > 0 ? <ResultsBoard standings={standings} /> : games.length > 0 ? (
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>Check games to see places.</Text>
      ) : null}
      <Button
        mode="contained"
        icon="flag-checkered"
        onPress={declare}
        disabled={!allowed || busy}
        loading={busy}
        accessibilityLabel="Declare results"
      >
        Declare results
      </Button>
      {selected.length > 0 && !allowed ? (
        <Text variant="bodyMedium">
          Only an admin of every selected game can declare these results. Anyone can view them after they are declared.
        </Text>
      ) : selected.length > 0 ? (
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
          Anyone can view these results after you declare them.
        </Text>
      ) : null}
      <SectionCard title="Declared">
        {saved.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>None yet.</Text>
        ) : saved.map((item) => (
          <Button
            key={item.id}
            mode="text"
            onPress={() => router.push(`/(screens)/results/${item.id}`)}
            style={styles.saved}
            accessibilityLabel={`View results ${item.winnerLine}`}
          >
            {`${item.winnerLine} · ${item.gameCount === 1 ? '1 game' : `${item.gameCount} games`}`}
          </Button>
        ))}
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: 'stretch',
  },
  saved: {
    alignSelf: 'flex-start',
  },
});

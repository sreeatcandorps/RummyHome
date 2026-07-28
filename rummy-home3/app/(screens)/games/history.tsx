import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { router, useFocusEffect } from 'expo-router';
import { gamesService } from '@/services/games';
import { authService } from '@/services/auth';
import { Screen } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { GameListItem } from '@/components/ui/GameListItem';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { spacing } from '@/constants/theme';

export default function GameHistory() {
  const theme = useTheme();
  const [games, setGames] = useState<Game[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);

    try {
      const player = await authService.getCurrentPlayer();
      if (!player) return;

      setCurrentPlayer(player);
      const userGames = await gamesService.listGamesForCurrentUser(player.id);
      setGames(userGames);
    } catch (err) {
      console.error('History load error:', err);
      setError(formatSupabaseError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          Loading your games…
        </Text>
      </View>
    );
  }

  const activeCount = games.filter((game) => !game.isComplete).length;

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
    >
      <SectionCard
        title="Your games"
        supportingText={
          games.length > 0 ? `${games.length} total · ${activeCount} still active` : undefined
        }
      >
        {error ? (
          <EmptyState
            icon="alert-circle-outline"
            title="Couldn’t load games"
            message={error}
            actionLabel="Retry"
            onAction={() => loadData(true)}
          />
        ) : games.length > 0 ? (
          <View style={styles.list}>
            {games.map((game) => (
              <GameListItem
                key={game.id}
                game={game}
                onPress={() => router.push(`/(screens)/games/${game.id}`)}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="history"
            title="No games yet"
            message="Games you create or join will show up here."
            actionLabel="New Game"
            onAction={() => router.push('/(screens)/games/new')}
          />
        )}
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  list: {
    gap: spacing.md,
  },
});

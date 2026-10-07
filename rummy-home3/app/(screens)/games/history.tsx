import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Text } from 'react-native-paper';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { router, useFocusEffect } from 'expo-router';
import { gamesService } from '@/services/games';
import { authService } from '@/services/auth';
import { Screen } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { GameListItem } from '@/components/ui/GameListItem';
import { StatTile } from '@/components/ui/StatTile';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';

export default function GameHistory() {
  const { colors } = useAppTheme();
  const { isWide } = useLayout();
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
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
          Loading your games…
        </Text>
      </View>
    );
  }

  const activeCount = games.filter((game) => !game.isComplete).length;
  const activeGames = games.filter((game) => !game.isComplete);
  const completedGames = games.filter((game) => game.isComplete);

  const renderGroup = (title: string, icon: string, list: Game[]) =>
    list.length > 0 ? (
      <SectionCard title={title} icon={icon} supportingText={`${list.length} ${list.length === 1 ? 'game' : 'games'}`}>
        <View style={[styles.list, isWide && styles.grid]}>
          {list.map((game) => (
            <View key={game.id} style={isWide ? styles.gridItem : undefined}>
              <GameListItem game={game} onPress={() => router.push(`/(screens)/games/${game.id}`)} />
            </View>
          ))}
        </View>
      </SectionCard>
    ) : null;

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
    >
      {error ? (
        <SectionCard>
          <EmptyState
            icon="alert-circle-outline"
            title="Couldn’t load games"
            message={error}
            actionLabel="Retry"
            onAction={() => loadData(true)}
          />
        </SectionCard>
      ) : games.length > 0 ? (
        <>
          <View style={styles.stats}>
            <StatTile label="Total" value={games.length} icon="cards-playing-outline" />
            <StatTile label="Active" value={activeCount} icon="play-circle-outline" />
            <StatTile label="Completed" value={games.length - activeCount} icon="flag-checkered" />
          </View>
          {renderGroup('In progress', 'play-circle-outline', activeGames)}
          {renderGroup('Completed', 'flag-checkered', completedGames)}
        </>
      ) : (
        <SectionCard>
          <EmptyState
            icon="history"
            title="No games yet"
            message="Games you create or join will show up here."
            actionLabel="New game"
            onAction={() => router.push('/(screens)/games/new')}
          />
        </SectionCard>
      )}
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
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    flexBasis: '48%',
    flexGrow: 1,
  },
});

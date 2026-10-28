import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { Game } from '@/types/game';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { gamesService } from '@/services/games';
import { playersService } from '@/services/players';
import { sessionsService } from '@/services/sessions';
import { authService } from '@/services/auth';
import { isSupabaseConfigured } from '@/services/supabase';
import { storage } from '@/utils/storage';
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [creatingSession, setCreatingSession] = useState(false);
  const params = useLocalSearchParams<{ filter?: string }>();

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

      const userGames = await gamesService.listGamesForCurrentUser(player.id, {
        includeScores: false,
        email: player.email,
        limit: 100,
      });
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
  const todayGames = games.filter((game) => new Date(game.date).toDateString() === new Date().toDateString());
  const source = selecting
    ? games
    : params.filter === 'today'
      ? todayGames
      : params.filter === 'active'
        ? games.filter((game) => !game.isComplete)
        : games;
  const activeGames = source.filter((game) => !game.isComplete);
  const completedGames = source.filter((game) => game.isComplete);

  const toggleSelected = (gameId: string) => {
    setSelectedIds((current) => (current.includes(gameId) ? current.filter((id) => id !== gameId) : [...current, gameId]));
  };

  const createSession = async () => {
    setCreatingSession(true);
    setError(null);
    try {
      const directory = isSupabaseConfigured ? await playersService.listPlayers() : await storage.getPlayers();
      const names = new Map(directory.map((player) => [player.id, player.name]));
      const session = await sessionsService.create(selectedIds, names);
      setSelecting(false);
      setSelectedIds([]);
      router.push(`/(screens)/sessions/${session.id}`);
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setCreatingSession(false);
    }
  };

  const renderGroup = (title: string, icon: string, list: Game[]) =>
    list.length > 0 ? (
      <SectionCard title={title} icon={icon} supportingText={`${list.length} ${list.length === 1 ? 'game' : 'games'}`}>
        <View style={[styles.list, isWide && styles.grid]}>
          {list.map((game) => (
            <View key={game.id} style={isWide ? styles.gridItem : undefined}>
              <GameListItem
                game={game}
                selected={selectedIds.includes(game.id)}
                onPress={() => (selecting && game.isComplete ? toggleSelected(game.id) : router.push(`/(screens)/games/${game.id}`))}
              />
            </View>
          ))}
        </View>
      </SectionCard>
    ) : null;

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
    >
      <View style={styles.sessionBar}>
        {selecting ? (
          <>
            <Button mode="text" onPress={() => { setSelecting(false); setSelectedIds([]); }}>
              Cancel
            </Button>
            <Button
              mode="contained"
              icon="trophy-outline"
              loading={creatingSession}
              disabled={selectedIds.length === 0 || creatingSession}
              onPress={createSession}
            >
              Create session ({selectedIds.length})
            </Button>
          </>
        ) : (
          <Button mode="outlined" icon="scale-balance" onPress={() => setSelecting(true)}>
            Prize distribution
          </Button>
        )}
      </View>
      {selecting ? (
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
          Tap completed games to include them. Coins start from the points (stake) or the prize (pool).
        </Text>
      ) : null}
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
  sessionBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
  },
});

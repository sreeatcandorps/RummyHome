import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Text, Button, Card, Icon, useTheme } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { storage } from '@/utils/storage';
import { Player } from '@/types/player';
import { Game } from '@/types/game';
import { authService } from '@/services/auth';
import { gamesService } from '@/services/games';
import { playersService } from '@/services/players';
import { isSupabaseConfigured } from '@/services/supabase';
import { formatSupabaseError, isClockSkewError } from '@/utils/supabaseErrors';
import { Screen } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { GameListItem } from '@/components/ui/GameListItem';
import { MIN_TOUCH_TARGET, radius, spacing } from '@/constants/theme';

export default function Dashboard() {
  const theme = useTheme();
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async (isRefresh = false) => {
    // Keep whatever is already on screen while refetching so returning to the
    // dashboard never flashes a spinner or an empty state.
    if (isRefresh) setRefreshing(true);
    setLoadError(null);

    try {
      const player = await authService.getCurrentPlayer();
      if (!player) {
        setCurrentPlayer(null);
        setLoadError('Not signed in. Please log in again.');
        return;
      }

      setCurrentPlayer(player);

      try {
        const [allPlayers, games] = await Promise.all([
          isSupabaseConfigured ? playersService.listPlayers() : storage.getPlayers(),
          gamesService.listGamesForCurrentUser(player.id, { limit: 5, includeScores: false }),
        ]);
        setPlayers(allPlayers);
        setRecentGames(games);
      } catch (innerError) {
        if (isClockSkewError(innerError) && isSupabaseConfigured) {
          await authService.refreshSession();
          const [allPlayers, games] = await Promise.all([
            playersService.listPlayers(),
            gamesService.listGamesForCurrentUser(player.id, { limit: 5, includeScores: false }),
          ]);
          setPlayers(allPlayers);
          setRecentGames(games);
        } else {
          throw innerError;
        }
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
      setLoadError(formatSupabaseError(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const navigateToGame = (gameId: string) => {
    router.push(`/(screens)/games/${gameId}`);
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!currentPlayer) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          icon="account-alert-outline"
          title="You're signed out"
          message={loadError ?? 'Sign in to see your games.'}
          actionLabel="Go to login"
          onAction={() => router.replace('/(auth)/login')}
        />
      </View>
    );
  }

  const activeGames = recentGames.filter((game) => !game.isComplete).length;
  const gamesToday = recentGames.filter((game) => {
    const gameDate = new Date(game.date);
    const today = new Date();
    return gameDate.toDateString() === today.toDateString();
  }).length;

  const stats = [
    { label: 'Active', value: activeGames, icon: 'play-circle-outline' },
    { label: 'Players', value: players.length, icon: 'account-group-outline' },
    { label: 'Today', value: gamesToday, icon: 'calendar-today' },
  ];

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
    >
      <View style={styles.greeting}>
        <Text variant="headlineSmall" style={styles.greetingTitle}>
          Hi {currentPlayer.name.split(' ')[0]}
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          Start a game or pick up where you left off.
        </Text>
      </View>

      {loadError ? (
        <Card mode="contained" style={{ backgroundColor: theme.colors.errorContainer, borderRadius: radius.lg }}>
          <Card.Content style={styles.errorContent}>
            <Icon source="alert-circle-outline" size={24} color={theme.colors.onErrorContainer} />
            <View style={styles.errorBody}>
              <Text variant="titleSmall" style={{ color: theme.colors.onErrorContainer }}>
                Couldn’t load everything
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onErrorContainer }}>
                {loadError}
              </Text>
            </View>
            <Button mode="text" onPress={() => loadData(true)} textColor={theme.colors.onErrorContainer}>
              Retry
            </Button>
          </Card.Content>
        </Card>
      ) : null}

      <View style={styles.statsRow}>
        {stats.map((stat) => (
          <Card key={stat.label} mode="contained" style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <Icon source={stat.icon} size={20} color={theme.colors.primary} />
              <Text variant="headlineMedium" style={styles.statValue}>
                {stat.value}
              </Text>
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {stat.label}
              </Text>
            </Card.Content>
          </Card>
        ))}
      </View>

      <SectionCard title="Quick actions">
        <Button
          mode="contained"
          icon="plus"
          onPress={() => router.push('/(screens)/games/new')}
          contentStyle={styles.primaryAction}
          labelStyle={styles.primaryActionLabel}
        >
          New Game
        </Button>

        <View style={styles.actionGrid}>
          <Button
            mode="outlined"
            icon="account-search-outline"
            onPress={() => router.push('/(screens)/players/new')}
            style={styles.gridButton}
            contentStyle={styles.gridButtonContent}
          >
            Find Players
          </Button>
          <Button
            mode="outlined"
            icon="history"
            onPress={() => router.push('/(screens)/games/history')}
            style={styles.gridButton}
            contentStyle={styles.gridButtonContent}
          >
            History
          </Button>
          <Button
            mode="outlined"
            icon="account-group-outline"
            onPress={() => router.push('/(screens)/players')}
            style={styles.gridButton}
            contentStyle={styles.gridButtonContent}
          >
            All Players
          </Button>
        </View>
      </SectionCard>

      <SectionCard title="Recent games">
        {recentGames.length > 0 ? (
          <View style={styles.gameList}>
            {recentGames.map((game) => (
              <GameListItem key={game.id} game={game} onPress={() => navigateToGame(game.id)} />
            ))}
          </View>
        ) : (
          <EmptyState
            title="No games yet"
            message="Tap New Game and pick at least one other registered player."
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  greeting: {
    gap: spacing.xs,
  },
  greetingTitle: {
    fontWeight: '600',
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  errorBody: {
    flex: 1,
    gap: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: radius.lg,
  },
  statContent: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  statValue: {
    fontWeight: '700',
  },
  primaryAction: {
    height: 56,
  },
  primaryActionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  gridButton: {
    flexGrow: 1,
    flexBasis: '45%',
  },
  gridButtonContent: {
    height: MIN_TOUCH_TARGET,
  },
  gameList: {
    gap: spacing.md,
  },
});

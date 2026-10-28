import React, { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { Button, ProgressBar, Text } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { Player } from '@/types/player';
import { Game } from '@/types/game';
import { authService } from '@/services/auth';
import { gamesService } from '@/services/games';
import { isSupabaseConfigured } from '@/services/supabase';
import { storage } from '@/utils/storage';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { settleEnabled } from '@/constants/features';
import { formatGameDateTime, gameIdLabel, gameTypeLabel, isLocalToday } from '@/utils/gameDisplay';
import { Screen } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { GameListItem } from '@/components/ui/GameListItem';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';

type Chip = 'all' | 'live' | 'today';

export default function Dashboard() {
  const { colors } = useAppTheme();
  const { isWide } = useLayout();
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chip, setChip] = useState<Chip>('all');

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setLoadError(null);
    try {
      if (isSupabaseConfigured) await authService.ensureFreshSession();
      const player = await authService.getCurrentPlayer();
      if (!player) {
        setCurrentPlayer(null);
        setLoadError('Not signed in. Please log in again.');
        return;
      }
      setCurrentPlayer(player);
      const games = await gamesService.listGamesForCurrentUser(player.id, {
        limit: 50,
        includeScores: false,
        email: player.email,
      });
      setRecentGames(games);
    } catch (error) {
      setLoadError(formatSupabaseError(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadData(recentGames.length > 0);
  }, [loadData]));

  const liveGame = recentGames.find((game) => !game.isComplete) ?? null;
  const filtered = recentGames.filter((game) => {
    if (chip === 'live') return !game.isComplete;
    if (chip === 'today') return isLocalToday(game.date);
    return true;
  });
  const firstName = currentPlayer?.name?.split(' ')[0] || 'there';

  const liveCard = (
    <SectionCard title="Live" icon="cards-playing-outline">
      {liveGame ? (
        <GameListItem game={liveGame} onPress={() => router.push(`/(screens)/games/${liveGame.id}`)} />
      ) : (
        <Text variant="bodyLarge" accessibilityLabel="No live game">No live game.</Text>
      )}
      {liveGame ? (
        <Button mode="contained" style={styles.resume} onPress={() => router.push(`/(screens)/games/${liveGame.id}`)}>
          Resume
        </Button>
      ) : null}
    </SectionCard>
  );

  const recent = (
    <SectionCard title="Recent" icon="history">
      <View style={styles.chips}>
        {(['all', 'live', 'today'] as Chip[]).map((value) => (
          <Button
            key={value}
            mode={chip === value ? 'contained' : 'outlined'}
            compact
            onPress={() => setChip(value)}
            accessibilityLabel={value === 'all' ? 'All games' : value === 'live' ? 'Live games' : 'Today'}
          >
            {value === 'all' ? 'All' : value === 'live' ? 'Live' : 'Today'}
          </Button>
        ))}
      </View>
      {filtered.length === 0 ? (
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
          {recentGames.length === 0 ? 'No games yet.' : 'Nothing in this filter.'}
        </Text>
      ) : (
        filtered.map((game) => (
          <View key={game.id} style={styles.gameGap}>
            <GameListItem game={game} onPress={() => router.push(`/(screens)/games/${game.id}`)} />
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
              {game.isComplete ? 'Done' : 'Live'} · {gameIdLabel(game)} · {formatGameDateTime(game.date)} · {gameTypeLabel(game.gameType)}
            </Text>
          </View>
        ))
      )}
    </SectionCard>
  );

  if (!currentPlayer && !loading) {
    return (
      <Screen>
        <EmptyState
          icon="account-alert-outline"
          title="You're signed out"
          message={loadError ?? 'Sign in to see your games.'}
          actionLabel="Go to login"
          onAction={() => router.replace('/(auth)/login')}
        />
      </Screen>
    );
  }

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
    >
      {refreshing ? <ProgressBar indeterminate color={colors.primary} style={styles.bar} /> : null}
      <Text variant="headlineSmall" style={styles.hi}>Hi {firstName}</Text>
      <Button
        mode="contained"
        icon="plus"
        onPress={() => router.push('/(screens)/games/new')}
        style={styles.newGame}
        contentStyle={styles.newGameContent}
      >
        New game
      </Button>
      {loadError ? (
        <View style={styles.errorBox}>
          <Text variant="bodyMedium" style={{ color: colors.error }}>{loadError}</Text>
          <Button onPress={() => loadData(true)}>Retry</Button>
        </View>
      ) : null}
      {loading && recentGames.length === 0 ? <LoadingRows /> : (
        isWide ? (
          <View style={styles.columns}>
            <View style={styles.column}>
              {liveCard}
              {settleEnabled ? (
                <Button mode="outlined" icon="scale-balance" onPress={() => router.push('/(screens)/settle')} style={styles.settle}>
                  Settle
                </Button>
              ) : null}
            </View>
            <View style={styles.column}>{recent}</View>
          </View>
        ) : (
          <View>
            {liveCard}
            {settleEnabled ? (
              <Button mode="outlined" icon="scale-balance" onPress={() => router.push('/(screens)/settle')} style={styles.settle}>
                Settle
              </Button>
            ) : null}
            {recent}
          </View>
        )
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hi: {
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  newGame: {
    marginBottom: spacing.md,
  },
  newGameContent: {
    minHeight: 52,
  },
  bar: {
    marginBottom: spacing.sm,
  },
  errorBox: {
    marginBottom: spacing.md,
  },
  resume: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  settle: {
    marginVertical: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  gameGap: {
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  columns: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
  },
});

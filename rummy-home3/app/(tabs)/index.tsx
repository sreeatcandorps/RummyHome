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
import { splitHomeGames } from '@/utils/homeGames';
import { Screen } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { GameListItem } from '@/components/ui/GameListItem';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { JoinRequestsDialog } from '@/components/players/JoinRequestsDialog';
import { ClaimRequestsCard } from '@/components/players/ClaimRequestsCard';
import { playerIdentityService } from '@/services/playerIdentity';

export default function Dashboard() {
  const { colors } = useAppTheme();
  const { isWide } = useLayout();
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const addNotice = useCallback((text: string) => setNotices((cur) => (cur.includes(text) ? cur : [...cur, text])), []);

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
      // Warm the first live games so tapping one opens the scorecard at once.
      splitHomeGames(games).live.slice(0, 2).forEach((game) => { gamesService.prefetchGame(game.id); });
      playerIdentityService.takeNotices(player.id)
        .then((list) => { if (list.length) setNotices((cur) => [...cur, ...list.map((n) => n.text)]); })
        .catch(() => {});
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

  const { live, recent: finished } = splitHomeGames(recentGames);
  const firstName = currentPlayer?.name?.split(' ')[0] || 'there';

  const resultsButton = (
    <Button
      mode="contained"
      icon="podium"
      buttonColor={colors.secondaryContainer}
      textColor={colors.onSecondaryContainer}
      onPress={() => router.push('/(screens)/results')}
      style={styles.results}
      contentStyle={styles.resultsContent}
      labelStyle={styles.resultsLabel}
      accessibilityLabel="Results"
    >
      Results
    </Button>
  );

  const liveCard = (
    <SectionCard
      title={live.length ? `Live · ${live.length}` : 'Live'}
      icon="cards-playing-outline"
      supportingText={live.length ? 'Tap a game to carry on scoring.' : undefined}
    >
      {live.length === 0 ? (
        <Text variant="bodyLarge" accessibilityLabel="No live game">No live game.</Text>
      ) : (
        live.map((game) => (
          <View key={game.id} style={styles.gameGap}>
            <GameListItem game={game} viewerId={currentPlayer?.id} onPress={() => router.push(`/(screens)/games/${game.id}`)} />
          </View>
        ))
      )}
    </SectionCard>
  );

  const recent = (
    <SectionCard title={finished.length ? `Recent · ${finished.length}` : 'Recent'} icon="history" supportingText="Completed and Closed games, newest first.">
      {finished.length === 0 ? (
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>No finished games yet.</Text>
      ) : (
        finished.map((game) => (
          <View key={game.id} style={styles.gameGap}>
            <GameListItem game={game} viewerId={currentPlayer?.id} onPress={() => router.push(`/(screens)/games/${game.id}`)} />
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
      <JoinRequestsDialog me={currentPlayer} onChanged={() => loadData(true)} onNotice={addNotice} />
      {currentPlayer ? <ClaimRequestsCard ownerId={currentPlayer.id} onChanged={() => loadData(true)} /> : null}
      {notices.map((text, i) => (
        <SectionCard key={i} title="Player update" icon="account-alert-outline" supportingText={text}>
          <Button compact mode="text" onPress={() => setNotices((cur) => cur.filter((_, j) => j !== i))}>OK</Button>
        </SectionCard>
      ))}
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
              {resultsButton}
              {settleEnabled ? (
                <Button mode="outlined" icon="scale-balance" onPress={() => router.push('/(screens)/settle')} style={styles.settle}>
                  Settle
                </Button>
              ) : null}
              {liveCard}
            </View>
            <View style={styles.column}>{recent}</View>
          </View>
        ) : (
          <View>
            {resultsButton}
            {settleEnabled ? (
              <Button mode="outlined" icon="scale-balance" onPress={() => router.push('/(screens)/settle')} style={styles.settle}>
                Settle
              </Button>
            ) : null}
            {liveCard}
            <View style={styles.sectionGap} />
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
  results: {
    marginBottom: spacing.lg,
    borderRadius: 16,
  },
  resultsContent: {
    minHeight: 56,
  },
  resultsLabel: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  settle: {
    marginBottom: spacing.md,
  },
  gameGap: {
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  sectionGap: { height: spacing.md },
  columns: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
  },
});

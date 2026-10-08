import React, { useState, useCallback } from 'react';
import { Alert, View, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Text, Button, Icon, TouchableRipple } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { storage } from '@/utils/storage';
import { Player } from '@/types/player';
import { Game } from '@/types/game';
import { authService } from '@/services/auth';
import { gamesService } from '@/services/games';
import { playersService } from '@/services/players';
import { clearDemoData, loadDemoData } from '@/services/demoSeed';
import { isSupabaseConfigured } from '@/services/supabase';
import { formatSupabaseError, isClockSkewError } from '@/utils/supabaseErrors';
import { Screen } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { GameListItem } from '@/components/ui/GameListItem';
import { StatTile } from '@/components/ui/StatTile';
import { MIN_TOUCH_TARGET, radius, spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';

export default function Dashboard() {
  const { colors } = useAppTheme();
  const { isWide, isShort } = useLayout();
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState<null | 'load' | 'clear'>(null);

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
      if (isSupabaseConfigured) {
        await authService.ensureFreshSession();
      }

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
          const recovered = await authService.recoverFromStaleSession();
          if (!recovered) {
            setCurrentPlayer(null);
            setLoadError(formatSupabaseError(innerError));
            return;
          }
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
      if (isClockSkewError(error) && isSupabaseConfigured) {
        await authService.clearLocalSession();
        setCurrentPlayer(null);
      }
      setLoadError(formatSupabaseError(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const navigateToGame = (gameId: string) => {
    router.push(`/(screens)/games/${gameId}`);
  };

  const runDemoAction = async (action: 'load' | 'clear') => {
    setDemoBusy(action);
    try {
      if (action === 'load') {
        const result = await loadDemoData();
        await loadData(true);
        Alert.alert(
          'Demo data loaded',
          `${result.hostName} is in the sample games. Open the active game to keep adding rounds.`,
        );
      } else {
        await clearDemoData();
        await loadData(true);
        Alert.alert('Demo data cleared', 'Sample players and games were removed. Your account is still on this phone.');
      }
    } catch (error) {
      Alert.alert('Demo data failed', error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setDemoBusy(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!currentPlayer) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
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

  const shortcuts = [
    { label: 'Find players', icon: 'account-search-outline', href: '/(screens)/players/new' as const },
    { label: 'History', icon: 'history', href: '/(screens)/games/history' as const },
    { label: 'All players', icon: 'account-group-outline', href: '/(screens)/players' as const },
  ];

  const demoTools = __DEV__ ? (
    <SectionCard
      title="Developer preview"
      icon="flask-outline"
      supportingText="Sample players and games stay on this phone. This card is not in the Play Store build."
    >
      <View style={styles.demoActions}>
        <Button
          mode="contained"
          icon="database-plus"
          onPress={() => runDemoAction('load')}
          loading={demoBusy === 'load'}
          disabled={demoBusy !== null}
          style={styles.demoButton}
        >
          Load demo data
        </Button>
        <Button
          mode="outlined"
          icon="database-remove"
          onPress={() => runDemoAction('clear')}
          loading={demoBusy === 'clear'}
          disabled={demoBusy !== null}
          style={styles.demoButton}
        >
          Clear demo data
        </Button>
      </View>
    </SectionCard>
  ) : null;

  const hero = (
    <View style={[styles.hero, isShort && styles.heroCompact, { backgroundColor: colors.felt }]}>
      <View style={styles.heroSuit} pointerEvents="none">
        <Icon source="cards-spade" size={120} color="rgba(251, 241, 225, 0.06)" />
      </View>
      <Text variant="labelLarge" style={[styles.heroEyebrow, { color: colors.onFeltMuted }]}>
        Welcome back
      </Text>
      <Text variant="headlineMedium" style={[styles.heroTitle, { color: colors.onFelt }]} numberOfLines={1}>
        Hi {currentPlayer.name.split(' ')[0]}
      </Text>
      {isShort ? null : (
        <Text variant="bodyMedium" style={{ color: colors.onFeltMuted }}>
          Start a game or pick up where you left off.
        </Text>
      )}
      <Button
        mode="contained"
        icon="plus"
        onPress={() => router.push('/(screens)/games/new')}
        buttonColor={colors.onFelt}
        textColor={colors.felt}
        style={[styles.heroButton, isShort && styles.heroButtonCompact]}
        contentStyle={isShort ? styles.heroButtonContentCompact : styles.heroButtonContent}
        labelStyle={styles.heroButtonLabel}
      >
        New game
      </Button>
    </View>
  );

  const errorBanner = loadError ? (
    <View style={[styles.errorBanner, { backgroundColor: colors.errorContainer }]}>
      <Icon source="alert-circle-outline" size={24} color={colors.onErrorContainer} />
      <View style={styles.errorBody}>
        <Text variant="titleSmall" style={{ color: colors.onErrorContainer }}>
          Couldn’t load everything
        </Text>
        <Text variant="bodySmall" style={{ color: colors.onErrorContainer }}>
          {loadError}
        </Text>
      </View>
      <Button mode="text" onPress={() => loadData(true)} textColor={colors.onErrorContainer}>
        Retry
      </Button>
    </View>
  ) : null;

  const statsRow = (
    <View style={styles.row}>
      {stats.map((stat) => (
        <StatTile key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} />
      ))}
    </View>
  );

  const shortcutRow = (
    <View style={styles.row}>
      {shortcuts.map((shortcut) => (
        <View
          key={shortcut.label}
          style={[styles.shortcut, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
        >
          <TouchableRipple
            onPress={() => router.push(shortcut.href)}
            borderless
            style={styles.shortcutRipple}
            accessibilityRole="button"
            accessibilityLabel={shortcut.label}
          >
            <View style={styles.shortcutInner}>
              <View style={[styles.shortcutIcon, { backgroundColor: colors.primaryContainer }]}>
                <Icon source={shortcut.icon} size={20} color={colors.onPrimaryContainer} />
              </View>
              <Text variant="labelLarge" numberOfLines={1} style={styles.shortcutLabel}>
                {shortcut.label}
              </Text>
            </View>
          </TouchableRipple>
        </View>
      ))}
    </View>
  );

  const recent = (
    <SectionCard
      title="Recent games"
      icon="cards-playing-outline"
      right={
        recentGames.length > 0 ? (
          <Button compact onPress={() => router.push('/(screens)/games/history')}>
            See all
          </Button>
        ) : undefined
      }
    >
      {recentGames.length > 0 ? (
        <View style={styles.gameList}>
          {recentGames.map((game) => (
            <GameListItem key={game.id} game={game} onPress={() => navigateToGame(game.id)} />
          ))}
        </View>
      ) : (
        <EmptyState
          title="No games yet"
          message="Tap New game and pick at least one other registered player."
          actionLabel="New game"
          onAction={() => router.push('/(screens)/games/new')}
        />
      )}
    </SectionCard>
  );

  return (
    <Screen
      safeBottom={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
    >
      {errorBanner}
      {isWide ? (
        <View style={styles.columns}>
          <View style={styles.column}>
            {hero}
            {demoTools}
            {statsRow}
            {shortcutRow}
          </View>
          <View style={styles.column}>{recent}</View>
        </View>
      ) : (
        <>
          {hero}
          {demoTools}
          {statsRow}
          {shortcutRow}
          {recent}
        </>
      )}
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
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  column: {
    flex: 1,
    minWidth: 0,
    gap: spacing.lg,
  },
  hero: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.xs,
    overflow: 'hidden',
  },
  heroCompact: {
    padding: spacing.lg,
    gap: 0,
  },
  heroSuit: {
    position: 'absolute',
    right: -18,
    top: -14,
    transform: [{ rotate: '14deg' }],
  },
  heroEyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  heroTitle: {
    fontWeight: '800',
  },
  heroButton: {
    marginTop: spacing.lg,
    borderRadius: radius.full,
  },
  heroButtonCompact: {
    marginTop: spacing.md,
  },
  heroButtonContent: {
    height: 56,
  },
  heroButtonContentCompact: {
    height: MIN_TOUCH_TARGET,
  },
  heroButtonLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  errorBody: {
    flex: 1,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  shortcut: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  shortcutRipple: {
    borderRadius: radius.lg,
  },
  shortcutInner: {
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: MIN_TOUCH_TARGET * 2,
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  shortcutIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutLabel: {
    fontWeight: '700',
  },
  gameList: {
    gap: spacing.sm,
  },
  demoActions: {
    gap: spacing.sm,
  },
  demoButton: {
    borderRadius: radius.full,
  },
});

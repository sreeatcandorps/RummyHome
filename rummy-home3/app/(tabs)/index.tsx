import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { Portal, ProgressBar, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { router, useFocusEffect } from 'expo-router';
import { Player } from '@/types/player';
import { Game } from '@/types/game';
import { gamesService } from '@/services/games';
import { homeService } from '@/services/home';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { settleEnabled } from '@/constants/features';
import { splitHomeGames } from '@/utils/homeGames';
import { LINK_COMPLETE_TITLE, LinkOutcome, linkCompleteMessage, LinkRequestForMe } from '@/utils/linkPlayer';
import { PendingLink } from '@/utils/playerIdentity';
import { Screen, ScreenList } from '@/components/ui/Screen';
import { SectionCard, SectionCardEnd, SectionCardRows } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { GameListItem } from '@/components/ui/GameListItem';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { JoinRequestsDialog } from '@/components/players/JoinRequestsDialog';
import { ClaimRequestsCard } from '@/components/players/ClaimRequestsCard';
import { LinkRequestsCard } from '@/components/players/LinkRequestsCard';
import { NoticeDialog } from '@/components/ui/NoticeDialog';

const openGame = (id: string) => router.push(`/(screens)/games/${id}`);

/** One game card. Memoised so a Home re-render (a notice, a refresh) redraws only the rows that changed. */
const HomeGameRow = React.memo(function HomeGameRow({ game, viewerId }: { game: Game; viewerId?: string | null }) {
  return (
    <View style={styles.gameGap}>
      <GameListItem game={game} viewerId={viewerId} onPress={() => openGame(game.id)} />
    </View>
  );
});

export default function Dashboard() {
  const { colors } = useAppTheme();
  const { isWide } = useLayout();
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [claimRequests, setClaimRequests] = useState<PendingLink[] | null>(null);
  const [linkRequests, setLinkRequests] = useState<LinkRequestForMe[] | null>(null);
  // One-time pop-ups (025): "Harish (HG) is now linked to #40." for the organiser, shown once each.
  const [popups, setPopups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const addNotice = useCallback((text: string) => setNotices((cur) => (cur.includes(text) ? cur : [...cur, text])), []);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setLoadError(null);
    try {
      const home = await homeService.load();
      if (!home) {
        setCurrentPlayer(null);
        setLoadError('Not signed in. Please log in again.');
        return;
      }
      setCurrentPlayer(home.player);
      setRecentGames(home.games);
      setClaimRequests(home.claimRequests);
      setLinkRequests(home.linkRequests);
      const linked = home.notices.filter((n) => n.kind === 'linked').map((n) => n.text);
      const plain = home.notices.filter((n) => n.kind !== 'linked').map((n) => n.text);
      if (linked.length) setPopups((cur) => [...cur, ...linked]);
      if (plain.length) setNotices((cur) => [...cur, ...plain]);
      // Warm the first live games so tapping one opens the scorecard at once.
      splitHomeGames(home.games).live.slice(0, 2).forEach((game) => { gamesService.prefetchGame(game.id); });
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

  const { live, recent: finished } = useMemo(() => splitHomeGames(recentGames), [recentGames]);
  const firstName = currentPlayer?.name?.split(' ')[0] || 'there';
  const viewerId = currentPlayer?.id;
  const renderRecent = useCallback(({ item }: { item: Game }) => (
    <SectionCardRows>
      <HomeGameRow game={item} viewerId={viewerId} />
    </SectionCardRows>
  ), [viewerId]);

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

  const settleButton = settleEnabled ? (
    <Button mode="outlined" icon="scale-balance" onPress={() => router.push('/(screens)/settle')} style={styles.settle}>
      Settle
    </Button>
  ) : null;

  const liveCard = (
    <SectionCard
      title={live.length ? `Live · ${live.length}` : 'Live'}
      icon="cards-playing-outline"
      supportingText={live.length ? 'Tap a game to carry on scoring.' : undefined}
    >
      {live.length === 0 ? (
        <Text variant="bodyLarge" accessibilityLabel="No live game">No live game.</Text>
      ) : (
        live.map((game) => <HomeGameRow key={game.id} game={game} viewerId={viewerId} />)
      )}
    </SectionCard>
  );

  const recentTitle = finished.length ? `Recent · ${finished.length}` : 'Recent';
  const recentSupporting = 'Completed and Closed games, newest first.';
  const noFinished = <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>No finished games yet.</Text>;

  const recent = (
    <SectionCard title={recentTitle} icon="history" supportingText={recentSupporting}>
      {finished.length === 0 ? noFinished : (
        finished.map((game) => <HomeGameRow key={game.id} game={game} viewerId={viewerId} />)
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

  const top = (
    <>
      {refreshing ? <ProgressBar indeterminate color={colors.primary} style={styles.bar} /> : null}
      <Text variant="headlineSmall" style={styles.hi}>Hi {firstName}</Text>
      <JoinRequestsDialog me={currentPlayer} onChanged={() => loadData(true)} onNotice={addNotice} />
      {currentPlayer ? <ClaimRequestsCard ownerId={currentPlayer.id} onChanged={() => loadData(true)} preloaded={claimRequests} /> : null}
      {currentPlayer ? <LinkRequestsCard me={currentPlayer} preloaded={linkRequests} onAnswered={(outcome: LinkOutcome | null) => { if (outcome) setPopups((cur) => [...cur, linkCompleteMessage(outcome)]); loadData(true); }} /> : null}
      <Portal>
        {popups.length ? <NoticeDialog title={LINK_COMPLETE_TITLE} icon="link-variant" message={popups[0]} onDismiss={() => setPopups((cur) => cur.slice(1))} testID="linked-popup" /> : null}
      </Portal>
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
    </>
  );

  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />;

  if (loading && recentGames.length === 0) {
    return (
      <Screen refreshControl={refreshControl}>
        {top}
        <LoadingRows />
      </Screen>
    );
  }

  if (isWide) {
    return (
      <Screen refreshControl={refreshControl}>
        {top}
        <View style={styles.columns}>
          <View style={styles.column}>
            {resultsButton}
            {settleButton}
            {liveCard}
          </View>
          <View style={styles.column}>{recent}</View>
        </View>
      </Screen>
    );
  }

  // Phones: the Recent rows are drawn by the list as they scroll into view. The
  // Recent card is split into its head (header), rows, and closing edge (footer).
  return (
    <ScreenList
      data={finished}
      keyExtractor={(game) => game.id}
      renderItem={renderRecent}
      extraData={viewerId}
      initialNumToRender={8}
      windowSize={7}
      refreshControl={refreshControl}
      header={(
        <>
          {top}
          <View>
            {resultsButton}
            {settleButton}
            {liveCard}
            <View style={styles.sectionGap} />
            <SectionCard title={recentTitle} icon="history" supportingText={recentSupporting} part="top" />
          </View>
        </>
      )}
      footer={(
        <>
          {finished.length === 0 ? <SectionCardRows>{noFinished}</SectionCardRows> : null}
          <SectionCardEnd />
        </>
      )}
    />
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

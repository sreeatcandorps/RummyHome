import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { Portal, ProgressBar, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { router, useFocusEffect } from 'expo-router';
import { Player } from '@/types/player';
import { Game } from '@/types/game';
import { gamesService } from '@/services/games';
import { homeService } from '@/services/home';
import { playersService } from '@/services/players';
import { myPlayersAccessibilityLabel, myPlayersBadge } from '@/utils/homeButtons';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { settleEnabled } from '@/constants/features';
import { HOME_GAME_LIMIT } from '@/services/home';
import { RECENT_PAGE, recentPaging, splitHomeGames } from '@/utils/homeGames';
import { LINK_COMPLETE_TITLE, LinkOutcome, linkCompleteMessage, LinkRequestForMe } from '@/utils/linkPlayer';
import { PendingLink } from '@/utils/playerIdentity';
import { Screen, ScreenList } from '@/components/ui/Screen';
import { SectionCard, SectionCardEnd, SectionCardRows } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { GameListItem } from '@/components/ui/GameListItem';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { JoinRequestsDialog } from '@/components/players/JoinRequestsDialog';
import { ClaimRequestsCard } from '@/components/players/ClaimRequestsCard';
import { LinkRequestsCard } from '@/components/players/LinkRequestsCard';
import { NoticeDialog } from '@/components/ui/NoticeDialog';
import { Toast } from '@/components/ui/Toast';
import { DeletedGamesCard } from '@/components/home/DeletedGamesCard';
import { archiveService } from '@/services/archive';
import { restoreGameNote } from '@/utils/archive';
import { ASKED_TOAST, DeletedHomeGame } from '@/utils/deletedGames';

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
  // PR 10b (Q10.4): Recent draws RECENT_PAGE games, then more per "Show more" tap; a short page from the server ends it.
  const [recentShown, setRecentShown] = useState(RECENT_PAGE);
  const [mayHaveMore, setMayHaveMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [claimRequests, setClaimRequests] = useState<PendingLink[] | null>(null);
  const [linkRequests, setLinkRequests] = useState<LinkRequestForMe[] | null>(null);
  // The My players button's badge (PR 5, D5.3): cached count at once, then the fresh one.
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  // One-time pop-ups (025): "Harish (HG) is now linked to #40." for the organiser, shown once each.
  const [popups, setPopups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** True only when the server said there is no session — not when the server could not be reached. */
  const [signedOut, setSignedOut] = useState(false);
  const [notices, setNotices] = useState<string[]>([]);
  // 045: games deleted in the last 30 days that this person scored in (or runs); Ask / Restore from the card.
  const [deletedGames, setDeletedGames] = useState<DeletedHomeGame[]>([]);
  const [deletedBusy, setDeletedBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const addNotice = useCallback((text: string) => setNotices((cur) => (cur.includes(text) ? cur : [...cur, text])), []);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setLoadError(null);
    try {
      const home = await homeService.load();
      if (!home) {
        setCurrentPlayer(null);
        setSignedOut(true);
        setLoadError('Not signed in. Please log in again.');
        return;
      }
      setSignedOut(false);
      setCurrentPlayer(home.player);
      setRecentGames(home.games);
      setMayHaveMore(home.games.length >= HOME_GAME_LIMIT);
      playersService.readMyPlayers(home.player.id)
        .then((cached) => { if (cached.length > 0) setPlayerCount(cached.length); })
        .then(() => playersService.listMyPlayers(home.player.id))
        .then((fresh) => setPlayerCount(fresh.length))
        .catch(() => {});
      setClaimRequests(home.claimRequests);
      setLinkRequests(home.linkRequests);
      setDeletedGames(home.deletedGames);
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
  const paging = recentPaging(finished.length, recentShown, mayHaveMore);
  const shownFinished = useMemo(() => finished.slice(0, paging.visible), [finished, paging.visible]);
  const showMore = useCallback(async () => {
    if (paging.action === 'reveal') {
      setRecentShown((cur) => Math.max(cur, paging.visible) + RECENT_PAGE);
      return;
    }
    if (paging.action !== 'fetch' || !currentPlayer || loadingMore) return;
    setLoadingMore(true);
    try {
      const more = await homeService.loadMore(currentPlayer, recentGames.length);
      setMayHaveMore(more.length >= HOME_GAME_LIMIT);
      if (more.length) {
        setRecentGames((cur) => {
          const seen = new Set(cur.map((game) => game.id));
          return [...cur, ...more.filter((game) => !seen.has(game.id))];
        });
        setRecentShown((cur) => Math.max(cur, paging.visible) + RECENT_PAGE);
      }
    } catch (error) {
      addNotice(formatSupabaseError(error));
    } finally {
      setLoadingMore(false);
    }
  }, [paging.action, paging.visible, currentPlayer, loadingMore, recentGames.length, addNotice]);
  const askRestore = useCallback(async (game: DeletedHomeGame) => {
    setDeletedBusy(game.id);
    try {
      await archiveService.requestRestore(game.id);
      setToast(ASKED_TOAST);
      await loadData(true);
    } catch (error) {
      addNotice(formatSupabaseError(error));
    } finally {
      setDeletedBusy(null);
    }
  }, [loadData, addNotice]);

  const restoreDeleted = useCallback(async (game: DeletedHomeGame) => {
    setDeletedBusy(game.id);
    try {
      const { removedFromResults } = await archiveService.restoreGame(game.id, currentPlayer?.id ?? null);
      setToast(restoreGameNote(removedFromResults.length));
      await loadData(true);
    } catch (error) {
      addNotice(formatSupabaseError(error));
    } finally {
      setDeletedBusy(null);
    }
  }, [loadData, addNotice, currentPlayer?.id]);

  const firstName = currentPlayer?.name?.split(' ')[0] || 'there';
  const viewerId = currentPlayer?.id;
  const renderRecent = useCallback(({ item }: { item: Game }) => (
    <SectionCardRows style={{ backgroundColor: colors.surfaceVariant }}>
      <HomeGameRow game={item} viewerId={viewerId} />
    </SectionCardRows>
  ), [viewerId, colors.surfaceVariant]);

  // PR 5: Results and My players side by side where Results was; the bottom bar is Home and Profile.
  const badge = myPlayersBadge(playerCount);
  const resultsButton = (
    <View style={styles.actionRow}>
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
      <View style={styles.results}>
        <Button
          mode="contained"
          icon="account-group"
          buttonColor={colors.secondaryContainer}
          textColor={colors.onSecondaryContainer}
          onPress={() => router.push('/(tabs)/players')}
          contentStyle={styles.resultsContent}
          labelStyle={styles.resultsLabel}
          accessibilityLabel={myPlayersAccessibilityLabel(playerCount)}
          testID="home-my-players"
        >
          My players
        </Button>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: colors.leaderContainer, borderColor: colors.background }]} pointerEvents="none" testID="home-my-players-badge">
            <Text variant="labelMedium" style={[styles.badgeText, { color: colors.onLeaderContainer }]}>{badge}</Text>
          </View>
        ) : null}
      </View>
    </View>
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

  // Sree (Nov 14): no count in the Recent title; the card sits on a grey surface so Live reads as the thing to tap.
  const recentTitle = 'Recent';
  const recentSupporting = 'Completed and Closed games, newest first.';
  const recentStyle = { backgroundColor: colors.surfaceVariant };
  const noFinished = <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>No finished games yet.</Text>;
  const showMoreRow = paging.action === 'none' ? null : (
    <Button
      mode="text"
      icon="chevron-down"
      loading={loadingMore}
      disabled={loadingMore}
      onPress={showMore}
      style={styles.showMore}
      accessibilityLabel={paging.action === 'reveal' ? `Show ${Math.min(RECENT_PAGE, paging.hidden)} more games` : 'Show more games'}
      testID="home-recent-show-more"
    >
      {paging.action === 'reveal' ? `Show ${Math.min(RECENT_PAGE, paging.hidden)} more` : 'Show more'}
    </Button>
  );

  const recent = (
    <SectionCard title={recentTitle} icon="history" supportingText={recentSupporting} style={recentStyle}>
      {finished.length === 0 ? noFinished : (
        shownFinished.map((game) => <HomeGameRow key={game.id} game={game} viewerId={viewerId} />)
      )}
      {showMoreRow}
    </SectionCard>
  );

  // 045 (G03): under Recent; absent when nothing was deleted in the last 30 days.
  const deletedCard = deletedGames.length ? (
    <>
      <View style={styles.sectionGap} />
      <DeletedGamesCard games={deletedGames} viewerId={viewerId} busyId={deletedBusy} onOpen={openGame} onAsk={askRestore} onRestore={restoreDeleted} />
    </>
  ) : null;


  if (!currentPlayer && !loading) {
    // F2 (chaos c11): a first load that failed because the phone is offline is not a sign-out — the
    // session is still on the phone and works once the network is back. Say so and offer a retry.
    if (!signedOut && loadError) {
      return (
        <Screen>
          <EmptyState
            icon="wifi-off"
            title="Couldn't reach the server"
            message={`You're still signed in. ${loadError}`}
            actionLabel="Try again"
            onAction={() => loadData(true)}
          />
        </Screen>
      );
    }
    return (
      <Screen>
        <EmptyState
          icon="account-alert-outline"
          title="You're signed out"
          message="Sign in to see your games."
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
        <Toast message={toast} onDismiss={() => setToast(null)} aboveBar />
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
          <View style={styles.column}>{recent}{deletedCard}</View>
        </View>
      </Screen>
    );
  }

  // Phones: the Recent rows are drawn by the list as they scroll into view. The
  // Recent card is split into its head (header), rows, and closing edge (footer).
  return (
    <ScreenList
      data={shownFinished}
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
            <SectionCard title={recentTitle} icon="history" supportingText={recentSupporting} part="top" style={recentStyle} />
          </View>
        </>
      )}
      footer={(
        <>
          {finished.length === 0 ? <SectionCardRows style={recentStyle}>{noFinished}</SectionCardRows> : null}
          {showMoreRow ? <SectionCardRows style={recentStyle}>{showMoreRow}</SectionCardRows> : null}
          <SectionCardEnd style={recentStyle} />
          {deletedCard}
          <View style={styles.listTail} />
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
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  results: {
    flex: 1,
    marginBottom: spacing.lg,
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -4,
    minWidth: 26,
    height: 26,
    paddingHorizontal: 6,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
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
  showMore: { alignSelf: 'center' },
  // The last Recent row clears the bottom bar (Sree, Nov 14: the list's last line was clipped).
  listTail: { height: spacing.xl },
  columns: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
  },
});

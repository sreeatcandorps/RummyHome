import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Button, Text, Dialog, Icon, IconButton, Portal } from 'react-native-paper';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { EXPENSE_PLAYER_ID, gamesService } from '@/services/games';
import { authService } from '@/services/auth';
import { isSupabaseConfigured } from '@/services/supabase';
import { realtimeService } from '@/services/realtime';
import { MIN_TOUCH_TARGET, radius, seatColor, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { formatGameDateTime, gameIdLabel, gameTypeLabel } from '@/utils/gameDisplay';
import { buildPlayerInitials } from '@/utils/playerInitials';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { useLayout } from '@/hooks/useLayout';
import { ScoreColumn, ScoreTable } from '@/components/game/ScoreTable';
import { Standing, Standings } from '@/components/game/Standings';
import { BottomBar } from '@/components/ui/BottomBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { StackedAction } from '@/components/ui/StackedAction';
import { Tag } from '@/components/ui/Tag';

/** Side panel width in landscape; the table takes everything else. */
const SIDE_PANEL_WIDTH = 236;

export default function GameScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const theme = useAppTheme();
  const { colors } = theme;
  const { isShort, insets, gutterLeft, gutterRight } = useLayout();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showCompleteResult, setShowCompleteResult] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    loadGameData();
  }, [id]);

  useEffect(() => {
    if (!isSupabaseConfigured || typeof id !== 'string') return;
    const channel = realtimeService.subscribeToGame(id, { onChange: loadGameData });
    return () => {
      realtimeService.unsubscribe(channel);
    };
  }, [id]);

  // Reload game data when screen comes into focus (e.g., after adding scores)
  useFocusEffect(
    React.useCallback(() => {
      loadGameData();
    }, [id])
  );

  const loadGameData = async () => {
    if (typeof id !== 'string') return;

    try {
      const [currentGame, gamePlayers] = await Promise.all([
        gamesService.getGame(id),
        gamesService.listGamePlayers(id)
      ]);

      if (currentGame) {
        setGame(currentGame);
        setPlayers(
          currentGame.settings?.expense
            ? [...gamePlayers, { id: EXPENSE_PLAYER_ID, name: 'Expenses', role: 'player' } as Player]
            : gamePlayers,
        );
      }
    } catch (error) {
      console.error('Error loading game:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPlayerTotal = (playerId: string): number => {
    if (!game?.scores) return 0;
    return Object.values(game.scores[playerId] || []).reduce((sum, score) => sum + score, 0);
  };

  const getRoundTotal = (roundIndex: number): number => {
    if (!game?.scores) return 0;
    return Object.values(game.scores).reduce((sum, playerScores) => {
      return sum + (playerScores[roundIndex] || 0);
    }, 0);
  };

  const getMaxRounds = (): number => {
    if (!game?.scores) return 0;
    return Math.max(...Object.values(game.scores).map(scores => scores.length), 0);
  };

  const handleUndoLastRound = async () => {
    if (!game) return;

    const maxRounds = getMaxRounds();

    if (maxRounds > 0) {
      try {
        const currentUserId = isSupabaseConfigured
          ? await authService.getCurrentUserId()
          : null;
        const nextGame = await gamesService.undoLastRound(game.id, currentUserId ?? 'local-admin');
        if (nextGame) setGame(nextGame);
      } catch (error) {
        setActionError(formatSupabaseError(error));
      }
    }
  };

  const handleCompleteGame = async () => {
    if (!game) return;

    setCompleting(true);
    try {
      const updatedGame = await gamesService.completeGame(game.id);
      if (updatedGame) setGame(updatedGame);
      setShowCompleteConfirm(false);
      setShowCompleteResult(true);
    } catch (error) {
      console.error('Error completing game:', error);
      setShowCompleteConfirm(false);
      setActionError(formatSupabaseError(error));
    } finally {
      setCompleting(false);
    }
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
          Loading game…
        </Text>
      </View>
    );
  }

  if (!game || !players.length) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="cards-playing-outline"
          title="Couldn't open this game"
          message="It may have been removed, or the connection dropped. Try again in a moment."
          actionLabel="Try again"
          onAction={() => {
            setLoading(true);
            loadGameData();
          }}
        />
      </View>
    );
  }

  const maxRounds = getMaxRounds();

  const initials = buildPlayerInitials(players.map((player) => player.name));
  const initialsFor = (playerId: string) => initials[players.findIndex((p) => p.id === playerId)] ?? '?';

  // Expenses never deal, so the rotation only counts real seats.
  const seats = players.filter((player) => player.id !== EXPENSE_PLAYER_ID);
  const dealerIdForRound = (roundIndex: number) =>
    seats.length ? seats[roundIndex % seats.length]?.id : undefined;
  const nextDealerId = game.isComplete ? undefined : dealerIdForRound(maxRounds);

  const colorFor = (playerId: string) => seatColor(seats.findIndex((seat) => seat.id === playerId));

  const standings = [...players]
    .filter((player) => player.id !== EXPENSE_PLAYER_ID)
    .map((player) => ({ player, total: getPlayerTotal(player.id) }))
    .sort((a, b) => b.total - a.total);

  const bestTotal = standings[0]?.total;
  const hasLeader = maxRounds > 0 && standings.length > 0;
  const leaderIds = hasLeader ? standings.filter((entry) => entry.total === bestTotal).map((entry) => entry.player.id) : [];

  const ranked: Standing[] = standings.map((entry) => ({
    id: entry.player.id,
    name: entry.player.name,
    label: initialsFor(entry.player.id),
    color: colorFor(entry.player.id),
    total: entry.total,
    rank: standings.findIndex((other) => other.total === entry.total) + 1,
    isLeader: leaderIds.includes(entry.player.id),
  }));

  const columns: ScoreColumn[] = players.map((player, index) => ({
    id: player.id,
    label: initials[index],
    color: player.id === EXPENSE_PLAYER_ID ? colors.onSurfaceVariant : colorFor(player.id),
    isExpense: player.id === EXPENSE_PLAYER_ID,
  }));

  const totals = Object.fromEntries(players.map((player) => [player.id, getPlayerTotal(player.id)]));
  const roundTotals = Array.from({ length: maxRounds }, (_, roundIndex) => getRoundTotal(roundIndex));
  const grandTotal = players.reduce((sum, player) => sum + getPlayerTotal(player.id), 0);

  const startedOn = formatGameDateTime(game.date);
  const typeTag = <Tag label={gameTypeLabel(game.gameType)} tone={game.gameType} icon={game.gameType === 'pool' ? 'trophy-outline' : 'cash-multiple'} />;
  const statusTag = game.isComplete ? (
    <Tag label="Completed" icon="flag-checkered" />
  ) : (
    <Tag
      label={nextDealerId ? `Round ${game.currentRound} · ${initialsFor(nextDealerId)} deals` : `Round ${game.currentRound}`}
      tone="primary"
      icon="cards-outline"
    />
  );
  const idText = (
    <Text variant="labelMedium" numberOfLines={1} style={[{ color: colors.onSurfaceVariant }, tabularNums]}>
      ID {gameIdLabel(game)}
    </Text>
  );

  const table = (
    <ScoreTable
      columns={columns}
      scores={game.scores}
      roundCount={maxRounds}
      totals={totals}
      roundTotals={roundTotals}
      grandTotal={grandTotal}
      dealerLabelForRound={(roundIndex) => {
        const dealerId = dealerIdForRound(roundIndex);
        return dealerId ? initialsFor(dealerId) : undefined;
      }}
      nextDealerId={nextDealerId}
      leaderIds={leaderIds}
      compact={isShort}
      emptyMessage={game.isComplete ? 'This game was closed with no rounds.' : 'No rounds yet. Tap Add round to score the first hand.'}
    />
  );

  const openScoreEntry = () =>
    router.push({
      pathname: '/(screens)/score-entry',
      params: { gameId: game.id },
    });

  const undoButton = (
    <StackedAction
      icon="undo-variant"
      label="Undo"
      onPress={handleUndoLastRound}
      disabled={maxRounds === 0}
      height={isShort ? 44 : 56}
      accessibilityLabel="Undo round"
    />
  );

  const completeButton = (
    <StackedAction
      icon="flag-checkered"
      label="Complete"
      onPress={() => setShowCompleteConfirm(true)}
      height={isShort ? 44 : 56}
      accessibilityLabel="Complete game"
    />
  );

  const addRoundButton = (
    <Button
      mode="contained"
      onPress={openScoreEntry}
      icon="plus"
      style={styles.primaryAction}
      contentStyle={isShort ? styles.compactPrimaryContent : styles.primaryActionContent}
      labelStyle={styles.primaryActionLabel}
    >
      Add round
    </Button>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: !isShort,
          headerTitle: () => (
            <View>
              <Text variant="titleMedium" style={styles.headerTitle} numberOfLines={1}>
                Scoreboard
              </Text>
              <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }} numberOfLines={1}>
                Started {startedOn}
              </Text>
            </View>
          ),
        }}
      />

      {isShort ? (
        <View
          style={[
            styles.compactTopBar,
            { paddingTop: insets.top + spacing.xs, paddingLeft: Math.max(insets.left, spacing.xs), paddingRight: gutterRight },
          ]}
        >
          <IconButton icon="arrow-left" onPress={goBack} accessibilityLabel="Back" style={styles.backButton} />
          <Text variant="titleMedium" style={styles.headerTitle} numberOfLines={1}>
            Scoreboard
          </Text>
          {typeTag}
          {statusTag}
          <View style={styles.flex} />
          <Text variant="labelMedium" numberOfLines={1} style={{ color: colors.onSurfaceVariant }}>
            {startedOn}
          </Text>
          {idText}
        </View>
      ) : (
        <View style={[styles.infoStrip, { paddingLeft: gutterLeft, paddingRight: gutterRight }]}>
          <View style={styles.metaRow}>
            {typeTag}
            {statusTag}
            <View style={styles.flex} />
            {idText}
          </View>
          {standings.length > 0 ? <Standings standings={ranked} layout="rail" /> : null}
        </View>
      )}

      {isShort ? (
        <View
          style={[
            styles.landscapeBody,
            { paddingLeft: gutterLeft, paddingRight: gutterRight, paddingBottom: insets.bottom + spacing.sm },
          ]}
        >
          <View style={styles.flex}>{table}</View>
          <View style={[styles.sidePanel, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
            <Text variant="labelLarge" style={[styles.panelTitle, { color: colors.onSurfaceVariant }]}>
              STANDINGS
            </Text>
            <Standings standings={ranked} layout="list" style={styles.flex} />
            {!game.isComplete ? (
              <View style={styles.panelActions}>
                {addRoundButton}
                <View style={styles.panelActionRow}>
                  {undoButton}
                  {completeButton}
                </View>
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        <>
          <View
            style={[
              styles.portraitTable,
              { paddingLeft: insets.left + spacing.sm, paddingRight: insets.right + spacing.sm },
              game.isComplete && { paddingBottom: insets.bottom + spacing.md },
            ]}
          >
            {table}
          </View>
          {!game.isComplete ? (
            <BottomBar fullWidth>
              {undoButton}
              {addRoundButton}
              {completeButton}
            </BottomBar>
          ) : null}
        </>
      )}

      <Portal>
        <Dialog
          visible={showCompleteConfirm}
          onDismiss={() => setShowCompleteConfirm(false)}
          style={[styles.dialog, { backgroundColor: colors.surface }]}
        >
          <Dialog.Icon icon="flag-checkered" />
          <Dialog.Title style={styles.dialogTitle}>Complete this game?</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text variant="bodyMedium" style={[styles.dialogBody, { color: colors.onSurfaceVariant }]}>
              {maxRounds === 0
                ? 'No rounds have been scored yet. You can still close the game, but it will have no results.'
                : `${maxRounds} ${maxRounds === 1 ? 'round' : 'rounds'} will be locked in and no more rounds can be added.`}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setShowCompleteConfirm(false)}>Keep playing</Button>
            <Button
              mode="contained"
              onPress={handleCompleteGame}
              loading={completing}
              disabled={completing}
              contentStyle={styles.dialogButtonContent}
            >
              Complete game
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={showCompleteResult}
          onDismiss={() => setShowCompleteResult(false)}
          style={[styles.dialog, { backgroundColor: colors.surface }]}
        >
          <Dialog.Icon icon="trophy" color={colors.leader} />
          <Dialog.Title style={styles.dialogTitle}>Game complete</Dialog.Title>
          <Dialog.ScrollArea style={styles.resultScroll}>
            {standings.length > 0 ? (
              <View style={styles.standings}>
                {standings.map((entry, index) => {
                  const winner = index === 0 && entry.total === bestTotal && maxRounds > 0;
                  return (
                    <View
                      key={entry.player.id}
                      style={[
                        styles.standingRow,
                        { backgroundColor: winner ? colors.leaderContainer : 'transparent' },
                      ]}
                    >
                      <Text
                        variant="labelLarge"
                        style={[styles.standingRank, { color: winner ? colors.onLeaderContainer : colors.onSurfaceVariant }]}
                      >
                        {index + 1}
                      </Text>
                      <SeatAvatar name={entry.player.name} color={colorFor(entry.player.id)} size={30} />
                      <Text
                        variant="bodyLarge"
                        style={[styles.standingName, { color: winner ? colors.onLeaderContainer : colors.onSurface }]}
                        numberOfLines={1}
                      >
                        {entry.player.name}
                      </Text>
                      {winner ? <Icon source="crown" size={18} color={colors.leader} /> : null}
                      <Text
                        variant="titleMedium"
                        style={[
                          styles.standingTotal,
                          tabularNums,
                          {
                            color: winner
                              ? colors.onLeaderContainer
                              : entry.total > 0
                                ? colors.positive
                                : colors.onSurfaceVariant,
                          },
                        ]}
                      >
                        {entry.total}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text variant="bodyMedium">This game was closed with no scores.</Text>
            )}
          </Dialog.ScrollArea>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setShowCompleteResult(false)}>Stay here</Button>
            <Button
              mode="contained"
              onPress={() => { setShowCompleteResult(false); router.back(); }}
              contentStyle={styles.dialogButtonContent}
            >
              Done
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={!!actionError}
          onDismiss={() => setActionError(null)}
          style={[styles.dialog, { backgroundColor: colors.surface }]}
        >
          <Dialog.Icon icon="alert-circle-outline" />
          <Dialog.Title style={styles.dialogTitle}>Something went wrong</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogBody}>
              {actionError}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button mode="contained" onPress={() => setActionError(null)} contentStyle={styles.dialogButtonContent}>
              Got it
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  headerTitle: {
    fontWeight: '800',
  },
  infoStrip: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  compactTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  backButton: {
    margin: 0,
  },
  portraitTable: {
    flex: 1,
    paddingBottom: spacing.sm,
  },
  landscapeBody: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sidePanel: {
    width: SIDE_PANEL_WIDTH,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  panelTitle: {
    fontWeight: '800',
    letterSpacing: 0.8,
    fontSize: 11,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  panelActions: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  panelActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryAction: {
    flex: 2,
    borderRadius: radius.full,
  },
  primaryActionContent: {
    height: 56,
  },
  compactPrimaryContent: {
    height: MIN_TOUCH_TARGET,
  },
  primaryActionLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  dialog: {
    borderRadius: radius.xl,
    maxWidth: 480,
    width: '90%',
    alignSelf: 'center',
  },
  dialogTitle: {
    textAlign: 'center',
    fontWeight: '700',
  },
  dialogContent: {
    gap: spacing.md,
  },
  dialogBody: {
    lineHeight: 20,
    textAlign: 'center',
  },
  dialogActions: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  dialogButtonContent: {
    paddingHorizontal: spacing.sm,
  },
  resultScroll: {
    maxHeight: 320,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.lg,
  },
  standings: {
    gap: 2,
    paddingVertical: spacing.xs,
  },
  standingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  standingRank: {
    width: 18,
    textAlign: 'center',
    fontWeight: '800',
  },
  standingName: {
    flex: 1,
    fontWeight: '600',
  },
  standingTotal: {
    fontWeight: '800',
  },
});

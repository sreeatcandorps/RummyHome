import React from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Button, Text, Card, Dialog, Divider, Portal, useTheme } from 'react-native-paper';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useState, useEffect } from 'react';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { EXPENSE_PLAYER_ID, gamesService } from '@/services/games';
import { authService } from '@/services/auth';
import { isSupabaseConfigured } from '@/services/supabase';
import { realtimeService } from '@/services/realtime';
import { radius, spacing } from '@/constants/theme';
import { formatGameDateTime, gameIdLabel, gameTypeLabel, gameTypeTint } from '@/utils/gameDisplay';
import { buildPlayerInitials } from '@/utils/playerInitials';
import { formatSupabaseError } from '@/utils/supabaseErrors';

/** Columns flex to fill the width so even 10 players fit without side-scrolling. */
const ROUND_COLUMN_FLEX = 1.5;
const TOTAL_COLUMN_FLEX = 1.2;

const scoreFontSize = (playerCount: number) => {
  if (playerCount <= 5) return 15;
  if (playerCount <= 7) return 13;
  if (playerCount <= 10) return 11;
  return 10;
};

export default function GameScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
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

  if (loading || !game || !players.length) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          Loading game…
        </Text>
      </View>
    );
  }

  const maxRounds = getMaxRounds();
  const tint = gameTypeTint(game.gameType);

  // Landscape has width to spare and little height, so trade padding for rows.
  const fontSize = isLandscape
    ? Math.min(15, scoreFontSize(players.length) + 3)
    : scoreFontSize(players.length);
  const rowHeight = isLandscape ? 34 : players.length > 7 ? 40 : 44;

  const initials = buildPlayerInitials(players.map((player) => player.name));
  const initialsFor = (playerId: string) => initials[players.findIndex((p) => p.id === playerId)] ?? '?';

  // Expenses never deal, so the rotation only counts real seats.
  const seats = players.filter((player) => player.id !== EXPENSE_PLAYER_ID);
  const dealerIdForRound = (roundIndex: number) =>
    seats.length ? seats[roundIndex % seats.length]?.id : undefined;
  const nextDealerId = game.isComplete ? undefined : dealerIdForRound(maxRounds);

  const standings = [...players]
    .filter((player) => player.id !== EXPENSE_PLAYER_ID)
    .map((player) => ({ player, total: getPlayerTotal(player.id) }))
    .sort((a, b) => b.total - a.total);

  const cellStyle = {
    height: rowHeight,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: theme.colors.outlineVariant,
    paddingHorizontal: 2,
  };

  const typeBadge = (
    <View style={[styles.badge, { backgroundColor: tint.container }]}>
      <Text variant="labelSmall" style={[styles.badgeText, { color: tint.on }]}>
        {gameTypeLabel(game.gameType)}
      </Text>
    </View>
  );

  const statusBadge = (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: game.isComplete
            ? theme.colors.surfaceVariant
            : theme.colors.primaryContainer,
        },
      ]}
    >
      <Text
        variant="labelSmall"
        style={{
          color: game.isComplete ? theme.colors.onSurfaceVariant : theme.colors.onPrimaryContainer,
        }}
      >
        {game.isComplete
          ? 'Completed'
          : nextDealerId
            ? `Round ${game.currentRound} · ${initialsFor(nextDealerId)} deals`
            : `Round ${game.currentRound}`}
      </Text>
    </View>
  );

  const startedOn = formatGameDateTime(game.date);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {isLandscape ? (
        <View style={styles.compactInfo}>
          <Text variant="bodyMedium" numberOfLines={1} style={styles.compactInfoText}>
            Game started on {startedOn}
          </Text>
          {typeBadge}
          {statusBadge}
          <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
            Game ID {gameIdLabel(game)}
          </Text>
        </View>
      ) : (
        <Card mode="contained" style={[styles.infoCard, { backgroundColor: theme.colors.elevation.level2 }]}>
          <Card.Content style={styles.infoContent}>
            <View>
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Game started on
              </Text>
              <Text variant="titleMedium" style={styles.infoTitle} numberOfLines={1}>
                {startedOn}
              </Text>
            </View>

            <View style={styles.metaRow}>
              {typeBadge}
              {statusBadge}
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Game ID {gameIdLabel(game)}
              </Text>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* A plain View, not a Card: Paper wraps card children in a flexShrink-only
          container, which collapses the scrollable table to zero height. */}
      <View
        style={[
          styles.tableCard,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
        ]}
      >
        {/* Rendered above the ScrollView rather than as a sticky child: RN moves a
            sticky header's style onto its own wrapper and replaces the child style
            with flex:1, which drops flexDirection and stacks the columns. */}
        <View style={[styles.row, { backgroundColor: theme.colors.surfaceVariant }]}>
          <View style={[cellStyle, { flex: ROUND_COLUMN_FLEX }]}>
            <Text
              numberOfLines={1}
              style={[styles.headerText, { fontSize: fontSize - 2, color: theme.colors.onSurfaceVariant }]}
            >
              Rd
            </Text>
          </View>
          <View style={[cellStyle, { flex: TOTAL_COLUMN_FLEX }]}>
            <Text
              numberOfLines={1}
              style={[styles.headerText, { fontSize: fontSize - 2, color: theme.colors.onSurfaceVariant }]}
            >
              Tot
            </Text>
          </View>
          {players.map((player, index) => {
            const dealsNext = player.id === nextDealerId;

            return (
              <View
                key={player.id}
                style={[
                  cellStyle,
                  { flex: 1 },
                  dealsNext && { backgroundColor: theme.colors.primary },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.headerText,
                    {
                      fontSize: fontSize - 2,
                      color: dealsNext ? theme.colors.onPrimary : theme.colors.onSurfaceVariant,
                    },
                  ]}
                >
                  {initials[index]}
                </Text>
              </View>
            );
          })}
        </View>

        <ScrollView style={styles.tableScroll} showsVerticalScrollIndicator={false}>
          {maxRounds === 0 ? (
            <View style={styles.emptyTable}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                No rounds yet. Tap Add Round to score the first hand.
              </Text>
            </View>
          ) : (
            Array.from({ length: maxRounds }, (_, roundIndex) => {
              const roundNumber = roundIndex + 1;
              const roundTotal = getRoundTotal(roundIndex);
              const dealerId = dealerIdForRound(roundIndex);
              const dealer = dealerId ? initialsFor(dealerId) : '';

              return (
                <View
                  key={roundIndex}
                  style={[
                    styles.row,
                    {
                      backgroundColor: theme.colors.surface,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: theme.colors.outlineVariant,
                    },
                  ]}
                >
                  <View
                    style={[
                      cellStyle,
                      { flex: ROUND_COLUMN_FLEX, backgroundColor: theme.colors.elevation.level1 },
                    ]}
                  >
                    <Text style={[styles.roundText, { fontSize, color: theme.colors.onSurface }]}>
                      {roundNumber}
                    </Text>
                    {dealer ? (
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: fontSize - 4, color: theme.colors.onSurfaceVariant }}
                      >
                        D: {dealer}
                      </Text>
                    ) : null}
                  </View>

                  <View
                    style={[
                      cellStyle,
                      { flex: TOTAL_COLUMN_FLEX, backgroundColor: theme.colors.elevation.level1 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.totalText,
                        { fontSize, color: roundTotal === 0 ? theme.colors.onSurfaceVariant : theme.colors.error },
                      ]}
                    >
                      {roundTotal}
                    </Text>
                  </View>

                  {players.map((player) => {
                    const score = game.scores[player.id]?.[roundIndex] || 0;
                    return (
                      <View key={player.id} style={[cellStyle, { flex: 1 }]}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.scoreText,
                            { fontSize, color: theme.colors.onSurfaceVariant },
                            score > 0 && { color: theme.colors.primary, fontWeight: '700' },
                          ]}
                        >
                          {score !== 0 ? score : '–'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              );
            })
          )}
        </ScrollView>

        <View
          style={[
            styles.row,
            styles.totalsRow,
            {
              backgroundColor: theme.colors.secondaryContainer,
              borderTopColor: theme.colors.outline,
            },
          ]}
        >
          <View style={[cellStyle, { flex: ROUND_COLUMN_FLEX }]}>
            <Text style={[styles.headerText, { fontSize: fontSize - 2, color: theme.colors.onSecondaryContainer }]}>
              TOTAL
            </Text>
          </View>
          <View style={[cellStyle, { flex: TOTAL_COLUMN_FLEX }]}>
            <Text style={[styles.totalText, { fontSize, color: theme.colors.onSecondaryContainer }]}>
              {players.reduce((sum, player) => sum + getPlayerTotal(player.id), 0)}
            </Text>
          </View>
          {players.map((player) => {
            const total = getPlayerTotal(player.id);
            return (
              <View key={player.id} style={[cellStyle, { flex: 1 }]}>
                <Text
                  numberOfLines={1}
                  style={[styles.totalText, { fontSize, color: theme.colors.onSecondaryContainer }]}
                >
                  {total}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {!game.isComplete && (
        <View style={isLandscape ? styles.actionBarCompact : styles.actionBar}>
          <View style={styles.actionBarInner}>
            <Button
              mode="outlined"
              onPress={handleUndoLastRound}
              disabled={maxRounds === 0}
              style={styles.sideAction}
              contentStyle={isLandscape ? styles.actionContentCompact : styles.sideActionContent}
              labelStyle={styles.sideActionLabel}
            >
              Undo Round
            </Button>

            <Button
              mode="contained"
              onPress={() => router.push({
                pathname: '/(screens)/score-entry',
                params: { gameId: game.id }
              })}
              icon="plus"
              style={styles.primaryAction}
              contentStyle={isLandscape ? styles.actionContentCompact : styles.primaryActionContent}
              labelStyle={styles.primaryActionLabel}
            >
              Add Round
            </Button>

            <Button
              mode="outlined"
              onPress={() => setShowCompleteConfirm(true)}
              style={styles.sideAction}
              contentStyle={isLandscape ? styles.actionContentCompact : styles.sideActionContent}
              labelStyle={styles.sideActionLabel}
            >
              Complete Game
            </Button>
          </View>
        </View>
      )}

      <Portal>
        <Dialog
          visible={showCompleteConfirm}
          onDismiss={() => setShowCompleteConfirm(false)}
          style={styles.dialog}
        >
          <Dialog.Icon icon="flag-checkered" />
          <Dialog.Title style={styles.dialogTitle}>Complete this game?</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text variant="bodyMedium" style={styles.dialogBody}>
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
            >
              Complete game
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={showCompleteResult}
          onDismiss={() => setShowCompleteResult(false)}
          style={styles.dialog}
        >
          <Dialog.Icon icon="trophy-outline" />
          <Dialog.Title style={styles.dialogTitle}>Game complete</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            {standings.length > 0 ? (
              <View style={styles.standings}>
                {standings.map((entry, index) => (
                  <View key={entry.player.id}>
                    {index > 0 ? <Divider /> : null}
                    <View style={styles.standingRow}>
                      <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                        {index + 1}
                      </Text>
                      <Text variant="bodyLarge" style={styles.standingName} numberOfLines={1}>
                        {entry.player.name}
                      </Text>
                      <Text
                        variant="titleMedium"
                        style={{
                          color: entry.total > 0 ? theme.colors.primary : theme.colors.onSurfaceVariant,
                          fontWeight: '700',
                        }}
                      >
                        {entry.total}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text variant="bodyMedium">This game was closed with no scores.</Text>
            )}
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setShowCompleteResult(false)}>Stay here</Button>
            <Button mode="contained" onPress={() => { setShowCompleteResult(false); router.back(); }}>
              Done
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={!!actionError} onDismiss={() => setActionError(null)} style={styles.dialog}>
          <Dialog.Icon icon="alert-circle-outline" />
          <Dialog.Title style={styles.dialogTitle}>Something went wrong</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogBody}>
              {actionError}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button mode="contained" onPress={() => setActionError(null)}>
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  infoCard: {
    margin: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
  },
  compactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  compactInfoText: {
    fontWeight: '700',
    marginRight: spacing.xs,
  },
  infoContent: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  infoTitle: {
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  badgeText: {
    fontWeight: '700',
  },
  tableCard: {
    flex: 1,
    marginHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tableScroll: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
  },
  totalsRow: {
    borderTopWidth: 2,
  },
  emptyTable: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  headerText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  roundText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  scoreText: {
    fontWeight: '500',
    textAlign: 'center',
  },
  totalText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  // Floats clear of the rounded bottom edge instead of sitting flush against it.
  actionBar: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  actionBarCompact: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  actionContentCompact: {
    height: 40,
  },
  actionBarInner: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  primaryAction: {
    flex: 1.4,
    borderRadius: radius.full,
  },
  primaryActionContent: {
    height: 52,
  },
  primaryActionLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginHorizontal: spacing.xs,
  },
  sideAction: {
    flex: 1,
    borderRadius: radius.full,
    justifyContent: 'center',
  },
  sideActionContent: {
    height: 52,
  },
  sideActionLabel: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginHorizontal: spacing.xs,
    marginVertical: 0,
  },
  dialog: {
    borderRadius: radius.lg,
  },
  dialogTitle: {
    textAlign: 'center',
  },
  dialogContent: {
    gap: spacing.md,
  },
  dialogBody: {
    lineHeight: 20,
  },
  dialogActions: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  standings: {
    gap: spacing.xs,
  },
  standingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  standingName: {
    flex: 1,
  },
});

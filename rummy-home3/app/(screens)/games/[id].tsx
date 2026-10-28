import React from 'react';
import { Linking, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Button, Text, Dialog, Icon, Menu, Portal } from 'react-native-paper';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { EXPENSE_PLAYER_ID, gamesService } from '@/services/games';
import { authService } from '@/services/auth';
import { playersService } from '@/services/players';
import { sendScorecardEmail } from '@/services/mail';
import { isSupabaseConfigured } from '@/services/supabase';
import { realtimeService } from '@/services/realtime';
import { storage } from '@/utils/storage';
import { MIN_TOUCH_TARGET, radius, seatColor, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { formatGameDateTime, gameIdLabel, gameTypeLabel } from '@/utils/gameDisplay';
import { buildShareCard, sharePlaces } from '@/utils/shareCard';
import { totalAcrossGames } from '@/utils/results';
import { buildPlayerInitials } from '@/utils/playerInitials';
import { scorecardUrl } from '@/utils/shareLink';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { REQUEST_TIMEOUT_MS, withTimeout } from '@/utils/withTimeout';
import { settleEnabled } from '@/constants/features';
import { HELP } from '@/constants/help';
import { HelpButton } from '@/components/ui/HelpButton';
import { useLayout } from '@/hooks/useLayout';
import { PlayersSheet } from '@/components/game/PlayersSheet';
import { ScoreColumn, ScoreTable } from '@/components/game/ScoreTable';
import { ShareDialog } from '@/components/game/ShareDialog';
import { BottomBar } from '@/components/ui/BottomBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { StackedAction } from '@/components/ui/StackedAction';
import { Tag } from '@/components/ui/Tag';

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
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [showCompleteResult, setShowCompleteResult] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [canScore, setCanScore] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [playersOpen, setPlayersOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [roster, setRoster] = useState<Player[]>([]);
  const [directory, setDirectory] = useState<Player[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      const userId = isSupabaseConfigured
        ? await authService.getCurrentUserId()
        : await storage.getCurrentPlayer();
      const [currentGame, gamePlayers, access] = await withTimeout(Promise.all([
        gamesService.getGame(id),
        gamesService.listGamePlayers(id),
        gamesService.accessFor(id, userId),
      ]), REQUEST_TIMEOUT_MS, 'Couldn’t open this game.');

      if (currentGame) {
        const seated = gamePlayers.filter((player) => player.seatRole !== 'spectator' && player.seated !== false);
        setGame(currentGame);
        setRoster(gamePlayers);
        setCanScore(access.canScore);
        setLoadError(null);
        setPlayers(
          currentGame.settings?.expense
            ? [...seated, { id: EXPENSE_PLAYER_ID, name: 'Expenses', role: 'player' } as Player]
            : seated,
        );
      }
    } catch (error) {
      console.error('Error loading game:', error);
      setLoadError(formatSupabaseError(error));
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

  const handleUndoLastRound = () => {
    if (!game || getMaxRounds() === 0) return;
    setShowUndoConfirm(true);
  };

  const confirmUndoLastRound = async () => {
    if (!game) return;
    setShowUndoConfirm(false);
    try {
      const currentUserId = isSupabaseConfigured ? await authService.getCurrentUserId() : null;
      const nextGame = await gamesService.undoLastRound(game.id, currentUserId ?? 'local-admin');
      if (nextGame) setGame(nextGame);
    } catch (error) {
      setActionError(formatSupabaseError(error));
    }
  };

  const playingSeats = () => players.filter((player) => player.id !== EXPENSE_PLAYER_ID);

  const openComplete = () => {
    setShowCompleteConfirm(true);
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

  const openShare = async () => {
    if (!game) return;
    setMenuOpen(false);
    setShareNotice(null);
    setShareOpen(true);
    try {
      const token = await gamesService.ensureViewToken(game.id);
      setShareLink(scorecardUrl(token));
    } catch (error) {
      setShareLink('');
      setShareNotice(formatSupabaseError(error));
    }
  };

  const copyShareLink = async () => {
    if (!shareLink) return;
    await Clipboard.setStringAsync(shareLink);
    setShareNotice('Link copied. Paste it into WhatsApp.');
  };

  const emailShareLink = async (selected: { email?: string }[]) => {
    if (!game || !shareLink) return;
    const emails = selected.map((person) => person.email).filter((email): email is string => Boolean(email));
    const skipped = selected.length - emails.length;
    setShareBusy(true);
    try {
      if (emails.length === 0) {
        setShareNotice(skipped > 0 ? `Skipped ${skipped}. Copy the link instead.` : 'Copy the link to share it.');
        return;
      }
      const result = await sendScorecardEmail({
        gameId: game.id,
        emails,
        url: shareLink,
        gameLabel: gameIdLabel(game),
        startedAt: formatGameDateTime(game.date),
      });
      setShareNotice(skipped > 0 ? `${result.message} Skipped ${skipped}.` : result.message);
    } finally {
      setShareBusy(false);
    }
  };

  const openPublicScorecard = async () => {
    setMenuOpen(false);
    try {
      if (!game) return;
      const token = game.viewToken ?? await gamesService.ensureViewToken(game.id);
      const url = scorecardUrl(token);
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else setActionError(url);
    } catch (error) {
      setActionError(formatSupabaseError(error));
    }
  };

  const openPlayers = async () => {
    setMenuOpen(false);
    setPlayersOpen(true);
    try {
      const userId = isSupabaseConfigured ? await authService.getCurrentUserId() : await storage.getCurrentPlayer();
      const everyone = userId ? await playersService.listMyPlayers(userId) : [];
      setDirectory(everyone.map((player) => ({ ...player, email: undefined, phone: undefined })));
    } catch (error) {
      setActionError(formatSupabaseError(error));
    }
  };

  const changeAdmin = async (player: Player, makeAdmin: boolean) => {
    if (!game) return;
    try {
      await gamesService.setSeatRole(game.id, player.id, makeAdmin ? 'game_admin' : 'player');
      await loadGameData();
    } catch (error) {
      setActionError(formatSupabaseError(error));
    }
  };

  const addViewer = async (player: Player) => {
    if (!game) return;
    try {
      await gamesService.setSeatRole(game.id, player.id, 'spectator');
      await loadGameData();
    } catch (error) {
      setActionError(formatSupabaseError(error));
    }
  };

  const addPlayer = async (player: Player) => {
    if (!game) return;
    try {
      await gamesService.addSeatedPlayer(game.id, player.id);
      await loadGameData();
    } catch (error) {
      setActionError(formatSupabaseError(error));
    }
  };

  const addScorekeeper = async (player: Player) => {
    if (!game) return;
    try {
      await gamesService.addNonPlayerAdmin(game.id, player.id);
      await loadGameData();
    } catch (error) {
      setActionError(formatSupabaseError(error));
    }
  };

  const moveSeat = async (player: Player, direction: -1 | 1) => {
    if (!game) return;
    try {
      const next = await gamesService.moveSeat(game.id, player.id, direction);
      if (next) setGame(next);
      await loadGameData();
    } catch (error) {
      setActionError(formatSupabaseError(error));
    }
  };

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
          message={loadError ?? 'It may have been removed, or the connection dropped. Try again in a moment.'}
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
  const scorecardPlaces = totalAcrossGames([{
    players: seats.map((seat) => seat.id),
    scores: game.scores,
    names: Object.fromEntries(seats.map((seat) => [seat.id, seat.name])),
  }]);
  const shareCard = buildShareCard({
    title: gameIdLabel(game),
    date: formatGameDateTime(game.date),
    rows: scorecardPlaces.map((row) => ({ name: row.name, points: row.points })),
    places: sharePlaces(scorecardPlaces),
  });

  const bestTotal = standings[0]?.total;
  const hasLeader = maxRounds > 0 && standings.length > 0;
  const leaderIds = hasLeader ? standings.filter((entry) => entry.total === bestTotal).map((entry) => entry.player.id) : [];

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
  const typeTag = <Tag label={gameTypeLabel(game.gameType)} tone={game.gameType} icon={game.gameType === 'pool' ? 'trophy-outline' : settleEnabled ? 'cash-multiple' : 'numeric'} />;
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
      label="Done"
      onPress={openComplete}
      height={isShort ? 44 : 56}
      accessibilityLabel="Done"
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
          headerShown: true,
          title: 'Scorecard',
          headerTitleAlign: 'left',
          headerStyle: { backgroundColor: colors.background },
          headerRight: () => (
            <View style={styles.headerActions}>
              <HelpButton text={HELP.scorecard} />
              <Menu
                visible={menuOpen}
                onDismiss={() => setMenuOpen(false)}
                anchor={<Button compact icon="dots-vertical" onPress={() => setMenuOpen(true)} accessibilityLabel="Scorecard menu"> </Button>}
              >
                <Menu.Item leadingIcon="account-group-outline" onPress={openPlayers} title="Players" />
                <Menu.Item leadingIcon="share-variant" onPress={openShare} title="Share" />
              </Menu>
            </View>
          ),
        }}
      />

      <View style={[styles.infoStrip, { paddingLeft: gutterLeft, paddingRight: gutterRight }]}>
        <View style={styles.metaRow}>
          {typeTag}
          {statusTag}
          {!canScore && !game.isComplete ? <Tag label="View only" icon="eye-outline" /> : null}
          <View style={styles.flex} />
          <Text variant="labelMedium" numberOfLines={1} style={{ color: colors.onSurfaceVariant }}>
            Started {startedOn}
          </Text>
          {idText}
        </View>
        {!canScore && !game.isComplete ? (
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>View only.</Text>
        ) : null}
        {game.isComplete ? (
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>Completed.</Text>
        ) : null}
      </View>

      {isShort ? (
        <View
          style={[
            styles.landscapeBody,
            { paddingLeft: gutterLeft, paddingRight: gutterRight },
          ]}
        >
          <View style={styles.flex}>{table}</View>
        </View>
      ) : (
        <View
          style={[
            styles.portraitTable,
            { paddingLeft: insets.left + spacing.sm, paddingRight: insets.right + spacing.sm },
            (game.isComplete || !canScore) && { paddingBottom: insets.bottom + spacing.md },
          ]}
        >
          {table}
        </View>
      )}
      {!game.isComplete && canScore ? (
        <BottomBar fullWidth>
          {undoButton}
          {addRoundButton}
          {completeButton}
        </BottomBar>
      ) : null}

      <Portal>
        <Dialog
          visible={showUndoConfirm}
          onDismiss={() => setShowUndoConfirm(false)}
          style={[styles.dialog, { backgroundColor: colors.surface }]}
        >
          <Dialog.Title>Remove the last round?</Dialog.Title>
          <Dialog.Actions>
            <Button onPress={() => setShowUndoConfirm(false)}>Cancel</Button>
            <Button mode="contained" onPress={confirmUndoLastRound}>Remove</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog
          visible={showCompleteConfirm}
          onDismiss={() => setShowCompleteConfirm(false)}
          style={[styles.dialog, { backgroundColor: colors.surface }]}
        >
          <Dialog.Title style={styles.dialogTitle}>
            <View style={styles.headerActions}>
              <Text variant="titleLarge">Complete this game?</Text>
              <HelpButton text={HELP.complete} />
            </View>
          </Dialog.Title>
          <Dialog.ScrollArea style={styles.resultScroll}>
            <Text variant="bodyMedium" style={[styles.dialogBody, { color: colors.onSurfaceVariant }]}>
              ID {gameIdLabel(game)}. The scores stay as they are.
            </Text>
            {playingSeats().map((seat) => (
              <View key={seat.id} style={styles.prizeRow}>
                <Text variant="bodyLarge" style={styles.standingName} numberOfLines={1}>
                  {seat.name}
                </Text>
                <Text variant="titleMedium" style={tabularNums}>
                  {getPlayerTotal(seat.id) > 0 ? `+${getPlayerTotal(seat.id)}` : getPlayerTotal(seat.id)}
                </Text>
              </View>
            ))}
          </Dialog.ScrollArea>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setShowCompleteConfirm(false)}>Not yet</Button>
            <Button
              mode="contained"
              onPress={handleCompleteGame}
              loading={completing}
              disabled={completing}
              contentStyle={styles.dialogButtonContent}
            >
              Confirm
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

        <ShareDialog
          visible={shareOpen}
          people={roster.map((person) => ({
            id: person.id,
            name: person.name,
            playerCode: person.playerCode,
            email: person.email,
          }))}
          link={shareLink}
          card={shareCard}
          startedLabel={startedOn}
          gameLabel={gameIdLabel(game)}
          busy={shareBusy}
          notice={shareNotice}
          onDismiss={() => setShareOpen(false)}
          onCopy={copyShareLink}
          onEmail={emailShareLink}
          onPreview={openPublicScorecard}
          onNotice={setShareNotice}
        />
        <PlayersSheet
          visible={playersOpen}
          seats={roster}
          canManage={canScore}
          candidates={directory}
          canReorder={getMaxRounds() === 0}
          onDismiss={() => setPlayersOpen(false)}
          onToggleAdmin={changeAdmin}
          onAddPlayer={addPlayer}
          onAddSpectator={addViewer}
          onAddNonPlayerAdmin={addScorekeeper}
          onFindPlayers={() => {
            setPlayersOpen(false);
            router.push('/(screens)/players/new');
          }}
          onMove={moveSeat}
        />
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
  prizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  prizeInput: {
    width: 96,
    backgroundColor: 'transparent',
  },
});

import { gameTitle } from '@/utils/gameLabel';
import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Button, Text, Dialog, Menu, Portal, Snackbar } from 'react-native-paper';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { gamesService } from '@/services/games';
import { archiveService, HoldingResult } from '@/services/archive';
import { authService } from '@/services/auth';
import { DELETE_GAME_BODY, DELETE_GAME_TITLE, deleteGameWarning, deletedBody, GAME_DELETED_TITLE, HIDE_GAME_NOTE, restoreGameNote } from '@/utils/archive';
import { isSupabaseConfigured } from '@/services/supabase';
import { realtimeService } from '@/services/realtime';
import { storage } from '@/utils/storage';
import { PLAYERS_ADMINS_TITLE } from '@/utils/gameAdmins';
import { radius, seatColor, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { gameTypeLabel } from '@/utils/gameDisplay';
import { seatLabels } from '@/utils/initials';
import { scorecardUrl } from '@/utils/shareLink';
import { canShareResults } from '@/utils/scorecardSheet';
import { shareLiveScorecard } from '@/utils/shareImage';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { REQUEST_TIMEOUT_MS, withTimeout } from '@/utils/withTimeout';
import { settleEnabled } from '@/constants/features';
import { HELP } from '@/constants/help';
import { HelpButton } from '@/components/ui/HelpButton';
import { useLayout } from '@/hooks/useLayout';
import { useMenuThenShare } from '@/hooks/useMenuThenShare';
import { ScoreColumn, ScoreTable } from '@/components/game/ScoreTable';
import { BottomBar } from '@/components/ui/BottomBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { StackedAction } from '@/components/ui/StackedAction';
import { editableRounds } from '@/utils/editRound';
import { Tag } from '@/components/ui/Tag';
import { GameSettingsDialog } from '@/components/game/GameSettingsDialog';
import { GameIdFooter } from '@/components/game/GameIdFooter';
import { rulesFromGame } from '@/utils/gameSettings';
import { canReopenGame } from '@/utils/gameStatus';

export default function GameScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const theme = useAppTheme();
  const { colors } = theme;
  const { isShort, insets, gutterLeft, gutterRight } = useLayout();
  // Seed from the last-known copy so returning from Add round shows the new row at once; the fresh load follows.
  const cachedGame = gamesService.peekGame(typeof id === 'string' ? id : null);
  const cachedSeats = gamesService.peekSeats(typeof id === 'string' ? id : null);
  const [game, setGame] = useState<Game | null>(cachedGame);
  const [players, setPlayers] = useState<Player[]>(() => (cachedSeats ?? []).filter((p) => p.seatRole !== 'spectator' && p.seated !== false && p.id !== 'EX'));
  const [members, setMembers] = useState<Player[]>(cachedSeats ?? []);
  const [loading, setLoading] = useState(!(cachedGame && cachedSeats));
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [showReopenConfirm, setShowReopenConfirm] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [canScore, setCanScore] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [holding, setHolding] = useState<HoldingResult[] | null>(null);
  const [archiving, setArchiving] = useState(false);
  const { open: menuOpen, setOpen: setMenuOpen, menuKey, run: afterMenu } = useMenuThenShare();
  const [gameSettingsOpen, setGameSettingsOpen] = useState(false);
  const [editRoundOpen, setEditRoundOpen] = useState(false);
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Mount is covered by useFocusEffect below (it fires on focus, which includes the first mount): one load, not two.
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
      const [currentGame, gamePlayers] = await withTimeout(Promise.all([
        gamesService.getGame(id),
        gamesService.listGamePlayers(id),
      ]), REQUEST_TIMEOUT_MS, 'Couldn’t open this game.');
      const access = await gamesService.accessFor(id, userId, { game: currentGame, seats: gamePlayers });
      setUserId(userId);

      if (currentGame) {
        const seated = gamePlayers.filter((player) => player.seatRole !== 'spectator' && player.seated !== false);
        setGame(currentGame);
        setCanScore(access.canScore);
        setCanManage(access.isCreator || access.seatRole === 'game_admin');
        setLoadError(null);
        setPlayers(seated.filter((player) => player.id !== 'EX'));
        setMembers(gamePlayers);
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
    return Object.entries(game.scores).reduce((sum, [playerId, playerScores]) => {
      if (playerId === 'EX') return sum;
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

  const confirmReopen = async () => {
    if (!game) return;
    setReopening(true);
    try {
      const nextGame = await gamesService.reopenGame(game.id);
      if (nextGame) setGame(nextGame);
      setShowReopenConfirm(false);
    } catch (error) {
      setShowReopenConfirm(false);
      setActionError(formatSupabaseError(error));
    } finally {
      setReopening(false);
    }
  };

  const playingSeats = () => players;

  const openComplete = () => {
    if (!game) return;
    router.push({ pathname: '/(screens)/games/complete', params: { id: game.id } });
  };

  const shareLive = () => afterMenu(async () => {
    if (!game) return;
    setLinkNote(null);
    try {
      const token = game.viewToken ?? await gamesService.ensureViewToken(game.id);
      const url = scorecardUrl(token, game.gameNumber);
      const result = await shareLiveScorecard(url);
      if (result === 'copied') setLinkNote('Link copied.');
    } catch (error) {
      setActionError(formatSupabaseError(error));
    }
  });

  const shareFinalScores = () => {
    if (!game) return;
    setMenuOpen(false);
    router.push({ pathname: '/(screens)/games/final-scores', params: { id: game.id } });
  };

  const openPlayers = () => {
    if (!game) return;
    setMenuOpen(false);
    router.push({ pathname: '/(screens)/games/players', params: { id: game.id } });
  };

  const hideGame = async () => {
    if (!game) return;
    setMenuOpen(false);
    try {
      await archiveService.hideGame(game.id, userId);
      setLinkNote(HIDE_GAME_NOTE);
      setTimeout(() => router.back(), 900);
    } catch (error) {
      setActionError(formatSupabaseError(error));
    }
  };

  // The warning names every saved result the game sits in; the list loads while the dialog opens.
  const openDelete = async () => {
    if (!game) return;
    setMenuOpen(false);
    setHolding(null);
    setDeleteOpen(true);
    try {
      setHolding(await archiveService.resultsHoldingGame(game.id));
    } catch {
      setHolding([]);
    }
  };

  const confirmDelete = async () => {
    if (!game) return;
    setArchiving(true);
    try {
      await archiveService.deleteGame(game.id, userId);
      setDeleteOpen(false);
      router.back();
    } catch (error) {
      setDeleteOpen(false);
      setActionError(formatSupabaseError(error));
    } finally {
      setArchiving(false);
    }
  };

  const restoreGame = async () => {
    if (!game) return;
    setArchiving(true);
    try {
      const { removedFromResults } = await archiveService.restoreGame(game.id, userId);
      setLinkNote(restoreGameNote(removedFromResults.length));
      setLoading(true);
      await loadGameData();
    } catch (error) {
      setActionError(formatSupabaseError(error));
    } finally {
      setArchiving(false);
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

  if (game?.deletedAt) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: true, title: gameTitle(game, 'Scorecard') }} />
        <EmptyState
          icon="delete-outline"
          title={GAME_DELETED_TITLE}
          message={deletedBody('game', Boolean(game.canRestore))}
          actionLabel={game.canRestore ? 'Restore' : undefined}
          onAction={game.canRestore ? restoreGame : undefined}
        />
        <Portal>
          <Dialog visible={!!actionError} onDismiss={() => setActionError(null)} style={[styles.dialog, { backgroundColor: colors.surface }]}>
            <Dialog.Title style={styles.dialogTitle}>Something went wrong</Dialog.Title>
            <Dialog.Content><Text variant="bodyMedium" style={styles.dialogBody}>{actionError}</Text></Dialog.Content>
            <Dialog.Actions style={styles.dialogActions}><Button mode="contained" onPress={() => setActionError(null)}>Got it</Button></Dialog.Actions>
          </Dialog>
          <Snackbar visible={Boolean(linkNote)} onDismiss={() => setLinkNote(null)} duration={4000}>{linkNote ?? ''}</Snackbar>
        </Portal>
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

  // Stored seat labels (022) first; a seat without one gets a letter form nobody else in this game has.
  const labelById = seatLabels(players);
  const initialsFor = (playerId: string) => labelById.get(playerId) ?? '?';

  const seats = players;
  const dealerIdForRound = (roundIndex: number) =>
    seats.length ? seats[roundIndex % seats.length]?.id : undefined;
  const nextDealerId = game.isComplete ? undefined : dealerIdForRound(maxRounds);

  const colorFor = (playerId: string) => seatColor(seats.findIndex((seat) => seat.id === playerId));

  const standings = [...players]
    .map((player) => ({ player, total: getPlayerTotal(player.id) }))
    .sort((a, b) => b.total - a.total);

  const bestTotal = standings[0]?.total;
  const hasLeader = maxRounds > 0 && standings.length > 0;
  const leaderIds = hasLeader ? standings.filter((entry) => entry.total === bestTotal).map((entry) => entry.player.id) : [];

  const columns: ScoreColumn[] = players.map((player) => ({
    id: player.id,
    label: initialsFor(player.id),
    color: colorFor(player.id),
  }));

  const totals = Object.fromEntries(players.map((player) => [player.id, getPlayerTotal(player.id)]));
  const roundTotals = Array.from({ length: maxRounds }, (_, roundIndex) => getRoundTotal(roundIndex));
  const grandTotal = players.reduce((sum, player) => sum + getPlayerTotal(player.id), 0);

  const typeTag = <Tag label={gameTypeLabel(game.gameType)} tone={game.gameType} icon={game.gameType === 'pool' ? 'trophy-outline' : settleEnabled ? 'cash-multiple' : 'numeric'} />;
  const statusTag = game.isComplete ? (
    <Tag label="Completed" icon="flag-checkered" />
  ) : (
    // Who deals is shown once, as the DEALS badge on that player's column header.
    <Tag label={`Round ${maxRounds + 1}`} tone="primary" icon="cards-outline" />
  );

  const idFooter = <GameIdFooter game={game} members={members} />;

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
      fullCount={game.settings?.maxCount}
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

  // Same stacked icon-over-label shape for all three. Add round is the everyday tap, so it is the widest;
  // Complete is the only filled (dark green) one because it ends the game.
  const completeButton = (
    <StackedAction
      icon="flag-checkered"
      label="Complete"
      onPress={openComplete}
      height={isShort ? 44 : 56}
      filled
      style={styles.completeAction}
      accessibilityLabel="Complete game"
    />
  );

  const addRoundButton = (
    <StackedAction
      icon="plus"
      label="Add round"
      onPress={openScoreEntry}
      height={isShort ? 44 : 56}
      tonal
      emphasis
      style={styles.addRound}
      accessibilityLabel="Add round"
    />
  );

  const openEditRound = (roundNumber: number) => {
    setEditRoundOpen(false);
    router.push({ pathname: '/(screens)/score-entry', params: { gameId: game.id, round: String(roundNumber) } });
  };

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
                key={menuKey}
                visible={menuOpen}
                onDismiss={() => setMenuOpen(false)}
                anchor={<Button compact icon="dots-vertical" onPress={() => setMenuOpen(true)} accessibilityLabel="Scorecard menu"> </Button>}
              >
                <Menu.Item leadingIcon="cog-outline" onPress={() => { setMenuOpen(false); setGameSettingsOpen(true); }} title="Game settings" />
                <Menu.Item leadingIcon="account-group-outline" onPress={openPlayers} title={PLAYERS_ADMINS_TITLE} />
                {canScore && !game.isComplete ? (
                  <Menu.Item leadingIcon="pencil-outline" title="Edit round" disabled={maxRounds === 0} onPress={() => { setMenuOpen(false); setEditRoundOpen(true); }} />
                ) : null}
                {canScore && canReopenGame(game) ? (
                  <Menu.Item leadingIcon="lock-open-variant-outline" title="Reopen game" onPress={() => { setMenuOpen(false); setShowReopenConfirm(true); }} />
                ) : null}
                <Menu.Item leadingIcon="share-variant" onPress={shareLive} title="Share live scorecard" />
                {canShareResults(game.isComplete) ? (
                  <Menu.Item leadingIcon="image" onPress={shareFinalScores} title="Share final scores" />
                ) : null}
                <Menu.Item leadingIcon="eye-off-outline" onPress={hideGame} title="Hide game" />
                {canManage ? (
                  <Menu.Item leadingIcon="delete-outline" onPress={openDelete} title="Delete game" titleStyle={{ color: colors.error }} />
                ) : null}
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
        </View>
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
          <View style={styles.flex}>{table}{idFooter}</View>
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
          {idFooter}
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
        <Dialog visible={editRoundOpen} onDismiss={() => setEditRoundOpen(false)} style={styles.dialog}>
          <Dialog.Title>Edit which round?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
              The round opens in Add round with its scores filled in. Save changes to replace it.
            </Text>
            <View style={styles.roundPicker}>
              {editableRounds(game.scores).map((n) => (
                <Button
                  key={n}
                  mode={n === maxRounds ? 'contained-tonal' : 'outlined'}
                  compact
                  onPress={() => openEditRound(n)}
                  style={styles.roundChip}
                  accessibilityLabel={`Edit round ${n}`}
                >
                  {`Round ${n}`}
                </Button>
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditRoundOpen(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
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
          visible={deleteOpen}
          onDismiss={() => archiving || setDeleteOpen(false)}
          style={[styles.dialog, { backgroundColor: colors.surface }]}
        >
          <Dialog.Title>{DELETE_GAME_TITLE}</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>{DELETE_GAME_BODY}</Text>
            {holding === null ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : deleteGameWarning(holding) ? (
              <View style={[styles.warning, { backgroundColor: colors.errorContainer }]}>
                <Text variant="bodyMedium" style={{ color: colors.onErrorContainer, fontWeight: '700' }}>{deleteGameWarning(holding)}</Text>
              </View>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteOpen(false)} disabled={archiving}>Cancel</Button>
            <Button mode="contained" buttonColor={colors.error} textColor={colors.onError} onPress={confirmDelete} loading={archiving} disabled={archiving || holding === null}>Delete</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog
          visible={showReopenConfirm}
          onDismiss={() => reopening || setShowReopenConfirm(false)}
          style={[styles.dialog, { backgroundColor: colors.surface }]}
        >
          <Dialog.Title>Reopen this game?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
              It goes back to Active so rounds can be added or edited. Scores stay as they are. Use this when Complete game was pressed too early.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowReopenConfirm(false)} disabled={reopening}>Cancel</Button>
            <Button mode="contained" onPress={confirmReopen} loading={reopening} disabled={reopening}>Reopen</Button>
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

        <Snackbar visible={Boolean(linkNote)} onDismiss={() => setLinkNote(null)} duration={2500}>{linkNote ?? ''}</Snackbar>
      </Portal>
      <GameSettingsDialog
        visible={gameSettingsOpen}
        rules={rulesFromGame(game.settings)}
        readOnly={!canScore}
        onDismiss={() => setGameSettingsOpen(false)}
        onSave={async (rules) => {
          const updated = await gamesService.updateGameRules(game.id, rules);
          if (updated) setGame(updated);
        }}
      />
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
  completeAction: {
    flex: 1.1,
  },
  addRound: {
    flex: 1.7,
  },
  roundPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  warning: { padding: spacing.md, borderRadius: radius.md },
  roundChip: { minWidth: 96 },
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
  prizeInput: {
    width: 96,
    backgroundColor: 'transparent',
  },
});

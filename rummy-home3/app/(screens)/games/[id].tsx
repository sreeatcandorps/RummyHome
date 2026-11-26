import { gameLabelOf, screenTitle } from '@/utils/gameLabel';
import { dealerForRound, nextDealer, opensFor, rotationStarts } from '@/utils/dealerRotation';
import { DEALER_MENU_ITEM } from '@/utils/dealerSheet';
import React from 'react';
import { AppState, View, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Text, Dialog, IconButton, Menu, Portal } from 'react-native-paper';
import { ShareSheet } from '@/components/share/ShareSheet';
import { Toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/AppButton';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { gamesService } from '@/services/games';
import { archiveService, HoldingResult } from '@/services/archive';
import { authService } from '@/services/auth';
import { DELETE_GAME_BODY, DELETE_GAME_TITLE, deleteGameWarning, deletedBody, GAME_DELETED_TITLE, HIDE_GAME_NOTE, restoreGameNote } from '@/utils/archive';
import { ASKED_TOAST } from '@/utils/deletedGames';
import { DeletedGameBanner } from '@/components/game/DeletedGameBanner';
import { isSupabaseConfigured } from '@/services/supabase';
import { LIVE_POLL_MS, realtimeService } from '@/services/realtime';
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
import { HelpButton } from '@/components/ui/HelpButton';
import { LANDSCAPE_EDITING, useLayout } from '@/hooks/useLayout';
import { useColumnChoice } from '@/hooks/useColumnChoice';
import { SegmentedChoice } from '@/components/ui/SegmentedChoice';
import { useMenuThenShare } from '@/hooks/useMenuThenShare';
import { ScoreColumn, ScoreTable } from '@/components/game/ScoreTable';
import { BottomBar } from '@/components/ui/BottomBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { StackedAction } from '@/components/ui/StackedAction';
import { editableRounds } from '@/utils/editRound';
import { Tag } from '@/components/ui/Tag';
import { GameSettingsDialog } from '@/components/game/GameSettingsDialog';
import { SeatingSheet } from '@/components/game/SeatingSheet';
import { DealerSheet } from '@/components/game/DealerSheet';
import { canChangeSeating, SEATING_MENU_ITEM } from '@/utils/seating';
import { GameIdFooter } from '@/components/game/GameIdFooter';
import { COLUMN_CHOICE_LABEL, ColumnChoice, columnChoices, playersChipLabel, POOL_CARD_MAX_ROWS, readColumnChoice, scorecardChrome, shownChoice } from '@/utils/scorecardLayout';
import { gameSettingsMenuTitle, rulesFromGame } from '@/utils/gameSettings';
import { canReopenGame, reopenClearsAwards, reopenUncloses, REOPEN_CLEARS_AWARDS_NOTE } from '@/utils/gameStatus';
import { reopenClosedLines, type ResultForGame } from '@/utils/results';
import { resultsService } from '@/services/results';
import { formatWhen } from '@/utils/formatWhen';
import { PoolStandings, PoolStandingRow } from '@/components/game/PoolStandings';
import { PoolAwardsCard } from '@/components/game/PoolAwardsCard';
import { CompleteGameDialog } from '@/components/game/CompleteGameDialog';
import { afterCompleteRoute, AWARD_ROUTE } from '@/utils/endFlow';
import { MultiplierChip, ActualToggle, ExactPointsSheet } from '@/components/game/MultiplierStrip';
import { useActualToggle } from '@/hooks/useActualToggle';
import { actual, anyShortened, exactLines, pointsGameMultiplier } from '@/utils/multiplier';
import { newGameDraft } from '@/utils/newGameDraft';
import { PointsRules } from '@/utils/gameSettings';
import { isPoolGame, lastPlayerStanding, limitChangePreview, playersIn, poolLimitOf, poolStandings, poolStatusLabel, poolTotal, reentryBlock, REENTRY_BLOCK_TEXT, seatOf } from '@/utils/pool';

export default function GameScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const theme = useAppTheme();
  const { colors } = theme;
  const { width, isShort, isLandscape, insets, gutterLeft, gutterRight } = useLayout();
  // D47 B (Sree, Nov 18): "sideways" is wider than tall, on every device. A phone turned sideways is also
  // short (compact chrome); a tablet turned sideways is not, but it still gets the table alone.
  const sideways = isLandscape;
  // D89: sideways is the table and nothing else, until the parked tablet mode switches the chrome back on.
  const chrome = scorecardChrome(sideways, LANDSCAPE_EDITING);
  // D90: portrait 5 · 7 · Max, from the width the portrait table gets (the screen less its side padding).
  const [columnChoice, setColumnChoice] = useColumnChoice();
  const columnOptions = columnChoices(width - insets.left - insets.right - spacing.sm * 2, isShort);
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
  // D49: the result a Closed game sits in, named in the Reopen dialog. null = none known / still loading.
  const [closedResult, setClosedResult] = useState<ResultForGame | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [canScore, setCanScore] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [holding, setHolding] = useState<HoldingResult[] | null>(null);
  const [archiving, setArchiving] = useState(false);
  const { open: menuOpen, setOpen: setMenuOpen, menuKey, run: afterMenu } = useMenuThenShare();
  // A04: one share sheet from the header icon (live link · final scores); the ⋮ keeps the game actions.
  const [shareOpen, setShareOpen] = useState(false);
  const [gameSettingsOpen, setGameSettingsOpen] = useState(false);
  const [editRoundOpen, setEditRoundOpen] = useState(false);
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reentering, setReentering] = useState<string | null>(null);
  // PR 14: the multiplier view toggle (per phone) and the Exact points sheet.
  const [showActual, setShowActual] = useActualToggle();
  const [exactOpen, setExactOpen] = useState(false);
  // PR 21 / PR 24: the Order of players sheet, any time from the ⋮ menu. The once-per-game pop-up is gone —
  // a new game sets its order as a step before Start.
  const [seating, setSeating] = useState(false);
  const [dealerSheet, setDealerSheet] = useState(false);
  // Nov 18 end flow: Complete is a dialog here, not a page.
  const [completeOpen, setCompleteOpen] = useState(false);

  // Mount is covered by useFocusEffect below (it fires on focus, which includes the first mount): one load, not two.
  useEffect(() => {
    if (!isSupabaseConfigured || typeof id !== 'string') return;
    const channel = realtimeService.subscribeToGame(id, { onChange: loadGameData });
    return () => {
      realtimeService.unsubscribe(channel);
    };
  }, [id]);

  // Safety net under Realtime: the socket dies while the phone sleeps or the share sheet is up, and a
  // mobile network can drop it silently. Reload when the app comes back to the front, and while an
  // active game is on screen, poll every LIVE_POLL_MS so the other phone's round shows up either way.
  const live = Boolean(game) && !game?.completedAt && !game?.deletedAt;
  useEffect(() => {
    if (!isSupabaseConfigured || typeof id !== 'string') return;
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') loadGameData(); });
    return () => sub.remove();
  }, [id]);
  useFocusEffect(
    React.useCallback(() => {
      if (!isSupabaseConfigured || typeof id !== 'string' || !live) return;
      const timer = setInterval(() => { if (AppState.currentState === 'active') loadGameData(); }, LIVE_POLL_MS);
      return () => clearInterval(timer);
    }, [id, live]),
  );

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

  const pool = isPoolGame(game);

  const getPlayerTotal = (playerId: string): number => {
    if (!game?.scores) return 0;
    // Pool: a re-entered player's total starts again at their re-entry score (D4).
    if (pool) return poolTotal(game.scores[playerId], seatOf(game, playerId));
    return Object.values(game.scores[playerId] || []).reduce((sum, score) => sum + score, 0);
  };

  const reenter = async (playerId: string) => {
    if (!game) return;
    setReentering(playerId);
    try {
      const next = await gamesService.reenterPlayer(game.id, playerId);
      if (next) setGame(next);
    } catch (error) {
      setActionError(formatSupabaseError(error));
    } finally {
      setReentering(null);
    }
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

  const openReopen = () => {
    if (!game) return;
    setClosedResult(null);
    setShowReopenConfirm(true);
    if (reopenUncloses(game)) {
      resultsService.forGame(game.id).then((result) => setClosedResult(result)).catch(() => setClosedResult(null));
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
    setCompleteOpen(true);
  };

  // Points → the Final screen; Pool → Awards (then the Final screen). Pushed, so the header arrow on
  // those screens returns to this, now completed, scorecard; Done on the Final screen goes Home.
  const onCompleted = (updated: Game) => {
    setGame(updated);
    router.push(afterCompleteRoute(updated));
  };

  const openAwards = () => {
    if (!game) return;
    router.push({ pathname: AWARD_ROUTE, params: { id: game.id } });
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

  const openLog = () => {
    if (!game) return;
    setMenuOpen(false);
    router.push({ pathname: '/(screens)/games/log', params: { id: game.id } });
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

  // 045: a scored player asks the creator and the admins to bring the game back (one ask per person per game).
  const askRestore = async () => {
    if (!game) return;
    setArchiving(true);
    try {
      await archiveService.requestRestore(game.id);
      setLinkNote(ASKED_TOAST);
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

  // A deleted game from a database before 045 (or one this person may not read in full): the stamp only.
  // Since 045 the creator, admins and scored players get the whole scorecard read-only, drawn below.
  if (game?.deletedAt && !(game.deletion && players.length > 0)) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: true, title: screenTitle('Scorecard', game) }} />
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
            <Dialog.Actions style={styles.dialogActions}><Button mode="contained" onPress={() => setActionError(null)}>OK</Button></Dialog.Actions>
          </Dialog>
          <Toast message={linkNote} onDismiss={() => setLinkNote(null)} />
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
  // 045: a deleted game is read-only for everyone — the banner carries the one action (Ask / Restore game).
  const deleted = Boolean(game.deletedAt && game.deletion);
  const canScoreNow = canScore && !deleted;
  const canManageNow = canManage && !deleted;

  // Stored seat labels (022) first; a seat without one gets a letter form nobody else in this game has.
  const labelById = seatLabels(players);
  const initialsFor = (playerId: string) => labelById.get(playerId) ?? '?';

  const seats = players;
  // 031: the deal follows the actual rotation (stored per round); a player added mid-game lengthens the next rotation.
  // 052 (D58, D60): a pool seat that is out is skipped; the Dealer sheet's override names who really deals.
  const rotation = {
    players: seats.map((seat) => seat.id),
    dealerIds: game.dealerIds,
    outIds: pool ? new Set(seats.filter((seat) => seatOf(game, seat.id)?.outRound).map((seat) => seat.id)) : null,
    nextDealerOverride: game.nextDealerOverride,
  };
  const dealerIdForRound = (roundIndex: number) => dealerForRound(rotation, roundIndex);
  const nextDealerId = game.isComplete ? undefined : nextDealer(rotation, maxRounds);
  const opensId = game.isComplete ? undefined : opensFor(rotation, nextDealerId);
  const rotationStartRounds = rotationStarts(rotation, maxRounds);

  const colorFor = (playerId: string) => seatColor(seats.findIndex((seat) => seat.id === playerId));

  // Points: the highest total leads. Pool: the lowest total among players still in.
  const inIds = pool ? new Set(playersIn(game)) : null;
  const standings = [...players]
    .filter((player) => !inIds || inIds.has(player.id))
    .map((player) => ({ player, total: getPlayerTotal(player.id) }))
    .sort((a, b) => (pool ? a.total - b.total : b.total - a.total));

  const bestTotal = standings[0]?.total;
  const hasLeader = maxRounds > 0 && standings.length > 0;
  const leaderIds = hasLeader ? standings.filter((entry) => entry.total === bestTotal).map((entry) => entry.player.id) : [];

  const columns: ScoreColumn[] = players.map((player) => {
    const seat = pool ? seatOf(game, player.id) : null;
    return {
      id: player.id,
      label: initialsFor(player.id),
      color: colorFor(player.id),
      // Pool header: initials and score like Points (no player number, Sree Nov 18); OUT and re-entry marks.
      ...(seat ? { outRound: seat.outRound, reenteredRound: seat.reenteredRound, reentryScore: seat.reentryScore } : {}),
    };
  });

  const poolRows: PoolStandingRow[] = pool
    ? poolStandings(game).map((row) => {
        const player = players.find((p) => p.id === row.playerId);
        const block = reentryBlock(game, row.playerId);
        return {
          ...row,
          name: player?.name ?? '?',
          label: initialsFor(row.playerId),
          canReenter: block === null && canScoreNow,
          reentryHint: block && block !== 'in' ? REENTRY_BLOCK_TEXT[block] : null,
        };
      })
    : [];
  const poolOver = pool && maxRounds > 0 && !game.isComplete && lastPlayerStanding(game);

  const totals = Object.fromEntries(players.map((player) => [player.id, getPlayerTotal(player.id)]));
  const roundTotals = Array.from({ length: maxRounds }, (_, roundIndex) => getRoundTotal(roundIndex));
  const grandTotal = players.reduce((sum, player) => sum + getPlayerTotal(player.id), 0);
  // PR 14: one multiplier per Points game; the grid shows entered × multiplier while the toggle is on.
  const multiplier = pool ? 1 : pointsGameMultiplier(game);
  const exact = exactLines({ players: players.map((p) => ({ id: p.id, name: p.name, label: initialsFor(p.id) })), totals, multiplier });
  const exactShortened = anyShortened([...Object.values(totals), ...Object.values(game.scores).flat()].map((v) => actual(Number(v) || 0, multiplier)));
  /** "Start a new game instead" (M22): New game with these players and the new rules prefilled; this game is left as it is. */
  const startNewGameWith = (rules: PointsRules) => {
    newGameDraft.set(players.map((p) => ({ id: p.id, name: p.name, playerCode: p.playerCode })));
    newGameDraft.setRules(rules);
    router.push('/(screens)/games/new');
  };

  // The 028 label (S14 / P15), never the bare G-number (final batch item 2).
  const gameLabel = gameLabelOf(game);
  const numberBadge = gameLabel ? (
    <View style={[styles.numberBadge, { backgroundColor: theme.gameTypes[game.gameType === 'pool' ? 'pool' : 'stake'].container }]} accessibilityLabel={`Game ${gameLabel}`}>
      <Text style={[styles.numberText, { color: theme.gameTypes[game.gameType === 'pool' ? 'pool' : 'stake'].on }]}>{gameLabel}</Text>
    </View>
  ) : null;
  const typeTag = <Tag label={gameTypeLabel(game.gameType)} tone={game.gameType} icon={game.gameType === 'pool' ? 'trophy-outline' : 'numeric'} />;
  const awardsLabel = poolStatusLabel(game);
  const statusTag = deleted ? (
    <Tag label="Deleted" tone="danger" icon="delete-outline" testID="status-tag" />
  ) : game.isComplete ? (
    <Tag label={awardsLabel ?? 'Completed'} tone="info" icon={awardsLabel === 'Awarded' ? 'trophy-outline' : 'flag-checkered'} testID="status-tag" />
  ) : (
    // Who deals is shown once, as the DEALS badge on that player's column header.
    <Tag label={`Round ${maxRounds + 1}`} tone="primary" icon="cards-outline" />
  );

  // PR 24: inside the table card, right under the last round row: creator, admins, unique game id (PR 4).
  const idFooter = <GameIdFooter game={game} members={members} compact={isShort} />;
  const playersTag = <Tag label={playersChipLabel(players.length)} icon="account-group-outline" />;

  // Pool (D5): Standings under the grid; on a completed pool the awards block (P19/P30) too.
  // Nov 18 (Sree): upright only. The card hugs its rounds (five at most) and the standings sit right
  // under it; sideways is the full-width table alone, like Points — turn the device for the standings.
  const poolBelow = pool ? (
    <>
      {game.isComplete ? (
        <PoolAwardsCard
          game={game}
          names={Object.fromEntries(players.map((p) => [p.id, p.name]))}
          labels={Object.fromEntries(players.map((p) => [p.id, initialsFor(p.id)]))}
          canManage={canManageNow}
          compact={isShort}
          onGiveAwards={openAwards}
        />
      ) : null}
      <PoolStandings
        rows={poolRows}
        limit={poolLimitOf(game.settings)}
        compact={isShort}
        onReenter={game.isComplete || deleted ? undefined : reenter}
        busyId={reentering}
        scroll={false}
      />
    </>
  ) : null;

  const openEditRound = (roundNumber: number) => {
    setEditRoundOpen(false);
    router.push({ pathname: '/(screens)/score-entry', params: { gameId: game.id, round: String(roundNumber) } });
  };

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
      opensId={opensId}
      onDealerPress={chrome.taps && canChangeSeating(game, canScoreNow) ? () => setDealerSheet(true) : undefined}
      rotationStarts={rotationStartRounds}
      leaderIds={leaderIds}
      compact={isShort}
      fullCount={game.settings?.maxCount}
      pool={pool}
      multiplier={multiplier}
      showActual={showActual}
      onTotalPress={pool || !chrome.taps ? undefined : () => setExactOpen(true)}
      emptyMessage={game.isComplete ? 'This game was closed with no rounds.' : chrome.bottomBar ? 'No rounds yet. Tap Add round to score the first hand.' : 'No rounds yet.'}
      footer={chrome.footer ? idFooter : undefined}
      // PR 24: a tap on a round number edits that round (the re-entry round too); the menu's Edit round stays.
      onRoundPress={chrome.taps && canScoreNow && !game.isComplete && !deleted ? openEditRound : undefined}
      // Pool upright (Nov 18): Sree's 5-line rule — see ScoreTable.hugRows.
      hugRows={pool && !sideways ? POOL_CARD_MAX_ROWS : undefined}
      columnChoice={sideways ? undefined : columnChoice}
      onColumnChoiceChange={sideways ? undefined : setColumnChoice}
    />
  );

  const openScoreEntry = () =>
    router.push({
      pathname: '/(screens)/score-entry',
      params: { gameId: game.id },
    });

  const barHeight = isShort ? 44 : 52;

  // Undo and Complete are outlined; Add round is the everyday tap, so it is the one filled green
  // button in the bar and the widest. Complete keeps its flag so it still reads as "end the game".
  const undoButton = (
    <StackedAction
      icon="undo-variant"
      label="Undo"
      onPress={handleUndoLastRound}
      disabled={maxRounds === 0}
      height={barHeight}
      accessibilityLabel="Undo round"
    />
  );

  const completeButton = (
    <StackedAction
      icon="flag-checkered"
      label="Complete"
      onPress={openComplete}
      height={barHeight}
      style={styles.completeAction}
      filled={poolOver}
      emphasis={poolOver}
      accessibilityLabel="Complete game"
    />
  );

  const addRoundButton = (
    <StackedAction
      icon="plus"
      label="Add round"
      onPress={openScoreEntry}
      height={barHeight}
      filled
      emphasis
      style={styles.addRound}
      accessibilityLabel="Add round"
    />
  );


  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: chrome.header,
          title: screenTitle('Scorecard', game),
          headerStyle: { backgroundColor: colors.background },
          headerRight: () => (
            <View style={styles.headerActions}>
              {deleted ? null : <IconButton icon="share-variant" size={22} onPress={() => setShareOpen(true)} accessibilityLabel="Share" testID="scorecard-share-icon" />}
              <HelpButton topic="scorecard" />
              <Menu
                key={menuKey}
                visible={menuOpen}
                onDismiss={() => setMenuOpen(false)}
                anchor={<Button compact icon="dots-vertical" onPress={() => setMenuOpen(true)} accessibilityLabel="Scorecard menu"> </Button>}
              >
                <Menu.Item leadingIcon="cog-outline" onPress={() => { setMenuOpen(false); setGameSettingsOpen(true); }} title={gameSettingsMenuTitle(pool, maxRounds)} testID="game-menu-settings" />
                {deleted ? null : <Menu.Item leadingIcon="account-group-outline" onPress={openPlayers} title={PLAYERS_ADMINS_TITLE} />}
                {canChangeSeating(game, canScoreNow) ? (
                  <Menu.Item leadingIcon="seat-outline" title={SEATING_MENU_ITEM} onPress={() => { setMenuOpen(false); setSeating(true); }} testID="game-menu-seating" />
                ) : null}
                {canChangeSeating(game, canScoreNow) ? (
                  <Menu.Item leadingIcon="cards-playing-outline" title={DEALER_MENU_ITEM} onPress={() => { setMenuOpen(false); setDealerSheet(true); }} testID="game-menu-dealer" />
                ) : null}
                {canScoreNow && !game.isComplete ? (
                  <Menu.Item leadingIcon="pencil-outline" title="Edit round" disabled={maxRounds === 0} onPress={() => { setMenuOpen(false); setEditRoundOpen(true); }} />
                ) : null}
                {canScoreNow && canReopenGame(game) ? (
                  <Menu.Item leadingIcon="lock-open-variant-outline" title="Reopen game" testID="game-menu-reopen" onPress={() => { setMenuOpen(false); openReopen(); }} />
                ) : null}
                <Menu.Item leadingIcon="history" onPress={openLog} title="Log" testID="game-menu-log" />
                {sideways ? null : (
                  <View style={styles.columnsRow} testID="game-menu-columns">
                    <Text variant="bodyLarge" style={{ color: colors.onSurface }}>Columns</Text>
                    <SegmentedChoice
                      value={String(shownChoice(columnChoice, columnOptions)) as `${ColumnChoice}`}
                      onChange={(value) => { setColumnChoice(readColumnChoice(value)); setMenuOpen(false); }}
                      options={columnOptions.map((choice) => ({ value: String(choice) as `${ColumnChoice}`, label: COLUMN_CHOICE_LABEL[choice], testID: `columns-choice-${choice}` }))}
                      accessibilityLabel="Columns"
                      style={styles.columnsChoice}
                    />
                  </View>
                )}
                {deleted ? null : <Menu.Item leadingIcon="eye-off-outline" onPress={hideGame} title="Hide game" />}
                {canManageNow ? (
                  <Menu.Item leadingIcon="delete-outline" onPress={openDelete} title="Delete game" titleStyle={{ color: colors.error }} />
                ) : null}
              </Menu>
            </View>
          ),
        }}
      />

      {chrome.strip ? (
        <View style={[styles.infoStrip, { paddingLeft: gutterLeft, paddingRight: gutterRight }]}>
          {deleted && game.deletion ? (
            <DeletedGameBanner deletion={game.deletion} viewerId={userId} busy={archiving} onAsk={askRestore} onRestore={restoreGame} />
          ) : null}
          <View style={styles.metaRow}>
            {numberBadge}
            {typeTag}
            {playersTag}
            {statusTag}
            <MultiplierChip multiplier={multiplier} onPress={() => setExactOpen(true)} testID="multiplier-chip" />
            {!canScoreNow && !game.isComplete && !deleted ? <Tag label="View only" icon="eye-outline" /> : null}
          </View>
          <ActualToggle multiplier={multiplier} on={showActual} onChange={setShowActual} />
          {game.isComplete && !deleted ? (
            <View style={styles.completedRow}>
              <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }} testID="completed-line">
                {pool && game.awardedAt ? 'Completed and awarded.' : 'Completed.'}
              </Text>
              {/* A sideways pool has no awards card (no standings pane), so the admin's way to the awards sits in the strip. */}
              {pool && sideways && canManageNow && !game.closedAt ? (
                <Button compact mode="text" icon="trophy-outline" onPress={openAwards} testID="strip-give-awards">
                  {game.awardedAt ? 'Change awards' : 'Give awards'}
                </Button>
              ) : null}
            </View>
          ) : poolOver ? (
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }} testID="pool-over-hint">
              One player is left in. Complete the pool, or re-enter someone below.
            </Text>
          ) : null}
        </View>
      ) : null}

      {sideways ? (
        <View
          style={[
            styles.landscapeBody,
            { paddingLeft: gutterLeft, paddingRight: gutterRight },
            // No header above and no bar below: the table clears the status bar and the gesture bar itself.
            !chrome.header && { paddingTop: insets.top + spacing.xs },
            !chrome.bottomBar && { paddingBottom: insets.bottom + spacing.xs },
          ]}
          testID="landscape-table-only"
        >
          {table}
        </View>
      ) : (
        <View
          style={[
            styles.portraitTable,
            { paddingLeft: insets.left + spacing.sm, paddingRight: insets.right + spacing.sm },
            (game.isComplete || !canScoreNow) && { paddingBottom: insets.bottom + spacing.md },
          ]}
        >
          {/* Pool upright (Nov 18): the card hugs its rounds (five at most, see ScoreTable.hugRows); the standings follow right under it. */}
          <View style={styles.flex}>
            {pool ? <View style={styles.poolTablePane} testID="pool-table-pane">{table}</View> : table}
            {pool ? (
              <ScrollView style={styles.flex} contentContainerStyle={styles.portraitStandingsContent} showsVerticalScrollIndicator testID="pool-standings-pane">
                {poolBelow}
              </ScrollView>
            ) : null}
          </View>
        </View>
      )}
      {chrome.bottomBar && !game.isComplete && canScoreNow ? (
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
                  mode={n === maxRounds ? 'contained' : 'outlined'}
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
          <Dialog.Title>{reopenUncloses(game) ? 'Reopen this Closed game?' : 'Reopen this game?'}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
              It goes back to Active so rounds can be added or edited. Scores stay as they are. Use this when Complete game was pressed too early.
            </Text>
            {reopenUncloses(game) ? (
              <>
                <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant, marginTop: spacing.sm }} testID="reopen-closed-note">
                  {reopenClosedLines(closedResult, formatWhen).body}
                </Text>
                {reopenClosedLines(closedResult, formatWhen).others ? (
                  <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant, marginTop: spacing.sm }} testID="reopen-closed-others">
                    {reopenClosedLines(closedResult, formatWhen).others}
                  </Text>
                ) : null}
              </>
            ) : null}
            {reopenClearsAwards(game) ? (
              <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant, marginTop: spacing.sm }} testID="reopen-clears-awards">
                {REOPEN_CLEARS_AWARDS_NOTE}
              </Text>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions style={reopenUncloses(game) ? styles.reopenActions : undefined}>
            <Button onPress={() => setShowReopenConfirm(false)} disabled={reopening}>Cancel</Button>
            {reopenUncloses(game) && closedResult ? (
              <Button
                onPress={() => { setShowReopenConfirm(false); router.push(`/(screens)/results/${closedResult.id}`); }}
                disabled={reopening}
                testID="reopen-open-result"
              >
                Open the result
              </Button>
            ) : null}
            <Button mode="contained" onPress={confirmReopen} loading={reopening} disabled={reopening} testID="reopen-confirm">
              {reopenUncloses(game) ? 'Reopen anyway' : 'Reopen'}
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
              OK
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Toast message={linkNote} onDismiss={() => setLinkNote(null)} aboveBar />
        <ShareSheet
          visible={shareOpen}
          onDismiss={() => setShareOpen(false)}
          options={[
            { key: 'live', icon: 'link-variant', label: 'Live scorecard link', detail: 'Anyone with the link watches the scores update.', onPress: shareLive, testID: 'share-live-link' },
            ...(canShareResults(game.isComplete)
              ? [{ key: 'final', icon: 'image', label: 'Share final scores', detail: 'The standings picture, or the full details as a PDF.', onPress: shareFinalScores, testID: 'share-final-scores-option' }]
              : []),
          ]}
        />
      </Portal>
      {canScoreNow && !game.isComplete ? (
        <CompleteGameDialog
          visible={completeOpen}
          game={game}
          players={players}
          onDismiss={() => setCompleteOpen(false)}
          onEditRound={openEditRound}
          onCompleted={onCompleted}
        />
      ) : null}
      <ExactPointsSheet
        visible={exactOpen}
        multiplier={multiplier}
        lines={exact}
        sum={actual(grandTotal, multiplier)}
        shortened={exactShortened}
        onDismiss={() => setExactOpen(false)}
        onSharePdf={() => { setExactOpen(false); shareFinalScores(); }}
      />
      <DealerSheet
        visible={dealerSheet}
        players={seats.map((seat) => ({ id: seat.id, name: seat.name, label: initialsFor(seat.id), outRound: pool ? seatOf(game, seat.id)?.outRound ?? null : null }))}
        dealerIds={game.dealerIds}
        nextDealerOverride={game.nextDealerOverride}
        roundCount={maxRounds}
        onDismiss={() => setDealerSheet(false)}
        onSave={async (change) => {
          const updated = await gamesService.setRoundDealer(game.id, change);
          if (updated) setGame(updated);
          await loadGameData();
        }}
      />
      <SeatingSheet
        visible={seating}
        players={seats.map((seat) => ({ id: seat.id, name: seat.name, label: initialsFor(seat.id), playerCode: seat.playerCode, out: pool && Boolean(seatOf(game, seat.id)?.outRound), reentered: pool && Boolean(seatOf(game, seat.id)?.reenteredRound) }))}
        pool={pool}
        dealerIds={game.dealerIds}
        roundCount={maxRounds}
        onDismiss={() => setSeating(false)}
        onSave={async (order) => {
          const updated = await gamesService.setSeatingOrder(game.id, order);
          if (updated) setGame(updated);
          await loadGameData();
        }}
      />
      <GameSettingsDialog
        visible={gameSettingsOpen}
        rules={rulesFromGame(game.settings, game.gameType)}
        readOnly={!canScoreNow}
        roundCount={maxRounds}
        poolLimitPreview={pool ? (limit) => limitChangePreview(game, limit, (id) => players.find((p) => p.id === id)?.name ?? '?') : undefined}
        onStartNewGame={canScoreNow && !pool ? startNewGameWith : undefined}
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
    // Four tags (P15 · Pool · Round 17 · View only) wrap on a narrow phone instead of being cut to "Po…".
    flexWrap: 'wrap',
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
  // The hugging card: never grows past its rows, shrinks before the standings do not.
  poolTablePane: {
    flexGrow: 0,
    flexShrink: 1,
  },
  portraitStandingsContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  landscapeBody: {
    flex: 1,
  },
  columnsRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    minWidth: 200,
  },
  columnsChoice: {
    alignSelf: 'stretch',
  },
  completeAction: {
    flex: 1.25,
  },
  addRound: {
    flex: 1.45,
  },
  numberBadge: {
    minWidth: 48,
    height: 32,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  roundPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  warning: { padding: spacing.md, borderRadius: radius.md },
  roundChip: { minWidth: 96 },
  reopenActions: {
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
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
  prizeInput: {
    width: 96,
    backgroundColor: 'transparent',
  },
});

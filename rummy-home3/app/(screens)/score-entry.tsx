import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Dialog, Icon, IconButton, Menu, Portal, Text, TouchableRipple } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Game } from '../../types/game';
import { Player } from '../../types/player';
import { gamesService } from '../../services/games';
import { authService } from '../../services/auth';
import { isSupabaseConfigured } from '../../services/supabase';
import { storage } from '../../utils/storage';
import { gameCache } from '../../utils/gameCache';
import {
  actionFill,
  applyPreset,
  applyRummy,
  PRESET_FLASH_FILL,
  PRESET_FLASH_MS,
  balance as roundBalance,
  canSaveRound,
  cellView,
  gridColumns,
  hiddenCells,
  clearPlayer,
  commitPending,
  countWarning,
  countWarningText,
  draftValue,
  emptyDraft,
  exceedsMaxCount,
  hasPendingEntry,
  initialPoolEntryState,
  initialRoundEntryState,
  PresetKind,
  PresetValues,
  pressDigit,
  RoundEntryState,
  rummyShares,
  saveScore,
  setNegative,
  tapPlayer,
  toRoundScores,
} from '../../utils/roundEntry';
import { MAX_CONTENT_WIDTH, radius, spacing, tabularNums, useAppTheme } from '../../constants/theme';
import { useLayout } from '../../hooks/useLayout';
import { useMenuThenShare } from '../../hooks/useMenuThenShare';
import { openHelp } from '@/components/help/HelpPage';
import { WhyLink } from '@/components/help/WhyLink';
import { HELP_WHY } from '@/constants/helpTopics';
import { entryFromRound, nextRoundNumber } from '../../utils/editRound';
import { BottomBar } from '../../components/ui/BottomBar';
import { SeatAvatar } from '../../components/ui/SeatAvatar';
import { ScoreCell } from '../../components/game/ScoreCell';
import { pointsGameMultiplier } from '@/utils/multiplier';
import { ScoreKeypad } from '../../components/game/ScoreKeypad';
import { GameSettingsDialog } from '../../components/game/GameSettingsDialog';
import { rulesFromGame } from '../../utils/gameSettings';
import { formatGameDateTime, gameNumberLabel } from '../../utils/gameDisplay';
import { scorecardUrl } from '../../utils/shareLink';
import { shareLiveScorecard } from '../../utils/shareImage';
import { formatSupabaseError } from '../../utils/supabaseErrors';
import { isRoundConflict, roundConflictMessage } from '../../utils/roundConflict';
import { rummyShareNeedsConfirm } from '../../utils/rummyDistribution';
import { overMaxConfirm, poolOverFullConfirm, rummyShareConfirm } from '../../utils/roundConfirms';
import { afterRound, AfterRound, isPoolGame, limitChangePreview, overFullCount, playersIn, poolTotal, seatOf } from '../../utils/pool';
import { gameSettingsMenuTitle } from '@/utils/gameSettings';
import { CompleteGameDialog } from '../../components/game/CompleteGameDialog';
import { afterCompleteRoute } from '@/utils/endFlow';

type Participant = {
  id: string;
  name: string;
};

type Notice = { title: string; body: string; icon: string; onClose?: () => void; why?: keyof typeof HELP_WHY };

const signed = (value: number) => (value > 0 ? `+${value}` : `${value}`);

/** Long enough for the saved cell to flash before the round leaves the screen. */
const SAVE_FLASH_MS = 450;
const GRID_GAP = spacing.sm;
/** Height of the "N more" pill + fade (v12 point 9). */
export const MORE_PILL_CLEARANCE = 56;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const participantsFrom = (seats: Player[], game?: Game | null): Participant[] => {
  // Pool (D4): players who are out are not on the sheet.
  const inIds = game && isPoolGame(game) ? new Set(playersIn(game)) : null;
  return seats
    .filter((player) => player.seatRole !== 'spectator' && player.seated !== false)
    .filter((player) => !inIds || inIds.has(player.id))
    .map((player) => ({ id: player.id, name: player.name }));
};

const freshEntry = (game: Game | null | undefined) => (game && isPoolGame(game) ? initialPoolEntryState() : initialRoundEntryState());

export default function ScoreEntryScreen() {
  const { colors } = useAppTheme();
  const { isShort, isLandscape, insets, gutterLeft, gutterRight } = useLayout();
  const { gameId, round } = useLocalSearchParams<{ gameId?: string; round?: string }>();
  // Edit mode: `round=N` opens a finished round with its scores already in the cells.
  const editRound = round && /^\d+$/.test(String(round)) ? Number(round) : null;

  // Seed from the copy the scorecard just showed, so the grid draws at once while the fresh copy loads.
  const seededGame = useRef(gameCache.peekGame(gameId ? String(gameId) : null)).current;
  const seededSeats = useRef(gameCache.peekSeats(gameId ? String(gameId) : null)).current;
  const seeded = Boolean(seededGame && seededSeats);
  const [game, setGame] = useState<Game | null>(seeded ? seededGame : null);
  const [participants, setParticipants] = useState<Participant[]>(seeded ? participantsFrom(seededSeats ?? [], seededGame) : []);
  /** Every seated player, including those out of a pool, for names in the after-save sheet. */
  const [seatNames, setSeatNames] = useState<Record<string, string>>(() => Object.fromEntries((seededSeats ?? []).map((p) => [p.id, p.name])));
  const nameOf = (id: string) => seatNames[id] ?? participants.find((p) => p.id === id)?.name ?? 'a player';
  /** Pool: shown once after a save — who went out, who may re-enter (D4). */
  const [afterSave, setAfterSave] = useState<AfterRound | null>(null);
  // Nov 18 end flow: the after-save sheet's Complete opens the one Complete dialog here, then replaces this
  // screen with the Awards page (the scorecard stays under it).
  const [completeOpen, setCompleteOpen] = useState(false);
  const [reentering, setReentering] = useState<string | null>(null);
  const [scorerName, setScorerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(!seeded);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { open: menuOpen, setOpen: setMenuOpen, menuKey, run: afterMenu } = useMenuThenShare();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  // PR 3 confirms, each shown once: a number typed past the Full count (per cell) and a Rummy share at or below 0 (per round).
  const [overMax, setOverMax] = useState<{ value: number; ids: string[] } | null>(null);
  const warnedCells = useRef(new Set<string>());
  const [rummyConfirm, setRummyConfirm] = useState<string | null>(null);
  const rummyConfirmed = useRef(false);

  const [entry, setEntry] = useState<RoundEntryState>(seeded && seededGame && editRound ? entryFromRound(seededGame, editRound) : freshEntry(seededGame));
  // The fresh copy must not wipe cells the person has already filled from the seeded round.
  const entrySeeded = useRef(seeded && Boolean(editRound));
  const [flashKeys, setFlashKeys] = useState<Record<string, number>>({});
  const [gridWidth, setGridWidth] = useState(0);
  // The "N more ▾" cue (PR 10b, Sree: 12 of 14 visible with no hint): grid height, viewport and scroll offset.
  const [gridHeight, setGridHeight] = useState(0);
  const [gridViewport, setGridViewport] = useState(0);
  const [gridScrollY, setGridScrollY] = useState(0);
  const gridRef = useRef<ScrollView>(null);

  const balancePulse = useRef(new Animated.Value(1)).current;
  const presetFlash = useRef<Record<string, Animated.Value>>({}).current;
  const flashFor = (id: string) => (presetFlash[id] ??= new Animated.Value(0));

  useEffect(() => {
    loadGameData();
  }, [gameId]);

  const loadGameData = async () => {
    if (!gameId) {
      setNotice({ title: 'No game selected', body: 'Open a game first, then add a round.', icon: 'alert-circle-outline' });
      setLoading(false);
      return;
    }

    try {
      const userId = isSupabaseConfigured
        ? await authService.getCurrentUserId()
        : await storage.getCurrentPlayer();
      // One trip for the game and its seats; access is worked out from them (it used to refetch both).
      const [fetchedGame, gamePlayers, scorer] = await Promise.all([
        gamesService.getGame(String(gameId)),
        gamesService.listGamePlayers(String(gameId)),
        authService.getCurrentPlayer().catch(() => null),
      ]);
      const access = await gamesService.accessFor(String(gameId), userId, { game: fetchedGame, seats: gamePlayers });
      const currentGame = access.game;

      if (!currentGame) {
        setNotice({ title: 'Game not found', body: 'This game may have been removed.', icon: 'alert-circle-outline' });
        return;
      }

      if (!access.canScore) {
        setNotice({
          title: 'View only',
          body: 'Only a game admin can enter scores. You can still watch the scorecard.',
          icon: 'eye-outline',
        });
        return;
      }

      setGame(currentGame);
      if (editRound && !entrySeeded.current) setEntry(entryFromRound(currentGame, editRound));
      else if (!editRound && !seeded && isPoolGame(currentGame)) setEntry((current) => (current.pool ? current : initialPoolEntryState()));
      entrySeeded.current = false;

      setParticipants(participantsFrom(gamePlayers, currentGame));
      setSeatNames(Object.fromEntries(gamePlayers.map((p) => [p.id, p.name])));
      setScorerName(scorer?.name ?? null);
    } catch (error) {
      setNotice({ title: 'Could not load game', body: formatSupabaseError(error), icon: 'alert-circle-outline' });
    } finally {
      setLoading(false);
    }
  };

  const presets: PresetValues = useMemo(
    () => {
      const sign = game?.gameType === 'pool' ? 1 : -1;
      const abs = (v: number | undefined, fallback: number) => (typeof v === 'number' ? Math.abs(v) : fallback) * sign;
      return {
        drop: abs(game?.settings.dropAmount, game?.gameType === 'pool' ? 25 : 10),
        middle_drop: abs(game?.settings.mdAmount, game?.gameType === 'pool' ? 50 : 30),
        count: abs(game?.settings.maxCount, game?.gameType === 'pool' ? 130 : 80),
      };
    },
    [game?.gameType, game?.settings.dropAmount, game?.settings.mdAmount, game?.settings.maxCount],
  );

  // Every write lands in lastSavedIds; flash those cells once.
  useEffect(() => {
    if (entry.lastSavedIds.length === 0) return;
    setFlashKeys((prev) => {
      const next = { ...prev };
      entry.lastSavedIds.forEach((id) => {
        next[id] = (next[id] ?? 0) + 1;
      });
      return next;
    });
  }, [entry.lastSavedIds]);

  const pool = isPoolGame(game);
  const balance = roundBalance(commitPending(entry));
  const saveReady = canSaveRound(entry, pool ? participants.map((p) => p.id) : undefined);
  const hasSelection = entry.selectedIds.length > 0;
  const hasAnything = Object.keys(entry.entries).length > 0 || entry.rummyIds.length > 0 || hasSelection;

  useEffect(() => {
    if (!saveReady) return;
    balancePulse.setValue(0.92);
    Animated.spring(balancePulse, { toValue: 1, speed: 18, bounciness: 10, useNativeDriver: false }).start();
  }, [balancePulse, saveReady]);

  const update = useCallback((reduce: (state: RoundEntryState) => RoundEntryState) => {
    setEntry((prev) => reduce(prev));
  }, []);

  const fullCount = game?.settings.maxCount;
  // PR 14: entered points are typed and stored; the small line and the confirm say what they are worth.
  const multiplier = pool ? 1 : pointsGameMultiplier(game);

  // A digit that first takes the number past the Full count asks once for that cell (D3.1).
  // Pool (D6/D7): the same one confirm, "Are you sure?", and no other warnings.
  const typeDigit = (digit: string) => {
    const next = pressDigit(entry, digit);
    const value = draftValue(next.draft);
    const fresh = next.selectedIds.filter((id) => !warnedCells.current.has(id));
    const over = (v: number | undefined) => (pool ? overFullCount(v, fullCount) : exceedsMaxCount(v, fullCount));
    if (value !== undefined && over(value) && fresh.length > 0 && !over(draftValue(entry.draft))) {
      next.selectedIds.forEach((id) => warnedCells.current.add(id));
      setOverMax({ value, ids: next.selectedIds });
    }
    setEntry(next);
  };

  const changeOverMax = () => {
    setOverMax(null);
    // Back to an empty number for the same selection; the sign is kept.
    update((state) => ({ ...state, draft: { ...emptyDraft(!state.pool), negative: state.pool ? false : state.draft.negative } }));
  };

  const handleSaveRound = async () => {
    if (!game || !saveReady || isSubmitting) return;

    // Whatever is still being typed counts; show it landing before we leave.
    const finalState = commitPending(entry);

    // A Rummy share at or below 0 (the others added up to a plus) is confirmed once per round (D3.2). Not for a pool: the winner is 0.
    const shares = rummyShares(finalState);
    if (!pool && !rummyConfirmed.current && rummyShareNeedsConfirm(shares)) {
      setRummyConfirm(rummyShareConfirm(finalState, shares, participants));
      return;
    }
    if (finalState !== entry) {
      setEntry(finalState);
      await wait(SAVE_FLASH_MS);
    }

    setIsSubmitting(true);
    try {
      const createdBy = isSupabaseConfigured
        ? await authService.getCurrentUserId()
        : await storage.getCurrentPlayer();
      if (!createdBy) throw new Error('You must be signed in to save a round.');

      if (editRound) {
        await gamesService.replaceRound({ gameId: game.id, roundNumber: editRound, scores: toRoundScores(finalState), createdBy, pool });
      } else {
        const saved = await gamesService.addRound({
          gameId: game.id,
          roundNumber: nextRoundNumber(game),
          scores: toRoundScores(finalState),
          createdBy,
          pool,
        });
        // Pool (D4): after every round, who is out and who may re-enter, before going back.
        if (pool && saved) {
          const summary = afterRound(game, saved);
          if (summary.newlyOut.length || summary.eligible.length || summary.lastStanding) {
            setGame(saved);
            setAfterSave(summary);
            return;
          }
        }
      }
      router.back();
    } catch (error) {
      if (isRoundConflict(error)) {
        // Someone else saved this round (or changed the players) first. Show what the server
        // said and drop the typed scores so they cannot land on the next round by accident.
        // Add mode then returns to the scorecard (it reloads on focus) instead of staying here
        // numbered for the next round. Edit mode reloads the round as it is now.
        if (!editRound) setEntry(freshEntry(game));
        else await loadGameData();
        setNotice({
          title: 'Round already saved',
          body: roundConflictMessage(error),
          icon: 'refresh',
          why: 'scorecardChanged',
          onClose: editRound ? undefined : closeScreen,
        });
        return;
      }
      console.error('Score submission error:', error);
      setNotice({ title: 'Could not save round', body: formatSupabaseError(error), icon: 'alert-circle-outline' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const shareLive = () => afterMenu(async () => {
    if (!game) return;
    try {
      const token = game.viewToken ?? await gamesService.ensureViewToken(game.id);
      const result = await shareLiveScorecard(scorecardUrl(token, game.gameNumber));
      if (result === 'copied') setNotice({ title: 'Link copied', body: 'Paste it anywhere to share the live scorecard.', icon: 'link-variant' });
    } catch (error) {
      setNotice({ title: 'Could not share', body: formatSupabaseError(error), icon: 'alert-circle-outline' });
    }
  });

  const closeScreen = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  const dismissNotice = () => {
    const onClose = notice?.onClose;
    setNotice(null);
    onClose?.();
  };

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!game) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background, padding: 24, gap: 12 }]}>
        <Text variant="titleLarge">{notice?.title ?? 'Could not open scores'}</Text>
        <Text variant="bodyMedium">{notice?.body ?? 'Go back to the scorecard.'}</Text>
        <Button mode="contained" onPress={closeScreen}>
          Back to scorecard
        </Button>
      </View>
    );
  }

  const columns = gridColumns(participants.length, isLandscape);
  const cellWidth = gridWidth > 0 ? Math.floor((gridWidth - GRID_GAP * (columns - 1)) / columns) : 0;
  const gridRows = Math.ceil(participants.length / columns);
  const rowPitch = gridRows > 0 && gridHeight > 0 ? (gridHeight + GRID_GAP) / gridRows : 0;
  const belowFold = hiddenCells(participants.length, columns, rowPitch, gridScrollY, gridViewport, spacing.xs);
  const onGridScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => setGridScrollY(event.nativeEvent.contentOffset.y);

  const header = (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top + spacing.xs, paddingLeft: Math.max(insets.left, spacing.xs), paddingRight: Math.max(insets.right, spacing.xs) },
      ]}
    >
      {/* A05: the page returns through a header arrow, not a menu item. */}
      <IconButton icon="arrow-left" onPress={closeScreen} accessibilityLabel="Back to scorecard" style={styles.noMargin} testID="score-entry-back" />
      <View style={styles.headerText}>
        <View style={styles.titleRow}>
          {gameNumberLabel(game) ? (
            <View style={[styles.gameBadge, { backgroundColor: colors.secondaryContainer }]}>
              <Text variant="labelLarge" style={[styles.gameBadgeText, { color: colors.onSecondaryContainer }]}>
                {gameNumberLabel(game)}
              </Text>
            </View>
          ) : null}
          <Text variant="titleLarge" numberOfLines={1} style={[styles.title, { color: colors.onSurface }]}>
            {editRound ? `Edit round ${editRound}` : `Round ${nextRoundNumber(game)}`}
          </Text>
        </View>
        <Text variant="labelMedium" numberOfLines={1} style={{ color: colors.onSurfaceVariant }}>
          Started {formatGameDateTime(game.date)}
        </Text>
      </View>
      {scorerName ? (
        <View accessible accessibilityLabel={`Scored by ${scorerName}`}>
          <SeatAvatar name={scorerName} size={36} />
        </View>
      ) : null}
      <Menu
        key={menuKey}
        visible={menuOpen}
        onDismiss={() => setMenuOpen(false)}
        anchor={
          <IconButton
            icon="dots-vertical"
            onPress={() => setMenuOpen(true)}
            accessibilityLabel="Round menu"
            style={styles.noMargin}
          />
        }
      >
        <Menu.Item leadingIcon="cog-outline" title={gameSettingsMenuTitle(pool, nextRoundNumber(game) - 1)} onPress={() => { setMenuOpen(false); setSettingsOpen(true); }} />
        <Menu.Item leadingIcon="share-variant" title="Share live scorecard" onPress={shareLive} />
        <Menu.Item
          leadingIcon="eraser-variant"
          title={editRound ? 'Undo my changes' : 'Clear this round'}
          disabled={!hasAnything}
          onPress={() => { setMenuOpen(false); rummyConfirmed.current = false; warnedCells.current.clear(); setEntry(editRound && game ? entryFromRound(game, editRound) : freshEntry(game)); }}
        />
        <Menu.Item
          leadingIcon="help-circle-outline"
          title="Help"
          onPress={() => { setMenuOpen(false); openHelp('add-round', pool ? 'pool' : 'points'); }}
        />
      </Menu>
    </View>
  );

  // The number being typed, measured against the Full count: soft at half, strong at the count.
  const pendingValue = draftValue(entry.draft);
  // Pool: no half / full warnings (D7); the one confirm past the Full count is the dialog.
  const pendingWarning = !pool && entry.draft.edited && entry.selectedIds.length > 0 ? countWarning(pendingValue, fullCount) : 'none';
  const warningLine = pendingValue !== undefined && pendingWarning !== 'none' ? (
    <View
      style={[styles.warning, { backgroundColor: pendingWarning === 'full' ? colors.errorContainer : colors.secondaryContainer }]}
      accessibilityRole="alert"
      testID="count-warning"
    >
      <Icon source="alert-outline" size={18} color={pendingWarning === 'full' ? colors.onErrorContainer : colors.onSecondaryContainer} />
      <Text variant="bodySmall" style={{ color: pendingWarning === 'full' ? colors.onErrorContainer : colors.onSecondaryContainer, flex: 1 }}>
        {countWarningText(pendingValue, fullCount, pendingWarning)}
      </Text>
    </View>
  ) : null;

  const grid = (
    <View style={styles.flex}>
    <ScrollView
      ref={gridRef}
      style={styles.flex}
      contentContainerStyle={[styles.gridContent, isShort && styles.gridContentCompact]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator
      onLayout={(event) => setGridViewport(Math.round(event.nativeEvent.layout.height))}
      onScroll={onGridScroll}
      scrollEventThrottle={32}
    >
      <View
        style={styles.grid}
        onLayout={(event) => { setGridWidth(Math.round(event.nativeEvent.layout.width)); setGridHeight(Math.round(event.nativeEvent.layout.height)); }}
      >
        {cellWidth > 0
          ? participants.map((participant) => {
            const view = cellView(entry, participant.id);
            // Pool: the cell shows the total after this round and OUT when it puts the player out.
            const after = pool && game && view.value !== undefined && !editRound
              ? (() => {
                  const total = poolTotal(game.scores[participant.id], seatOf(game, participant.id)) + view.value;
                  return { total, out: total >= (game.settings.poolLimit ?? 101) };
                })()
              : null;
            return (
              <ScoreCell
                key={participant.id}
                name={participant.name}
                status={view.status}
                value={view.value}
                width={cellWidth}
                compact={isShort}
                pool={pool}
                after={after}
                fullCount={game?.settings.maxCount}
                multiplier={multiplier}
                flashKey={flashKeys[participant.id] ?? 0}
                onPress={() => update((state) => tapPlayer(state, participant.id))}
                onClear={() => update((state) => clearPlayer(state, participant.id))}
              />
            );
          })
          : null}
      </View>
      {warningLine}
    </ScrollView>
      {belowFold > 0 ? (
        <View pointerEvents="box-none" style={styles.moreWrap}>
          <View pointerEvents="none" style={[styles.fade, { backgroundColor: colors.background }]} />
          <Pressable
            onPress={() => gridRef.current?.scrollToEnd({ animated: true })}
            style={[styles.morePill, { backgroundColor: colors.inverseSurface }]}
            accessibilityRole="button"
            accessibilityLabel={`${belowFold} more ${belowFold === 1 ? 'player' : 'players'} below, scroll down`}
            testID="add-round-more"
          >
            <Text variant="labelLarge" style={{ color: colors.inverseOnSurface }}>{`${belowFold} more ▾`}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  type ActionKey = { id: 'plus' | 'minus' | 'rummy' | PresetKind; label: string; icon?: string };

  // Pool: no sign keys (plus points only); the presets read as plain numbers.
  const actionKeys: ActionKey[] = [
    ...(pool ? [] : [{ id: 'plus', label: 'Plus', icon: 'plus' } as ActionKey, { id: 'minus', label: 'Minus', icon: 'minus' } as ActionKey]),
    { id: 'drop', label: `${presets.drop}` },
    { id: 'middle_drop', label: `${presets.middle_drop}` },
    { id: 'count', label: `${presets.count}` },
    { id: 'rummy', label: 'Rummy' },
  ];

  // Each preset key gets a green flash when tapped so the hand knows it landed.
  const flashPreset = (id: string) => {
    const value = flashFor(id);
    value.setValue(1);
    Animated.timing(value, { toValue: 0, duration: PRESET_FLASH_MS, delay: 80, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  };

  const pressAction = (key: ActionKey) => {
    if (key.id === 'plus') return update((state) => setNegative(state, false));
    if (key.id === 'minus') return update((state) => setNegative(state, true));
    if (key.id === 'rummy') return update(applyRummy);
    const kind: PresetKind = key.id;
    flashPreset(key.id);
    return update((state) => applyPreset(state, kind, presets));
  };

  // One row: the sign toggle, the three point values from game settings, and Rummy.
  const actionRow = (
    <View style={styles.actions}>
      {actionKeys.map((key) => {
        const isSign = key.id === 'plus' || key.id === 'minus';
        const isRummy = key.id === 'rummy';
        const signOn = isSign && entry.draft.negative === (key.id === 'minus');
        const enabled = isSign || hasSelection;
        const restFill = colors[actionFill(isSign ? 'sign' : isRummy ? 'rummy' : 'preset', signOn)];
        const background = isSign || isRummy
          ? restFill
          : flashFor(key.id).interpolate({ inputRange: [0, 1], outputRange: [restFill, colors[PRESET_FLASH_FILL]] });
        const border = signOn ? colors.onSecondaryContainer : isRummy ? colors.tertiary : colors.outlineVariant;
        const foreground = signOn ? colors.onSecondaryContainer : isRummy ? colors.onTertiaryContainer : colors.onSurface;
        const accessibilityLabel = isSign
          ? key.label
          : isRummy
            ? 'Rummy'
            : `${key.id === 'drop' ? 'Drop' : key.id === 'middle_drop' ? 'Middle drop' : 'Full count'} ${key.label}`;
        return (
          <Animated.View
            key={key.id}
            style={[
              styles.action,
              isSign && styles.actionSign,
              isRummy && styles.actionRummy,
              { backgroundColor: background, borderColor: border, opacity: enabled ? 1 : 0.55 },
            ]}
          >
            <TouchableRipple
              onPress={() => pressAction(key)}
              disabled={!enabled}
              borderless
              style={styles.actionRipple}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}
              accessibilityState={isSign ? { selected: signOn } : { disabled: !enabled }}
            >
              <View style={styles.actionInner}>
                {key.icon ? (
                  <Icon source={key.icon} size={34} color={foreground} />
                ) : (
                  <Text
                    numberOfLines={1}
                    style={[styles.actionLabel, isRummy && styles.actionLabelRummy, tabularNums, { color: foreground }]}
                  >
                    {key.label}
                  </Text>
                )}
              </View>
            </TouchableRipple>
          </Animated.View>
        );
      })}
    </View>
  );

  const keypad = (
    <ScoreKeypad
      enabled={hasSelection}
      canSave={hasPendingEntry(entry)}
      compact={isShort}
      onDigit={typeDigit}
      onSave={() => update(saveScore)}
    />
  );

  // Pool: the pill counts scored players instead of a balance ("5 of 6 scored", green when complete).
  const scoredCount = participants.filter((p) => cellView(commitPending(entry), p.id).value !== undefined).length;
  const balanced = pool ? saveReady : balance === 0;
  const balanceBackground = balanced ? colors.positiveContainer : colors.errorContainer;
  const balanceForeground = balanced ? colors.onPositiveContainer : colors.onErrorContainer;

  const balancePill = (
    <Animated.View
      style={[styles.balance, { backgroundColor: balanceBackground, transform: [{ scale: balancePulse }] }]}
      accessible
      accessibilityLabel={pool ? `${scoredCount} of ${participants.length} scored${saveReady ? '' : scoredCount === participants.length ? ', no winner at 0 yet' : ''}` : `Balance ${signed(balance)}`}
      testID="balance-pill"
    >
      <Text variant="labelMedium" style={[styles.balanceLabel, { color: balanceForeground }]}>
        {pool ? 'Scored' : 'Balance'}
      </Text>
      <Text style={[styles.balanceValue, tabularNums, { color: balanceForeground }]}>
        {pool ? `${scoredCount}/${participants.length}` : balanced ? '0' : signed(balance)}
      </Text>
    </Animated.View>
  );

  const saveRoundButton = (
    <Button
      mode="contained"
      onPress={handleSaveRound}
      loading={isSubmitting}
      disabled={!saveReady || isSubmitting}
      icon="check-circle-outline"
      style={styles.saveRound}
      contentStyle={styles.saveRoundContent}
      labelStyle={styles.saveRoundLabel}
    >
      {editRound ? 'Save edit' : 'Save round'}
    </Button>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: `Round ${nextRoundNumber(game)}` }} />

      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}

        {isShort ? (
          <View style={[styles.landscapeBody, { paddingLeft: gutterLeft, paddingRight: gutterRight, paddingBottom: insets.bottom + spacing.sm }]}>
            {grid}
            <View style={styles.controlColumn}>
              {actionRow}
              {keypad}
              <View style={styles.flex} />
              <View style={styles.saveRow}>
                {balancePill}
                {saveRoundButton}
              </View>
            </View>
          </View>
        ) : (
          <>
            <View style={[styles.flex, { paddingLeft: gutterLeft, paddingRight: gutterRight }]}>
              <View style={[styles.column, styles.flex]}>{grid}</View>
            </View>
            <View style={[styles.controls, { paddingLeft: gutterLeft, paddingRight: gutterRight, borderTopColor: colors.hairline }]}>
              <View style={[styles.column, styles.controlsInner]}>
                {actionRow}
                {keypad}
              </View>
            </View>
            <BottomBar>
              {balancePill}
              {saveRoundButton}
            </BottomBar>
          </>
        )}
      </View>

      <Portal>
        <Dialog visible={!!overMax} onDismiss={changeOverMax} style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Dialog.Icon icon="alert-outline" />
          <Dialog.Title style={styles.dialogTitle}>{pool ? 'Are you sure?' : 'Over the Full count'}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={[styles.dialogBody, { color: colors.onSurfaceVariant }]} testID="over-max-body">
              {overMax ? (pool ? poolOverFullConfirm(overMax.value, fullCount) : overMaxConfirm(overMax.value, fullCount, multiplier)) : ''}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={changeOverMax}>Change</Button>
            <Button mode="contained" onPress={() => setOverMax(null)} contentStyle={styles.dialogButtonContent}>
              {overMax ? `Keep ${pool ? overMax.value : signed(overMax.value)}` : 'Keep'}
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={!!afterSave} dismissable={false} style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Dialog.Icon icon={afterSave?.lastStanding ? 'flag-checkered' : afterSave?.newlyOut.length ? 'account-off-outline' : 'restore'} />
          <Dialog.Title style={styles.dialogTitle}>Round saved</Dialog.Title>
          <Dialog.Content style={{ gap: spacing.sm }}>
            {afterSave?.newlyOut.map((o) => (
              <Text key={o.playerId} variant="bodyMedium" style={{ color: colors.loss, fontWeight: '700' }} testID="after-out">
                {`${nameOf(o.playerId)} is out at ${o.total} (limit ${game.settings.poolLimit ?? 101}).`}
              </Text>
            ))}
            {afterSave?.lastStanding ? (
              <Text variant="bodyMedium" style={{ color: colors.onSurface }}>
                One player is left in the pool. Complete the pool, or re-enter someone to keep playing.
              </Text>
            ) : null}
            {afterSave?.eligible.length ? (
              <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }} testID="after-eligible">
                {`May re-enter at ${afterSave.reentryAt}: ${afterSave.eligible.map(nameOf).join(', ')}`}
              </Text>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions style={[styles.dialogActions, { flexWrap: 'wrap' }]}>
            {afterSave?.eligible.map((id) => (
              <Button
                key={id}
                mode="outlined"
                icon="restore"
                loading={reentering === id}
                disabled={Boolean(reentering)}
                onPress={async () => {
                  setReentering(id);
                  try {
                    await gamesService.reenterPlayer(game.id, id);
                    router.back();
                  } catch (error) {
                    setAfterSave(null);
                    setNotice({ title: 'Could not re-enter', body: formatSupabaseError(error), icon: 'alert-circle-outline' });
                  } finally {
                    setReentering(null);
                  }
                }}
                testID={`after-reenter-${id}`}
              >
                {`Re-enter ${nameOf(id).split(/\s+/)[0]}`}
              </Button>
            ))}
            {afterSave?.lastStanding ? (
              <Button mode="outlined" icon="flag-checkered" disabled={Boolean(reentering)} onPress={() => { setAfterSave(null); setCompleteOpen(true); }} testID="after-complete">
                Complete
              </Button>
            ) : null}
            {/* A05 / Nov 18: this returns to the scorecard, so it is Close. Done is kept for ending a game (it goes Home). */}
            <Button mode="contained" disabled={Boolean(reentering)} onPress={() => { setAfterSave(null); router.back(); }} contentStyle={styles.dialogButtonContent} testID="after-done">
              Close
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={!!rummyConfirm} onDismiss={() => setRummyConfirm(null)} style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Dialog.Icon icon="cards-playing-outline" />
          <Dialog.Title style={styles.dialogTitle}>Rummy share is not a win</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={[styles.dialogBody, { color: colors.onSurfaceVariant }]} testID="rummy-share-body">
              {rummyConfirm ?? ''}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setRummyConfirm(null)}>Change</Button>
            <Button
              mode="contained"
              contentStyle={styles.dialogButtonContent}
              onPress={() => { rummyConfirmed.current = true; setRummyConfirm(null); void handleSaveRound(); }}
            >
              Yes, save
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={!!notice} onDismiss={dismissNotice} style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Dialog.Icon icon={notice?.icon ?? 'information-outline'} />
          <Dialog.Title style={styles.dialogTitle}>{notice?.title}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={[styles.dialogBody, { color: colors.onSurfaceVariant }]}>
              {notice?.body}
            </Text>
            {notice?.why ? <WhyLink why={notice.why} before={dismissNotice} /> : null}
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button mode="contained" onPress={dismissNotice} contentStyle={styles.dialogButtonContent}>
              OK
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <CompleteGameDialog
        visible={completeOpen}
        game={game}
        players={game.players.map((id) => ({ id }))}
        onDismiss={() => setCompleteOpen(false)}
        onEditRound={() => setCompleteOpen(false)}
        onCompleted={(updated) => router.replace(afterCompleteRoute(updated))}
      />

      <GameSettingsDialog
        visible={settingsOpen}
        rules={rulesFromGame(game.settings, game.gameType)}
        roundCount={nextRoundNumber(game) - 1}
        poolLimitPreview={pool ? (limit) => limitChangePreview(game, limit, nameOf) : undefined}
        onDismiss={() => setSettingsOpen(false)}
        onSave={async (rules) => {
          const updated = await gamesService.updateGameRules(game.id, rules);
          if (updated) setGame(updated);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  noMargin: {
    margin: 0,
  },
  column: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gameBadge: {
    paddingHorizontal: spacing.sm,
    minHeight: 32,
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  gameBadgeText: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  title: {
    fontWeight: '800',
    flexShrink: 1,
  },
  // v12 point 9 (Sree, Nov 19): room under the last row for the "N more ▾" pill and its fade, so the
  // last players can scroll clear of the pill and be tapped; the pill itself hides once they are in view.
  gridContent: {
    paddingTop: spacing.xs,
    paddingBottom: MORE_PILL_CLEARANCE,
  },
  gridContentCompact: {
    paddingBottom: MORE_PILL_CLEARANCE,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    alignContent: 'flex-start',
  },
  moreWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'flex-end' },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 28, opacity: 0.85 },
  morePill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full, marginBottom: 4 },
  landscapeBody: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  controlColumn: {
    width: 440,
    gap: spacing.sm,
  },
  controls: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  controlsInner: {
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  action: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  actionSign: {
    flex: 0.8,
  },
  actionRummy: {
    flex: 1.6,
  },
  actionRipple: {
    borderRadius: radius.md,
  },
  actionInner: {
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  actionLabel: {
    fontWeight: '800',
    fontSize: 22,
    letterSpacing: -0.3,
  },
  actionLabelRummy: {
    fontSize: 18,
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  balance: {
    minWidth: 112,
    height: 78,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  balanceLabel: {
    fontWeight: '700',
    lineHeight: 18,
  },
  balanceValue: {
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
  },
  saveRound: {
    flex: 1,
    borderRadius: radius.full,
  },
  saveRoundContent: {
    height: 78,
  },
  saveRoundLabel: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  dialog: {
    borderRadius: radius.xl,
    maxWidth: 440,
    width: '90%',
    alignSelf: 'center',
  },
  dialogTitle: {
    textAlign: 'center',
    fontWeight: '700',
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
    paddingHorizontal: spacing.md,
  },
});

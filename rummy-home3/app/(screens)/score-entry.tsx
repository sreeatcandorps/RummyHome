import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Icon, IconButton, Menu, Portal, Text, TouchableRipple } from 'react-native-paper';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Game } from '../../types/game';
import { gamesService } from '../../services/games';
import { authService } from '../../services/auth';
import { isSupabaseConfigured } from '../../services/supabase';
import { storage } from '../../utils/storage';
import {
  applyPreset,
  applyRummy,
  balance as roundBalance,
  canSaveRound,
  cellView,
  clearPlayer,
  commitPending,
  hasPendingEntry,
  initialRoundEntryState,
  PresetKind,
  PresetValues,
  pressDigit,
  RoundEntryState,
  saveScore,
  setNegative,
  tapPlayer,
  toRoundScores,
} from '../../utils/roundEntry';
import { MAX_CONTENT_WIDTH, radius, spacing, tabularNums, useAppTheme } from '../../constants/theme';
import { useLayout } from '../../hooks/useLayout';
import { HELP } from '../../constants/help';
import { BottomBar } from '../../components/ui/BottomBar';
import { SeatAvatar } from '../../components/ui/SeatAvatar';
import { ScoreCell } from '../../components/game/ScoreCell';
import { ScoreKeypad } from '../../components/game/ScoreKeypad';
import { GameSettingsDialog } from '../../components/game/GameSettingsDialog';
import { rulesFromGame } from '../../utils/gameSettings';
import { formatGameDateTime, gameNumberLabel } from '../../utils/gameDisplay';
import { scorecardUrl } from '../../utils/shareLink';
import { shareLiveScorecard } from '../../utils/shareImage';
import { formatSupabaseError } from '../../utils/supabaseErrors';

type Participant = {
  id: string;
  name: string;
};

type Notice = { title: string; body: string; icon: string };

const signed = (value: number) => (value > 0 ? `+${value}` : `${value}`);

/** Long enough for the saved cell to flash before the round leaves the screen. */
const SAVE_FLASH_MS = 450;
const GRID_GAP = spacing.sm;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function ScoreEntryScreen() {
  const { colors } = useAppTheme();
  const { isShort, insets, gutterLeft, gutterRight } = useLayout();
  const { gameId } = useLocalSearchParams();

  const [game, setGame] = useState<Game | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [scorerName, setScorerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [entry, setEntry] = useState<RoundEntryState>(initialRoundEntryState);
  const [flashKeys, setFlashKeys] = useState<Record<string, number>>({});
  const [gridWidth, setGridWidth] = useState(0);

  const balancePulse = useRef(new Animated.Value(1)).current;

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
      const access = await gamesService.accessFor(String(gameId), userId);
      const currentGame = access.game ?? await gamesService.getGame(String(gameId));

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

      const [gamePlayers, scorer] = await Promise.all([
        gamesService.listGamePlayers(currentGame.id),
        authService.getCurrentPlayer().catch(() => null),
      ]);
      setParticipants(
        gamePlayers
          .filter((player) => player.seatRole !== 'spectator' && player.seated !== false)
          .map((player) => ({ id: player.id, name: player.name })),
      );
      setScorerName(scorer?.name ?? null);
    } catch (error) {
      setNotice({ title: 'Could not load game', body: formatSupabaseError(error), icon: 'alert-circle-outline' });
    } finally {
      setLoading(false);
    }
  };

  const presets: PresetValues = useMemo(
    () => ({
      drop: game?.settings.dropAmount ?? -10,
      middle_drop: game?.settings.mdAmount ?? -30,
      count: game?.settings.maxCount ?? -80,
    }),
    [game?.settings.dropAmount, game?.settings.mdAmount, game?.settings.maxCount],
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

  const balance = roundBalance(commitPending(entry));
  const saveReady = canSaveRound(entry);
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

  const handleSaveRound = async () => {
    if (!game || !saveReady || isSubmitting) return;

    // Whatever is still being typed counts; show it landing before we leave.
    const finalState = commitPending(entry);
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

      await gamesService.addRound({
        gameId: game.id,
        roundNumber: game.currentRound || 1,
        scores: toRoundScores(finalState),
        createdBy,
      });
      router.back();
    } catch (error) {
      console.error('Score submission error:', error);
      setNotice({ title: 'Could not save round', body: formatSupabaseError(error), icon: 'alert-circle-outline' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const shareLive = async () => {
    if (!game) return;
    setMenuOpen(false);
    try {
      const token = game.viewToken ?? await gamesService.ensureViewToken(game.id);
      const result = await shareLiveScorecard(scorecardUrl(token, game.gameNumber));
      if (result === 'copied') setNotice({ title: 'Link copied', body: 'Paste it anywhere to share the live scorecard.', icon: 'link-variant' });
    } catch (error) {
      setNotice({ title: 'Could not share', body: formatSupabaseError(error), icon: 'alert-circle-outline' });
    }
  };

  const closeScreen = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

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

  const columns = 2;
  const cellWidth = gridWidth > 0 ? Math.floor((gridWidth - GRID_GAP * (columns - 1)) / columns) : 0;

  const header = (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top + spacing.xs, paddingLeft: gutterLeft, paddingRight: Math.max(insets.right, spacing.xs) },
      ]}
    >
      <View style={styles.headerText}>
        <View style={styles.titleRow}>
          {gameNumberLabel(game) ? (
            <View style={[styles.gameBadge, { backgroundColor: colors.felt }]}>
              <Text variant="labelLarge" style={[styles.gameBadgeText, { color: colors.onFelt }]}>
                {gameNumberLabel(game)}
              </Text>
            </View>
          ) : null}
          <Text variant="titleLarge" numberOfLines={1} style={[styles.title, { color: colors.onSurface }]}>
            Round {game.currentRound || 1}
          </Text>
        </View>
        <Text variant="labelMedium" numberOfLines={1} style={{ color: colors.onSurfaceVariant }}>
          Started {formatGameDateTime(game.date)}
        </Text>
      </View>
      {scorerName ? (
        <View accessible accessibilityLabel={`Scored by ${scorerName}`}>
          <SeatAvatar name={scorerName} size={34} color={colors.primary} />
        </View>
      ) : null}
      <Menu
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
        <Menu.Item leadingIcon="cog-outline" title="Game settings" onPress={() => { setMenuOpen(false); setSettingsOpen(true); }} />
        <Menu.Item leadingIcon="share-variant" title="Share live scorecard" onPress={shareLive} />
        <Menu.Item
          leadingIcon="eraser-variant"
          title="Clear this round"
          disabled={!hasAnything}
          onPress={() => { setMenuOpen(false); setEntry(initialRoundEntryState()); }}
        />
        <Menu.Item
          leadingIcon="help-circle-outline"
          title="Help"
          onPress={() => { setMenuOpen(false); setNotice({ title: 'Add round', body: HELP.scoreEntry, icon: 'help-circle-outline' }); }}
        />
        <Menu.Item leadingIcon="arrow-left" title="Back to scorecard" onPress={() => { setMenuOpen(false); closeScreen(); }} />
      </Menu>
    </View>
  );

  const grid = (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.gridContent, isShort && styles.gridContentCompact]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator
    >
      <View
        style={styles.grid}
        onLayout={(event) => setGridWidth(Math.round(event.nativeEvent.layout.width))}
      >
        {cellWidth > 0
          ? participants.map((participant) => {
            const view = cellView(entry, participant.id);
            return (
              <ScoreCell
                key={participant.id}
                name={participant.name}
                status={view.status}
                value={view.value}
                width={cellWidth}
                compact={isShort}
                flashKey={flashKeys[participant.id] ?? 0}
                onPress={() => update((state) => tapPlayer(state, participant.id))}
                onClear={() => update((state) => clearPlayer(state, participant.id))}
              />
            );
          })
          : null}
      </View>
    </ScrollView>
  );

  const presetButtons: { kind: PresetKind | 'rummy'; label: string; caption: string; icon?: string }[] = [
    { kind: 'drop', label: 'Drop', caption: `${presets.drop}` },
    { kind: 'middle_drop', label: 'Middle drop', caption: `${presets.middle_drop}` },
    { kind: 'count', label: 'Full count', caption: `${presets.count}` },
    { kind: 'rummy', label: 'Rummy', caption: 'wins', icon: 'crown-outline' },
  ];

  const actionRow = (
    <View style={styles.actions}>
      {presetButtons.map((preset) => {
        const isRummy = preset.kind === 'rummy';
        return (
          <View
            key={preset.kind}
            style={[
              styles.action,
              {
                backgroundColor: isRummy ? colors.leaderContainer : colors.surface,
                borderColor: isRummy ? colors.leaderContainer : colors.outlineVariant,
                opacity: hasSelection ? 1 : 0.55,
              },
            ]}
          >
            <TouchableRipple
              onPress={() =>
                update((state) => (isRummy ? applyRummy(state) : applyPreset(state, preset.kind as PresetKind, presets)))
              }
              disabled={!hasSelection}
              borderless
              style={styles.actionRipple}
              accessibilityRole="button"
              accessibilityLabel={isRummy ? 'Rummy' : `${preset.label} ${preset.caption}`}
              accessibilityState={{ disabled: !hasSelection }}
            >
              <View style={styles.actionInner}>
                <Text
                  variant="labelLarge"
                  numberOfLines={1}
                  style={[styles.actionLabel, { color: isRummy ? colors.onLeaderContainer : colors.onSurface }]}
                >
                  {preset.label}
                </Text>
                <View style={styles.captionRow}>
                  {preset.icon ? <Icon source={preset.icon} size={13} color={colors.onLeaderContainer} /> : null}
                  <Text
                    variant="labelSmall"
                    numberOfLines={1}
                    style={[tabularNums, { color: isRummy ? colors.onLeaderContainer : colors.onSurfaceVariant }]}
                  >
                    {preset.caption}
                  </Text>
                </View>
              </View>
            </TouchableRipple>
          </View>
        );
      })}
    </View>
  );

  const keypad = (
    <ScoreKeypad
      negative={entry.draft.negative}
      enabled={hasSelection}
      canSave={hasPendingEntry(entry)}
      compact={isShort}
      onSign={(negative) => update((state) => setNegative(state, negative))}
      onDigit={(digit) => update((state) => pressDigit(state, digit))}
      onSave={() => update(saveScore)}
    />
  );

  const balancePill = (
    <Animated.View
      style={[
        styles.balance,
        {
          backgroundColor: saveReady ? colors.positiveContainer : balance === 0 ? colors.surfaceVariant : colors.errorContainer,
          transform: [{ scale: balancePulse }],
        },
      ]}
      accessible
      accessibilityLabel={`Balance ${signed(balance)}`}
    >
      <Text
        variant="labelSmall"
        style={[styles.balanceLabel, { color: saveReady ? colors.onPositiveContainer : balance === 0 ? colors.onSurfaceVariant : colors.onErrorContainer }]}
      >
        Balance
      </Text>
      <Text
        style={[
          styles.balanceValue,
          tabularNums,
          { color: saveReady ? colors.onPositiveContainer : balance === 0 ? colors.onSurfaceVariant : colors.onErrorContainer },
        ]}
      >
        {balance === 0 ? '0' : signed(balance)}
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
      Save round
    </Button>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: `Round ${game.currentRound || 1}` }} />

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
        <Dialog visible={!!notice} onDismiss={() => setNotice(null)} style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Dialog.Icon icon={notice?.icon ?? 'information-outline'} />
          <Dialog.Title style={styles.dialogTitle}>{notice?.title}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={[styles.dialogBody, { color: colors.onSurfaceVariant }]}>
              {notice?.body}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button mode="contained" onPress={() => setNotice(null)} contentStyle={styles.dialogButtonContent}>
              Got it
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <GameSettingsDialog
        visible={settingsOpen}
        rules={rulesFromGame(game.settings)}
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
    paddingVertical: 2,
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
  gridContent: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  gridContentCompact: {
    paddingBottom: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    alignContent: 'flex-start',
  },
  landscapeBody: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  controlColumn: {
    width: 360,
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
  actionRipple: {
    borderRadius: radius.md,
  },
  actionInner: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingVertical: spacing.xs,
  },
  actionLabel: {
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0,
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  balance: {
    minWidth: 84,
    height: 52,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  balanceLabel: {
    fontWeight: '700',
    lineHeight: 14,
  },
  balanceValue: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  saveRound: {
    flex: 1,
    borderRadius: radius.full,
  },
  saveRoundContent: {
    height: 52,
  },
  saveRoundLabel: {
    fontSize: 16,
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

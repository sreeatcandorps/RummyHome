import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import {
  Button,
  Dialog,
  Icon,
  IconButton,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
  TouchableRipple,
} from 'react-native-paper';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Game } from '../../types/game';
import { ScoreType } from '../../types/database';
import { EXPENSE_PLAYER_ID, gamesService } from '../../services/games';
import { authService } from '../../services/auth';
import { isSupabaseConfigured } from '../../services/supabase';
import { storage } from '../../utils/storage';
import { distributeRummyWinnings } from '../../utils/rummyDistribution';
import {
  MAX_CONTENT_WIDTH,
  MIN_TOUCH_TARGET,
  radius,
  seatColor,
  spacing,
  tabularNums,
  useAppTheme,
} from '../../constants/theme';
import { useLayout } from '../../hooks/useLayout';
import { BottomBar } from '../../components/ui/BottomBar';
import { SeatAvatar } from '../../components/ui/SeatAvatar';
import { buildPlayerInitials } from '../../utils/playerInitials';
import { formatGameDateTime, gameIdLabel } from '../../utils/gameDisplay';
import { formatSupabaseError } from '../../utils/supabaseErrors';

const EXPENSE_ID = EXPENSE_PLAYER_ID;

type SelectableType = 'drop' | 'middle_drop' | 'rummy';

type Participant = {
  id: string;
  name: string;
  isExpense?: boolean;
};

type ScoreEntry = {
  value: number;
  scoreType: ScoreType;
};

const TYPE_LABELS: Record<ScoreType, string> = {
  drop: 'Drop',
  middle_drop: 'Middle drop',
  rummy: 'Rummy',
  count: 'Count',
  expense: 'Expense',
};

const signed = (value: number) => (value > 0 ? `+${value}` : `${value}`);

export default function ScoreEntryScreen() {
  const { colors } = useAppTheme();
  const { isShort, insets, gutterLeft, gutterRight } = useLayout();
  const { gameId } = useLocalSearchParams();

  const [game, setGame] = useState<Game | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<SelectableType | null>(null);
  const [entries, setEntries] = useState<Record<string, ScoreEntry>>({});
  const [winners, setWinners] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [manualTarget, setManualTarget] = useState<Participant | null>(null);
  const [manualDigits, setManualDigits] = useState('');
  const [manualNegative, setManualNegative] = useState(true);

  const [message, setMessage] = useState<{ title: string; body: string; icon: string } | null>(null);

  useEffect(() => {
    loadGameData();
  }, [gameId]);

  const loadGameData = async () => {
    if (!gameId) {
      setMessage({ title: 'No game selected', body: 'Open a game first, then add a round.', icon: 'alert-circle-outline' });
      setLoading(false);
      return;
    }

    try {
      const currentGame = await gamesService.getGame(String(gameId));

      if (!currentGame) {
        setMessage({ title: 'Game not found', body: 'This game may have been removed.', icon: 'alert-circle-outline' });
        return;
      }

      setGame(currentGame);

      const gamePlayers = await gamesService.listGamePlayers(currentGame.id);
      const roster: Participant[] = gamePlayers.map((player) => ({ id: player.id, name: player.name }));

      if (currentGame.settings.expense) {
        roster.push({ id: EXPENSE_ID, name: 'Expenses', isExpense: true });
        const expenseAmount = currentGame.settings.expenseAmount ?? -10;
        setEntries({ [EXPENSE_ID]: { value: expenseAmount, scoreType: 'expense' } });
      }

      setParticipants(roster);
    } catch (error) {
      setMessage({ title: 'Could not load game', body: formatSupabaseError(error), icon: 'alert-circle-outline' });
    } finally {
      setLoading(false);
    }
  };

  const dropValue = game?.settings.dropAmount ?? -10;
  const middleDropValue = game?.settings.mdAmount ?? -30;

  const typeOptions = useMemo(
    () => [
      { value: 'drop' as SelectableType, label: `Drop ${dropValue}` },
      { value: 'middle_drop' as SelectableType, label: `MD ${middleDropValue}` },
      { value: 'rummy' as SelectableType, label: 'Rummy' },
    ],
    [dropValue, middleDropValue],
  );

  const entriesTotal = useMemo(
    () => Object.values(entries).reduce((sum, entry) => sum + entry.value, 0),
    [entries],
  );

  /** Winners evenly share whatever is needed to bring the round back to zero. */
  const distribution = useMemo(
    () => distributeRummyWinnings(entriesTotal, winners),
    [entriesTotal, winners],
  );

  const scoreFor = useCallback(
    (participantId: string): number | undefined => {
      if (winners.includes(participantId)) return distribution[participantId];
      return entries[participantId]?.value;
    },
    [winners, distribution, entries],
  );

  const typeFor = useCallback(
    (participantId: string): ScoreType | undefined => {
      if (winners.includes(participantId)) return 'rummy';
      return entries[participantId]?.scoreType;
    },
    [winners, entries],
  );

  const tally = useMemo(
    () =>
      entriesTotal +
      winners.reduce((sum, winnerId) => sum + (distribution[winnerId] ?? 0), 0),
    [entriesTotal, winners, distribution],
  );

  const scoredCount = Object.keys(entries).length + winners.length;
  const isBalanced = tally === 0 && winners.length > 0;

  const setEntry = (participantId: string, entry: ScoreEntry) => {
    setWinners((prev) => prev.filter((id) => id !== participantId));
    setEntries((prev) => ({ ...prev, [participantId]: entry }));
  };

  const clearScore = (participantId: string) => {
    setWinners((prev) => prev.filter((id) => id !== participantId));
    setEntries((prev) => {
      const next = { ...prev };
      delete next[participantId];
      return next;
    });
  };

  const toggleWinner = (participantId: string) => {
    setEntries((prev) => {
      if (!prev[participantId]) return prev;
      const next = { ...prev };
      delete next[participantId];
      return next;
    });
    setWinners((prev) =>
      prev.includes(participantId)
        ? prev.filter((id) => id !== participantId)
        : [...prev, participantId],
    );
  };

  const handleParticipantPress = (participant: Participant) => {
    if (selectedType === 'rummy') {
      toggleWinner(participant.id);
      return;
    }

    if (selectedType === 'drop') {
      setEntry(participant.id, { value: dropValue, scoreType: 'drop' });
      return;
    }

    if (selectedType === 'middle_drop') {
      setEntry(participant.id, { value: middleDropValue, scoreType: 'middle_drop' });
      return;
    }

    openManualEntry(participant);
  };

  const openManualEntry = (participant: Participant) => {
    const existing = scoreFor(participant.id);
    setManualTarget(participant);
    setManualNegative(existing === undefined ? true : existing <= 0);
    setManualDigits(existing === undefined ? '' : String(Math.abs(existing)));
  };

  const closeManualEntry = () => {
    setManualTarget(null);
    setManualDigits('');
    setManualNegative(true);
  };

  const submitManualEntry = () => {
    if (!manualTarget) return;

    const magnitude = parseInt(manualDigits || '0', 10);
    if (Number.isNaN(magnitude)) return;

    if (magnitude === 0 && manualDigits === '') {
      clearScore(manualTarget.id);
      closeManualEntry();
      return;
    }

    const value = manualNegative ? -magnitude : magnitude;
    const scoreType: ScoreType = manualTarget.isExpense
      ? 'expense'
      : value > 0
        ? 'rummy'
        : 'count';

    setEntry(manualTarget.id, { value, scoreType });
    closeManualEntry();
  };

  const handleSubmit = async () => {
    if (!game) return;

    if (scoredCount === 0) {
      setMessage({
        title: 'Nothing to save',
        body: 'Give at least one player a score before submitting the round.',
        icon: 'information-outline',
      });
      return;
    }

    if (winners.length === 0) {
      setMessage({
        title: 'Pick a winner',
        body: 'Select Rummy, then tap everyone who won this round. They split the points so the round balances to zero.',
        icon: 'trophy-outline',
      });
      return;
    }

    if (tally !== 0) {
      setMessage({
        title: 'Round is off by ' + signed(tally),
        body: 'Every round has to total zero. Adjust a score or add another winner to even it out.',
        icon: 'scale-balance',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const currentRound = game.currentRound || 1;
      const createdBy = isSupabaseConfigured
        ? await authService.getCurrentUserId()
        : await storage.getCurrentPlayer();

      if (!createdBy) {
        throw new Error('You must be signed in to submit scores.');
      }

      const scores = [
        ...Object.entries(entries).map(([participantId, entry]) => ({
          playerId: participantId === EXPENSE_ID ? null : participantId,
          value: entry.value,
          scoreType: entry.scoreType,
        })),
        ...winners.map((winnerId) => ({
          playerId: winnerId === EXPENSE_ID ? null : winnerId,
          value: distribution[winnerId] ?? 0,
          scoreType: 'rummy' as ScoreType,
        })),
      ];

      await gamesService.addRound({
        gameId: game.id,
        roundNumber: currentRound,
        scores,
        createdBy,
      });

      router.back();
    } catch (error) {
      console.error('Score submission error:', error);
      setMessage({
        title: 'Could not save round',
        body: formatSupabaseError(error),
        icon: 'alert-circle-outline',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTypeLabel = selectedType
    ? selectedType === 'rummy'
      ? 'Rummy'
      : selectedType === 'drop'
        ? `Drop (${dropValue})`
        : `Middle drop (${middleDropValue})`
    : null;

  const initials = buildPlayerInitials(participants.map((participant) => participant.name));
  const seatIndex = (participantId: string) =>
    participants.filter((participant) => !participant.isExpense).findIndex((participant) => participant.id === participantId);

  const modeOptions: { value: SelectableType; label: string; amount?: number; icon: string }[] = [
    { value: 'drop', label: 'Drop', amount: dropValue, icon: 'arrow-down-circle-outline' },
    { value: 'middle_drop', label: 'Middle drop', amount: middleDropValue, icon: 'arrow-collapse-down' },
    { value: 'rummy', label: 'Rummy', icon: 'trophy-outline' },
  ];

  const hint = selectedTypeLabel
    ? selectedType === 'rummy'
      ? 'Tap every winner. They split the points so the round balances.'
      : `Tap each player who took a ${selectedTypeLabel}.`
    : 'Pick Drop, Middle drop or Rummy, or tap a player to type an exact score.';

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const modeTiles = (
    <View style={[styles.modes, isShort && styles.modesColumn]}>
      {modeOptions.map((option) => {
        const selected = selectedType === option.value;
        const accessibleLabel = option.amount !== undefined ? `${option.label} ${option.amount}` : option.label;
        return (
          <View
            key={option.value}
            style={[
              styles.modeTile,
              isShort && styles.modeTileRow,
              {
                backgroundColor: selected ? colors.primary : colors.surface,
                borderColor: selected ? colors.primary : colors.outlineVariant,
              },
            ]}
          >
            <TouchableRipple
              onPress={() => setSelectedType((prev) => (prev === option.value ? null : option.value))}
              borderless
              style={styles.modeRipple}
              accessibilityRole="button"
              accessibilityLabel={accessibleLabel}
              accessibilityState={{ selected }}
            >
              <View style={[styles.modeInner, isShort && styles.modeInnerRow]}>
                <Icon source={option.icon} size={isShort ? 20 : 22} color={selected ? colors.onPrimary : colors.primary} />
                <Text
                  variant="labelLarge"
                  numberOfLines={1}
                  style={[styles.modeLabel, { color: selected ? colors.onPrimary : colors.onSurface }]}
                >
                  {option.label}
                </Text>
                {option.amount !== undefined ? (
                  <Text
                    numberOfLines={1}
                    style={[styles.modeAmount, tabularNums, { color: selected ? colors.onPrimary : colors.onSurfaceVariant }]}
                  >
                    {option.amount}
                  </Text>
                ) : (
                  <Text
                    numberOfLines={1}
                    style={[styles.modeAmount, { color: selected ? colors.onPrimary : colors.onSurfaceVariant }]}
                  >
                    winners
                  </Text>
                )}
              </View>
            </TouchableRipple>
          </View>
        );
      })}
    </View>
  );

  const tallyPill = (
    <View
      style={[styles.tallyPill, { backgroundColor: isBalanced ? colors.positiveContainer : colors.errorContainer }]}
      accessible
      accessibilityLabel={isBalanced ? 'Round balanced' : `Round tally ${tally}`}
    >
      <Text
        style={[
          styles.tallyValue,
          tabularNums,
          { color: isBalanced ? colors.onPositiveContainer : colors.onErrorContainer },
        ]}
      >
        {isBalanced ? '0' : signed(tally)}
      </Text>
      <Text
        variant="labelSmall"
        style={[styles.tallyCaption, { color: isBalanced ? colors.onPositiveContainer : colors.onErrorContainer }]}
      >
        {isBalanced ? 'Balanced' : 'Tally'}
      </Text>
    </View>
  );

  const submitButton = (
    <Button
      mode="contained"
      onPress={handleSubmit}
      loading={isSubmitting}
      disabled={isSubmitting}
      icon="check"
      style={styles.submitButton}
      contentStyle={isShort ? styles.submitContentCompact : styles.submitContent}
      labelStyle={styles.submitLabel}
    >
      Submit round
    </Button>
  );

  const playerRows = participants.map((participant, index) => {
    const value = scoreFor(participant.id);
    const scoreType = typeFor(participant.id);
    const isWinner = winners.includes(participant.id);
    const isPositive = (value ?? 0) > 0;
    const hasValue = value !== undefined;

    return (
      <View
        key={participant.id}
        style={[
          styles.playerRow,
          isShort && styles.playerCell,
          {
            backgroundColor: isPositive ? colors.positiveContainer : colors.surface,
            borderColor: isWinner ? colors.positive : hasValue ? colors.outline : colors.outlineVariant,
            borderWidth: isWinner ? 2 : 1,
          },
        ]}
      >
        <TouchableRipple
          onPress={() => handleParticipantPress(participant)}
          borderless
          style={styles.playerRipple}
          accessibilityRole="button"
          accessibilityLabel={participant.name}
        >
          <View style={[styles.playerRowInner, isShort && styles.playerRowInnerCompact]}>
            <View>
              {participant.isExpense ? (
                <SeatAvatar name={participant.name} icon="cash-multiple" muted size={isShort ? 32 : 38} />
              ) : (
                <SeatAvatar
                  name={participant.name}
                  label={initials[index]}
                  color={seatColor(seatIndex(participant.id))}
                  size={isShort ? 32 : 38}
                />
              )}
              {isWinner ? (
                <View style={[styles.winnerBadge, { backgroundColor: colors.leader, borderColor: colors.surface }]}>
                  <Icon source="trophy" size={10} color={colors.surface} />
                </View>
              ) : null}
            </View>

            <View style={styles.playerText}>
              <Text variant="bodyLarge" numberOfLines={1} style={[styles.playerName, { color: isPositive ? colors.onPositiveContainer : colors.onSurface }]}>
                {participant.name}
              </Text>
              <Text
                variant="labelSmall"
                numberOfLines={1}
                style={{ color: isPositive ? colors.onPositiveContainer : colors.onSurfaceVariant }}
              >
                {scoreType ? (isWinner ? 'Rummy winner' : TYPE_LABELS[scoreType]) : 'Not scored'}
              </Text>
            </View>

            {isShort && !hasValue ? null : (
              <View
                style={[
                  styles.scorePill,
                  isShort && styles.scorePillCompact,
                  {
                    backgroundColor: isPositive ? colors.surface : hasValue ? colors.surfaceVariant : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.playerScore,
                    tabularNums,
                    { color: isPositive ? colors.positive : hasValue ? colors.onSurface : colors.outline },
                  ]}
                >
                  {value === undefined ? '—' : signed(value)}
                </Text>
              </View>
            )}

            <IconButton
              icon={value === undefined ? 'pencil-outline' : 'close'}
              size={20}
              style={styles.rowAction}
              iconColor={colors.onSurfaceVariant}
              accessibilityLabel={
                value === undefined
                  ? `Enter score for ${participant.name}`
                  : `Clear score for ${participant.name}`
              }
              onPress={() =>
                value === undefined ? openManualEntry(participant) : clearScore(participant.id)
              }
            />
          </View>
        </TouchableRipple>
      </View>
    );
  });

  const hintText = (
    <View style={styles.hintRow}>
      <Icon source="gesture-tap" size={16} color={colors.onSurfaceVariant} />
      <Text variant="bodySmall" style={[styles.hintText, { color: colors.onSurfaceVariant }]}>
        {hint}
      </Text>
    </View>
  );

  const title = game ? `Round ${game.currentRound}` : 'Enter scores';
  const subtitle = game ? `${formatGameDateTime(game.date)} · ID ${gameIdLabel(game)}` : undefined;

  return (
    <>
      <Stack.Screen
        options={{
          title: game ? `Enter scores for round ${game.currentRound}` : 'Enter scores',
          headerShown: !isShort,
          headerTitle: () => (
            <View>
              <Text variant="titleMedium" style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ),
        }}
      />

      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {isShort ? (
          <>
            <View
              style={[
                styles.compactTopBar,
                { paddingTop: insets.top + spacing.xs, paddingLeft: Math.max(insets.left, spacing.xs), paddingRight: gutterRight },
              ]}
            >
              <IconButton
                icon="close"
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
                accessibilityLabel="Close score entry"
                style={styles.noMargin}
              />
              <Text variant="titleMedium" style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text variant="labelMedium" numberOfLines={1} style={[styles.flex, { color: colors.onSurfaceVariant }]}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <View
              style={[
                styles.landscapeBody,
                { paddingLeft: gutterLeft, paddingRight: gutterRight, paddingBottom: insets.bottom + spacing.sm },
              ]}
            >
              <View style={[styles.controlPanel, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                {modeTiles}
                {hintText}
                <View style={styles.flex} />
                <View style={styles.submitRow}>
                  {tallyPill}
                  {submitButton}
                </View>
              </View>
              <ScrollView
                style={styles.flex}
                contentContainerStyle={styles.grid}
                keyboardShouldPersistTaps="handled"
              >
                {playerRows}
              </ScrollView>
            </View>
          </>
        ) : (
          <>
            {/* Frozen: the score type must stay visible while the player list scrolls. */}
            <View style={[styles.stickyTop, { paddingLeft: gutterLeft, paddingRight: gutterRight }]}>
              <View style={styles.column}>
                {modeTiles}
                {hintText}
              </View>
            </View>

            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={[styles.content, { paddingLeft: gutterLeft, paddingRight: gutterRight }]}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.column, styles.playerList]}>{playerRows}</View>
            </ScrollView>

            <BottomBar>
              {tallyPill}
              {submitButton}
            </BottomBar>
          </>
        )}
      </View>

      <Portal>
        <Dialog
          visible={!!manualTarget}
          onDismiss={closeManualEntry}
          style={[styles.dialog, { backgroundColor: colors.surface }, isShort && styles.dialogCompact]}
        >
          {isShort ? null : <Dialog.Title style={styles.dialogTitle}>{manualTarget?.name}</Dialog.Title>}
          <Dialog.Content style={[styles.dialogContent, isShort && styles.dialogContentCompact]}>
            {isShort ? (
              <Text variant="titleMedium" style={styles.headerTitle} numberOfLines={1}>
                {manualTarget?.name}
              </Text>
            ) : null}
            <View style={isShort ? styles.manualRow : styles.manualColumn}>
              <SegmentedButtons
                value={manualNegative ? 'minus' : 'plus'}
                onValueChange={(value) => setManualNegative(value === 'minus')}
                style={isShort ? styles.flex : undefined}
                buttons={[
                  { value: 'minus', label: 'Loses (−)' },
                  { value: 'plus', label: 'Wins (+)' },
                ]}
              />
              <TextInput
                label="Points"
                value={manualDigits}
                onChangeText={(text) => setManualDigits(text.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                mode="outlined"
                autoFocus
                maxLength={4}
                style={[styles.pointsInput, isShort && styles.pointsInputCompact]}
                contentStyle={styles.pointsInputContent}
                left={<TextInput.Affix text={manualNegative ? '−' : '+'} />}
              />
            </View>
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}>
              Saves as {manualNegative ? '−' : '+'}
              {manualDigits || '0'}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={closeManualEntry}>Cancel</Button>
            <Button mode="contained" onPress={submitManualEntry} disabled={!manualDigits} contentStyle={styles.dialogButtonContent}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={!!message} onDismiss={() => setMessage(null)} style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Dialog.Icon icon={message?.icon ?? 'information-outline'} />
          <Dialog.Title style={styles.dialogTitle}>{message?.title}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={[styles.dialogBody, { color: colors.onSurfaceVariant }]}>
              {message?.body}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button mode="contained" onPress={() => setMessage(null)} contentStyle={styles.dialogButtonContent}>
              Got it
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  headerTitle: {
    fontWeight: '800',
  },
  stickyTop: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  compactTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  landscapeBody: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  controlPanel: {
    width: 296,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  submitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  modes: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modesColumn: {
    flexDirection: 'column',
    gap: spacing.xs,
  },
  modeTile: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  modeTileRow: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
  },
  modeRipple: {
    borderRadius: radius.lg,
  },
  modeInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 76,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  modeInnerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: spacing.sm,
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  modeLabel: {
    fontWeight: '800',
    fontSize: 14,
  },
  modeAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xxs,
  },
  hintText: {
    flex: 1,
    lineHeight: 17,
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.md,
  },
  playerList: {
    gap: spacing.sm,
  },
  playerRow: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  playerCell: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  playerRipple: {
    borderRadius: radius.lg,
  },
  playerRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 62,
    paddingLeft: spacing.md,
    paddingRight: spacing.xxs,
  },
  playerRowInnerCompact: {
    minHeight: 52,
    gap: spacing.sm,
    paddingLeft: spacing.sm,
  },
  winnerBadge: {
    position: 'absolute',
    right: -4,
    bottom: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerText: {
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    fontWeight: '600',
  },
  scorePill: {
    minWidth: 58,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  scorePillCompact: {
    minWidth: 48,
    paddingHorizontal: spacing.xs,
  },
  playerScore: {
    fontSize: 18,
    fontWeight: '800',
  },
  rowAction: {
    margin: 0,
  },
  tallyPill: {
    minWidth: 68,
    height: 52,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  tallyValue: {
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 22,
  },
  tallyCaption: {
    fontWeight: '700',
  },
  submitButton: {
    flex: 1,
    borderRadius: radius.full,
  },
  submitContent: {
    height: 52,
  },
  submitContentCompact: {
    height: 52,
  },
  submitLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  dialog: {
    borderRadius: radius.xl,
    maxWidth: 440,
    width: '90%',
    alignSelf: 'center',
  },
  dialogCompact: {
    maxWidth: 560,
    marginTop: 0,
    marginBottom: 'auto',
  },
  dialogTitle: {
    textAlign: 'center',
    fontWeight: '700',
  },
  dialogContent: {
    gap: spacing.md,
  },
  dialogContentCompact: {
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  manualColumn: {
    gap: spacing.md,
  },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pointsInput: {
    fontSize: 24,
  },
  pointsInputCompact: {
    width: 150,
  },
  pointsInputContent: {
    fontSize: 24,
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

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
  useTheme,
} from 'react-native-paper';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Game } from '../../types/game';
import { ScoreType } from '../../types/database';
import { EXPENSE_PLAYER_ID, gamesService } from '../../services/games';
import { authService } from '../../services/auth';
import { isSupabaseConfigured } from '../../services/supabase';
import { storage } from '../../utils/storage';
import { distributeRummyWinnings } from '../../utils/rummyDistribution';
import { MIN_TOUCH_TARGET, radius, spacing } from '../../constants/theme';
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
  const theme = useTheme();
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

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: game ? `Enter scores for round ${game.currentRound}` : 'Enter scores',
          headerShown: true,
          headerTitleStyle: { fontSize: 17, fontWeight: '600' },
        }}
      />

      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Frozen: the score type must stay visible while the player list scrolls. */}
        <View style={styles.stickyTop}>
          {game ? (
            <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
              {formatGameDateTime(game.date)} · ID {gameIdLabel(game)}
            </Text>
          ) : null}

          <SegmentedButtons
            value={selectedType ?? ''}
            onValueChange={(value) =>
              setSelectedType((prev) => (prev === value ? null : (value as SelectableType)))
            }
            buttons={typeOptions.map((option) => ({
              value: option.value,
              label: option.label,
              style: styles.segment,
            }))}
          />

          <Text variant="labelLarge" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
            {selectedTypeLabel
              ? `Select players for ${selectedTypeLabel}`
              : 'Tap a player to type an exact score'}
          </Text>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.playerList}>
            {participants.map((participant) => {
              const value = scoreFor(participant.id);
              const scoreType = typeFor(participant.id);
              const isWinner = winners.includes(participant.id);
              const isPositive = (value ?? 0) > 0;

              return (
                <TouchableRipple
                  key={participant.id}
                  onPress={() => handleParticipantPress(participant)}
                  borderless
                  style={[
                    styles.playerRow,
                    {
                      backgroundColor: isPositive
                        ? theme.colors.primaryContainer
                        : value !== undefined
                          ? theme.colors.surfaceVariant
                          : 'transparent',
                      borderColor: isWinner ? theme.colors.primary : theme.colors.outlineVariant,
                    },
                  ]}
                >
                  <View style={styles.playerRowInner}>
                    <Icon
                      source={
                        participant.isExpense
                          ? 'cash-multiple'
                          : isWinner
                            ? 'trophy'
                            : value !== undefined
                              ? 'check-circle'
                              : 'account-outline'
                      }
                      size={20}
                      color={isPositive ? theme.colors.primary : theme.colors.onSurfaceVariant}
                    />

                    <View style={styles.playerText}>
                      <Text variant="bodyLarge" numberOfLines={1} style={styles.playerName}>
                        {participant.name}
                      </Text>
                      {scoreType ? (
                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                          {isWinner ? 'Rummy winner' : TYPE_LABELS[scoreType]}
                        </Text>
                      ) : null}
                    </View>

                    <Text
                      variant="titleMedium"
                      style={[
                        styles.playerScore,
                        {
                          color: isPositive
                            ? theme.colors.primary
                            : value !== undefined
                              ? theme.colors.onSurface
                              : theme.colors.outline,
                        },
                      ]}
                    >
                      {value === undefined ? '—' : signed(value)}
                    </Text>

                    <IconButton
                      icon={value === undefined ? 'pencil-outline' : 'close'}
                      size={18}
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
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <View
            style={[
              styles.tallyPill,
              {
                backgroundColor: isBalanced
                  ? theme.colors.primaryContainer
                  : theme.colors.errorContainer,
              },
            ]}
          >
            <Text
              variant="titleMedium"
              style={{
                fontWeight: '700',
                color: isBalanced ? theme.colors.onPrimaryContainer : theme.colors.onErrorContainer,
              }}
            >
              {tally}
            </Text>
            <Text
              variant="labelSmall"
              style={{
                color: isBalanced ? theme.colors.onPrimaryContainer : theme.colors.onErrorContainer,
              }}
            >
              {isBalanced ? 'Balanced' : 'Tally'}
            </Text>
          </View>

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
            icon="check"
            style={styles.submitButton}
            contentStyle={styles.submitContent}
            labelStyle={styles.submitLabel}
          >
            Submit round
          </Button>
        </View>
      </View>

      <Portal>
        <Dialog visible={!!manualTarget} onDismiss={closeManualEntry} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>{manualTarget?.name}</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <SegmentedButtons
              value={manualNegative ? 'minus' : 'plus'}
              onValueChange={(value) => setManualNegative(value === 'minus')}
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
            />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Saves as {manualNegative ? '−' : '+'}
              {manualDigits || '0'}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={closeManualEntry}>Cancel</Button>
            <Button mode="contained" onPress={submitManualEntry} disabled={!manualDigits}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={!!message} onDismiss={() => setMessage(null)} style={styles.dialog}>
          <Dialog.Icon icon={message?.icon ?? 'information-outline'} />
          <Dialog.Title style={styles.dialogTitle}>{message?.title}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogBody}>
              {message?.body}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button mode="contained" onPress={() => setMessage(null)}>
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyTop: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  segment: {
    minWidth: 0,
  },
  playerList: {
    gap: spacing.xs,
  },
  playerRow: {
    borderRadius: radius.md,
    borderWidth: 1,
  },
  playerRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 50,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  playerText: {
    flex: 1,
  },
  playerName: {
    fontWeight: '500',
  },
  playerScore: {
    minWidth: 56,
    textAlign: 'right',
    fontWeight: '700',
  },
  // Floats above the rounded bottom edge rather than hugging it.
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  tallyPill: {
    width: 76,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  submitButton: {
    flex: 1,
    borderRadius: radius.full,
  },
  submitContent: {
    height: MIN_TOUCH_TARGET,
  },
  submitLabel: {
    fontSize: 16,
    fontWeight: '600',
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
});

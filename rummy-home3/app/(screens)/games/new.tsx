import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, Icon, Switch, Searchbar, Text, TextInput, TouchableRipple } from 'react-native-paper';
import { router } from 'expo-router';
import { storage } from '../../../utils/storage';
import { Player } from '../../../types/player';
import { gamesService } from '../../../services/games';
import { authService } from '../../../services/auth';
import { playersService } from '../../../services/players';
import { isSupabaseConfigured } from '../../../services/supabase';
import { formatSupabaseError } from '../../../utils/supabaseErrors';
import { SectionCard } from '../../../components/ui/SectionCard';
import { EmptyState } from '../../../components/ui/EmptyState';
import { BottomBar } from '../../../components/ui/BottomBar';
import { SeatAvatar } from '../../../components/ui/SeatAvatar';
import { MAX_CONTENT_WIDTH, MIN_TOUCH_TARGET, radius, seatColor, spacing, useAppTheme } from '../../../constants/theme';
import { useLayout } from '../../../hooks/useLayout';

const GAME_TYPES = [
  { value: 'stake' as const, label: 'Stake', icon: 'cash-multiple' },
  { value: 'pool' as const, label: 'Pool', icon: 'trophy-outline' },
];

export default function NewGame() {
  const { colors, gameTypes } = useAppTheme();
  const { isWide, gutterLeft, gutterRight, isShort } = useLayout();
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [gameType, setGameType] = useState<'stake' | 'pool'>('stake');
  const [expenseEnabled, setExpenseEnabled] = useState(true);
  const [expenseDigits, setExpenseDigits] = useState('10');
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    try {
      const [players, userId] = await Promise.all([
        isSupabaseConfigured ? playersService.listPlayers() : storage.getPlayers(),
        isSupabaseConfigured ? authService.getCurrentUserId() : storage.getCurrentPlayer(),
      ]);

      setAvailablePlayers(players);
      setCurrentUserId(userId);

      if (userId) {
        setSelectedPlayers((prev) => (prev.includes(userId) ? prev : [userId, ...prev]));
      }
    } catch (error) {
      console.error('Failed to load players:', error);
      Alert.alert('Error', formatSupabaseError(error));
    }
  };

  const togglePlayerSelection = (playerId: string) => {
    if (playerId === currentUserId) return;

    if (selectedPlayers.includes(playerId)) {
      setSelectedPlayers(selectedPlayers.filter((id) => id !== playerId));
    } else {
      setSelectedPlayers([...selectedPlayers, playerId]);
    }
  };

  const startGame = async () => {
    if (selectedPlayers.length < 2) {
      Alert.alert(
        'Need more players',
        'Select at least one other registered player. Ask friends to create an account first, then use Find Players.',
      );
      return;
    }

    setCreating(true);
    try {
      const createdBy = currentUserId
        ?? (isSupabaseConfigured
          ? await authService.getCurrentUserId()
          : await storage.getCurrentPlayer());

      if (!createdBy) {
        throw new Error('You must be signed in to create a game.');
      }

      const playerIds = selectedPlayers.includes(createdBy)
        ? selectedPlayers
        : [createdBy, ...selectedPlayers];

      const newGame = await gamesService.createGame({
        playerIds,
        gameType,
        expenseEnabled,
        expenseAmount: -Math.abs(parseInt(expenseDigits || '0', 10) || 0),
        createdBy,
      });

      router.push(`/(screens)/games/${newGame.id}`);
    } catch (error: any) {
      console.error('Error creating game:', error);
      Alert.alert('Could not create game', formatSupabaseError(error));
    } finally {
      setCreating(false);
    }
  };

  const otherPlayers = useMemo(() => {
    const others = availablePlayers.filter((player) => player.id !== currentUserId);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return others;
    return others.filter(
      (player) =>
        player.name.toLowerCase().includes(q) ||
        (player.email ?? '').toLowerCase().includes(q),
    );
  }, [availablePlayers, currentUserId, searchQuery]);

  const currentUserName = availablePlayers.find((p) => p.id === currentUserId)?.name ?? 'You';

  const renderPlayerRow = (player: Player, isSelf: boolean) => {
    const checked = isSelf || selectedPlayers.includes(player.id);
    const seat = selectedPlayers.indexOf(player.id);

    return (
      <TouchableRipple
        key={player.id}
        onPress={isSelf ? undefined : () => togglePlayerSelection(player.id)}
        disabled={isSelf}
        borderless
        style={[
          styles.playerRow,
          {
            backgroundColor: checked ? colors.primaryContainer : 'transparent',
          },
        ]}
        accessibilityRole="checkbox"
        accessibilityLabel={player.name}
        accessibilityState={{ checked, disabled: isSelf }}
      >
        <View style={styles.playerRowInner}>
          <SeatAvatar name={player.name} size={40} muted={!checked} color={seatColor(seat < 0 ? 0 : seat)} />
          <View style={styles.playerText}>
            <Text
              variant="bodyLarge"
              numberOfLines={1}
              style={[styles.playerName, { color: checked ? colors.onPrimaryContainer : colors.onSurface }]}
            >
              {player.name}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: checked ? colors.onPrimaryContainer : colors.onSurfaceVariant }}
              numberOfLines={1}
            >
              {isSelf ? 'You (always included)' : player.email ?? 'No email on file'}
            </Text>
          </View>
          <View
            style={[
              styles.check,
              checked
                ? { backgroundColor: isSelf ? colors.outline : colors.primary, borderColor: 'transparent' }
                : { borderColor: colors.outline },
            ]}
          >
            {checked ? <Icon source={isSelf ? 'lock' : 'check'} size={16} color={colors.onPrimary} /> : null}
          </View>
        </View>
      </TouchableRipple>
    );
  };

  const gameSetup = (
    <SectionCard title="Game type" icon="cards-outline">
      <View style={styles.typeRow} accessibilityRole="radiogroup">
        {GAME_TYPES.map((option) => {
          const selected = gameType === option.value;
          const tint = gameTypes[option.value];
          return (
            <View
              key={option.value}
              style={[
                styles.typeTile,
                {
                  backgroundColor: selected ? tint.container : colors.surface,
                  borderColor: selected ? tint.accent : colors.outlineVariant,
                  borderWidth: selected ? 2 : 1,
                },
              ]}
            >
              <TouchableRipple
                onPress={() => setGameType(option.value)}
                borderless
                style={styles.typeRipple}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ checked: selected }}
              >
                <View style={[styles.typeInner, isShort && styles.typeInnerCompact]}>
                  <Icon source={option.icon} size={24} color={selected ? tint.on : colors.onSurfaceVariant} />
                  <Text
                    variant="titleMedium"
                    style={[styles.typeLabel, { color: selected ? tint.on : colors.onSurface }]}
                  >
                    {option.label}
                  </Text>
                  {selected ? (
                    <View style={styles.typeCheck}>
                      <Icon source="check-circle" size={18} color={tint.accent} />
                    </View>
                  ) : null}
                </View>
              </TouchableRipple>
            </View>
          );
        })}
      </View>

      <View style={[styles.expenseBox, { backgroundColor: colors.surfaceVariant }]}>
        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text variant="bodyLarge" style={styles.settingTitle}>
              Add expense to each round
            </Text>
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
              Charges the table a fixed amount every round.
            </Text>
          </View>
          <Switch
            value={expenseEnabled}
            onValueChange={setExpenseEnabled}
            accessibilityLabel="Add expense to each round"
          />
        </View>

        {expenseEnabled ? (
          <View style={styles.expenseRow}>
            <TextInput
              label="Expense per round"
              value={expenseDigits}
              onChangeText={(text) => setExpenseDigits(text.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              mode="outlined"
              maxLength={4}
              dense
              left={<TextInput.Affix text="−" />}
              style={[styles.expenseInput, { backgroundColor: colors.surface }]}
            />
            <Text variant="bodySmall" style={[styles.expenseHint, { color: colors.onSurfaceVariant }]}>
              Recorded as −{expenseDigits || '0'} on every round.
            </Text>
          </View>
        ) : null}
      </View>
    </SectionCard>
  );

  const playerPicker = (
    <SectionCard
      title="Players"
      icon="account-group-outline"
      supportingText="You are included automatically. Pick at least one other registered player."
    >
      <Searchbar
        placeholder="Search name or email"
        value={searchQuery}
        onChangeText={setSearchQuery}
        mode="bar"
        style={[styles.search, { backgroundColor: colors.surfaceVariant }]}
        inputStyle={styles.searchInput}
      />

      <View style={styles.playerList}>
        {currentUserId
          ? renderPlayerRow(
              { id: currentUserId, name: currentUserName, role: 'player' } as Player,
              true,
            )
          : null}

        {otherPlayers.map((player) => renderPlayerRow(player, false))}
      </View>

      {otherPlayers.length === 0 ? (
        <EmptyState
          icon="account-search-outline"
          title={searchQuery.trim() ? 'No matches' : 'No other players yet'}
          message={
            searchQuery.trim()
              ? `Nobody matches “${searchQuery}”.`
              : 'Ask a friend to sign up, then invite them from Find players.'
          }
          actionLabel={searchQuery.trim() ? undefined : 'Find players'}
          onAction={searchQuery.trim() ? undefined : () => router.push('/(screens)/players/new')}
        />
      ) : null}
    </SectionCard>
  );

  const selectedCount = selectedPlayers.length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingLeft: gutterLeft, paddingRight: gutterRight, paddingTop: isShort ? spacing.md : spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {isWide ? (
          <View style={styles.columns}>
            <View style={styles.sideColumn}>{gameSetup}</View>
            <View style={styles.mainColumn}>{playerPicker}</View>
          </View>
        ) : (
          <View style={styles.stack}>
            {gameSetup}
            {playerPicker}
          </View>
        )}
      </ScrollView>

      <BottomBar fullWidth={isWide}>
        <View style={styles.selectedSummary}>
          <Text variant="titleMedium" style={styles.selectedCount}>
            {selectedCount}
          </Text>
          <Text variant="labelMedium" style={{ color: colors.onSurfaceVariant }} numberOfLines={1}>
            {selectedCount === 1 ? 'player' : 'players'}
          </Text>
        </View>
        <Button
          mode="contained"
          onPress={startGame}
          disabled={selectedCount < 2 || creating}
          loading={creating}
          icon="play"
          contentStyle={isShort ? styles.startButtonContentCompact : styles.startButtonContent}
          labelStyle={styles.startButtonLabel}
          style={styles.startButton}
        >
          Start game
        </Button>
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  stack: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    gap: spacing.lg,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  sideColumn: {
    flex: 2,
    minWidth: 0,
  },
  mainColumn: {
    flex: 3,
    minWidth: 0,
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeTile: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  typeRipple: {
    borderRadius: radius.lg,
  },
  typeInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 84,
    padding: spacing.md,
  },
  typeInnerCompact: {
    minHeight: 64,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeLabel: {
    fontWeight: '800',
  },
  typeCheck: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  expenseBox: {
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: MIN_TOUCH_TARGET,
  },
  settingText: {
    flex: 1,
    gap: 2,
  },
  settingTitle: {
    fontWeight: '600',
  },
  search: {
    borderRadius: radius.full,
  },
  searchInput: {
    minHeight: 0,
  },
  expenseRow: {
    gap: spacing.xs,
  },
  expenseInput: {
    maxWidth: 200,
  },
  expenseHint: {
    lineHeight: 18,
  },
  playerList: {
    gap: spacing.xs,
    marginHorizontal: -spacing.sm,
  },
  playerRow: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  playerRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingVertical: spacing.xs,
  },
  playerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  playerName: {
    fontWeight: '600',
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedSummary: {
    flex: 1,
    minWidth: 0,
  },
  selectedCount: {
    fontWeight: '800',
    lineHeight: 22,
  },
  startButton: {
    flex: 2,
    borderRadius: radius.full,
  },
  startButtonContent: {
    height: 52,
  },
  startButtonContentCompact: {
    height: MIN_TOUCH_TARGET,
  },
  startButtonLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
});

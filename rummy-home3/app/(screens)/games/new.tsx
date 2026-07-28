import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  Divider,
  SegmentedButtons,
  Switch,
  Searchbar,
  Text,
  TextInput,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
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
import { gameTypeColors, MIN_TOUCH_TARGET, radius, spacing } from '../../../constants/theme';

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

export default function NewGame() {
  const theme = useTheme();
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

    return (
      <TouchableRipple
        key={player.id}
        onPress={isSelf ? undefined : () => togglePlayerSelection(player.id)}
        disabled={isSelf}
        style={styles.playerRow}
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled: isSelf }}
      >
        <View style={styles.playerRowInner}>
          <Avatar.Text
            size={40}
            label={getInitials(player.name)}
            style={{
              backgroundColor: checked ? theme.colors.primaryContainer : theme.colors.surfaceVariant,
            }}
            color={checked ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant}
          />
          <View style={styles.playerText}>
            <Text variant="bodyLarge" numberOfLines={1}>
              {player.name}
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
              numberOfLines={1}
            >
              {isSelf ? 'You (always included)' : player.email ?? 'No email on file'}
            </Text>
          </View>
          <Checkbox.Android
            status={checked ? 'checked' : 'unchecked'}
            disabled={isSelf}
            onPress={isSelf ? undefined : () => togglePlayerSelection(player.id)}
          />
        </View>
      </TouchableRipple>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <SectionCard title="Game type">
          <SegmentedButtons
            value={gameType}
            onValueChange={(value) => setGameType(value as 'stake' | 'pool')}
            buttons={[
              {
                value: 'stake',
                label: 'Stake',
                icon: 'cash-multiple',
                checkedColor: gameTypeColors.stake.on,
                style: gameType === 'stake' ? { backgroundColor: gameTypeColors.stake.container } : undefined,
              },
              {
                value: 'pool',
                label: 'Pool',
                icon: 'trophy-outline',
                checkedColor: gameTypeColors.pool.on,
                style: gameType === 'pool' ? { backgroundColor: gameTypeColors.pool.container } : undefined,
              },
            ]}
          />

          <Divider />

          <View style={styles.settingRow}>
            <View style={styles.settingText}>
              <Text variant="bodyLarge">Add expense to each round</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Charges the table a fixed amount every round.
              </Text>
            </View>
            <Switch value={expenseEnabled} onValueChange={setExpenseEnabled} />
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
                left={<TextInput.Affix text="−" />}
                style={styles.expenseInput}
              />
              <Text variant="bodySmall" style={[styles.expenseHint, { color: theme.colors.onSurfaceVariant }]}>
                Recorded as −{expenseDigits || '0'} on every round.
              </Text>
            </View>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Players"
          supportingText="You are included automatically. Pick at least one other registered player."
        >
          <Searchbar
            placeholder="Search name or email"
            value={searchQuery}
            onChangeText={setSearchQuery}
            mode="bar"
            style={{ backgroundColor: theme.colors.surfaceVariant, borderRadius: radius.full }}
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
                  : 'Ask a friend to sign up, then invite them from Find Players.'
              }
              actionLabel={searchQuery.trim() ? undefined : 'Find Players'}
              onAction={searchQuery.trim() ? undefined : () => router.push('/(screens)/players/new')}
            />
          ) : null}
        </SectionCard>
      </ScrollView>

      <Card
        mode="contained"
        style={[styles.bottomBar, { backgroundColor: theme.colors.elevation.level2 }]}
      >
        <View style={styles.bottomBarInner}>
          <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            {selectedPlayers.length} selected
          </Text>
          <Button
            mode="contained"
            onPress={startGame}
            disabled={selectedPlayers.length < 2 || creating}
            loading={creating}
            icon="play"
            contentStyle={styles.startButtonContent}
            labelStyle={styles.startButtonLabel}
            style={styles.startButton}
          >
            Start Game
          </Button>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    minHeight: MIN_TOUCH_TARGET,
  },
  settingText: {
    flex: 1,
    gap: 2,
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
    marginHorizontal: -spacing.sm,
  },
  playerRow: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  playerRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: 64,
    paddingVertical: spacing.sm,
  },
  playerText: {
    flex: 1,
    gap: 2,
  },
  bottomBar: {
    borderRadius: 0,
  },
  bottomBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  startButton: {
    minWidth: 160,
  },
  startButtonContent: {
    height: 52,
  },
  startButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});

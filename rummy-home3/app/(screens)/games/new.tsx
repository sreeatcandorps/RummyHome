import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, Text, Checkbox, List, SegmentedButtons, Switch, Searchbar } from 'react-native-paper';
import { router } from 'expo-router';
import { storage } from '../../../utils/storage';
import { Player } from '../../../types/player';
import { gamesService } from '../../../services/games';
import { authService } from '../../../services/auth';
import { playersService } from '../../../services/players';
import { isSupabaseConfigured } from '../../../services/supabase';
import { formatSupabaseError } from '../../../utils/supabaseErrors';

export default function NewGame() {
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [gameType, setGameType] = useState<'stake' | 'pool'>('stake');
  const [expenseEnabled, setExpenseEnabled] = useState(true);
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

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>New Game</Text>

      <SegmentedButtons
        value={gameType}
        onValueChange={(value) => setGameType(value as 'stake' | 'pool')}
        buttons={[
          { value: 'stake', label: 'Stake Game' },
          { value: 'pool', label: 'Pool Game' },
        ]}
        style={styles.gameTypeSelector}
      />

      <View style={styles.settingRow}>
        <Text variant="bodyLarge">Expense Enabled</Text>
        <Switch value={expenseEnabled} onValueChange={setExpenseEnabled} />
      </View>

      <Text variant="titleMedium" style={styles.subtitle}>Select Players</Text>
      <Text variant="bodySmall" style={styles.hint}>
        You are included automatically. Pick at least one other registered player.
      </Text>

      <Searchbar
        placeholder="Search by name or email"
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.search}
      />

      <ScrollView style={styles.playerList}>
        {currentUserId ? (
          <List.Item
            title={availablePlayers.find((p) => p.id === currentUserId)?.name ?? 'You'}
            description="You (required)"
            left={() => <Checkbox status="checked" disabled />}
          />
        ) : null}

        {otherPlayers.map((player) => (
          <List.Item
            key={player.id}
            title={player.name}
            description={player.email}
            left={() => (
              <Checkbox
                status={selectedPlayers.includes(player.id) ? 'checked' : 'unchecked'}
                onPress={() => togglePlayerSelection(player.id)}
              />
            )}
            onPress={() => togglePlayerSelection(player.id)}
          />
        ))}

        {otherPlayers.length === 0 ? (
          <Text style={styles.empty}>
            {searchQuery.trim()
              ? `No players match “${searchQuery}”.`
              : 'No other registered players yet. Ask a friend to sign up, or use player1/player2 test accounts.'}
          </Text>
        ) : null}
      </ScrollView>

      <Button
        mode="contained"
        onPress={startGame}
        disabled={selectedPlayers.length < 2 || creating}
        loading={creating}
        style={styles.button}
      >
        Start Game ({selectedPlayers.length} players)
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 16,
    marginBottom: 4,
  },
  hint: {
    marginBottom: 8,
    color: '#666',
  },
  search: {
    marginBottom: 8,
  },
  empty: {
    marginTop: 16,
    color: '#666',
    lineHeight: 20,
  },
  gameTypeSelector: {
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  playerList: {
    flex: 1,
    marginBottom: 16,
  },
  button: {
    marginTop: 10,
  },
});

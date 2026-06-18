import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Text, Checkbox, List, SegmentedButtons, Switch } from 'react-native-paper';
import { router } from 'expo-router';
import { storage } from '../../../utils/storage';
import { Player } from '../../../types/player';
import { gamesService } from '../../../services/games';
import { authService } from '../../../services/auth';
import { playersService } from '../../../services/players';
import { isSupabaseConfigured } from '../../../services/supabase';

export default function NewGame() {
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [gameType, setGameType] = useState<'stake' | 'pool'>('stake');
  const [expenseEnabled, setExpenseEnabled] = useState(true);

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    const players = isSupabaseConfigured
      ? await playersService.listPlayers()
      : await storage.getPlayers();
    setAvailablePlayers(players);
  };

  const togglePlayerSelection = (playerId: string) => {
    if (selectedPlayers.includes(playerId)) {
      setSelectedPlayers(selectedPlayers.filter(id => id !== playerId));
    } else {
      setSelectedPlayers([...selectedPlayers, playerId]);
    }
  };

  const startGame = async () => {
    if (selectedPlayers.length >= 2) {
      try {
        const createdBy = isSupabaseConfigured
          ? await authService.getCurrentUserId()
          : await storage.getCurrentPlayer();

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
      } catch (error) {
        console.error('Error creating game:', error);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>New Game</Text>

      <SegmentedButtons
        value={gameType}
        onValueChange={value => setGameType(value as 'stake' | 'pool')}
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
      
      <ScrollView style={styles.playerList}>
        {availablePlayers.map(player => (
          <List.Item
            key={player.id}
            title={player.name}
            left={() => (
              <Checkbox
                status={selectedPlayers.includes(player.id) ? 'checked' : 'unchecked'}
                onPress={() => togglePlayerSelection(player.id)}
              />
            )}
          />
        ))}
      </ScrollView>

      <Button 
        mode="contained" 
        onPress={startGame}
        disabled={selectedPlayers.length < 2}
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
    marginBottom: 8,
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

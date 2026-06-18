import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Portal, Modal, Text } from 'react-native-paper';
import { storage } from '../utils/storage';
import { router } from 'expo-router';
import { Player } from '../types/player';

export function DevTools() {
  const [visible, setVisible] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    const allPlayers = await storage.getPlayers();
    setPlayers(allPlayers);
  };

  const switchToPlayer = async (playerId: string) => {
    await storage.setCurrentPlayer(playerId);
    setVisible(false);
    router.replace('/(tabs)');
  };

  if (!__DEV__) return null;

  return (
    <>
      <Button
        mode="outlined"
        onPress={() => setVisible(true)}
        style={styles.devButton}
      >
        Dev: Switch Player
      </Button>

      <Portal>
        <Modal
          visible={visible}
          onDismiss={() => setVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleMedium" style={styles.title}>Switch Player (Dev Only)</Text>
          {players.map(player => (
            <Button
              key={player.id}
              mode="outlined"
              onPress={() => switchToPlayer(player.id)}
              style={styles.playerButton}
            >
              {player.name}
            </Button>
          ))}
        </Modal>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  devButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#fff',
  },
  modal: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  title: {
    marginBottom: 16,
    textAlign: 'center',
  },
  playerButton: {
    marginBottom: 8,
  },
}); 
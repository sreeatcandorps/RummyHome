import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { storage } from '../../../../utils/storage';
import { Player } from '../../../../types/player';

export default function EditPlayerScreen() {
  const { id } = useLocalSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlayer();
  }, [id]);

  const loadPlayer = async () => {
    try {
      const players = await storage.getPlayers();
      const player = players.find(p => p.id === id);
      if (player) {
        setName(player.name);
        setEmail(player.email || '');
        setPhone(player.phone || '');
      } else {
        setError('Player not found');
      }
    } catch (err) {
      setError('Failed to load player');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePlayer = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    try {
      const players = await storage.getPlayers();
      const playerIndex = players.findIndex(p => p.id === id);
      
      if (playerIndex !== -1) {
        const updatedPlayer: Player = {
          ...players[playerIndex],
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined
        };
        
        players[playerIndex] = updatedPlayer;
        await storage.savePlayers(players);
        router.back();
      }
    } catch (err) {
      setError('Failed to update player');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Edit Player
      </Text>

      <TextInput
        label="Player Name"
        value={name}
        onChangeText={(text) => {
          setName(text);
          setError('');
        }}
        mode="outlined"
        style={styles.input}
        error={!!error}
      />

      <TextInput
        label="Email (optional)"
        value={email}
        onChangeText={setEmail}
        mode="outlined"
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        label="Phone (optional)"
        value={phone}
        onChangeText={setPhone}
        mode="outlined"
        style={styles.input}
        keyboardType="phone-pad"
      />

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      <Button
        mode="contained"
        onPress={handleUpdatePlayer}
        style={styles.button}
      >
        Update Player
      </Button>

      <Button
        mode="outlined"
        onPress={() => router.back()}
        style={styles.button}
      >
        Cancel
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
  errorText: {
    color: 'red',
    marginBottom: 16,
  },
}); 
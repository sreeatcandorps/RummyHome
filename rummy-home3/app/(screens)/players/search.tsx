import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, HelperText } from 'react-native-paper';
import { router } from 'expo-router';
import { storage } from '../../../utils/storage';
import { Player } from '../../../types/player';
import { Screen } from '@/components/ui/Screen';
import { spacing } from '@/constants/theme';

export default function AddPlayerScreen() {
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerEmail, setNewPlayerEmail] = useState('');
  const [newPlayerPhone, setNewPlayerPhone] = useState('');
  const [error, setError] = useState('');

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) {
      setError('Name is required.');
      return;
    }

    const newPlayer: Player = {
      id: Date.now().toString(),
      name: newPlayerName.trim(),
      email: newPlayerEmail.trim(),
      phone: newPlayerPhone.trim(),
      gamesPlayed: 0,
      gamesWon: 0,
      role: 'player',
    };

    const existingPlayers = await storage.getPlayers();
    await storage.savePlayers([...existingPlayers, newPlayer]);
    router.back();
  };

  return (
    <Screen>
      <View style={styles.form}>
        <TextInput
          label="Player Name"
          value={newPlayerName}
          onChangeText={(value) => {
            setNewPlayerName(value);
            setError('');
          }}
          mode="outlined"
          style={styles.input}
        />
        <TextInput
          label="Email (optional)"
          value={newPlayerEmail}
          onChangeText={setNewPlayerEmail}
          mode="outlined"
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          label="Phone (optional)"
          value={newPlayerPhone}
          onChangeText={setNewPlayerPhone}
          mode="outlined"
          style={styles.input}
          keyboardType="phone-pad"
        />
        {error ? <HelperText type="error">{error}</HelperText> : null}
        <View style={styles.buttonContainer}>
          <Button mode="outlined" onPress={() => router.back()} style={styles.button}>
            Cancel
          </Button>
          <Button mode="contained" onPress={handleAddPlayer} style={styles.button}>
            Add Player
          </Button>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.sm,
  },
  input: {
    marginBottom: spacing.sm,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  button: {
    flex: 1,
  },
});

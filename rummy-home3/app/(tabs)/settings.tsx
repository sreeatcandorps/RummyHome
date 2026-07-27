import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Text, Switch, Button, TextInput, useTheme } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from '@/utils/storage';
import { authService } from '@/services/auth';
import { router } from 'expo-router';
import { Player } from '@/types/player';

interface Settings {
  winningCondition: 'lowest' | 'highest';
  maxScore: number;
  roundLimit: number;
  darkMode: boolean;
}

const SETTINGS_KEY = 'rummy_settings';

export default function Settings() {
  const theme = useTheme();
  const [settings, setSettings] = useState<Settings>({
    winningCondition: 'lowest',
    maxScore: 100,
    roundLimit: 10,
    darkMode: false,
  });
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);

  useEffect(() => {
    loadSettings();
    loadCurrentPlayer();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem(SETTINGS_KEY);
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings: Settings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const resetData = async () => {
    Alert.alert(
      'Reset Data',
      'This only clears local cache on this device. Your Supabase account and games are not deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all([
                storage.saveGames([]),
                storage.savePlayers([]),
                AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)),
              ]);
              Alert.alert('Success', 'Local cache has been reset');
            } catch (error) {
              Alert.alert('Error', 'Failed to reset data');
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    try {
      await authService.signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout');
    }
  };

  const loadCurrentPlayer = async () => {
    const player = await authService.getCurrentPlayer();
    setCurrentPlayer(player);
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.section}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Account
          </Text>

          {currentPlayer ? (
            <View style={styles.playerInfo}>
              <Text variant="bodyLarge">{currentPlayer.name}</Text>
              <Text style={styles.muted}>Role: {currentPlayer.role === 'admin' ? 'App admin' : 'Player'}</Text>
              {currentPlayer.email ? <Text style={styles.muted}>{currentPlayer.email}</Text> : null}
            </View>
          ) : null}

          <Button
            mode="outlined"
            onPress={() => router.push('/profile')}
            style={styles.button}
            icon="account"
          >
            View Profile
          </Button>

          <Button
            mode="contained"
            onPress={handleLogout}
            style={styles.button}
            buttonColor={theme.colors.error}
            icon="logout"
          >
            Logout
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.section}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Game Rules (local preferences)
          </Text>
          <Text style={styles.help}>
            These preferences are stored on this phone only. Live games currently use the stake/pool
            defaults from the game screen, not these toggles yet.
          </Text>

          <View style={styles.setting}>
            <View style={styles.settingText}>
              <Text>Lowest score wins</Text>
              <Text style={styles.muted}>
                On = typical Rummy (lowest total wins). Off = highest total wins.
              </Text>
            </View>
            <Switch
              value={settings.winningCondition === 'lowest'}
              onValueChange={(value) =>
                saveSettings({
                  ...settings,
                  winningCondition: value ? 'lowest' : 'highest',
                })
              }
            />
          </View>

          <View style={styles.setting}>
            <Text>Max Score</Text>
            <TextInput
              value={settings.maxScore.toString()}
              onChangeText={(text) =>
                saveSettings({
                  ...settings,
                  maxScore: parseInt(text) || 100,
                })
              }
              keyboardType="numeric"
              style={styles.input}
            />
          </View>

          <View style={styles.setting}>
            <Text>Round Limit</Text>
            <TextInput
              value={settings.roundLimit.toString()}
              onChangeText={(text) =>
                saveSettings({
                  ...settings,
                  roundLimit: parseInt(text) || 10,
                })
              }
              keyboardType="numeric"
              style={styles.input}
            />
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.section}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            App Settings
          </Text>

          <View style={styles.setting}>
            <View style={styles.settingText}>
              <Text>Dark Mode</Text>
              <Text style={styles.muted}>Saved locally; theme wiring comes in the UI overhaul.</Text>
            </View>
            <Switch
              value={settings.darkMode}
              onValueChange={(value) =>
                saveSettings({
                  ...settings,
                  darkMode: value,
                })
              }
            />
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.section}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Data
          </Text>

          <Button
            mode="outlined"
            onPress={resetData}
            style={styles.button}
            textColor={theme.colors.error}
            icon="delete"
          >
            Reset Local Cache
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  help: {
    color: '#666',
    marginBottom: 16,
    lineHeight: 18,
  },
  setting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  settingText: {
    flex: 1,
    paddingRight: 8,
  },
  muted: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  input: {
    width: 100,
  },
  button: {
    marginTop: 8,
  },
  playerInfo: {
    marginBottom: 12,
    gap: 2,
  },
});

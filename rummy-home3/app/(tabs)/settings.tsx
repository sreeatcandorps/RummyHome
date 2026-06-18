import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Text, Switch, Button, TextInput, Divider, useTheme } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from '@/utils/storage';
import { supabase } from '../../services/supabase';
import { router } from 'expo-router';
import { Player } from '@/types/player';
import { Game } from '@/types/game';

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
      'Are you sure you want to reset all data? This cannot be undone.',
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
              Alert.alert('Success', 'All data has been reset');
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
      await supabase.auth.signOut();
      await storage.setCurrentPlayer(null);
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout');
    }
  };

  const loadCurrentPlayer = async () => {
    const playerId = await storage.getCurrentPlayer();
    if (playerId) {
      const players = await storage.getPlayers();
      const player = players.find(p => p.id === playerId);
      setCurrentPlayer(player || null);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.section}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Account Management
          </Text>
          
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
            textColor="red"
            icon="logout"
          >
            Logout
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.section}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Game Rules
          </Text>
          
          <View style={styles.setting}>
            <Text>Winning Condition</Text>
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
            <Text>Dark Mode</Text>
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
            Data Management
          </Text>
          
          <Button 
            mode="outlined"
            onPress={resetData}
            style={styles.button}
            textColor="red"
            icon="delete"
          >
            Reset All Data
          </Button>
        </Card.Content>
      </Card>

      <Button 
        mode="contained" 
        onPress={async () => {
          const adminPlayer = {
            id: 'admin-id',
            name: 'Admin',
            email: 'admin@test.com',
            role: 'admin' as const,
            gamesPlayed: 0,
            gamesWon: 0
          };
          await storage.savePlayers([adminPlayer]);
          await storage.setCurrentPlayer(adminPlayer.id);
          alert('Admin account created - please restart the app');
        }}
        style={styles.button}
      >
        Restore Admin Account
      </Button>

      <Button 
        mode="contained" 
        onPress={async () => {
          const currentPlayer = await storage.getCurrentPlayer();
          const players = await storage.getPlayers();
          alert(`Current Player: ${currentPlayer}\nTotal Players: ${players.length}`);
        }}
        style={[styles.button, { marginTop: 8 }]}
      >
        Check Current State
      </Button>

      {currentPlayer && (
        <View style={styles.playerInfo}>
          <Text>Current Player: {currentPlayer.name}</Text>
          <Text>Role: {currentPlayer.role}</Text>
          <Text>Email: {currentPlayer.email}</Text>
        </View>
      )}

      {currentPlayer?.role === 'admin' && (
        <Card style={styles.section}>
          <Card.Content>
            <Text variant="titleMedium">Admin Actions</Text>
            <Button 
              mode="contained" 
              onPress={async () => {
                await storage.saveGames([]);
                alert('Games cleared - start fresh');
              }}
              style={styles.button}
            >
              Clear Games
            </Button>
          </Card.Content>
        </Card>
      )}
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
    marginBottom: 16,
  },
  setting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  input: {
    width: 100,
  },
  button: {
    marginTop: 8,
    marginBottom: 16,
  },
  playerInfo: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
});

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Avatar, Button, Divider, List, Text, Switch, TextInput, useTheme } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from '@/utils/storage';
import { authService } from '@/services/auth';
import { router } from 'expo-router';
import { Player } from '@/types/player';
import { Screen } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { MIN_TOUCH_TARGET, radius, spacing } from '@/constants/theme';

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

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);

  return (
    <Screen>
      <SectionCard title="Account">
        {currentPlayer ? (
          <View style={styles.identityRow}>
            <Avatar.Text
              size={48}
              label={getInitials(currentPlayer.name)}
              style={{
                backgroundColor:
                  currentPlayer.role === 'admin' ? theme.colors.error : theme.colors.primary,
              }}
            />
            <View style={styles.identityText}>
              <Text variant="titleMedium" numberOfLines={1}>
                {currentPlayer.name}
              </Text>
              {currentPlayer.email ? (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
                  {currentPlayer.email}
                </Text>
              ) : null}
              <Text variant="labelSmall" style={{ color: theme.colors.primary }}>
                {currentPlayer.role === 'admin' ? 'App admin' : 'Player'}
              </Text>
            </View>
          </View>
        ) : null}

        <Divider />

        <List.Item
          title="View profile"
          description="Stats, contact details, and passcode"
          left={(props) => <List.Icon {...props} icon="account-circle-outline" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/profile')}
          style={styles.listItem}
        />

        <Button
          mode="contained"
          onPress={handleLogout}
          buttonColor={theme.colors.errorContainer}
          textColor={theme.colors.onErrorContainer}
          icon="logout"
          contentStyle={styles.buttonContent}
        >
          Log out
        </Button>
      </SectionCard>

      <SectionCard
        title="Game rules"
        supportingText="Stored on this phone only. Live games still use the stake/pool defaults from the game screen."
      >
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text variant="bodyLarge">Lowest score wins</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
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

        <Divider />

        <View style={styles.fieldRow}>
          <View style={styles.switchText}>
            <Text variant="bodyLarge">Max score</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Elimination threshold for pool games.
            </Text>
          </View>
          <TextInput
            value={settings.maxScore.toString()}
            onChangeText={(text) =>
              saveSettings({
                ...settings,
                maxScore: parseInt(text) || 100,
              })
            }
            keyboardType="numeric"
            mode="outlined"
            dense
            style={styles.numberInput}
          />
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.switchText}>
            <Text variant="bodyLarge">Round limit</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Maximum rounds before a game auto-closes.
            </Text>
          </View>
          <TextInput
            value={settings.roundLimit.toString()}
            onChangeText={(text) =>
              saveSettings({
                ...settings,
                roundLimit: parseInt(text) || 10,
              })
            }
            keyboardType="numeric"
            mode="outlined"
            dense
            style={styles.numberInput}
          />
        </View>
      </SectionCard>

      <SectionCard title="Appearance">
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text variant="bodyLarge">Dark mode</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Saved locally; full theme switching is still coming.
            </Text>
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
      </SectionCard>

      <SectionCard
        title="Data"
        supportingText="Clears cached games and players on this device only."
        mode="outlined"
      >
        <Button
          mode="outlined"
          onPress={resetData}
          textColor={theme.colors.error}
          icon="delete-outline"
          contentStyle={styles.buttonContent}
          style={{ borderColor: theme.colors.error }}
        >
          Reset local cache
        </Button>
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  listItem: {
    paddingHorizontal: 0,
    minHeight: MIN_TOUCH_TARGET + spacing.md,
    borderRadius: radius.sm,
  },
  buttonContent: {
    height: MIN_TOUCH_TARGET,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    minHeight: MIN_TOUCH_TARGET,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    minHeight: MIN_TOUCH_TARGET,
  },
  switchText: {
    flex: 1,
    gap: 2,
  },
  numberInput: {
    width: 96,
  },
});

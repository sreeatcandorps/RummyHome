import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Button, Divider, Text, Switch, TextInput } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from '@/utils/storage';
import { authService } from '@/services/auth';
import { router } from 'expo-router';
import { Player } from '@/types/player';
import { Screen } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { ListRow } from '@/components/ui/ListRow';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { Tag } from '@/components/ui/Tag';
import { MIN_TOUCH_TARGET, spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { usePreferences } from '@/contexts/PreferencesContext';

interface Settings {
  winningCondition: 'lowest' | 'highest';
  maxScore: number;
  roundLimit: number;
  darkMode: boolean;
}

const SETTINGS_KEY = 'rummy_settings';

export default function Settings() {
  const { colors } = useAppTheme();
  const { isWide } = useLayout();
  const { setDarkMode } = usePreferences();
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

  const account = (
    <SectionCard title="Account" icon="account-outline">
      {currentPlayer ? (
        <View style={styles.identityRow}>
          <SeatAvatar
            name={currentPlayer.name}
            size={56}
            color={currentPlayer.role === 'admin' ? colors.error : colors.primary}
          />
          <View style={styles.identityText}>
            <Text variant="titleMedium" style={styles.identityName} numberOfLines={1}>
              {currentPlayer.name}
            </Text>
            {currentPlayer.email ? (
              <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }} numberOfLines={1}>
                {currentPlayer.email}
              </Text>
            ) : null}
            <Tag
              label={currentPlayer.role === 'admin' ? 'App admin' : 'Player'}
              tone={currentPlayer.role === 'admin' ? 'danger' : 'primary'}
              style={styles.roleTag}
            />
          </View>
        </View>
      ) : null}

      <Divider />

      <ListRow
        title="View profile"
        description="Stats, contact details, and passcode"
        icon="account-circle-outline"
        onPress={() => router.push('/profile')}
      />
      <ListRow title="Log out" icon="logout" tone="danger" onPress={handleLogout} right={<View />} />
    </SectionCard>
  );

  const appearance = (
    <SectionCard title="Appearance" icon="palette-outline">
      <ListRow
        title="Dark mode"
        description="Easier on the eyes at night. Saved on this phone."
        icon="weather-night"
        right={
          <Switch
            value={settings.darkMode}
            accessibilityLabel="Dark mode"
            onValueChange={(value) => {
              setDarkMode(value);
              saveSettings({
                ...settings,
                darkMode: value,
              });
            }}
          />
        }
      />
    </SectionCard>
  );

  const rules = (
    <SectionCard
      title="Game rules"
      icon="cards-outline"
      supportingText="Stored on this phone only. Live games still use the stake/pool defaults from the game screen."
    >
      <ListRow
        title="Lowest score wins"
        description="On = typical Rummy (lowest total wins). Off = highest total wins."
        icon="sort-numeric-ascending"
        right={
          <Switch
            value={settings.winningCondition === 'lowest'}
            accessibilityLabel="Lowest score wins"
            onValueChange={(value) =>
              saveSettings({
                ...settings,
                winningCondition: value ? 'lowest' : 'highest',
              })
            }
          />
        }
      />

      <Divider />

      <ListRow
        title="Max score"
        description="Elimination threshold for pool games."
        icon="flag-outline"
        right={
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
            accessibilityLabel="Max score"
            style={styles.numberInput}
          />
        }
      />

      <ListRow
        title="Round limit"
        description="Maximum rounds before a game auto-closes."
        icon="counter"
        right={
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
            accessibilityLabel="Round limit"
            style={styles.numberInput}
          />
        }
      />
    </SectionCard>
  );

  const data = (
    <SectionCard
      title="Data"
      icon="database-outline"
      supportingText="Clears cached games and players on this device only."
      mode="outlined"
    >
      <Button
        mode="outlined"
        onPress={resetData}
        textColor={colors.error}
        icon="delete-outline"
        contentStyle={styles.buttonContent}
        style={{ borderColor: colors.error }}
      >
        Reset local cache
      </Button>
    </SectionCard>
  );

  return (
    <Screen safeBottom={false}>
      {isWide ? (
        <View style={styles.columns}>
          <View style={styles.column}>
            {account}
            {appearance}
          </View>
          <View style={styles.column}>
            {rules}
            {data}
          </View>
        </View>
      ) : (
        <>
          {account}
          {appearance}
          {rules}
          {data}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  column: {
    flex: 1,
    minWidth: 0,
    gap: spacing.lg,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  identityText: {
    flex: 1,
    gap: 2,
    alignItems: 'flex-start',
  },
  identityName: {
    fontWeight: '700',
  },
  roleTag: {
    marginTop: spacing.xs,
  },
  buttonContent: {
    height: MIN_TOUCH_TARGET,
  },
  numberInput: {
    width: 88,
  },
});

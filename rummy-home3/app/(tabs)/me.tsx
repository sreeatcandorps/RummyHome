import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, Switch, Text, TextInput } from 'react-native-paper';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { Player } from '@/types/player';
import { authService } from '@/services/auth';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { storage } from '@/utils/storage';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { isAdminEmail } from '@/utils/adminAccess';
import { sharePlayerId } from '@/utils/invite';
import { authRedirectUrl } from '@/utils/authRedirect';
import { clearDemoData, loadDemoData } from '@/services/demoSeed';
import { Screen } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { usePreferences } from '@/contexts/PreferencesContext';
import { spacing, useAppTheme } from '@/constants/theme';

export default function MeScreen() {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const { darkMode, setDarkMode } = usePreferences();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [demoBusy, setDemoBusy] = useState<null | 'load' | 'clear'>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const current = await authService.getCurrentPlayer();
      if (!current) {
        setPlayer(null);
        setError('Not signed in.');
        return;
      }
      setPlayer(current);
      setName(current.name);
      setPhone(current.phone ?? '');
      let email = current.email ?? null;
      if (isSupabaseConfigured) {
        const { data } = await supabase.auth.getSession();
        email = data.session?.user.email ?? email;
      }
      setShowDemo(isAdminEmail(email));
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: 'Me' });
  }, [navigation]);

  const saveName = async () => {
    if (!player) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      if (isSupabaseConfigured) {
        const parts = trimmed.split(/\s+/);
        await authService.updateProfile({
          displayName: trimmed,
          firstName: parts[0],
          lastName: parts.slice(1).join(' '),
          phone: phone.trim() || undefined,
        });
      } else {
        const players = await storage.getPlayers();
        await storage.savePlayers(players.map((item) => (
          item.id === player.id ? { ...item, name: trimmed, phone: phone.trim() || undefined } : item
        )));
      }
      setEditing(false);
      await load();
    } catch (err) {
      Alert.alert('Couldn’t save', formatSupabaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const changePasscode = async () => {
    const email = player?.email;
    if (!email || !isSupabaseConfigured) {
      setNotice('Sign in with an account to email yourself a reset link.');
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() });
    if (resetError) setNotice(resetError.message);
    else setNotice('Check your email. We sent a link to set a new 6-digit code.');
  };

  const logout = async () => {
    try {
      if (isSupabaseConfigured) await authService.signOut();
      else await storage.setCurrentPlayer(null);
      router.replace('/(auth)/login');
    } catch (err) {
      Alert.alert('Couldn’t log out', formatSupabaseError(err));
    }
  };

  const runDemo = async (action: 'load' | 'clear') => {
    setDemoBusy(action);
    try {
      if (action === 'load') {
        const result = await loadDemoData();
        Alert.alert('Demo data loaded', `${result.hostName} is in the sample games.`);
      } else {
        await clearDemoData();
        Alert.alert('Demo data cleared', 'Sample players and games were removed.');
      }
    } catch (err) {
      Alert.alert('Demo data failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setDemoBusy(null);
    }
  };

  if (loading && !player) {
    return <Screen><LoadingRows /></Screen>;
  }

  if (!player) {
    return (
      <Screen>
        <EmptyState
          icon="account-alert-outline"
          title="Couldn’t load your profile"
          message={error ?? 'Try again.'}
          actionLabel="Retry"
          onAction={() => { setLoading(true); load(); }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      {error ? <Text variant="bodyMedium" style={{ color: colors.error }}>{error}</Text> : null}
      <View style={styles.identity}>
        <SeatAvatar name={player.name} size={56} />
        <View style={styles.identityText}>
          <Text variant="headlineSmall">{player.name}</Text>
          <Text variant="bodyMedium">{player.email}</Text>
          <Text variant="bodyMedium">Player ID {player.playerCode || '—'}</Text>
        </View>
      </View>
      {player.playerCode ? (
        <Button
          mode="outlined"
          icon="share-variant"
          onPress={() => sharePlayerId(player.playerCode!).catch(() => {})}
          style={styles.block}
        >
          Share
        </Button>
      ) : null}

      <SectionCard title="Name" icon="account-edit-outline">
        {editing ? (
          <View style={styles.gap}>
            <TextInput mode="outlined" label="Name" value={name} onChangeText={setName} />
            <Button mode="contained" onPress={saveName} loading={saving}>Save</Button>
          </View>
        ) : (
          <Button mode="outlined" onPress={() => setEditing(true)}>Edit</Button>
        )}
      </SectionCard>

      <SectionCard title="Phone" icon="phone-outline" supportingText="Optional. Nothing texts this number.">
        <TextInput mode="outlined" label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Button mode="text" onPress={saveName} loading={saving}>Save phone</Button>
      </SectionCard>

      <Button mode="outlined" icon="lock-reset" onPress={changePasscode} style={styles.block}>
        Change passcode
      </Button>
      {notice ? <Text variant="bodyMedium">{notice}</Text> : null}

      <View style={styles.darkRow}>
        <Text variant="titleMedium">Dark mode</Text>
        <Switch value={darkMode} onValueChange={setDarkMode} accessibilityLabel="Dark mode" />
      </View>

      {showDemo ? (
        <SectionCard title="Demo data" icon="flask-outline" supportingText="Sample players and games for this account.">
          <View style={styles.demo}>
            <Button mode="contained" loading={demoBusy === 'load'} onPress={() => runDemo('load')}>Load</Button>
            <Button mode="outlined" loading={demoBusy === 'clear'} onPress={() => runDemo('clear')}>Clear</Button>
          </View>
        </SectionCard>
      ) : null}

      <Button mode="contained" buttonColor={colors.error} onPress={logout} style={styles.block}>
        Log out
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  block: {
    marginBottom: spacing.md,
  },
  gap: {
    gap: spacing.sm,
  },
  darkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: spacing.md,
  },
  demo: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});

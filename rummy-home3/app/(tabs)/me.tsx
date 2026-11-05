import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, Icon, Switch, Text, TextInput, TouchableRipple } from 'react-native-paper';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { Player } from '@/types/player';
import { authService } from '@/services/auth';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { storage } from '@/utils/storage';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { isAdminEmail } from '@/utils/adminAccess';
import { sharePlayerId } from '@/utils/invite';
import { authRedirectUrl } from '@/utils/authRedirect';
import { normalizePhone, phoneProblem } from '@/utils/phone';
import { playerIdBadge } from '@/utils/myPlayersList';
import { clearDemoData, loadDemoData } from '@/services/demoSeed';
import { Screen } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { SettingsPriority } from '@/components/ui/SettingsPriority';
import { usePreferences } from '@/contexts/PreferencesContext';
import { radius, spacing, useAppTheme } from '@/constants/theme';

type PhoneState = { kind: 'idle' } | { kind: 'saved' } | { kind: 'error'; message: string };

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
  const [savedPhone, setSavedPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneState, setPhoneState] = useState<PhoneState>({ kind: 'idle' });
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
      setSavedPhone(current.phone ?? '');
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
    navigation.setOptions({ title: 'Profile' });
  }, [navigation]);

  const saveName = async () => {
    if (!player) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      if (isSupabaseConfigured) {
        const parts = trimmed.split(/\s+/);
        await authService.updateProfile({ displayName: trimmed, firstName: parts[0], lastName: parts.slice(1).join(' ') });
      } else {
        const players = await storage.getPlayers();
        await storage.savePlayers(players.map((item) => (item.id === player.id ? { ...item, name: trimmed } : item)));
      }
      setEditing(false);
      await load();
    } catch (err) {
      Alert.alert('Couldn’t save', formatSupabaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const savePhone = async () => {
    if (!player) return;
    const problem = phoneProblem(phone);
    if (problem) {
      setPhoneState({ kind: 'error', message: problem });
      return;
    }
    const clean = normalizePhone(phone);
    setSavingPhone(true);
    setPhoneState({ kind: 'idle' });
    try {
      if (isSupabaseConfigured) {
        const stored = await authService.updatePhone(clean || null);
        setPhone(stored ?? '');
        setSavedPhone(stored ?? '');
      } else {
        const players = await storage.getPlayers();
        await storage.savePlayers(players.map((item) => (item.id === player.id ? { ...item, phone: clean || undefined } : item)));
        setPhone(clean);
        setSavedPhone(clean);
      }
      setPhoneState({ kind: 'saved' });
    } catch (err) {
      setPhoneState({ kind: 'error', message: formatSupabaseError(err) });
    } finally {
      setSavingPhone(false);
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

  const phoneDirty = normalizePhone(phone) !== normalizePhone(savedPhone);
  const badge = playerIdBadge(player);

  return (
    <Screen contentStyle={styles.content}>
      {error ? <Text variant="bodyMedium" style={{ color: colors.error }}>{error}</Text> : null}

      <View style={[styles.identityCard, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
        <View style={styles.identity}>
          <SeatAvatar name={player.name} size={56} />
          <View style={styles.identityText}>
            {editing ? (
              <TextInput
                mode="outlined"
                dense
                label="Name"
                value={name}
                onChangeText={setName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={saveName}
                accessibilityLabel="Name"
              />
            ) : (
              <Text variant="headlineSmall" numberOfLines={1}>{player.name}</Text>
            )}
            {player.email ? <Text variant="bodySmall" numberOfLines={1} style={{ color: colors.onSurfaceVariant }}>{player.email}</Text> : null}
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{badge ?? 'Player ID pending'}</Text>
          </View>
        </View>
        <View style={styles.identityActions}>
          {editing ? (
            <>
              <Button mode="contained" icon="check" onPress={saveName} loading={saving} disabled={saving} style={styles.half} contentStyle={styles.action} accessibilityLabel="Save name">
                Save name
              </Button>
              <Button mode="outlined" onPress={() => { setEditing(false); setName(player.name); }} style={styles.half} contentStyle={styles.action} accessibilityLabel="Cancel name edit">
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button mode="contained-tonal" icon="share-variant" onPress={() => player.playerCode && sharePlayerId(player.playerCode).catch(() => {})} disabled={!player.playerCode} style={styles.half} contentStyle={styles.action} accessibilityLabel="Share your Player ID">
                Share
              </Button>
              <Button mode="outlined" icon="pencil-outline" onPress={() => setEditing(true)} style={styles.half} contentStyle={styles.action} accessibilityLabel="Edit name">
                Edit name
              </Button>
            </>
          )}
        </View>
      </View>

      <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
        <Icon source={darkMode ? 'weather-night' : 'white-balance-sunny'} size={20} color={colors.onSurfaceVariant} />
        <Text variant="titleMedium" style={styles.flex}>Dark mode</Text>
        <Switch value={darkMode} onValueChange={setDarkMode} accessibilityLabel="Dark mode" />
      </View>

      <SectionCard title="Phone" icon="phone-outline" supportingText="Optional. Never texted, never shown to other players.">
        <View style={styles.phoneRow}>
          <TextInput
            mode="outlined"
            dense
            value={phone}
            onChangeText={(value) => { setPhone(value); if (phoneState.kind !== 'idle') setPhoneState({ kind: 'idle' }); }}
            keyboardType="phone-pad"
            placeholder="Add a number"
            style={styles.flex}
            error={phoneState.kind === 'error'}
            returnKeyType="done"
            onSubmitEditing={savePhone}
            accessibilityLabel="Phone"
          />
          <Button
            mode="contained"
            onPress={savePhone}
            loading={savingPhone}
            disabled={savingPhone || !phoneDirty}
            contentStyle={styles.action}
            accessibilityLabel="Save phone"
          >
            Save
          </Button>
        </View>
        {phoneState.kind === 'saved' ? (
          <View style={styles.inline}>
            <Icon source="check-circle" size={16} color={colors.positive} />
            <Text variant="labelMedium" style={{ color: colors.positive }}>{savedPhone ? 'Phone saved.' : 'Phone cleared.'}</Text>
          </View>
        ) : null}
        {phoneState.kind === 'error' ? (
          <Text variant="labelMedium" style={{ color: colors.error }}>{phoneState.message}</Text>
        ) : null}
      </SectionCard>

      <SectionCard title="Settings" icon="cog-outline">
        <TouchableRipple
          onPress={() => router.push('/(screens)/settings')}
          style={[styles.settingsButton, { backgroundColor: colors.secondaryContainer }]}
          borderless
          accessibilityRole="button"
          accessibilityLabel="User settings: game type, Drop, Middle drop, Full count"
        >
          <View style={styles.settingsInner}>
            <Icon source="tune-variant" size={18} color={colors.onSecondaryContainer} />
            <Text variant="labelLarge" style={[styles.flex, { color: colors.onSecondaryContainer }]}>
              User settings: game type, Drop, Middle drop, Full count
            </Text>
            <Icon source="chevron-right" size={18} color={colors.onSecondaryContainer} />
          </View>
        </TouchableRipple>
        <SettingsPriority highlight="User settings" />
      </SectionCard>

      <Button mode="outlined" icon="lock-reset" onPress={changePasscode} contentStyle={styles.action}>
        Change passcode
      </Button>
      {notice ? <Text variant="bodyMedium">{notice}</Text> : null}

      {showDemo ? (
        <SectionCard title="Demo data" icon="flask-outline" supportingText="Sample players and games for this account.">
          <View style={styles.demo}>
            <Button mode="contained" loading={demoBusy === 'load'} onPress={() => runDemo('load')}>Load</Button>
            <Button mode="outlined" loading={demoBusy === 'clear'} onPress={() => runDemo('clear')}>Clear</Button>
          </View>
        </SectionCard>
      ) : null}

      <Button mode="contained" icon="logout" buttonColor={colors.error} onPress={logout} contentStyle={styles.action} accessibilityLabel="Log out">
        Log out
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  identityCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  identity: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  identityActions: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  action: { height: 44 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  flex: { flex: 1 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  settingsButton: {
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  settingsInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  demo: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});

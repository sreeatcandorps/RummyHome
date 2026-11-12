import React, { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Checkbox, Icon, Text, TextInput, TouchableRipple } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { Player } from '@/types/player';
import { authService } from '@/services/auth';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { storage } from '@/utils/storage';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { isAdminEmail } from '@/utils/adminAccess';
import { sharePlayerId } from '@/utils/invite';
import { normalizePhone, phoneProblem } from '@/utils/phone';
import { playerIdBadge } from '@/utils/myPlayersList';
import { clearDemoData, loadDemoData } from '@/services/demoSeed';
import { DEFAULT_EMAIL_PREFS, EmailPrefs, emailsService } from '@/services/emails';
import { ChangePasscodeDialog } from '@/components/auth/ChangePasscodeDialog';
import { DeleteAccountDialog } from '@/components/account/DeleteAccountDialog';
import { DELETE_ACCOUNT_DONE_BODY, DELETE_ACCOUNT_DONE_TITLE, PRIVACY_PAGE_URL } from '@/utils/accountDeletion';
import { Screen } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { usePreferences } from '@/contexts/PreferencesContext';
import { APPEARANCE_OPTIONS } from '@/utils/appearance';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { shortVersionLabel } from '@/utils/appVersion';
import { readAppVersion } from '@/utils/appVersionRuntime';

const VERSION_LABEL = shortVersionLabel(readAppVersion());

type PhoneState = { kind: 'idle' } | { kind: 'saved' } | { kind: 'error'; message: string };

export default function MeScreen() {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const { appearance, darkMode, setAppearance } = usePreferences();
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
  const [editingPhone, setEditingPhone] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [demoBusy, setDemoBusy] = useState<null | 'load' | 'clear'>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [emailPrefs, setEmailPrefs] = useState<EmailPrefs>(DEFAULT_EMAIL_PREFS);
  const [emailError, setEmailError] = useState<string | null>(null);

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
      setEmailPrefs(await emailsService.getPrefs());
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
      setEditingPhone(false);
    } catch (err) {
      setPhoneState({ kind: 'error', message: formatSupabaseError(err) });
    } finally {
      setSavingPhone(false);
    }
  };

  const toggleEmail = async (key: keyof EmailPrefs) => {
    const previous = emailPrefs;
    const next = { ...emailPrefs, [key]: !emailPrefs[key] };
    setEmailPrefs(next);
    setEmailError(null);
    try {
      setEmailPrefs(await emailsService.savePrefs(next));
    } catch (err) {
      setEmailPrefs(previous);
      setEmailError(formatSupabaseError(err));
    }
  };

  const [passcodeOpen, setPasscodeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const changePasscode = () => {
    if (!player?.email || !isSupabaseConfigured) {
      setNotice('Passcodes belong to online accounts. This build is running without the account service.');
      return;
    }
    setNotice(null);
    setPasscodeOpen(true);
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
          </View>
        </View>
        <View style={[styles.idBadge, { backgroundColor: colors.tertiaryContainer }]} accessibilityLabel={badge ? `Your ${badge}` : 'Player ID pending'}>
          <Icon source="card-account-details-outline" size={20} color={colors.onTertiaryContainer} />
          <Text variant="titleMedium" style={[styles.idText, { color: colors.onTertiaryContainer }]}>{badge ?? 'Player ID pending'}</Text>
          <Text variant="labelSmall" style={{ color: colors.onTertiaryContainer }}>Share it so friends can find you</Text>
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

      <Button mode="outlined" icon="lock-reset" onPress={changePasscode} contentStyle={styles.action} accessibilityLabel="Change passcode">
        Change passcode
      </Button>
      {notice ? <Text variant="bodyMedium">{notice}</Text> : null}

      <View style={[styles.row, styles.appearance, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
        <View style={styles.valueRow}>
          <Icon source={darkMode ? 'weather-night' : 'white-balance-sunny'} size={20} color={colors.onSurfaceVariant} />
          <Text variant="titleMedium">Appearance</Text>
        </View>
        <View style={styles.segments} accessibilityRole="radiogroup">
          {APPEARANCE_OPTIONS.map((option) => {
            const on = appearance === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setAppearance(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={option.value === 'system' ? 'Follow the phone setting' : `${option.label} mode`}
                style={[
                  styles.segment,
                  { backgroundColor: on ? colors.primary : colors.surfaceSunken, borderColor: on ? colors.primary : colors.outlineVariant },
                ]}
              >
                <Icon source={option.icon} size={18} color={on ? colors.onPrimary : colors.onSurfaceVariant} />
                <Text variant="labelLarge" style={{ color: on ? colors.onPrimary : colors.onSurface }}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <SectionCard title="Phone" icon="phone-outline" supportingText="Optional. Never texted, never shown to other players.">
        {editingPhone ? (
          <View style={styles.gap}>
            <TextInput
              mode="outlined"
              dense
              value={phone}
              onChangeText={(value) => { setPhone(value); if (phoneState.kind !== 'idle') setPhoneState({ kind: 'idle' }); }}
              keyboardType="phone-pad"
              placeholder="Add a number"
              autoFocus
              error={phoneState.kind === 'error'}
              returnKeyType="done"
              onSubmitEditing={savePhone}
              accessibilityLabel="Phone"
            />
            {phoneState.kind === 'error' ? (
              <Text variant="labelMedium" style={{ color: colors.error }}>{phoneState.message}</Text>
            ) : null}
            <View style={styles.identityActions}>
              <Button mode="contained" icon="check" onPress={savePhone} loading={savingPhone} disabled={savingPhone || !phoneDirty} style={styles.half} contentStyle={styles.action} accessibilityLabel="Save phone">
                Save phone
              </Button>
              <Button mode="outlined" onPress={() => { setEditingPhone(false); setPhone(savedPhone); setPhoneState({ kind: 'idle' }); }} style={styles.half} contentStyle={styles.action} accessibilityLabel="Cancel phone edit">
                Cancel
              </Button>
            </View>
          </View>
        ) : (
          <View style={styles.valueRow}>
            <View style={styles.flex}>
              <Text variant="titleMedium" style={{ color: savedPhone ? colors.onSurface : colors.onSurfaceVariant }}>
                {savedPhone || 'No number yet'}
              </Text>
              {phoneState.kind === 'saved' ? (
                <View style={styles.inline}>
                  <Icon source="check-circle" size={16} color={colors.win} />
                  <Text variant="labelMedium" style={{ color: colors.win }}>{savedPhone ? 'Phone saved.' : 'Phone cleared.'}</Text>
                </View>
              ) : null}
            </View>
            <Button mode="outlined" icon="pencil-outline" onPress={() => { setEditingPhone(true); setPhoneState({ kind: 'idle' }); }} contentStyle={styles.action} accessibilityLabel={savedPhone ? 'Edit phone' : 'Add phone'}>
              {savedPhone ? 'Edit' : 'Add'}
            </Button>
          </View>
        )}
      </SectionCard>

      <SectionCard title="Email" icon="email-outline" supportingText="Sent to the address you signed up with. Each email has an unsubscribe link.">
        <TouchableRipple onPress={() => toggleEmail('gameStarted')} accessibilityRole="checkbox" accessibilityState={{ checked: emailPrefs.gameStarted }} accessibilityLabel="Email me when a game starts, with the live score link">
          <View style={styles.checkRow}>
            <Checkbox status={emailPrefs.gameStarted ? 'checked' : 'unchecked'} onPress={() => toggleEmail('gameStarted')} />
            <View style={styles.flex}>
              <Text variant="bodyLarge">Game started (live link)</Text>
              <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>When a game you are in starts, with a link to follow the scores live.</Text>
            </View>
          </View>
        </TouchableRipple>
        <TouchableRipple onPress={() => toggleEmail('results')} accessibilityRole="checkbox" accessibilityState={{ checked: emailPrefs.results }} accessibilityLabel="Email me when a result I am in is saved">
          <View style={styles.checkRow}>
            <Checkbox status={emailPrefs.results ? 'checked' : 'unchecked'} onPress={() => toggleEmail('results')} />
            <View style={styles.flex}>
              <Text variant="bodyLarge">Results</Text>
              <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>When a result you are in is saved, with a link to the result page.</Text>
            </View>
          </View>
        </TouchableRipple>
        {emailError ? <Text variant="bodySmall" style={{ color: colors.error }}>{emailError}</Text> : null}
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
      </SectionCard>

      <ChangePasscodeDialog
        visible={passcodeOpen}
        email={player?.email ?? ''}
        onDismiss={() => setPasscodeOpen(false)}
        onChanged={() => {
          setPasscodeOpen(false);
          setNotice('Passcode changed. Use the new 6 digits next time you sign in.');
        }}
      />

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

      <SectionCard title="Account" icon="shield-account-outline" supportingText="Your data: email, name, Player ID, phone if you added one, and the games you play.">
        <View style={styles.gap}>
          <Button mode="outlined" icon="file-document-outline" onPress={() => Linking.openURL(PRIVACY_PAGE_URL).catch(() => {})} contentStyle={styles.action} accessibilityLabel="Privacy policy">
            Privacy policy
          </Button>
          <Button mode="outlined" icon="account-remove-outline" textColor={colors.error} onPress={() => setDeleteOpen(true)} style={{ borderColor: colors.error }} contentStyle={styles.action} accessibilityLabel="Delete account" testID="delete-account">
            Delete account
          </Button>
        </View>
      </SectionCard>

      {VERSION_LABEL ? (
        <Text variant="labelSmall" style={[styles.version, { color: colors.onSurfaceVariant }]} accessibilityLabel={`App version ${VERSION_LABEL}`}>
          {`EZ Score ${VERSION_LABEL}`}
        </Text>
      ) : null}

      <DeleteAccountDialog
        visible={deleteOpen}
        onDismiss={() => setDeleteOpen(false)}
        onDeleted={() => {
          setDeleteOpen(false);
          router.replace('/(auth)/login');
          Alert.alert(DELETE_ACCOUNT_DONE_TITLE, DELETE_ACCOUNT_DONE_BODY);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  version: { textAlign: 'center', paddingVertical: spacing.sm },
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
  appearance: { flexDirection: 'column', alignItems: 'stretch', gap: spacing.sm, paddingVertical: spacing.sm },
  segments: { flexDirection: 'row', gap: spacing.sm },
  segment: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gap: { gap: spacing.sm },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  idBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    flexWrap: 'wrap',
  },
  idText: { fontWeight: '800' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  settingsButton: {
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
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

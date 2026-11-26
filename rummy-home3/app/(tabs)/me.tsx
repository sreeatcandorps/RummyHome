import React, { useCallback, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { NoticeDialog } from '@/components/ui/NoticeDialog';
import { Icon, Portal, Text } from 'react-native-paper';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { Player } from '@/types/player';
import { authService, readSignInMethods, SignInMethods } from '@/services/auth';
import { loadSignInDefaults } from '@/services/deviceCountry';
import { SignInMethodDialog } from '@/components/account/SignInMethodDialog';
import { DEFAULT_WHATSAPP_COUNTRY, formatWhatsAppNumber, WhatsAppCountry, whatsAppCountry } from '@/utils/countries';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { storage } from '@/utils/storage';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { isAdminEmail } from '@/utils/adminAccess';
import { sharePlayerId } from '@/utils/invite';
import { normalizePhone, phoneProblem } from '@/utils/phone';
import { playerIdBadge } from '@/utils/myPlayersList';
import { playersService } from '@/services/players';
import { assignInitials, defaultInitials } from '@/utils/initials';
import { InitialsDialog } from '@/components/players/InitialsDialog';
import { clearDemoData, loadDemoData } from '@/services/demoSeed';
import { DEFAULT_EMAIL_PREFS, EmailPrefs, emailsService } from '@/services/emails';
import { ChangePasscodeDialog } from '@/components/auth/ChangePasscodeDialog';
import { DeleteAccountDialog } from '@/components/account/DeleteAccountDialog';
import { EditFieldDialog } from '@/components/account/EditFieldDialog';
import { EmailPrefsDialog } from '@/components/account/EmailPrefsDialog';
import { emailPrefsSummary } from '@/utils/emailPrefs';
import { DELETE_ACCOUNT_DONE_BODY, DELETE_ACCOUNT_DONE_TITLE, PRIVACY_PAGE_URL } from '@/utils/accountDeletion';
import { Screen } from '@/components/ui/Screen';
import { ListRow } from '@/components/ui/ListRow';
import { SegmentedChoice } from '@/components/ui/SegmentedChoice';
import { SettingsGroup } from '@/components/ui/SettingsGroup';
import { HELP_INDEX_TITLE } from '@/constants/helpTopics';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { usePreferences } from '@/contexts/PreferencesContext';
import { APPEARANCE_OPTIONS } from '@/utils/appearance';
import { userSettingsService } from '@/services/userSettings';
import { PointsRules } from '@/utils/gameSettings';
import { spacing, useAppTheme } from '@/constants/theme';
import { shortVersionLabel } from '@/utils/appVersion';
import { appVariantLabel, readAppVersion } from '@/utils/appVersionRuntime';

const VERSION_LABEL = [shortVersionLabel(readAppVersion()), appVariantLabel()].filter(Boolean).join(' · ');

type PhoneState = { kind: 'idle' } | { kind: 'saved' } | { kind: 'error'; message: string };

/** The Game defaults row's value: "Points · −10 · −30 · −80" — the kind a new game starts as and its three scores. */
export function defaultsSummary(startsAs: 'points' | 'pool', rules: PointsRules): string {
  const n = (v: number) => String(v).replace('-', '\u2212');
  return `${startsAs === 'pool' ? 'Pool' : 'Points'} · ${n(rules.drop)} · ${n(rules.middleDrop)} · ${n(rules.fullCount)}`;
}

/** Group headings, top to bottom (design-review-2 §10.1; Sign-in methods from the WhatsApp spec §8(d)). */
export const PROFILE_GROUPS = ['Sign-in methods', 'Your table', 'Notifications', 'Game defaults', 'Appearance', 'Help', 'Account'] as const;

/** The line under Sign-in methods (`wa-profile.png`). */
export function signInMethodsNote(methods: Pick<SignInMethods, 'email' | 'phone'>): string {
  if (methods.email && methods.phone) return 'Either one signs you in with the same passcode. Only you see these.';
  if (methods.phone) return 'If you lose this number, a backup email is the way back in.';
  return 'If you lose this email, a backup WhatsApp number is the way back in.';
}

export default function MeScreen() {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const { appearance, setAppearance } = usePreferences();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Size-S (D66): Name and Phone edit in a sheet off their row, not inline.
  const [editing, setEditing] = useState<null | 'name' | 'phone' | 'email'>(null);
  const [savedPhone, setSavedPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneState, setPhoneState] = useState<PhoneState>({ kind: 'idle' });
  const [defaults, setDefaults] = useState<string | null>(null);
  const [showDemo, setShowDemo] = useState(false);
  const [demoBusy, setDemoBusy] = useState<null | 'load' | 'clear'>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // A09: pop-up notices are Paper dialogs, never Alert.alert. `then` runs after OK (account deleted → sign-in).
  const [popup, setPopup] = useState<{ title: string; message: string; icon?: string; then?: () => void } | null>(null);
  const [emailPrefs, setEmailPrefs] = useState<EmailPrefs>(DEFAULT_EMAIL_PREFS);
  const [emailError, setEmailError] = useState<string | null>(null);
  // Your initials (040, Q10.5): the letters you are on every scorecard you create.
  const [editingInitials, setEditingInitials] = useState(false);
  const [savingInitials, setSavingInitials] = useState(false);
  const [initialsError, setInitialsError] = useState<string | null>(null);
  const [takenInitials, setTakenInitials] = useState<Map<string, string>>(new Map());
  // WhatsApp spec §8(d): the ways in, read from Supabase Auth (the number is kept only there, D113).
  const [methods, setMethods] = useState<SignInMethods | null>(null);
  const [methodSheet, setMethodSheet] = useState<null | 'email' | 'whatsapp'>(null);
  const [waCountry, setWaCountry] = useState<WhatsAppCountry>(DEFAULT_WHATSAPP_COUNTRY);
  // Home's "Add a backup way in" card opens this screen with add=email|whatsapp.
  const params = useLocalSearchParams<{ add?: string }>();

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
      setSavedPhone(current.phone ?? '');
      userSettingsService.getAll(current.id).then((all) => setDefaults(defaultsSummary(all.startsAs, all.startsAs === 'pool' ? all.pool : all.points))).catch(() => {});
      let email = current.email ?? null;
      if (isSupabaseConfigured) {
        const { data } = await supabase.auth.getSession();
        email = data.session?.user.email ?? email;
      }
      setShowDemo(isAdminEmail(email));
      if (isSupabaseConfigured) {
        readSignInMethods().then(setMethods).catch(() => {});
        loadSignInDefaults(false).then((d) => setWaCountry(whatsAppCountry(d.country) ?? DEFAULT_WHATSAPP_COUNTRY)).catch(() => {});
      }
      setEmailPrefs(await emailsService.getPrefs());
      playersService.listMyPlayers(current.id).then((mine) => {
        const labels = assignInitials(mine.map((player) => ({ id: player.id, name: player.name, initials: player.initials, addedAt: player.addedAt })));
        setTakenInitials(new Map(mine.map((player) => [labels.get(player.id) ?? '', player.name] as const).filter(([label]) => label)));
      }).catch(() => {});
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  React.useEffect(() => {
    if (params.add !== 'email' && params.add !== 'whatsapp') return;
    setMethodSheet(params.add);
    router.setParams({ add: undefined } as never);
  }, [params.add]);

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: 'Profile' });
  }, [navigation]);

  const saveInitials = async (value: string) => {
    if (!player) return;
    setSavingInitials(true);
    setInitialsError(null);
    try {
      let stored: string | null = value;
      if (isSupabaseConfigured) {
        stored = await authService.setMyInitials(value);
      } else {
        const players = await storage.getPlayers();
        await storage.savePlayers(players.map((item) => (item.id === player.id ? { ...item, initials: value } : item)));
      }
      setPlayer((current) => (current ? { ...current, initials: stored ?? undefined } : current));
      setEditingInitials(false);
    } catch (err) {
      setInitialsError(formatSupabaseError(err));
    } finally {
      setSavingInitials(false);
    }
  };

  const saveName = async (name: string) => {
    if (!player) return;
    // Doubled spaces collapse on save (Sree, Nov 14: "Srikanth  Koneru" broke the winner line).
    const trimmed = name.trim().replace(/\s+/g, ' ');
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
      setEditing(null);
      await load();
    } catch (err) {
      setPopup({ title: 'Couldn’t save', message: formatSupabaseError(err), icon: 'alert-circle-outline' });
    } finally {
      setSaving(false);
    }
  };

  const savePhone = async (phone: string) => {
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
        setSavedPhone(stored ?? '');
      } else {
        const players = await storage.getPlayers();
        await storage.savePlayers(players.map((item) => (item.id === player.id ? { ...item, phone: clean || undefined } : item)));
        setSavedPhone(clean);
      }
      setPhoneState({ kind: 'saved' });
      setEditing(null);
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
  // The passcode check signs in with whichever way the account has: the email, else the WhatsApp number (D76).
  const passcodeLogin = methods?.email ?? player?.email ?? (methods?.phone ? `+${methods.phone.replace(/^\+/, '')}` : '');
  const changePasscode = () => {
    if (!passcodeLogin || !isSupabaseConfigured) {
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
      setPopup({ title: 'Couldn’t log out', message: formatSupabaseError(err), icon: 'alert-circle-outline' });
    }
  };

  const runDemo = async (action: 'load' | 'clear') => {
    setDemoBusy(action);
    try {
      if (action === 'load') {
        const result = await loadDemoData();
        setPopup({ title: 'Demo data loaded', message: `${result.hostName} is in the sample games.`, icon: 'check-circle-outline' });
      } else {
        await clearDemoData();
        setPopup({ title: 'Demo data cleared', message: 'Sample players and games were removed.', icon: 'check-circle-outline' });
      }
    } catch (err) {
      setPopup({ title: 'Demo data failed', message: err instanceof Error ? err.message : 'Something went wrong.', icon: 'alert-circle-outline' });
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

  const badge = playerIdBadge(player);
  const initials = player.initials ?? defaultInitials(player.name);

  // Size-S (D66, design-review-2 §10.1): a header block and six grouped lists; no cards, no icon
  // squares, no buttons on the screen — each edit is a row that opens its sheet.
  return (
    <Screen contentStyle={styles.content}>
      {error ? <Text variant="bodyMedium" style={{ color: colors.error }}>{error}</Text> : null}

      <View style={styles.identity}>
        <SeatAvatar name={player.name} size={56} />
        <View style={styles.identityText}>
          <Text variant="headlineSmall" numberOfLines={2}>{player.name}</Text>
          <Text variant="bodySmall" numberOfLines={1} style={{ color: colors.onSurfaceVariant }}>
            {[player.email, badge].filter(Boolean).join(' · ') || 'Player ID pending'}
          </Text>
        </View>
      </View>

      {methods ? (
        <SettingsGroup title="Sign-in methods" note={signInMethodsNote(methods)} testID="me-sign-in-methods">
          {(methods.phone && !methods.email
            ? (['whatsapp', 'email'] as const)
            : (['email', 'whatsapp'] as const)).map((kind) => {
            const value = kind === 'email' ? methods.email : (methods.phone ? formatWhatsAppNumber(methods.phone) : null);
            const title = kind === 'email' ? 'Email' : 'WhatsApp';
            return (
              <ListRow
                key={kind}
                title={title}
                value={value ?? 'Add a backup'}
                valueTone={value ? 'muted' : 'action'}
                onPress={() => setMethodSheet(kind)}
                accessibilityLabel={value ? `${title}, ${value}. Change` : `${title}: add a backup way in`}
                testID={`me-method-${kind}`}
              />
            );
          })}
          <ListRow title="Passcode" value="Change" onPress={changePasscode} testID="me-change-passcode" />
        </SettingsGroup>
      ) : null}

      <SettingsGroup title="Your table" testID="me-your-table">
        <ListRow title="Name" value={player.name} pen onPress={() => setEditing('name')} accessibilityLabel={`Name, ${player.name}. Edit name`} testID="me-edit-name" />
        <ListRow
          title="Initials on scorecards"
          value={player.initials ? initials : `${initials} · from your name`}
          pen
          onPress={() => { setInitialsError(null); setEditingInitials(true); }}
          accessibilityLabel={`Your initials ${initials}${player.initials ? '' : ', from your name'}. Change your initials`}
          testID="me-edit-initials"
        />
        <ListRow
          title="Player ID"
          value={badge ?? 'Pending'}
          right={badge ? <Icon source="share-variant" size={20} color={colors.onSurfaceVariant} /> : null}
          onPress={player.playerCode ? () => sharePlayerId(player.playerCode!).catch(() => {}) : undefined}
          accessibilityLabel={badge ? `Your ${badge}. Share your Player ID so friends can find you` : 'Player ID pending'}
          testID="me-share-player-id"
        />
      </SettingsGroup>

      <SettingsGroup title="Notifications" testID="me-notifications">
        <ListRow
          title="Phone"
          description={phoneState.kind === 'saved' ? (savedPhone ? 'Saved.' : 'Cleared.') : undefined}
          value={savedPhone || 'No number yet'}
          pen
          onPress={() => { setEditing('phone'); setPhoneState({ kind: 'idle' }); }}
          accessibilityLabel={savedPhone ? `Phone, ${savedPhone}. Edit phone` : 'Phone, no number yet. Add phone'}
          testID="me-edit-phone"
        />
        <ListRow title="Email" value={emailPrefsSummary(emailPrefs)} onPress={() => { setEmailError(null); setEditing('email'); }} testID="me-email" />
      </SettingsGroup>

      <SettingsGroup title="Game defaults" testID="me-game-defaults">
        <ListRow title="Settings" value={defaults ?? ''} onPress={() => router.push('/(screens)/settings')} accessibilityLabel="Settings: game type, Drop, Middle drop, Full count" testID="me-settings" />
      </SettingsGroup>

      <SettingsGroup title="Appearance" testID="me-appearance">
        <SegmentedChoice
          value={appearance}
          onChange={setAppearance}
          accessibilityLabel="Appearance"
          options={APPEARANCE_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
            accessibilityLabel: option.value === 'system' ? 'Follow the phone setting' : `${option.label} mode`,
            testID: `me-appearance-${option.value}`,
          }))}
          style={styles.choice}
        />
      </SettingsGroup>

      {/* PR 11 (Q11.7): the help index — every help page by group, with search. */}
      <SettingsGroup title="Help" testID="me-help">
        <ListRow title={HELP_INDEX_TITLE} description="How each screen works, tricky cases, scoring rules" onPress={() => router.push('/(screens)/help' as never)} accessibilityLabel="Help and guide: every help page, with search" testID="me-help-index" />
      </SettingsGroup>

      <SettingsGroup title="Account" note={notice ?? undefined} testID="me-account">
        {methods ? null : <ListRow title="Change passcode" onPress={changePasscode} testID="me-change-passcode" />}
        <ListRow title="Privacy policy" onPress={() => Linking.openURL(PRIVACY_PAGE_URL).catch(() => {})} testID="me-privacy" />
        <ListRow title="Delete account" tone="danger" onPress={() => setDeleteOpen(true)} testID="delete-account" />
        <ListRow title="Log out" tone="danger" noChevron onPress={logout} testID="me-log-out" />
      </SettingsGroup>

      {showDemo ? (
        <SettingsGroup title="Admin" note="Sample players and games for this account. Load adds them; Clear removes them." testID="me-admin">
          <ListRow title="Load demo data" description={demoBusy === 'load' ? 'Loading…' : undefined} onPress={demoBusy ? undefined : () => runDemo('load')} testID="me-demo-load" />
          <ListRow title="Clear demo data" description={demoBusy === 'clear' ? 'Clearing…' : undefined} onPress={demoBusy ? undefined : () => runDemo('clear')} testID="me-demo-clear" />
        </SettingsGroup>
      ) : null}

      {VERSION_LABEL ? (
        <Text variant="labelSmall" style={[styles.version, { color: colors.onSurfaceVariant }]} accessibilityLabel={`App version ${VERSION_LABEL}`}>
          {`EZ Score ${VERSION_LABEL}`}
        </Text>
      ) : null}

      <Portal>
        {popup ? (
          <NoticeDialog
            icon={popup.icon}
            title={popup.title}
            message={popup.message}
            onDismiss={() => { const next = popup.then; setPopup(null); next?.(); }}
            testID="me-notice"
          />
        ) : null}
        {editingInitials ? (
          <InitialsDialog
            name={player.name}
            current={player.initials}
            taken={takenInitials}
            scope="my-players"
            busy={savingInitials}
            error={initialsError}
            onDismiss={() => setEditingInitials(false)}
            onSave={saveInitials}
          />
        ) : null}
        {editing === 'name' ? (
          <EditFieldDialog
            title="Edit name"
            label="Name"
            initial={player.name}
            autoCapitalize="words"
            busy={saving}
            validate={(value) => (value.trim() ? null : 'Type a name.')}
            onSave={saveName}
            onDismiss={() => setEditing(null)}
            testID="me-name-dialog"
          />
        ) : null}
        {editing === 'phone' ? (
          <EditFieldDialog
            title={savedPhone ? 'Edit phone' : 'Add phone'}
            label="Phone"
            initial={savedPhone}
            hint="Optional. Never texted, never shown to other players."
            placeholder="Add a number"
            keyboardType="phone-pad"
            busy={savingPhone}
            error={phoneState.kind === 'error' ? phoneState.message : null}
            validate={phoneProblem}
            onSave={savePhone}
            onDismiss={() => { setEditing(null); setPhoneState({ kind: 'idle' }); }}
            testID="me-phone-dialog"
          />
        ) : null}
        {methodSheet ? (
          <SignInMethodDialog
            kind={methodSheet}
            changing={Boolean(methodSheet === 'email' ? methods?.email : methods?.phone)}
            country={waCountry}
            onDismiss={() => setMethodSheet(null)}
            onSent={(to, done) => {
              const channel = methodSheet;
              setMethodSheet(null);
              if (done) load();
              else router.push({ pathname: '/(screens)/confirm-code', params: { channel, to } });
            }}
          />
        ) : null}
        {editing === 'email' ? (
          <EmailPrefsDialog prefs={emailPrefs} error={emailError} onToggle={toggleEmail} onDismiss={() => setEditing(null)} />
        ) : null}
      </Portal>

      <ChangePasscodeDialog
        visible={passcodeOpen}
        email={passcodeLogin}
        onDismiss={() => setPasscodeOpen(false)}
        onChanged={() => {
          setPasscodeOpen(false);
          setNotice('Passcode changed. Use the new 6 digits next time you sign in.');
        }}
      />

      <DeleteAccountDialog
        visible={deleteOpen}
        onDismiss={() => setDeleteOpen(false)}
        onDeleted={() => {
          setDeleteOpen(false);
          setPopup({ title: DELETE_ACCOUNT_DONE_TITLE, message: DELETE_ACCOUNT_DONE_BODY, icon: 'check-circle-outline', then: () => router.replace('/(auth)/login') });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  version: { textAlign: 'center', paddingVertical: spacing.sm },
  identity: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', paddingVertical: spacing.xs },
  identityText: { flex: 1, gap: 2 },
  choice: { marginVertical: spacing.xs },
});

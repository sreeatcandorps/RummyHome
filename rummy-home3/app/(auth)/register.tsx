import { normalizeEmail } from '@/utils/playerIdentity';
import { COUNTRIES, Country, DEFAULT_COUNTRY, DEFAULT_WHATSAPP_COUNTRY, internationalPhone, maskWhatsAppNumber, parseStoredPhone, phoneForCountryProblem, postalProblem, whatsAppCountry, whatsAppE164, whatsAppNumberProblem } from '@/utils/countries';
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Text, HelperText, Menu, Portal } from 'react-native-paper';
import { NoticeDialog } from '@/components/ui/NoticeDialog';
import { Button } from '@/components/ui/AppButton';
import { CodeStep } from '@/components/ui/CodeStep';
import { SignInMethodSwitch } from '@/components/ui/SignInMethodSwitch';
import { WhatsAppNumberField } from '@/components/ui/WhatsAppNumberField';
import { BackupStep } from '@/components/auth/BackupStep';
import { router, useLocalSearchParams } from 'expo-router';
import { storage } from '../../utils/storage';
import { authService, signUpCodeClient, whatsAppAuth } from '../../services/auth';
import { loadSignInDefaults, rememberSignInMethod } from '@/services/deviceCountry';
import { resendSignUpCode, SIGNUP_CODE_TEXT, verifySignUpCode } from '@/utils/signUpCode';
import { SignInMethod } from '@/utils/signInDefaults';
import { authNavigationHold } from '@/utils/authFlow';
import { passcodeProblem } from '@/utils/passcode';
import { WHATSAPP_SIGNUP_TEXT } from '@/utils/whatsappAuth';
import { isSupabaseConfigured, supabase } from '../../services/supabase';
import { formatAuthError } from '../../utils/authErrors';
import { AuthShell } from '../../components/ui/AuthShell';
import { PasscodeField } from '@/components/ui/PasscodeField';
import { sendWelcomeEmail } from '@/services/mail';
import { MIN_TOUCH_TARGET, radius, spacing, useAppTheme } from '../../constants/theme';

/** Where the code went after Create account (D101; WhatsApp spec §8(b)). */
type CodeFor = { channel: 'email'; email: string } | { channel: 'whatsapp'; phone: string };

export default function RegisterScreen() {
  const theme = useAppTheme();
  // Sign in with an unconfirmed address sends `confirm=<email>`: straight to the code step.
  // "Not you?" on Set a new passcode sends `whatsapp=<+number>`: a new account with that number.
  const params = useLocalSearchParams<{ confirm?: string; whatsapp?: string }>();
  const confirmParam = typeof params.confirm === 'string' && params.confirm.includes('@') ? normalizeEmail(params.confirm) : null;
  const whatsappParam = typeof params.whatsapp === 'string' ? parseStoredPhone(params.whatsapp) : null;
  const [method, setMethod] = useState<SignInMethod>(whatsappParam ? 'whatsapp' : 'email');
  // The defaults arrive a moment after the screen; they never undo a choice already made on it.
  const touched = useRef({ method: false, country: false });
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState(confirmParam ?? '');
  const [phone, setPhone] = React.useState('');
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [zip, setZip] = React.useState('');
  const [waCountry, setWaCountry] = useState(whatsappParam?.country ?? DEFAULT_WHATSAPP_COUNTRY);
  const [waNumber, setWaNumber] = useState(whatsappParam?.national ?? '');
  // D101: after sign-up the email (or WhatsApp) gets a 6-digit code, typed here; no confirm link.
  const [codeFor, setCodeFor] = useState<CodeFor | null>(confirmParam ? { channel: 'email', email: confirmParam } : null);
  // D75: right after the code, the backup contact with Skip for now.
  const [backupAfter, setBackupAfter] = useState<SignInMethod | null>(null);
  // A09: a Paper notice, not Alert.alert; OK carries on to the next screen.
  const [created, setCreated] = useState<{ message: string; to: '/(tabs)' | '/(auth)/login' } | null>(null);
  const [passcode, setPasscode] = React.useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [numberInUse, setNumberInUse] = useState(false);

  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [countryOpen, setCountryOpen] = useState(false);

  // D125: WhatsApp first in India, Email elsewhere; the number's code from the phone's country. Read each time.
  useEffect(() => {
    if (confirmParam || whatsappParam) return;
    let live = true;
    loadSignInDefaults(false).then((defaults) => {
      if (!live) return;
      if (!touched.current.method) setMethod(defaults.method);
      if (!touched.current.country) setWaCountry(whatsAppCountry(defaults.country) ?? DEFAULT_WHATSAPP_COUNTRY);
    }).catch(() => {});
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Signing up (and the code) signs in; the root layout would open Home before the backup step. Hold it.
  const holding = useRef(false);
  const hold = () => {
    if (holding.current) return;
    holding.current = true;
    authNavigationHold.begin();
  };
  const release = () => {
    if (!holding.current) return;
    holding.current = false;
    authNavigationHold.end();
  };
  useEffect(() => release, []);

  const goHome = () => {
    release();
    router.replace('/(tabs)');
  };

  const clearFields = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setWaNumber('');
    setPasscode('');
    setError('');
    setNumberInUse(false);
  };

  const validateForm = () => {
    if (!firstName || !lastName) {
      setError('First and last name are required');
      return false;
    }
    if (method === 'whatsapp') {
      const numberIssue = whatsAppNumberProblem(waCountry, waNumber);
      if (numberIssue) {
        setError(numberIssue);
        return false;
      }
    } else {
      if (!email) {
        setError('Email is required');
        return false;
      }
      if (!email.includes('@')) {
        setError('Please enter a valid email address');
        return false;
      }
    }
    const passcodeIssue = passcodeProblem(passcode);
    if (passcodeIssue) {
      setError(passcodeIssue);
      return false;
    }
    return true;
  };

  /**
   * The form's name (and, for email, contact) on the new profile row; needs a session (right after sign-up or the
   * code). A WhatsApp number is never written to the profile: it lives only in Supabase Auth (D113).
   */
  const saveProfile = async (userId: string, signedUpWith: SignInMethod) => {
    if (!firstName || !lastName) return;
    const contact = signedUpWith === 'email'
      ? { phone: internationalPhone(country, phone) || null, zip_code: zip.trim() || null, email: normalizeEmail(email) }
      : {};
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ first_name: firstName, last_name: lastName, display_name: `${firstName} ${lastName}`, ...contact })
      .eq('id', userId);

    if (profileError) {
      console.warn('Profile update after signup failed:', profileError.message);
    }
  };

  /** Signed in with a confirmed email or number: remember the way on this phone (D125), then the backup step. */
  const signedIn = async (signedUpWith: SignInMethod) => {
    const userId = await authService.getCurrentUserId();
    if (userId) await saveProfile(userId, signedUpWith);
    await rememberSignInMethod(signedUpWith).catch(() => {});
    setCodeFor(null);
    setBackupAfter(signedUpWith);
  };

  const whatsAppData = () => ({ display_name: `${firstName} ${lastName}`, first_name: firstName, last_name: lastName });

  const registerWithWhatsApp = async () => {
    if (!isSupabaseConfigured) throw new Error(WHATSAPP_SIGNUP_TEXT.notReady);
    const e164 = whatsAppE164(waCountry, waNumber);
    if (!e164) throw new Error('Enter your WhatsApp number.');
    hold();
    const result = await whatsAppAuth.signUp({ phone: e164, passcode, data: whatsAppData() });
    if (!result.ok) {
      release();
      setNumberInUse(Boolean(result.numberInUse));
      setError(result.message);
      return;
    }
    if (result.session) {
      await signedIn('whatsapp');
      return;
    }
    setCodeFor({ channel: 'whatsapp', phone: e164 });
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError('');
    setNumberInUse(false);

    try {
      if (method === 'whatsapp') {
        await registerWithWhatsApp();
        return;
      }
      const phoneIssue = phoneForCountryProblem(country, phone);
      if (phoneIssue) throw new Error(phoneIssue);
      const postalIssue = postalProblem(country, zip);
      if (postalIssue) throw new Error(postalIssue);
      const formattedPhone = internationalPhone(country, phone) ?? '';

      const displayName = `${firstName} ${lastName}`;
      const zipCode = zip.trim() || null;
      const cleanEmail = normalizeEmail(email);
      if (isSupabaseConfigured) hold();
      const authData = isSupabaseConfigured
        ? await authService.signUp(cleanEmail, passcode, displayName, { phone: formattedPhone || null, zip_code: zipCode })
        : { user: { id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` }, session: null };

      if (!authData.user) throw new Error('Failed to create user');

      if (!isSupabaseConfigured) {
        const newPlayer = {
          id: authData.user.id,
          email: cleanEmail,
          phone: formattedPhone || undefined,
          zipCode: zipCode || undefined,
          status: 'registered' as const,
          emailVerified: true,
          name: displayName,
          gamesPlayed: 0,
          gamesWon: 0,
          role: 'player' as const
        };

        const players = await storage.getPlayers();
        await storage.savePlayers([...players, newPlayer]);
        setCreated({ message: 'Your account has been created. You can now log in with your email and 6-digit passcode.', to: '/(auth)/login' });
        return;
      }

      sendWelcomeEmail(cleanEmail, displayName).catch(() => {});

      if (!authData.session) {
        setCodeFor({ channel: 'email', email: cleanEmail });
        return;
      }
      await signedIn('email');
    } catch (err) {
      release();
      console.error('Registration error:', err);
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const backToForm = () => {
    if (codeFor?.channel === 'email' && !email) setEmail(codeFor.email);
    release();
    setCodeFor(null);
    setError('');
  };

  if (backupAfter) {
    return <BackupStep signedUpWith={backupAfter} country={waCountry} onDone={goHome} />;
  }

  if (codeFor?.channel === 'whatsapp') {
    return (
      <CodeStep
        channel="whatsapp"
        to={maskWhatsAppNumber(codeFor.phone)}
        helpAnchor="create-account"
        testIDPrefix="register"
        onVerify={async (code) => {
          hold();
          const outcome = await whatsAppAuth.verifyCode('sign-up', codeFor.phone, code);
          if (outcome.ok) await signedIn('whatsapp');
          return outcome;
        }}
        onResend={() => whatsAppAuth.sendCode('sign-up', codeFor.phone, passcode, whatsAppData())}
        onBack={backToForm}
      />
    );
  }

  if (codeFor) {
    return (
      <CodeStep
        channel="email"
        to={codeFor.email}
        helpAnchor="create-account"
        testIDPrefix="register"
        note={SIGNUP_CODE_TEXT.inviteNote}
        onVerify={async (code) => {
          hold();
          const outcome = await verifySignUpCode(signUpCodeClient, codeFor.email, code);
          if (outcome.ok) await signedIn('email');
          else release();
          return outcome;
        }}
        onResend={() => resendSignUpCode(signUpCodeClient, codeFor.email)}
        onBack={backToForm}
      />
    );
  }

  return (
    <AuthShell
      title="Create account"
      subtitle="Your name, then a way to sign in"
      help="sign-in"
      helpAnchor="create-account"
      footer={
        <View style={styles.footerRow}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Already have an account?
          </Text>
          <Button
            mode="text"
            onPress={() => router.push('/(auth)/login')}
            disabled={loading}
            compact
          >
            Sign in
          </Button>
        </View>
      }
    >
      <SignInMethodSwitch value={method} onChange={(next) => { touched.current.method = true; setMethod(next); setError(''); setNumberInUse(false); }} disabled={loading} testIDPrefix="register" />

      <Text variant="titleSmall" style={styles.groupLabel}>
        Your name
      </Text>
      <View style={styles.nameRow}>
        <TextInput
          label="First name"
          value={firstName}
          onChangeText={setFirstName}
          mode="outlined"
          disabled={loading}
          style={styles.nameInput}
          testID="register-first-name"
        />
        <TextInput
          label="Last name"
          value={lastName}
          onChangeText={setLastName}
          mode="outlined"
          disabled={loading}
          style={styles.nameInput}
          testID="register-last-name"
        />
      </View>

      <Text variant="titleSmall" style={styles.groupLabel}>
        Sign-in details
      </Text>
      {method === 'whatsapp' ? (
        <>
          <WhatsAppNumberField
            country={waCountry}
            onCountryChange={(next) => { touched.current.country = true; setWaCountry(next); }}
            value={waNumber}
            onChangeText={(next) => { touched.current.country = true; setWaNumber(next); }}
            disabled={loading}
            testID="register-number"
          />
          <HelperText type="info" visible>
            {WHATSAPP_SIGNUP_TEXT.numberHint}
          </HelperText>
        </>
      ) : (
        <>
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            disabled={loading}
            left={<TextInput.Icon icon="email-outline" />}
            testID="register-email"
          />

          <HelperText type="info" visible>
            We email you a 6-digit code to confirm it. It is how you sign in.
          </HelperText>
        </>
      )}
      <PasscodeField value={passcode} onChangeText={setPasscode} disabled={loading} testID="register-passcode" />
      <HelperText type="info" visible>
        {method === 'whatsapp' ? WHATSAPP_SIGNUP_TEXT.passcodeHint : 'Numbers only. This is what you sign in with.'}
      </HelperText>

      {method === 'email' ? (
        <Button mode="text" onPress={() => setPhoneOpen((open) => !open)} icon={phoneOpen ? 'chevron-up' : 'chevron-down'}>
          Optional: country, phone and {country.postalLabel.toLowerCase()}
        </Button>
      ) : null}
      {method === 'email' && phoneOpen ? (
        <View style={styles.contact}>
          <HelperText type="info" visible>
            All optional. We never text you and never ask for your address.
          </HelperText>
          <Menu
            visible={countryOpen}
            onDismiss={() => setCountryOpen(false)}
            anchor={(
              <Button
                mode="outlined"
                icon="chevron-down"
                contentStyle={styles.countryButton}
                onPress={() => setCountryOpen(true)}
                disabled={loading}
                accessibilityLabel="Country"
              >
                {country.flag} {country.name}{country.callingCode ? ` (+${country.callingCode})` : ''}
              </Button>
            )}
          >
            {COUNTRIES.map((item) => (
              <Menu.Item
                key={item.code}
                title={`${item.flag} ${item.name}${item.callingCode ? ` (+${item.callingCode})` : ''}`}
                onPress={() => { setCountry(item); setCountryOpen(false); }}
              />
            ))}
          </Menu>
          <TextInput
            label={country.callingCode ? `Phone (+${country.callingCode})` : 'Phone with country code'}
            value={phone}
            onChangeText={setPhone}
            mode="outlined"
            keyboardType="phone-pad"
            autoComplete="tel"
            disabled={loading}
            left={<TextInput.Icon icon="phone-outline" />}
            accessibilityLabel="Phone"
          />
          <TextInput
            label={country.postalLabel}
            placeholder={country.postalExample}
            value={zip}
            onChangeText={(t) => setZip(t.replace(/[^0-9A-Za-z -]/g, '').slice(0, 12))}
            mode="outlined"
            autoCapitalize="characters"
            keyboardType={/^\d+$/.test(country.postalExample) ? 'number-pad' : 'default'}
            disabled={loading}
            left={<TextInput.Icon icon="map-marker-outline" />}
            accessibilityLabel={country.postalLabel}
          />
        </View>
      ) : null}

      {error ? (
        <View style={styles.signInError}>
          <HelperText type="error" visible testID="register-error">
            {error}
          </HelperText>
          {numberInUse ? (
            <View style={styles.inUseRow}>
              <Button
                mode="outlined"
                icon="login"
                onPress={() => router.push({ pathname: '/(auth)/login', params: { whatsapp: whatsAppE164(waCountry, waNumber) ?? '' } })}
                testID="register-number-sign-in"
              >
                Sign in
              </Button>
              <Button
                mode="text"
                onPress={() => router.push({ pathname: '/(auth)/forgot-password', params: { whatsapp: whatsAppE164(waCountry, waNumber) ?? '' } })}
              >
                Forgot passcode?
              </Button>
            </View>
          ) : /sign(?:ing)? in/i.test(error) ? (
            <Button
              mode="outlined"
              icon="login"
              onPress={() => router.push({ pathname: '/(auth)/login', params: { email: email.trim() } })}
            >
              Sign in
            </Button>
          ) : null}
        </View>
      ) : null}

      <Button
        mode="contained"
        onPress={handleRegister}
        loading={loading}
        disabled={loading}
        style={styles.pill}
        contentStyle={styles.primaryContent}
        labelStyle={styles.primaryLabel}
        testID="register-submit"
      >
        Create account
      </Button>

      <Button
        mode="text"
        onPress={clearFields}
        disabled={loading}
        contentStyle={styles.secondaryContent}
      >
        Clear form
      </Button>
      <Portal>
        {created ? (
          <NoticeDialog
            icon="check-circle-outline"
            title="Account created"
            message={created.message}
            onDismiss={() => { const to = created.to; setCreated(null); router.replace(to); }}
            testID="register-created"
          />
        ) : null}
      </Portal>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  contact: { gap: 8 },
  countryButton: { justifyContent: 'flex-start', height: 48 },
  groupLabel: {
    marginTop: spacing.xs,
    fontWeight: '700',
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  nameInput: {
    flex: 1,
  },
  pill: {
    borderRadius: radius.full,
  },
  primaryContent: {
    height: 56,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryContent: {
    height: MIN_TOUCH_TARGET,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  signInError: {
    gap: spacing.xs,
  },
  inUseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
});

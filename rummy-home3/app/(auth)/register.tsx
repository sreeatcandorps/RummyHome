import { normalizeEmail } from '@/utils/playerIdentity';
import { COUNTRIES, Country, DEFAULT_COUNTRY, internationalPhone, phoneForCountryProblem, postalProblem } from '@/utils/countries';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Text, HelperText, Menu, Portal } from 'react-native-paper';
import { NoticeDialog } from '@/components/ui/NoticeDialog';
import { Button } from '@/components/ui/AppButton';
import { OtpField } from '@/components/ui/OtpField';
import { router, useLocalSearchParams } from 'expo-router';
import { storage } from '../../utils/storage';
import { authService, signUpCodeClient } from '../../services/auth';
import { cleanSignUpCode, resendSignUpCode, SIGNUP_CODE_TEXT, SIGNUP_RESEND_COOLDOWN_S, verifySignUpCode } from '@/utils/signUpCode';
import { isSupabaseConfigured, supabase } from '../../services/supabase';
import { formatAuthError } from '../../utils/authErrors';
import { AuthShell } from '../../components/ui/AuthShell';
import { PasscodeField } from '@/components/ui/PasscodeField';
import { sendWelcomeEmail } from '@/services/mail';
import { MIN_TOUCH_TARGET, radius, spacing, useAppTheme } from '../../constants/theme';
// import * as Location from 'expo-location';

export default function RegisterScreen() {
  const theme = useAppTheme();
  // Sign in with an unconfirmed address sends `confirm=<email>`: straight to the code step.
  const params = useLocalSearchParams<{ confirm?: string }>();
  const confirmParam = typeof params.confirm === 'string' && params.confirm.includes('@') ? normalizeEmail(params.confirm) : null;
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState(confirmParam ?? '');
  const [phone, setPhone] = React.useState('');
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [zip, setZip] = React.useState('');
  // D101: after sign-up the email gets a 6-digit code, typed here; no confirm link.
  const [codeFor, setCodeFor] = useState<string | null>(confirmParam);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [info, setInfo] = useState('');
  // A09: a Paper notice, not Alert.alert; OK carries on to the next screen.
  const [created, setCreated] = useState<{ message: string; to: '/(tabs)' | '/(auth)/login' } | null>(null);
  const [passcode, setPasscode] = React.useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [countryOpen, setCountryOpen] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const clearFields = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setPasscode('');
    setError('');
  };

  const validateForm = () => {
    if (!firstName || !lastName) {
      setError('First and last name are required');
      return false;
    }
    
    if (!email) {
      setError('Email is required');
      return false;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!passcode) {
      setError('Passcode is required');
      return false;
    }
    if (passcode.length !== 6) {
      setError('Passcode must be exactly 6 digits');
      return false;
    }
    if (!/^\d{6}$/.test(passcode)) {
      setError('Passcode must contain only numbers');
      return false;
    }
    
    return true;
  };

  /** The form's name and contact on the new profile row; needs a session (right after sign-up or the code). */
  const saveProfile = async (userId: string) => {
    if (!firstName || !lastName) return;
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone: internationalPhone(country, phone) || null,
        zip_code: zip.trim() || null,
        display_name: `${firstName} ${lastName}`,
        email: normalizeEmail(email),
      })
      .eq('id', userId);

    if (profileError) {
      console.warn('Profile update after signup failed:', profileError.message);
    }
  };

  const handleRegister = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    setError('');

    try {
      const phoneIssue = phoneForCountryProblem(country, phone);
      if (phoneIssue) throw new Error(phoneIssue);
      const postalIssue = postalProblem(country, zip);
      if (postalIssue) throw new Error(postalIssue);
      const formattedPhone = internationalPhone(country, phone) ?? '';

      const displayName = `${firstName} ${lastName}`;
      const zipCode = zip.trim() || null;
      const cleanEmail = normalizeEmail(email);
      const authData = isSupabaseConfigured
        ? await authService.signUp(cleanEmail, passcode, displayName, { phone: formattedPhone || null, zip_code: zipCode })
        : { user: { id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` }, session: null };

      if (!authData.user) throw new Error('Failed to create user');

      if (isSupabaseConfigured && authData.session) {
        await saveProfile(authData.user.id);
      }

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
      }

      if (isSupabaseConfigured) {
        sendWelcomeEmail(cleanEmail, displayName).catch(() => {});
      }

      if (isSupabaseConfigured && !authData.session) {
        setCode('');
        setInfo('');
        setCooldown(SIGNUP_RESEND_COOLDOWN_S);
        setCodeFor(cleanEmail);
        return;
      }

      if (isSupabaseConfigured && authData.session) {
        setCreated({ message: 'You are signed in and ready to play.', to: '/(tabs)' });
        return;
      }

      setCreated({ message: 'Your account has been created. You can now log in with your email and 6-digit passcode.', to: '/(auth)/login' });

    } catch (err) {
      console.error('Registration error:', err);
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!codeFor) return;
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const outcome = await verifySignUpCode(signUpCodeClient, codeFor, code);
      if (!outcome.ok) {
        setError(outcome.message);
        return;
      }
      // Signed in: the root layout's SIGNED_IN listener opens Home, as a sign-up with a session does.
      const userId = await authService.getCurrentUserId();
      if (userId) await saveProfile(userId);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!codeFor) return;
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const outcome = await resendSignUpCode(signUpCodeClient, codeFor);
      if (!outcome.ok) {
        setError(outcome.message);
        return;
      }
      setCode('');
      setCooldown(SIGNUP_RESEND_COOLDOWN_S);
      setInfo(SIGNUP_CODE_TEXT.sent(codeFor));
    } finally {
      setLoading(false);
    }
  };

  const backToForm = () => {
    if (!email && codeFor) setEmail(codeFor);
    setCodeFor(null);
    setCode('');
    setError('');
    setInfo('');
  };

  if (codeFor) {
    return (
      <AuthShell
        title={SIGNUP_CODE_TEXT.title}
        subtitle={SIGNUP_CODE_TEXT.subtitle(codeFor)}
        icon="email-check-outline"
        help="sign-in"
        helpAnchor="create-account"
        footer={
          <View style={styles.footerRow}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {SIGNUP_CODE_TEXT.wrongAddress}
            </Text>
            <Button mode="text" onPress={backToForm} disabled={loading} compact testID="register-go-back">
              {SIGNUP_CODE_TEXT.goBack}
            </Button>
          </View>
        }
      >
        <OtpField
          value={code}
          onChangeText={(text) => setCode(cleanSignUpCode(text))}
          disabled={loading}
          autoFocus
          label={SIGNUP_CODE_TEXT.fieldLabel}
          placeholder={SIGNUP_CODE_TEXT.placeholder}
          testID="register-code"
        />
        {error ? <HelperText type="error" visible>{error}</HelperText> : null}
        {info ? <HelperText type="info" visible>{info}</HelperText> : null}
        <Button
          mode="contained"
          onPress={handleVerify}
          loading={loading}
          disabled={loading}
          style={styles.pill}
          contentStyle={styles.primaryContent}
          labelStyle={styles.primaryLabel}
          testID="register-verify"
        >
          {SIGNUP_CODE_TEXT.verify}
        </Button>
        <Button
          mode="text"
          onPress={handleResend}
          disabled={loading || cooldown > 0}
          contentStyle={styles.secondaryContent}
          testID="register-resend"
        >
          {cooldown > 0 ? SIGNUP_CODE_TEXT.resendIn(cooldown) : SIGNUP_CODE_TEXT.resend}
        </Button>
        <Text variant="bodySmall" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
          {SIGNUP_CODE_TEXT.inviteNote}
        </Text>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create account"
      subtitle="You'll use your email and a 6-digit passcode to sign in."
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
      <PasscodeField value={passcode} onChangeText={setPasscode} disabled={loading} testID="register-passcode" />
      <HelperText type="info" visible>
        Numbers only. This is what you sign in with.
      </HelperText>

      <Button mode="text" onPress={() => setPhoneOpen((open) => !open)} icon={phoneOpen ? 'chevron-up' : 'chevron-down'}>
        Optional: country, phone and {country.postalLabel.toLowerCase()}
      </Button>
      {phoneOpen ? (
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
          <HelperText type="error" visible>
            {error}
          </HelperText>
          {/sign(?:ing)? in/i.test(error) ? (
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
  note: {
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.sm,
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
});

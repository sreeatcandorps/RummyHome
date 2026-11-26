import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput as NativeInput, View } from 'react-native';
import { TextInput, Text, HelperText } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { router, useLocalSearchParams } from 'expo-router';
import { PasscodeField } from '@/components/ui/PasscodeField';
import { JokerCard } from '@/components/ui/JokerCard';
import { CodeStep } from '@/components/ui/CodeStep';
import { SignInMethodSwitch } from '@/components/ui/SignInMethodSwitch';
import { WhatsAppNumberField } from '@/components/ui/WhatsAppNumberField';
import { storage } from '../../utils/storage';
import { authService, whatsAppAuth } from '../../services/auth';
import { loadSignInDefaults, rememberSignInMethod } from '@/services/deviceCountry';
import { isSupabaseConfigured } from '../../services/supabase';
import { formatAuthError } from '../../utils/authErrors';
import { AuthShell } from '../../components/ui/AuthShell';
import { MIN_TOUCH_TARGET, radius, spacing, useAppTheme } from '../../constants/theme';
import { takeStartupNotice } from '../../utils/startupNotice';
import { isEmailNotConfirmed, SIGNUP_CODE_TEXT } from '../../utils/signUpCode';
import { SignInMethod } from '@/utils/signInDefaults';
import { passcodeProblem } from '@/utils/passcode';
import { DEFAULT_WHATSAPP_COUNTRY, maskWhatsAppNumber, parseStoredPhone, whatsAppCountry, whatsAppE164, whatsAppNumberProblem } from '@/utils/countries';
import { WHATSAPP_SIGNUP_TEXT } from '@/utils/whatsappAuth';

export default function LoginScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ email?: string; notice?: string; whatsapp?: string }>();
  const wantsWhatsApp = typeof params.whatsapp === 'string';
  const paramNumber = wantsWhatsApp ? parseStoredPhone(params.whatsapp) : null;
  const paramEmail = typeof params.email === 'string' ? params.email : '';
  const [method, setMethod] = useState<SignInMethod>(wantsWhatsApp ? 'whatsapp' : 'email');
  // The defaults arrive a moment after the screen; they never undo a choice already made on it.
  const touched = useRef({ method: false, country: false });
  const [email, setEmail] = useState(paramEmail);
  const [waCountry, setWaCountry] = useState(paramNumber?.country ?? DEFAULT_WHATSAPP_COUNTRY);
  const [waNumber, setWaNumber] = useState(paramNumber?.national ?? '');
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(typeof params.notice === 'string' ? params.notice : '');
  const [unconfirmed, setUnconfirmed] = useState(false);
  // A number that signed up but never typed its code: the code step, by WhatsApp, from here.
  const [confirmNumber, setConfirmNumber] = useState<string | null>(null);

  const emailRef = useRef<NativeInput>(null);

  useEffect(() => {
    const startup = takeStartupNotice();
    if (startup) setError(startup);
  }, []);

  // D125: the way last used on this phone, else the phone's country (WhatsApp in India). Nothing else is kept.
  useEffect(() => {
    if (paramNumber) return;
    let live = true;
    loadSignInDefaults(true).then((defaults) => {
      if (!live) return;
      if (!paramEmail && !wantsWhatsApp && !touched.current.method) setMethod(defaults.method);
      if (!touched.current.country) setWaCountry(whatsAppCountry(defaults.country) ?? DEFAULT_WHATSAPP_COUNTRY);
    }).catch(() => {});
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cursor in Email on launch. Android ignores autoFocus on a screen that mounts mid-transition, so focus once laid out.
  useEffect(() => {
    if (email) return;
    const timer = setTimeout(() => emailRef.current?.focus(), Platform.OS === 'web' ? 0 : 350);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWhatsAppLogin = async () => {
    const numberIssue = whatsAppNumberProblem(waCountry, waNumber);
    const passcodeIssue = passcodeProblem(passcode);
    if (numberIssue || passcodeIssue) {
      setError(numberIssue ?? passcodeIssue ?? '');
      return;
    }
    if (!isSupabaseConfigured) {
      setError(WHATSAPP_SIGNUP_TEXT.notReady);
      return;
    }
    const e164 = whatsAppE164(waCountry, waNumber)!;
    setLoading(true);
    setError('');
    setUnconfirmed(false);
    try {
      const result = await whatsAppAuth.signIn(e164, passcode);
      if (!result.ok) {
        setError(result.message);
        setUnconfirmed(Boolean(result.notConfirmed));
        return;
      }
      await rememberSignInMethod('whatsapp').catch(() => {});
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !passcode) {
      setError('Email and passcode are required');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (passcode.length !== 6) {
      setError('Passcode must be exactly 6 digits');
      return;
    }

    if (!/^\d{6}$/.test(passcode)) {
      setError('Passcode must contain only numbers');
      return;
    }

    setLoading(true);
    setError('');
    setUnconfirmed(false);

    try {
      if (isSupabaseConfigured) {
        await authService.signIn(email, passcode);
        await rememberSignInMethod('email').catch(() => {});
      } else {
        // Get player data from storage
        const players = await storage.getPlayers();
        let currentPlayer = players.find(p => p.email === email.trim());

        if (!currentPlayer) {
          // Create new player if not found
          currentPlayer = {
            id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            email: email.trim(),
            name: email.split('@')[0] || 'Player',
            gamesPlayed: 0,
            gamesWon: 0,
            role: 'player' as const
          };
          await storage.savePlayers([...players, currentPlayer]);
        }

        // Set as current player
        await storage.setCurrentPlayer(currentPlayer.id);
      }

      // Navigate to main app
      router.replace('/(tabs)');
    } catch (err) {
      console.error('Login error:', err);
      setError(formatAuthError(err));
      setUnconfirmed(isEmailNotConfirmed(err));
    } finally {
      setLoading(false);
    }
  };

  const enterCode = async () => {
    if (method === 'email') {
      router.push({ pathname: '/(auth)/register', params: { confirm: email.trim() } });
      return;
    }
    const e164 = whatsAppE164(waCountry, waNumber);
    if (!e164) return;
    setLoading(true);
    try {
      const sent = await whatsAppAuth.sendCode('recovery', e164);
      if (!sent.ok) {
        setError(sent.message);
        return;
      }
      setError('');
      setConfirmNumber(e164);
    } finally {
      setLoading(false);
    }
  };

  if (confirmNumber) {
    return (
      <CodeStep
        channel="whatsapp"
        to={maskWhatsAppNumber(confirmNumber)}
        testIDPrefix="login"
        onVerify={async (code) => {
          const outcome = await whatsAppAuth.verifyCode('recovery', confirmNumber, code);
          if (outcome.ok) {
            await rememberSignInMethod('whatsapp').catch(() => {});
            router.replace('/(tabs)');
          }
          return outcome;
        }}
        onResend={() => whatsAppAuth.sendCode('recovery', confirmNumber)}
        onBack={() => { setConfirmNumber(null); setUnconfirmed(false); }}
      />
    );
  }

  const forgotParams = method === 'whatsapp'
    ? { whatsapp: whatsAppE164(waCountry, waNumber) ?? '' }
    : (email ? { email: email.trim() } : {});

  return (
    <AuthShell
      title="EZ Score: Rummy"
      subtitle="Sign in to keep score with your table"
      help="sign-in"
      keepCardInView
      keepFooterInView
      hero={<JokerCard />}
      footer={
        <>
          {/* Size-S (D69, B01): one line, a text action, no pill; the B17 reassurance line is gone. */}
          <View style={styles.newHere}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>New here?</Text>
            <Button mode="text" compact onPress={() => router.push('/(auth)/register')} testID="login-create-account">
              Create account
            </Button>
          </View>
          {isSupabaseConfigured ? null : (
            <Text variant="bodySmall" style={[styles.footer, { color: theme.colors.onSurfaceVariant }]}>
              Local prototype mode: add Supabase env vars for production auth
            </Text>
          )}
        </>
      }
    >
      <SignInMethodSwitch value={method} onChange={(next) => { touched.current.method = true; setMethod(next); setError(''); setUnconfirmed(false); }} disabled={loading} testIDPrefix="login" />

      {method === 'whatsapp' ? (
        <WhatsAppNumberField
          country={waCountry}
          onCountryChange={(next) => { touched.current.country = true; setWaCountry(next); }}
          value={waNumber}
          onChangeText={(next) => { touched.current.country = true; setWaNumber(next); }}
          disabled={loading}
          testID="login-number"
        />
      ) : (
        <TextInput
          ref={emailRef}
          label="Email"
          value={email}
          onChangeText={setEmail}
          mode="outlined"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoFocus={!email}
          returnKeyType="next"
          cursorColor={theme.colors.primary}
          selectionColor={theme.colors.primary}
          testID="login-email"
        />
      )}

      <PasscodeField value={passcode} onChangeText={setPasscode} disabled={loading} testID="login-passcode" />
      {notice ? (
        <HelperText type="info" visible style={styles.notice} onPress={() => setNotice('')}>
          {notice}
        </HelperText>
      ) : null}

      {error ? (
        <HelperText type="error" visible={!!error} testID="login-error">
          {error}
        </HelperText>
      ) : null}
      {unconfirmed ? (
        <Button
          mode="outlined"
          icon={method === 'whatsapp' ? 'whatsapp' : 'email-check-outline'}
          onPress={enterCode}
          disabled={loading}
          testID="login-enter-code"
        >
          {SIGNUP_CODE_TEXT.enterCode}
        </Button>
      ) : null}

      <Button
        mode="contained"
        onPress={method === 'whatsapp' ? handleWhatsAppLogin : handleEmailLogin}
        loading={loading}
        disabled={loading}
        style={styles.pill}
        contentStyle={styles.primaryContent}
        labelStyle={styles.primaryLabel}
        testID="login-submit"
      >
        Sign in
      </Button>

      <Button
        mode="text"
        onPress={() => router.push({ pathname: '/(auth)/forgot-password', params: forgotParams })}
        contentStyle={styles.secondaryContent}
        testID="login-forgot"
      >
        Forgot passcode?
      </Button>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  notice: { fontWeight: '700' },
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
  newHere: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  footer: {
    textAlign: 'center',
  },
});

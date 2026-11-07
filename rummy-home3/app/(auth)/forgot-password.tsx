import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { PasscodeField } from '@/components/ui/PasscodeField';
import { AuthShell } from '@/components/ui/AuthShell';
import { HELP } from '@/constants/help';
import { MIN_TOUCH_TARGET, radius, spacing, useAppTheme } from '@/constants/theme';
import { isSupabaseConfigured } from '@/services/supabase';
import { passcodeClient } from '@/services/auth';
import { passcodeRecovery } from '@/utils/authFlow';
import { digitsOnly, EMAIL_CODE_MAX, RESEND_COOLDOWN_S } from '@/utils/passcode';
import { completePasscodeReset, requestPasscodeCode } from '@/utils/passcodeFlow';
import 'react-native-url-polyfill/auto';

type Step = 'email' | 'code';

export const PASSCODE_UPDATED_NOTICE = 'Passcode updated. Sign in with your new 6-digit passcode.';

/**
 * Forgot passcode, all inside the app: email → 6-digit code from the email + new passcode →
 * back to Sign in with the new code. No browser page.
 */
export default function ForgotPasscodeScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ email?: string }>();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [code, setCode] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const verified = useRef(false);

  useEffect(() => {
    passcodeRecovery.begin();
    return () => passcodeRecovery.end();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendCode = async () => {
    setError('');
    setInfo('');
    if (!isSupabaseConfigured) {
      setError('Passcode recovery needs the online account service. It isn’t set up in this build.');
      return;
    }
    setLoading(true);
    try {
      const outcome = await requestPasscodeCode(passcodeClient, email);
      if (!outcome.ok) {
        setError(outcome.message);
        return;
      }
      verified.current = false;
      setCode('');
      setStep('code');
      setCooldown(RESEND_COOLDOWN_S);
      setInfo(`If ${email.trim()} has an account, a 6-digit code is on its way. It works once and expires soon.`);
    } finally {
      setLoading(false);
    }
  };

  const setNewPasscode = async () => {
    setError('');
    setLoading(true);
    try {
      const outcome = await completePasscodeReset(passcodeClient, {
        email,
        code,
        next,
        confirm,
        verified: verified.current,
      });
      if (!outcome.ok) {
        verified.current = Boolean(outcome.verified);
        setError(outcome.message);
        if (outcome.field === 'code' && !outcome.verified) setCode('');
        return;
      }
      router.replace({ pathname: '/(auth)/login', params: { email: email.trim(), notice: PASSCODE_UPDATED_NOTICE } });
    } finally {
      setLoading(false);
    }
  };

  const changeEmail = () => {
    verified.current = false;
    setStep('email');
    setCode('');
    setNext('');
    setConfirm('');
    setError('');
    setInfo('');
  };

  return (
    <AuthShell
      title="Forgot passcode"
      subtitle={step === 'email'
        ? 'We’ll email you a 6-digit code. Type it here, then choose a new passcode.'
        : `Enter the code we emailed to ${email.trim()}, then your new passcode.`}
      help={HELP.reset}
      icon="lock-reset"
      footer={
        <View style={styles.footerActions}>
          <Button
            mode="outlined"
            onPress={() => router.back()}
            disabled={loading}
            icon="arrow-left"
            contentStyle={styles.secondaryContent}
            style={styles.footerButton}
          >
            Back to sign in
          </Button>
          {step === 'email' ? (
            <Button
              mode="text"
              onPress={() => router.push('/(auth)/register')}
              disabled={loading}
              contentStyle={styles.secondaryContent}
              style={styles.footerButton}
            >
              Create account
            </Button>
          ) : null}
        </View>
      }
    >
      {step === 'email' ? (
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
            accessibilityLabel="Email"
          />
          <HelperText type="error" visible={Boolean(error)}>{error}</HelperText>
          <Button
            mode="contained"
            onPress={sendCode}
            loading={loading}
            disabled={loading}
            style={styles.pill}
            contentStyle={styles.primaryContent}
            labelStyle={styles.primaryLabel}
            accessibilityLabel="Email me a code"
          >
            Email me a code
          </Button>
          <Text variant="bodySmall" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
            For privacy, the same message shows whether or not the email has an account.
          </Text>
        </>
      ) : (
        <>
          <TextInput
            label="Code from the email"
            value={code}
            onChangeText={(text) => setCode(digitsOnly(text, EMAIL_CODE_MAX))}
            mode="outlined"
            keyboardType="number-pad"
            maxLength={EMAIL_CODE_MAX}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            disabled={loading || verified.current}
            left={<TextInput.Icon icon="email-check-outline" />}
            accessibilityLabel="Code from the email"
            style={styles.codeInput}
          />
          {info ? <HelperText type="info" visible>{info}</HelperText> : null}

          <PasscodeField value={next} onChangeText={setNext} disabled={loading} label="New 6-digit passcode" />
          <PasscodeField value={confirm} onChangeText={setConfirm} disabled={loading} label="Type it again" />

          <HelperText type="error" visible={Boolean(error)}>{error}</HelperText>

          <Button
            mode="contained"
            onPress={setNewPasscode}
            loading={loading}
            disabled={loading}
            style={styles.pill}
            contentStyle={styles.primaryContent}
            labelStyle={styles.primaryLabel}
            accessibilityLabel="Set new passcode"
          >
            Set new passcode
          </Button>

          <View style={styles.row}>
            <Button
              mode="text"
              onPress={sendCode}
              disabled={loading || cooldown > 0}
              contentStyle={styles.secondaryContent}
              accessibilityLabel="Send a new code"
            >
              {cooldown > 0 ? `Send a new code (${cooldown}s)` : 'Send a new code'}
            </Button>
            <Button mode="text" onPress={changeEmail} disabled={loading} contentStyle={styles.secondaryContent}>
              Different email
            </Button>
          </View>
        </>
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: radius.full },
  primaryContent: { height: 56 },
  primaryLabel: { fontSize: 16, fontWeight: '700' },
  secondaryContent: { height: MIN_TOUCH_TARGET },
  note: { textAlign: 'center', lineHeight: 18, marginTop: spacing.sm },
  footerActions: { gap: spacing.sm },
  footerButton: { width: '100%' },
  row: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' },
  codeInput: { fontSize: 22, letterSpacing: 4 },
});

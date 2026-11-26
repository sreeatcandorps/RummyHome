import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { HelperText, Text, TextInput } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { router, useLocalSearchParams } from 'expo-router';
import { OtpField } from '@/components/ui/OtpField';
import { PasscodeField } from '@/components/ui/PasscodeField';
import { AuthShell } from '@/components/ui/AuthShell';
import { CodeStep } from '@/components/ui/CodeStep';
import { SignInMethodSwitch } from '@/components/ui/SignInMethodSwitch';
import { WhatsAppNumberField } from '@/components/ui/WhatsAppNumberField';
import { MIN_TOUCH_TARGET, radius, spacing, useAppTheme } from '@/constants/theme';
import { isSupabaseConfigured } from '@/services/supabase';
import { authService, passcodeClient, releaseMyWhatsAppNumber, whatsAppAuth } from '@/services/auth';
import { loadSignInDefaults, rememberSignInMethod } from '@/services/deviceCountry';
import { passcodeRecovery } from '@/utils/authFlow';
import { newPasscodeProblem, passcodeErrorMessage, RESEND_COOLDOWN_S } from '@/utils/passcode';
import { completePasscodeReset, requestPasscodeCode } from '@/utils/passcodeFlow';
import { SignInMethod } from '@/utils/signInDefaults';
import { DEFAULT_WHATSAPP_COUNTRY, maskWhatsAppNumber, parseStoredPhone, whatsAppCountry, whatsAppE164, whatsAppNumberProblem } from '@/utils/countries';
import { playerIdBadge } from '@/utils/myPlayersList';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { WHATSAPP_SIGNUP_TEXT } from '@/utils/whatsappAuth';
import 'react-native-url-polyfill/auto';

type Step = 'email' | 'code' | 'wa-code' | 'wa-new' | 'wa-not-you';

export const PASSCODE_UPDATED_NOTICE = 'Passcode updated. Sign in with your new 6-digit passcode.';

export const FORGOT_WHATSAPP_TEXT = {
  subtitle: 'We send a code to your WhatsApp or your email',
  numberHint: 'The number you signed up with. If it no longer works, switch to Email and use your backup email.',
  send: 'Send code',
  newTitle: 'Set a new passcode',
  /** The recycled-number guard (WhatsApp spec §5a case 5): one line, not a dialog (D50). */
  thisIs: (who: string) => `This is the account of ${who}.`,
  notYou: 'Not you?',
  notYouTitle: 'This number belonged to someone before you.',
  notYouBody: 'Phone companies give unused numbers to new people. Start your own account with this number; the old account keeps its email, if it has one.',
  startNew: 'Start a new account with this number',
  itIsMe: 'It is me',
  save: 'Save and sign in',
} as const;

/**
 * Forgot passcode, all inside the app. Email (today's reset): email → 6-digit OTP + new passcode →
 * back to Sign in with the new passcode. WhatsApp (D124): number → the shared code step → Set a new passcode →
 * Home, signed in. No browser page, no link needed.
 */
export default function ForgotPasscodeScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ email?: string; whatsapp?: string }>();
  const paramNumber = typeof params.whatsapp === 'string' ? parseStoredPhone(params.whatsapp) : null;
  const [method, setMethod] = useState<SignInMethod>(paramNumber ? 'whatsapp' : 'email');
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [waCountry, setWaCountry] = useState(paramNumber?.country ?? DEFAULT_WHATSAPP_COUNTRY);
  const [waNumber, setWaNumber] = useState(paramNumber?.national ?? '');
  const [sentTo, setSentTo] = useState('');
  const [whoseAccount, setWhoseAccount] = useState<string | null>(null);
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

  // D125: the way last used on this phone, else the phone's country.
  useEffect(() => {
    if (params.email || paramNumber) return;
    let live = true;
    loadSignInDefaults(true).then((defaults) => {
      if (!live) return;
      setMethod(defaults.method);
      setWaCountry(whatsAppCountry(defaults.country) ?? DEFAULT_WHATSAPP_COUNTRY);
    }).catch(() => {});
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setInfo(`If ${email.trim()} has an account, a 6-digit OTP is on its way. It works once and expires in 15 minutes.`);
    } finally {
      setLoading(false);
    }
  };

  const sendWhatsAppCode = async () => {
    setError('');
    if (!isSupabaseConfigured) {
      setError(WHATSAPP_SIGNUP_TEXT.notReady);
      return;
    }
    const problem = whatsAppNumberProblem(waCountry, waNumber);
    if (problem) {
      setError(problem);
      return;
    }
    const e164 = whatsAppE164(waCountry, waNumber)!;
    setLoading(true);
    try {
      const outcome = await whatsAppAuth.sendCode('recovery', e164);
      if (!outcome.ok) {
        setError(outcome.message);
        return;
      }
      setSentTo(e164);
      setStep('wa-code');
    } finally {
      setLoading(false);
    }
  };

  const afterWhatsAppCode = async () => {
    const profile = await authService.getCurrentProfile().catch(() => null);
    const badge = profile ? playerIdBadge(profile) : null;
    setWhoseAccount(profile ? [profile.displayName, badge].filter(Boolean).join(' · ') : null);
    setNext('');
    setConfirm('');
    setError('');
    setStep('wa-new');
  };

  const saveWhatsAppPasscode = async () => {
    setError('');
    const problem = newPasscodeProblem(next, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setLoading(true);
    try {
      const saved = await passcodeClient.setPasscode(next);
      if (saved.error) {
        setError(passcodeErrorMessage(saved.error));
        return;
      }
      await rememberSignInMethod('whatsapp').catch(() => {});
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  };

  const startNewAccount = async () => {
    setError('');
    setLoading(true);
    try {
      await releaseMyWhatsAppNumber();
      router.replace({ pathname: '/(auth)/register', params: { whatsapp: sentTo } });
    } catch (err) {
      setError(formatSupabaseError(err));
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

  if (step === 'wa-code') {
    return (
      <CodeStep
        channel="whatsapp"
        to={maskWhatsAppNumber(sentTo)}
        verifyLabel="Confirm"
        testIDPrefix="forgot"
        onVerify={async (typed) => {
          const outcome = await whatsAppAuth.verifyCode('recovery', sentTo, typed);
          if (outcome.ok) await afterWhatsAppCode();
          return outcome;
        }}
        onResend={() => whatsAppAuth.sendCode('recovery', sentTo)}
        onBack={() => { setStep('email'); setError(''); }}
      />
    );
  }

  if (step === 'wa-new' || step === 'wa-not-you') {
    return (
      <AuthShell title={FORGOT_WHATSAPP_TEXT.newTitle} subtitle={maskWhatsAppNumber(sentTo)} icon="lock-reset" help="sign-in">
        {step === 'wa-not-you' ? (
          <>
            <Text variant="titleMedium" style={styles.fieldTitle}>{FORGOT_WHATSAPP_TEXT.notYouTitle}</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{FORGOT_WHATSAPP_TEXT.notYouBody}</Text>
            <HelperText type="error" visible={Boolean(error)}>{error}</HelperText>
            <Button
              mode="contained"
              onPress={startNewAccount}
              loading={loading}
              disabled={loading}
              style={styles.pill}
              contentStyle={styles.primaryContent}
              labelStyle={styles.primaryLabel}
              testID="forgot-start-new"
            >
              {FORGOT_WHATSAPP_TEXT.startNew}
            </Button>
            <Button mode="text" onPress={() => { setStep('wa-new'); setError(''); }} disabled={loading} contentStyle={styles.secondaryContent}>
              {FORGOT_WHATSAPP_TEXT.itIsMe}
            </Button>
          </>
        ) : (
          <>
            {whoseAccount ? (
              <View style={styles.whoRow}>
                <Text variant="bodyMedium" testID="forgot-whose-account">{FORGOT_WHATSAPP_TEXT.thisIs(whoseAccount)}</Text>
                <Button mode="text" compact onPress={() => { setStep('wa-not-you'); setError(''); }} disabled={loading} testID="forgot-not-you">
                  {FORGOT_WHATSAPP_TEXT.notYou}
                </Button>
              </View>
            ) : null}
            <PasscodeField value={next} onChangeText={setNext} disabled={loading} label="New 6-digit passcode" autoFocus testID="forgot-new-passcode" />
            <PasscodeField value={confirm} onChangeText={setConfirm} disabled={loading} label="Type it again" testID="forgot-confirm-passcode" />
            <HelperText type="error" visible={Boolean(error)}>{error}</HelperText>
            <Button
              mode="contained"
              onPress={saveWhatsAppPasscode}
              loading={loading}
              disabled={loading}
              style={styles.pill}
              contentStyle={styles.primaryContent}
              labelStyle={styles.primaryLabel}
              testID="forgot-save-passcode"
            >
              {FORGOT_WHATSAPP_TEXT.save}
            </Button>
          </>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot passcode"
      subtitle={step === 'email'
        ? (method === 'whatsapp' ? FORGOT_WHATSAPP_TEXT.subtitle : 'We’ll email you a 6-digit OTP. Type it here, then choose a new passcode. No web page needed.')
        : `Type the 6-digit OTP we emailed to ${email.trim()}, then choose your new passcode.`}
      help="sign-in"
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
          <SignInMethodSwitch value={method} onChange={(value) => { setMethod(value); setError(''); }} disabled={loading} testIDPrefix="forgot" />
          {method === 'whatsapp' ? (
            <>
              <WhatsAppNumberField
                country={waCountry}
                onCountryChange={setWaCountry}
                value={waNumber}
                onChangeText={setWaNumber}
                disabled={loading}
                onSubmitEditing={sendWhatsAppCode}
                testID="forgot-number"
              />
              <HelperText type={error ? 'error' : 'info'} visible>{error || FORGOT_WHATSAPP_TEXT.numberHint}</HelperText>
              <Button
                mode="contained"
                onPress={sendWhatsAppCode}
                loading={loading}
                disabled={loading}
                style={styles.pill}
                contentStyle={styles.primaryContent}
                labelStyle={styles.primaryLabel}
                testID="forgot-send"
              >
                {FORGOT_WHATSAPP_TEXT.send}
              </Button>
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
          )}
        </>
      ) : (
        <>
          <Text variant="titleSmall" style={styles.fieldTitle}>Step 1 · OTP from the email</Text>
          <OtpField value={code} onChangeText={setCode} disabled={loading || verified.current} autoFocus />
          {info ? <HelperText type="info" visible>{info}</HelperText> : null}

          <Text variant="titleSmall" style={styles.fieldTitle}>Step 2 · Your new passcode</Text>

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
              {cooldown > 0 ? `Send a new OTP (${cooldown}s)` : 'Send a new OTP'}
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
  fieldTitle: { fontWeight: '700', marginTop: spacing.sm },
  whoRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
});

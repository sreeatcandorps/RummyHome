import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { HelperText, Text } from 'react-native-paper';
import { AuthShell } from '@/components/ui/AuthShell';
import { Button } from '@/components/ui/AppButton';
import { OtpField } from '@/components/ui/OtpField';
import { HelpTopicKey } from '@/constants/helpTopics';
import { MIN_TOUCH_TARGET, radius, spacing, useAppTheme } from '@/constants/theme';
import { CodeChannel, cleanSignUpCode, codeStepIcon, codeStepText, SIGNUP_RESEND_COOLDOWN_S, SignUpCodeOutcome } from '@/utils/signUpCode';

/**
 * The one code step (D101, WhatsApp spec §8(b), flow 3): one code box, Confirm and sign in, Send a new code
 * after 60 s, and Go back. Email and WhatsApp are the same screen; only the icon, the title, the field label
 * and "Wrong address?" / "Wrong number?" change. Used by Create account, Forgot passcode, the backup step and
 * Profile › Sign-in methods. The caller says what Confirm and Send a new code do.
 */
export function CodeStep({
  channel,
  to,
  onVerify,
  onResend,
  onBack,
  verifyLabel,
  help = 'sign-in',
  helpAnchor,
  testIDPrefix,
  note,
}: {
  channel: CodeChannel;
  /** The address, or the number already masked ("+91 98xxx xx210"). */
  to: string;
  onVerify: (code: string) => Promise<SignUpCodeOutcome>;
  /** The request that sent the first code, made again: WhatsApp stays WhatsApp (never `auth.resend`). */
  onResend: () => Promise<SignUpCodeOutcome>;
  onBack: () => void;
  verifyLabel?: string;
  help?: HelpTopicKey;
  helpAnchor?: string;
  /** `register` gives register-code, register-verify, register-resend, register-go-back. */
  testIDPrefix: string;
  note?: string;
}) {
  const theme = useAppTheme();
  const words = codeStepText(channel);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(SIGNUP_RESEND_COOLDOWN_S);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const verify = async () => {
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const outcome = await onVerify(code);
      if (!outcome.ok) setError(outcome.message);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const outcome = await onResend();
      if (!outcome.ok) {
        setError(outcome.message);
        return;
      }
      setCode('');
      setCooldown(SIGNUP_RESEND_COOLDOWN_S);
      setInfo(words.sent(to));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title={words.title} subtitle={words.subtitle(to)} icon={codeStepIcon(channel)} help={help} helpAnchor={helpAnchor}>
      <OtpField
        value={code}
        onChangeText={(text) => setCode(cleanSignUpCode(text))}
        disabled={loading}
        autoFocus
        label={words.fieldLabel}
        placeholder={words.placeholder}
        icon={channel === 'whatsapp' ? 'whatsapp' : 'email-check-outline'}
        testID={`${testIDPrefix}-code`}
      />
      {error ? <HelperText type="error" visible>{error}</HelperText> : null}
      {info ? <HelperText type="info" visible>{info}</HelperText> : null}
      <Button
        mode="contained"
        onPress={verify}
        loading={loading}
        disabled={loading}
        style={styles.pill}
        contentStyle={styles.primaryContent}
        labelStyle={styles.primaryLabel}
        testID={`${testIDPrefix}-verify`}
      >
        {verifyLabel ?? words.verify}
      </Button>
      <Button
        mode="text"
        onPress={resend}
        disabled={loading || cooldown > 0}
        contentStyle={styles.secondaryContent}
        testID={`${testIDPrefix}-resend`}
      >
        {cooldown > 0 ? words.resendIn(cooldown) : words.resend}
      </Button>
      <View style={styles.backRow}>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>{words.wrongAddress}</Text>
        <Button mode="text" onPress={onBack} disabled={loading} compact testID={`${testIDPrefix}-go-back`}>
          {words.goBack}
        </Button>
      </View>
      {note ? (
        <Text variant="bodySmall" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>{note}</Text>
      ) : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: radius.full },
  primaryContent: { height: 56 },
  primaryLabel: { fontSize: 16, fontWeight: '700' },
  secondaryContent: { height: MIN_TOUCH_TARGET },
  backRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  note: { textAlign: 'center', lineHeight: 18, marginTop: spacing.sm },
});

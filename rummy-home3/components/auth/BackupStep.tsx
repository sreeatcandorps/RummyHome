import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { HelperText, TextInput } from 'react-native-paper';
import { AuthShell } from '@/components/ui/AuthShell';
import { Button } from '@/components/ui/AppButton';
import { CodeStep } from '@/components/ui/CodeStep';
import { WhatsAppNumberField } from '@/components/ui/WhatsAppNumberField';
import { MIN_TOUCH_TARGET, radius } from '@/constants/theme';
import { emailChange, whatsAppAuth } from '@/services/auth';
import { emailProblem } from '@/utils/passcode';
import { maskWhatsAppNumber, WhatsAppCountry, whatsAppE164, whatsAppNumberProblem } from '@/utils/countries';

export const BACKUP_TEXT = {
  title: 'Add a backup',
  afterWhatsApp: 'If you ever lose this WhatsApp number',
  afterEmail: 'If you ever lose access to this email',
  emailLabel: 'Backup email',
  emailHint: 'We email a code to confirm it. It becomes a second way in. We never email you anything else unless you turn it on.',
  whatsAppLabel: 'Backup WhatsApp number',
  whatsAppHint: 'We send a code on WhatsApp to confirm it. It becomes a second way in. We never message it otherwise.',
  send: 'Send code',
  skip: 'Skip for now',
} as const;

/**
 * The backup contact right after sign-up (D75, `wa-backup.png`): the other kind of contact, confirmed with a
 * code, Skip for now always there. A WhatsApp account is offered an email; an email account a WhatsApp number.
 */
export function BackupStep({ signedUpWith, country: startCountry, onDone }: {
  signedUpWith: 'whatsapp' | 'email';
  /** Where the number picker starts (D125). */
  country: WhatsAppCountry;
  /** Skip for now, or the backup confirmed: on to Home. */
  onDone: () => void;
}) {
  const offer = signedUpWith === 'whatsapp' ? 'email' : 'whatsapp';
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState(startCountry);
  const [number, setNumber] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const target = offer === 'email' ? email.trim().toLowerCase() : whatsAppE164(country, number) ?? '';

  const send = async () => {
    setError('');
    const problem = offer === 'email' ? emailProblem(email) : whatsAppNumberProblem(country, number);
    if (problem) {
      setError(problem);
      return;
    }
    setLoading(true);
    try {
      const outcome = offer === 'email' ? await emailChange.sendCode(target) : await whatsAppAuth.sendCode('change', target);
      if (!outcome.ok) {
        setError(outcome.message);
        return;
      }
      if ('done' in outcome && outcome.done) {
        onDone();
        return;
      }
      setSentTo(target);
    } finally {
      setLoading(false);
    }
  };

  if (sentTo) {
    return (
      <CodeStep
        channel={offer}
        to={offer === 'email' ? sentTo : maskWhatsAppNumber(sentTo)}
        verifyLabel="Confirm"
        helpAnchor="create-account"
        testIDPrefix="backup"
        onVerify={async (code) => {
          const outcome = offer === 'email' ? await emailChange.verifyCode(sentTo, code) : await whatsAppAuth.verifyCode('change', sentTo, code);
          if (outcome.ok) onDone();
          return outcome;
        }}
        onResend={() => (offer === 'email' ? emailChange.sendCode(sentTo) : whatsAppAuth.sendCode('change', sentTo))}
        onBack={() => { setSentTo(null); setError(''); }}
      />
    );
  }

  return (
    <AuthShell
      title={BACKUP_TEXT.title}
      subtitle={signedUpWith === 'whatsapp' ? BACKUP_TEXT.afterWhatsApp : BACKUP_TEXT.afterEmail}
      icon="shield-account-outline"
      help="sign-in"
      helpAnchor="create-account"
    >
      {offer === 'email' ? (
        <TextInput
          label={BACKUP_TEXT.emailLabel}
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          mode="outlined"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          disabled={loading}
          onSubmitEditing={send}
          testID="backup-email"
        />
      ) : (
        <WhatsAppNumberField
          country={country}
          onCountryChange={setCountry}
          value={number}
          onChangeText={setNumber}
          label={BACKUP_TEXT.whatsAppLabel}
          disabled={loading}
          onSubmitEditing={send}
          testID="backup-number"
        />
      )}
      <HelperText type={error ? 'error' : 'info'} visible>
        {error || (offer === 'email' ? BACKUP_TEXT.emailHint : BACKUP_TEXT.whatsAppHint)}
      </HelperText>
      <Button
        mode="contained"
        onPress={send}
        loading={loading}
        disabled={loading}
        style={styles.pill}
        contentStyle={styles.primaryContent}
        labelStyle={styles.primaryLabel}
        testID="backup-send"
      >
        {BACKUP_TEXT.send}
      </Button>
      <Button mode="text" onPress={onDone} disabled={loading} contentStyle={styles.secondaryContent} testID="backup-skip">
        {BACKUP_TEXT.skip}
      </Button>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: radius.full },
  primaryContent: { height: 56 },
  primaryLabel: { fontSize: 16, fontWeight: '700' },
  secondaryContent: { height: MIN_TOUCH_TARGET },
});

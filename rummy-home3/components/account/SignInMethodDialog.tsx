import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Dialog, Text, TextInput } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { WhatsAppNumberField } from '@/components/ui/WhatsAppNumberField';
import { spacing, useAppTheme } from '@/constants/theme';
import { emailChange, whatsAppAuth } from '@/services/auth';
import { WhatsAppCountry, whatsAppE164, whatsAppNumberProblem } from '@/utils/countries';
import { emailProblem } from '@/utils/passcode';

export function signInMethodSheetText(kind: 'email' | 'whatsapp', changing: boolean) {
  if (kind === 'whatsapp') {
    return {
      title: changing ? 'Change WhatsApp number' : 'Add a WhatsApp number',
      body: 'We send a code on WhatsApp to the new number. Your account, Player ID, passcode and games stay the same.',
      label: changing ? 'New WhatsApp number' : 'WhatsApp number',
    };
  }
  return {
    title: changing ? 'Change email' : 'Add a backup email',
    body: 'We email a code to the new address. Your account, Player ID, passcode and games stay the same.',
    label: changing ? 'New email' : 'Email',
  };
}

/**
 * Profile › Sign-in methods › Email or WhatsApp (`wa-profile.png`, flow 6): the new number or address, Send code,
 * Cancel. The code goes to the NEW one; the old one stops working once the code is typed. No Remove (D50).
 */
export function SignInMethodDialog({ kind, changing, country: startCountry, onSent, onDismiss }: {
  kind: 'email' | 'whatsapp';
  changing: boolean;
  country: WhatsAppCountry;
  /** The code is on its way to `to` (an email, or "+<digits>"); `done` when it changed at once, with no code. */
  onSent: (to: string, done: boolean) => void;
  onDismiss: () => void;
}) {
  const { colors } = useAppTheme();
  const words = signInMethodSheetText(kind, changing);
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState(startCountry);
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setError(null);
    const problem = kind === 'email' ? emailProblem(email) : whatsAppNumberProblem(country, number);
    if (problem) {
      setError(problem);
      return;
    }
    const to = kind === 'email' ? email.trim().toLowerCase() : whatsAppE164(country, number)!;
    setBusy(true);
    try {
      const outcome = kind === 'email' ? await emailChange.sendCode(to) : await whatsAppAuth.sendCode('change', to);
      if (!outcome.ok) {
        setError(outcome.message);
        return;
      }
      onSent(to, 'done' in outcome && Boolean(outcome.done));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={StyleSheet.absoluteFill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} pointerEvents="box-none">
      <Dialog visible onDismiss={onDismiss} style={{ backgroundColor: colors.surface }} testID="me-sign-in-method-dialog">
        <Dialog.Title>{words.title}</Dialog.Title>
        <Dialog.Content style={styles.content}>
          <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>{words.body}</Text>
          {kind === 'email' ? (
            <TextInput
              mode="outlined"
              label={words.label}
              value={email}
              onChangeText={setEmail}
              autoFocus
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="done"
              onSubmitEditing={send}
              disabled={busy}
              accessibilityLabel={words.label}
              testID="me-sign-in-method-email"
            />
          ) : (
            <WhatsAppNumberField
              country={country}
              onCountryChange={setCountry}
              value={number}
              onChangeText={setNumber}
              label={words.label}
              autoFocus
              disabled={busy}
              onSubmitEditing={send}
              testID="me-sign-in-method-number"
            />
          )}
          {error ? <Text variant="bodySmall" style={{ color: colors.error }}>{error}</Text> : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={busy}>Cancel</Button>
          <Button mode="contained" onPress={send} loading={busy} disabled={busy} testID="me-sign-in-method-send">Send code</Button>
        </Dialog.Actions>
      </Dialog>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
});

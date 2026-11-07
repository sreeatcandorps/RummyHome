import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Dialog, HelperText, Portal, Text, TextInput } from 'react-native-paper';
import { PasscodeField } from '@/components/ui/PasscodeField';
import { spacing, useAppTheme } from '@/constants/theme';
import { passcodeClient } from '@/services/auth';
import { passcodeRecovery } from '@/utils/authFlow';
import { digitsOnly, EMAIL_CODE_MAX } from '@/utils/passcode';
import { changePasscode } from '@/utils/passcodeFlow';

type Props = {
  visible: boolean;
  email: string;
  onDismiss: () => void;
  onChanged: () => void;
};

/**
 * Signed-in passcode change, no email round trip: current passcode → new passcode twice.
 * Only if the project insists on a fresh check does a second step ask for an emailed code.
 */
export function ChangePasscodeDialog({ visible, email, onDismiss, onChanged }: Props) {
  const { colors } = useAppTheme();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [nonce, setNonce] = useState('');
  const [needNonce, setNeedNonce] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCurrent('');
    setNext('');
    setConfirm('');
    setNonce('');
    setNeedNonce(false);
    setError('');
    passcodeRecovery.begin();
    return () => passcodeRecovery.end();
  }, [visible]);

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      const outcome = await changePasscode(passcodeClient, { email, current, next, confirm, nonce: needNonce ? nonce : undefined });
      if (!outcome.ok) {
        setError(outcome.message);
        if (outcome.reauthentication) setNeedNonce(true);
        return;
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={busy ? undefined : onDismiss} style={styles.dialog}>
        <Dialog.Title>Change passcode</Dialog.Title>
        <Dialog.ScrollArea style={styles.area}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {needNonce ? (
              <>
                <Text variant="bodyMedium">We emailed a code to {email}. Enter it to finish.</Text>
                <TextInput
                  label="Code from the email"
                  value={nonce}
                  onChangeText={(text) => setNonce(digitsOnly(text, EMAIL_CODE_MAX))}
                  mode="outlined"
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  disabled={busy}
                  accessibilityLabel="Code from the email"
                />
              </>
            ) : (
              <>
                <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
                  Your passcode is the 6 digits you sign in with. Nothing changes until the new one is saved.
                </Text>
                <PasscodeField value={current} onChangeText={setCurrent} disabled={busy} label="Current passcode" />
                <PasscodeField value={next} onChangeText={setNext} disabled={busy} label="New 6-digit passcode" />
                <PasscodeField value={confirm} onChangeText={setConfirm} disabled={busy} label="Type it again" />
              </>
            )}
            <HelperText type="error" visible={Boolean(error)}>{error}</HelperText>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={busy}>Cancel</Button>
          <Button mode="contained" onPress={submit} loading={busy} disabled={busy} accessibilityLabel="Save new passcode">
            Save new passcode
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: { maxHeight: '90%' },
  area: { paddingHorizontal: 0 },
  body: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});

import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Dialog, HelperText, Portal, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { OtpField } from '@/components/ui/OtpField';
import { PasscodeField } from '@/components/ui/PasscodeField';
import { spacing, useAppTheme } from '@/constants/theme';
import { passcodeClient } from '@/services/auth';
import { passcodeRecovery } from '@/utils/authFlow';
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
      <KeyboardAvoidingView style={StyleSheet.absoluteFill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} pointerEvents="box-none">
      <Dialog visible={visible} onDismiss={busy ? undefined : onDismiss} style={styles.dialog}>
        <Dialog.Title>Change passcode</Dialog.Title>
        <Dialog.ScrollArea style={styles.area}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {needNonce ? (
              <>
                <Text variant="bodyMedium">We emailed a 6-digit OTP to {email}. Type it to finish.</Text>
                <OtpField value={nonce} onChangeText={setNonce} disabled={busy} autoFocus />
              </>
            ) : (
              <>
                {/* Fields first, the sentence after (PR 10b): the keyboard no longer covers the cells on small phones. */}
                <PasscodeField value={current} onChangeText={setCurrent} disabled={busy} label="Current passcode" testID="passcode-current" />
                <PasscodeField value={next} onChangeText={setNext} disabled={busy} label="New 6-digit passcode" testID="passcode-next" />
                <PasscodeField value={confirm} onChangeText={setConfirm} disabled={busy} label="Type it again" testID="passcode-confirm" />
                <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                  Your passcode is the 6 digits you sign in with. Nothing changes until the new one is saved.
                </Text>
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
      </KeyboardAvoidingView>
    </Portal>
  );
}

const styles = StyleSheet.create({
  // Anchored near the top so three rows of cells stay above the keyboard.
  dialog: { maxHeight: '90%', marginTop: spacing.xl, alignSelf: 'center', width: '92%', maxWidth: 520, top: 0, position: 'absolute' },
  area: { paddingHorizontal: 0 },
  body: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});

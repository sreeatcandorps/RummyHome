import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Checkbox, Dialog, Portal, Text, TouchableRipple } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { authService } from '@/services/auth';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import {
  DELETE_ACCOUNT_BUTTON,
  DELETE_ACCOUNT_CONFIRM_LABEL,
  DELETE_ACCOUNT_SUPPORT_LINE,
  DELETE_ACCOUNT_TITLE,
  DELETED_ITEMS,
  DeleteAccountSummary,
  KEPT_ITEMS,
} from '@/utils/accountDeletion';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  /** The account is gone and the phone has forgotten the session. */
  onDeleted: (summary: DeleteAccountSummary) => void;
};

/**
 * Profile > Delete account. Says exactly what goes and what stays, needs one tick, and
 * then calls the server (026). The lists come from utils/accountDeletion so the public
 * /delete-account page and the privacy policy say the same thing.
 */
export function DeleteAccountDialog({ visible, onDismiss, onDeleted }: Props) {
  const { colors } = useAppTheme();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setAgreed(false);
    setError(null);
    onDismiss();
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const summary = await authService.deleteAccount();
      setAgreed(false);
      onDeleted(summary);
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={close} style={[styles.dialog, { backgroundColor: colors.surface }]} testID="delete-account-dialog">
        <Dialog.Icon icon="account-remove-outline" color={colors.error} />
        <Dialog.Title style={styles.title}>{DELETE_ACCOUNT_TITLE}</Dialog.Title>
        <Dialog.ScrollArea style={styles.area}>
          <View style={styles.body}>
            <Text variant="titleSmall">Deleted now</Text>
            {DELETED_ITEMS.map((line) => (
              <Text key={line} variant="bodyMedium" style={styles.line}>{`\u2022 ${line}`}</Text>
            ))}
            <Text variant="titleSmall" style={styles.heading}>Kept</Text>
            {KEPT_ITEMS.map((line) => (
              <Text key={line} variant="bodyMedium" style={styles.line}>{`\u2022 ${line}`}</Text>
            ))}
            <Text variant="bodySmall" style={[styles.heading, { color: colors.onSurfaceVariant }]}>{DELETE_ACCOUNT_SUPPORT_LINE}</Text>
            <TouchableRipple
              onPress={() => setAgreed((value) => !value)}
              disabled={busy}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed }}
              accessibilityLabel={DELETE_ACCOUNT_CONFIRM_LABEL}
              testID="delete-account-agree"
              style={styles.agree}
            >
              <View style={styles.agreeRow}>
                <Checkbox status={agreed ? 'checked' : 'unchecked'} onPress={() => setAgreed((value) => !value)} disabled={busy} />
                <Text variant="bodyMedium" style={styles.flex}>{DELETE_ACCOUNT_CONFIRM_LABEL}</Text>
              </View>
            </TouchableRipple>
            {error ? <Text variant="bodySmall" style={{ color: colors.error }}>{error}</Text> : null}
          </View>
        </Dialog.ScrollArea>
        <Dialog.Actions style={styles.actions}>
          <Button mode="outlined" onPress={close} disabled={busy} accessibilityLabel="Keep my account">Keep my account</Button>
          <Button
            mode="contained"
            buttonColor={colors.error}
            onPress={run}
            loading={busy}
            disabled={!agreed || busy}
            accessibilityLabel={DELETE_ACCOUNT_BUTTON}
            testID="delete-account-confirm"
          >
            {DELETE_ACCOUNT_BUTTON}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: { borderRadius: radius.xl, maxWidth: 520, width: '92%', alignSelf: 'center', maxHeight: '90%' },
  title: { textAlign: 'center' },
  area: { paddingHorizontal: 0 },
  body: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.xs },
  heading: { marginTop: spacing.sm },
  line: { paddingLeft: spacing.xs },
  agree: { marginTop: spacing.sm, borderRadius: radius.md },
  agreeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingRight: spacing.sm },
  flex: { flex: 1 },
  actions: { justifyContent: 'flex-end', gap: spacing.xs, flexWrap: 'wrap' },
});

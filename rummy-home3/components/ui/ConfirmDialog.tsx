import React from 'react';
import { StyleSheet } from 'react-native';
import { Dialog, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { radius, useAppTheme } from '@/constants/theme';

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  /** The confirming verb repeats the title (A05): "Remove", "Delete", "Deselect". */
  confirmLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
  icon?: string;
  /** Red filled button for anything that removes or deletes. */
  destructive?: boolean;
  busy?: boolean;
  cancelLabel?: string;
  testID?: string;
};

/**
 * The one two-button question (design audit A09): Paper only, never `Alert.alert` — the native dialog
 * has its own font, colours and button order on Android. Cancel on the left, the verb on the right.
 */
export function ConfirmDialog({ visible, title, message, confirmLabel, onConfirm, onDismiss, icon, destructive = false, busy = false, cancelLabel = 'Cancel', testID }: ConfirmDialogProps) {
  const { colors } = useAppTheme();
  return (
    <Dialog visible={visible} onDismiss={busy ? undefined : onDismiss} style={[styles.dialog, { backgroundColor: colors.surface }]} testID={testID}>
      {icon ? <Dialog.Icon icon={icon} color={destructive ? colors.error : undefined} /> : null}
      <Dialog.Title style={icon ? styles.center : undefined}>{title}</Dialog.Title>
      <Dialog.Content>
        <Text variant="bodyMedium" style={icon ? styles.center : undefined}>{message}</Text>
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss} disabled={busy} accessibilityLabel={cancelLabel}>{cancelLabel}</Button>
        <Button
          mode="contained"
          onPress={onConfirm}
          loading={busy}
          disabled={busy}
          buttonColor={destructive ? colors.error : undefined}
          textColor={destructive ? colors.onError : undefined}
          accessibilityLabel={confirmLabel}
          testID={testID ? `${testID}-confirm` : undefined}
        >
          {confirmLabel}
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  dialog: { borderRadius: radius.xl, maxWidth: 480, width: '90%', alignSelf: 'center' },
  center: { textAlign: 'center' },
});

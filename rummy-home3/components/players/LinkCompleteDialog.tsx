import React from 'react';
import { StyleSheet } from 'react-native';
import { Button, Dialog, Text } from 'react-native-paper';
import { radius, useAppTheme } from '@/constants/theme';
import { LINK_COMPLETE_TITLE, linkCompleteMessage, LinkOutcome } from '@/utils/linkPlayer';

/** The link-complete pop-up: who became whom, and which games moved. */
export function LinkCompleteDialog({ outcome, onDismiss }: { outcome: LinkOutcome; onDismiss: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Dialog visible onDismiss={onDismiss} style={[styles.dialog, { backgroundColor: colors.surface }]} testID="link-complete">
      <Dialog.Icon icon="link-variant" />
      <Dialog.Title style={styles.title}>{LINK_COMPLETE_TITLE}</Dialog.Title>
      <Dialog.Content>
        <Text variant="bodyMedium" style={styles.title}>{linkCompleteMessage(outcome)}</Text>
      </Dialog.Content>
      <Dialog.Actions style={styles.actions}>
        <Button mode="contained" onPress={onDismiss} accessibilityLabel="OK">OK</Button>
      </Dialog.Actions>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  dialog: { borderRadius: radius.xl, maxWidth: 480, width: '90%', alignSelf: 'center' },
  title: { textAlign: 'center' },
  actions: { justifyContent: 'center' },
});

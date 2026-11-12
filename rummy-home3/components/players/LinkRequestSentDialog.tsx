import React from 'react';
import { StyleSheet } from 'react-native';
import { Button, Dialog, Text } from 'react-native-paper';
import { radius, useAppTheme } from '@/constants/theme';
import { LINK_REQUEST_SENT_TITLE, LinkRequestOutcome, linkRequestSentMessage } from '@/utils/linkPlayer';

/** After Send request: who was asked, how, and that the row reads Link pending until they say Yes. */
export function LinkRequestSentDialog({ outcome, onDismiss }: { outcome: LinkRequestOutcome; onDismiss: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Dialog visible onDismiss={onDismiss} style={[styles.dialog, { backgroundColor: colors.surface }]} testID="link-request-sent">
      <Dialog.Icon icon="email-fast-outline" />
      <Dialog.Title style={styles.title}>{LINK_REQUEST_SENT_TITLE}</Dialog.Title>
      <Dialog.Content>
        <Text variant="bodyMedium" style={styles.title}>{linkRequestSentMessage(outcome)}</Text>
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

import React from 'react';
import { StyleSheet } from 'react-native';
import { Button, Dialog, Text } from 'react-native-paper';
import { radius, useAppTheme } from '@/constants/theme';

/** A one-line, one-button pop-up for a one-time notice ("Harish (HG) is now linked to #40."). */
export function NoticeDialog({ title, message, icon = 'information-outline', onDismiss, testID }: {
  title: string;
  message: string;
  icon?: string;
  onDismiss: () => void;
  testID?: string;
}) {
  const { colors } = useAppTheme();
  return (
    <Dialog visible onDismiss={onDismiss} style={[styles.dialog, { backgroundColor: colors.surface }]} testID={testID}>
      <Dialog.Icon icon={icon} />
      <Dialog.Title style={styles.center}>{title}</Dialog.Title>
      <Dialog.Content>
        <Text variant="bodyMedium" style={styles.center}>{message}</Text>
      </Dialog.Content>
      <Dialog.Actions style={styles.actions}>
        <Button mode="contained" onPress={onDismiss} accessibilityLabel="OK">OK</Button>
      </Dialog.Actions>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  dialog: { borderRadius: radius.xl, maxWidth: 480, width: '90%', alignSelf: 'center' },
  center: { textAlign: 'center' },
  actions: { justifyContent: 'center' },
});

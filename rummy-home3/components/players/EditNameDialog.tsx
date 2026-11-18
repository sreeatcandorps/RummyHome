import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Dialog, Text, TextInput } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { Player } from '@/types/player';

/** Edit name for an unregistered player I added (the same dialog on the game's Players page and on My players). */
export function EditNameDialog({ seat, busy, onDismiss, onSave }: { seat: Player; busy: boolean; onDismiss: () => void; onSave: (first: string, last: string) => void }) {
  const { colors } = useAppTheme();
  const [first, setFirst] = useState(seat.firstName ?? seat.name.split(' ')[0] ?? '');
  const [last, setLast] = useState(seat.lastName ?? seat.name.split(' ').slice(1).join(' '));
  return (
    <Dialog visible onDismiss={onDismiss} style={[styles.dialog, { backgroundColor: colors.surface }]}>
      <Dialog.Title>Edit name</Dialog.Title>
      <Dialog.Content style={styles.gap}>
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
          Changes this player's name everywhere they appear. Only works until they register; after that the name is theirs.
        </Text>
        <TextInput label="First name" value={first} onChangeText={setFirst} mode="outlined" accessibilityLabel="First name" autoCapitalize="words" />
        <TextInput label="Last name" value={last} onChangeText={setLast} mode="outlined" accessibilityLabel="Last name" autoCapitalize="words" />
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss} disabled={busy}>Cancel</Button>
        <Button mode="contained" onPress={() => onSave(first, last)} loading={busy} disabled={busy || !first.trim() || !last.trim()} accessibilityLabel="Save name">Save</Button>
      </Dialog.Actions>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  dialog: { borderRadius: radius.xl, maxWidth: 520, width: '94%', alignSelf: 'center' },
  gap: { gap: spacing.sm },
});

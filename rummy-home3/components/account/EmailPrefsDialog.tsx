import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Dialog, Switch, Text, TouchableRipple } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { EmailPrefs } from '@/services/emails';
import { EMAIL_PREF_ROWS } from '@/utils/emailPrefs';
import { spacing, useAppTheme } from '@/constants/theme';

/**
 * Profile (D66, Size-S): the two e-mail switches with their one-line help, in a sheet off the
 * Email row. Each toggle saves at once, as the checkboxes did; a refusal shows under the list.
 */
export function EmailPrefsDialog({ prefs, error, onToggle, onDismiss }: {
  prefs: EmailPrefs;
  error: string | null;
  onToggle: (key: keyof EmailPrefs) => void;
  onDismiss: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Dialog visible onDismiss={onDismiss} style={{ backgroundColor: colors.surface }} testID="me-email-prefs">
      <Dialog.Title>Email</Dialog.Title>
      <Dialog.Content style={styles.content}>
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
          Sent to the address you signed up with. Each email has an unsubscribe link.
        </Text>
        {EMAIL_PREF_ROWS.map((row) => (
          <TouchableRipple
            key={row.key}
            onPress={() => onToggle(row.key)}
            accessibilityRole="switch"
            accessibilityState={{ checked: prefs[row.key] }}
            accessibilityLabel={`Email me: ${row.title}. ${row.help}`}
            testID={`me-email-${row.key}`}
          >
            <View style={styles.row}>
              <View style={styles.text}>
                <Text variant="bodyLarge">{row.title}</Text>
                <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{row.help}</Text>
              </View>
              <Switch value={prefs[row.key]} onValueChange={() => onToggle(row.key)} />
            </View>
          </TouchableRipple>
        ))}
        {error ? <Text variant="bodySmall" style={{ color: colors.error }}>{error}</Text> : null}
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss}>Done</Button>
      </Dialog.Actions>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  text: { flex: 1, gap: 2 },
});

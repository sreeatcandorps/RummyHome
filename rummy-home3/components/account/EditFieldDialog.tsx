import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Dialog, Text, TextInput } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { spacing, useAppTheme } from '@/constants/theme';

/**
 * Profile (D66, Size-S): one small sheet for a one-line field — Name, Phone. The row shows the
 * value; the sheet holds the input, the hint and the one Save. Validation stays with the caller
 * (`validate` returns the problem to show, or null); saving errors come back through `error`.
 */
export function EditFieldDialog({ title, label, initial, hint, placeholder, keyboardType, autoCapitalize, busy, error, validate, onSave, onDismiss, testID }: {
  title: string;
  label: string;
  initial: string;
  hint?: string;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad';
  autoCapitalize?: 'none' | 'words';
  busy: boolean;
  error?: string | null;
  validate?: (value: string) => string | null;
  onSave: (value: string) => void;
  onDismiss: () => void;
  testID?: string;
}) {
  const { colors } = useAppTheme();
  const [value, setValue] = useState(initial);
  const [touched, setTouched] = useState(false);
  const problem = validate ? validate(value) : null;
  const shown = (touched && problem) || error || null;
  const unchanged = value.trim() === initial.trim();
  const save = () => { setTouched(true); if (!problem) onSave(value); };

  return (
    <KeyboardAvoidingView style={StyleSheet.absoluteFill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} pointerEvents="box-none">
      <Dialog visible onDismiss={onDismiss} style={{ backgroundColor: colors.surface }} testID={testID}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content style={styles.content}>
          <TextInput
            mode="outlined"
            label={label}
            value={value}
            onChangeText={(next) => { setValue(next); setTouched(false); }}
            autoFocus
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            placeholder={placeholder}
            error={Boolean(shown)}
            returnKeyType="done"
            onSubmitEditing={save}
            accessibilityLabel={label}
            testID={testID ? `${testID}-input` : undefined}
          />
          {shown || hint ? (
            <Text variant="bodySmall" style={{ color: shown ? colors.error : colors.onSurfaceVariant }}>{shown ?? hint}</Text>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={busy}>Cancel</Button>
          <Button mode="contained" onPress={save} loading={busy} disabled={busy || unchanged} testID={testID ? `${testID}-save` : undefined}>Save</Button>
        </Dialog.Actions>
      </Dialog>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
});

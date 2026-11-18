import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Chip, Dialog, Text, TextInput } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import {
  defaultInitials,
  INITIALS_FORMAT,
  INITIALS_HELP,
  INITIALS_UNCHANGED_HINT,
  initialsProblem,
  normalizeInitials,
  suggestInitials,
} from '@/utils/initials';

/**
 * The one initials editor (PR 6, D6.4). It serves My players (the owner's list), the Add
 * new players screen and a game's Players page (one column of this game). `taken` is every
 * label the new value must differ from, mapped to who has it, so a clash names the other
 * player. Any free 2–3 characters are accepted as long as the first is a letter (SK2 is
 * fine); the chips suggest letter forms first and a digit form only when letters ran out.
 * The dialog sits inside a KeyboardAvoidingView so Save stays above the keyboard.
 */
export function InitialsDialog({ name, current, taken, scope, busy, onDismiss, onSave, onDelete, deleteConfirm, error }: {
  name: string;
  current: string | null | undefined;
  taken: Map<string, string>;
  /** Where uniqueness applies, for the helper line. */
  scope: 'my-players' | 'game';
  busy: boolean;
  onDismiss: () => void;
  onSave: (initials: string) => void;
  /** Add new players (PR 10b, Q10.8): a Delete action with a one-line confirm before it runs. */
  onDelete?: () => void;
  deleteConfirm?: string;
  /** A server refusal to show under the hint (the caller keeps the dialog open). */
  error?: string | null;
}) {
  const { colors } = useAppTheme();
  const [text, setText] = useState(current ?? defaultInitials(name));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const value = normalizeInitials(text);
  const problem = initialsProblem(text, taken);
  const fallback = defaultInitials(name);
  const chips = useMemo(() => {
    const options = [fallback, ...suggestInitials(name, taken.keys(), 4)].filter((label, index, all) => !taken.has(label) && all.indexOf(label) === index);
    return options.slice(0, 4);
  }, [name, taken, fallback]);
  const unchanged = value === normalizeInitials(current ?? '');
  const showProblem = Boolean(problem) && text.length > 0;
  const hint = showProblem ? problem : unchanged ? INITIALS_UNCHANGED_HINT : INITIALS_FORMAT;

  return (
    <KeyboardAvoidingView
      style={StyleSheet.absoluteFill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      pointerEvents="box-none"
    >
      <Dialog visible onDismiss={onDismiss} style={[styles.dialog, { backgroundColor: colors.surface }]}>
        <Dialog.Title>Initials for {name}</Dialog.Title>
        <Dialog.Content style={styles.gap}>
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
            {scope === 'my-players' ? INITIALS_HELP : 'Shown in this game’s scorecard column. Must be different from every other player in this game.'}
          </Text>
          <TextInput
            label="Initials"
            value={text}
            onChangeText={(next) => setText(next.toUpperCase())}
            mode="outlined"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={3}
            error={showProblem}
            accessibilityLabel="Initials"
            testID="initials-input"
            contentStyle={styles.inputText}
            onSubmitEditing={() => !problem && !unchanged && onSave(value)}
          />
          <Text variant="labelSmall" style={{ color: showProblem ? colors.error : colors.onSurfaceVariant }} accessibilityLabel={`Initials hint: ${hint}`}>
            {hint}
          </Text>
          {error ? <Text variant="labelSmall" style={{ color: colors.error }} accessibilityRole="alert">{error}</Text> : null}
          <View style={styles.chips}>
            {chips.map((label) => (
              <Chip
                key={label}
                compact
                mode={value === label ? 'flat' : 'outlined'}
                selected={value === label}
                showSelectedCheck={false}
                onPress={() => setText(label)}
                style={[styles.chip, value === label && { backgroundColor: colors.secondaryContainer }]}
                accessibilityLabel={`Use ${label}`}
              >
                {label}
              </Chip>
            ))}
          </View>
        </Dialog.Content>
        {confirmingDelete && onDelete ? (
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: colors.error }} testID="initials-delete-confirm">{deleteConfirm ?? `Remove ${name} from My players?`}</Text>
          </Dialog.Content>
        ) : null}
        <Dialog.Actions>
          {onDelete ? (
            confirmingDelete ? (
              <Button textColor={colors.error} onPress={onDelete} loading={busy} disabled={busy} accessibilityLabel={`Confirm remove ${name}`}>Remove</Button>
            ) : (
              <Button textColor={colors.error} onPress={() => setConfirmingDelete(true)} disabled={busy} accessibilityLabel={`Delete ${name}`}>Delete</Button>
            )
          ) : null}
          <View style={styles.spacer} />
          <Button onPress={onDismiss} disabled={busy}>Cancel</Button>
          <Button
            mode="contained"
            onPress={() => onSave(value)}
            loading={busy}
            disabled={busy || Boolean(problem) || unchanged}
            accessibilityLabel="Save initials"
          >
            Save
          </Button>
        </Dialog.Actions>
      </Dialog>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  dialog: { borderRadius: radius.xl },
  gap: { gap: spacing.sm },
  inputText: { fontSize: 22, fontWeight: '800', letterSpacing: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { borderRadius: radius.full },
  spacer: { flex: 1 },
});

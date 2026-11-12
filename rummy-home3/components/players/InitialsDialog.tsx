import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Dialog, Text, TextInput } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { defaultInitials, INITIALS_HELP, initialsProblem, normalizeInitials, suggestInitials } from '@/utils/initials';

/**
 * Edit one player's scorecard initials. The same dialog serves My players (the owner's
 * list) and a game's Players page (one column of this game). `taken` is every label the
 * new value must differ from, mapped to who has it, so a clash names the other player.
 */
export function InitialsDialog({ name, current, taken, scope, busy, onDismiss, onSave }: {
  name: string;
  current: string | null | undefined;
  taken: Map<string, string>;
  /** Where uniqueness applies, for the helper line. */
  scope: 'my-players' | 'game';
  busy: boolean;
  onDismiss: () => void;
  onSave: (initials: string) => void;
}) {
  const { colors } = useAppTheme();
  const [text, setText] = useState(current ?? defaultInitials(name));
  const value = normalizeInitials(text);
  const problem = initialsProblem(text, taken);
  const fallback = defaultInitials(name);
  const chips = useMemo(() => {
    const options = [fallback, ...suggestInitials(name, taken.keys(), 4)].filter((label, index, all) => !taken.has(label) && all.indexOf(label) === index);
    return options.slice(0, 4);
  }, [name, taken, fallback]);
  const unchanged = value === normalizeInitials(current ?? '');

  return (
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
          error={Boolean(problem) && text.length > 0}
          accessibilityLabel="Initials"
          contentStyle={styles.inputText}
          onSubmitEditing={() => !problem && !unchanged && onSave(value)}
        />
        <Text variant="labelSmall" style={{ color: problem && text.length > 0 ? colors.error : colors.onSurfaceVariant }}>
          {problem && text.length > 0 ? problem : '2 or 3 letters, A to Z.'}
        </Text>
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
      <Dialog.Actions>
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
  );
}

const styles = StyleSheet.create({
  dialog: { borderRadius: radius.xl },
  gap: { gap: spacing.sm },
  inputText: { fontSize: 22, fontWeight: '800', letterSpacing: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { borderRadius: radius.full },
});

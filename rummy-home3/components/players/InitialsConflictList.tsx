import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Icon, Text, TextInput } from 'react-native-paper';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { InitialsConflict, initialsProblem, normalizeInitials } from '@/utils/initials';

export type ConflictChoices = Record<string, string>;

/**
 * Every clash at once, as in the approved mockup: one card per shared label, the player
 * who keeps it first, then each other player with suggestion chips and an Edit field.
 * `choices` is the caller's state (player id → chosen initials); every "other" row has a
 * choice from the start (the first suggestion), so nothing is left undecided.
 */
export function InitialsConflictList({ conflicts, choices, onChoose, taken, youId }: {
  conflicts: InitialsConflict[];
  choices: ConflictChoices;
  onChoose: (playerId: string, initials: string) => void;
  /** Every label in use (list labels plus the current choices), mapped to the player's name. */
  taken: Map<string, string>;
  /** The signed-in owner, shown as "you". */
  youId?: string | null;
}) {
  const { colors } = useAppTheme();
  const [editing, setEditing] = useState<Record<string, string>>({});
  const nameOf = (row: { id: string; name: string }) => (row.id === youId ? `${row.name} (you)` : row.name);
  const firstName = (row: { id: string; name: string }) => (row.id === youId ? 'You' : row.name.split(' ')[0]);

  return (
    <View style={styles.list}>
      {conflicts.map((conflict) => (
        <View key={conflict.label} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
          <Text variant="labelMedium" style={{ color: colors.onSurfaceVariant }}>
            {conflict.label} · {conflict.others.length + 1} players
          </Text>
          <View style={styles.row}>
            <View style={[styles.badge, { borderColor: colors.positive, backgroundColor: colors.positiveContainer }]}>
              <Text variant="labelLarge" style={{ color: colors.onPositiveContainer, fontWeight: '800' }}>{conflict.label}</Text>
            </View>
            <View style={styles.text}>
              <Text variant="bodyLarge" style={styles.name} numberOfLines={1}>{nameOf(conflict.keeper)}</Text>
              <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>keeps {conflict.label}</Text>
            </View>
            <Icon source="check-circle-outline" size={20} color={colors.positive} />
          </View>
          {conflict.others.map(({ row, suggestions }) => {
            const chosen = choices[row.id] ?? suggestions[0] ?? '';
            const draft = editing[row.id];
            const isEditing = draft !== undefined;
            const others = new Map([...taken].filter(([label, who]) => who !== row.name && label !== chosen));
            const problem = isEditing ? initialsProblem(draft, others) : null;
            const custom = chosen && !suggestions.includes(chosen);
            return (
              <View key={row.id} style={[styles.other, { borderTopColor: colors.hairline }]}>
                <View style={styles.row}>
                  <View style={[styles.badge, { borderColor: colors.error, backgroundColor: colors.errorContainer }]}>
                    <Text variant="labelLarge" style={{ color: colors.onErrorContainer, fontWeight: '800', textDecorationLine: 'line-through' }}>{conflict.label}</Text>
                  </View>
                  <View style={styles.text}>
                    <Text variant="bodyLarge" style={styles.name} numberOfLines={1}>{nameOf(row)}</Text>
                    <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{firstName(row)} becomes</Text>
                  </View>
                  <View style={[styles.badge, { borderColor: colors.primary, backgroundColor: colors.primaryContainer }]}>
                    <Text variant="labelLarge" style={{ color: colors.onPrimaryContainer, fontWeight: '800' }}>{chosen || '?'}</Text>
                  </View>
                </View>
                <View style={styles.chips}>
                  {suggestions.map((label) => (
                    <Chip
                      key={label}
                      compact
                      selected={chosen === label}
                      showSelectedCheck={false}
                      mode={chosen === label ? 'flat' : 'outlined'}
                      onPress={() => { setEditing((cur) => { const next = { ...cur }; delete next[row.id]; return next; }); onChoose(row.id, label); }}
                      style={[styles.chip, chosen === label && { backgroundColor: colors.secondaryContainer }]}
                      accessibilityLabel={`${row.name} becomes ${label}`}
                    >
                      {label}
                    </Chip>
                  ))}
                  {custom && !isEditing ? (
                    <Chip compact selected showSelectedCheck={false} mode="flat" style={[styles.chip, { backgroundColor: colors.secondaryContainer }]}>{chosen}</Chip>
                  ) : null}
                  <Chip
                    compact
                    icon="pencil-outline"
                    mode={isEditing ? 'flat' : 'outlined'}
                    onPress={() => setEditing((cur) => (cur[row.id] !== undefined ? cur : { ...cur, [row.id]: '' }))}
                    style={styles.chip}
                    accessibilityLabel={`Type initials for ${row.name}`}
                  >
                    Edit…
                  </Chip>
                </View>
                {isEditing ? (
                  <View style={styles.editRow}>
                    <TextInput
                      mode="outlined"
                      dense
                      value={draft}
                      placeholder="ABC"
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={3}
                      autoFocus
                      error={Boolean(problem) && draft.length > 0}
                      onChangeText={(text) => {
                        const upper = text.toUpperCase();
                        setEditing((cur) => ({ ...cur, [row.id]: upper }));
                        if (!initialsProblem(upper, others)) onChoose(row.id, normalizeInitials(upper));
                      }}
                      style={styles.editInput}
                      contentStyle={styles.editText}
                      accessibilityLabel={`Initials for ${row.name}`}
                    />
                    <Text variant="labelSmall" style={[styles.flex, { color: problem && draft.length > 0 ? colors.error : colors.onSurfaceVariant }]}>
                      {problem && draft.length > 0 ? problem : '2 or 3 letters, A to Z.'}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: { minWidth: 44, height: 32, paddingHorizontal: 8, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  name: { fontWeight: '600' },
  other: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.xs, gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingLeft: 44 + spacing.sm },
  chip: { borderRadius: radius.full },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: 44 + spacing.sm },
  editInput: { width: 84, height: 40, backgroundColor: 'transparent' },
  editText: { textAlign: 'center', fontSize: 18, fontWeight: '800', letterSpacing: 2 },
  flex: { flex: 1 },
});

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { PointsRules } from '@/utils/gameSettings';
import { spacing, useAppTheme } from '@/constants/theme';

export type RulesDraft = { drop: string; middleDrop: string; fullCount: string };

/** The field always shows a negative number, including the minus sign. */
export const showRule = (value: number) => (Number.isFinite(value) ? String(value) : '');

export const draftFromRules = (r: PointsRules): RulesDraft => ({
  drop: showRule(r.drop),
  middleDrop: showRule(r.middleDrop),
  fullCount: showRule(r.fullCount),
});

const signedField = (text: string) => {
  const digits = text.replace(/[^0-9]/g, '').slice(0, 3);
  return digits ? `-${digits}` : '';
};

/** Game type (Points only for now), Drop, Middle drop, and Full count. */
export function RulesForm({ draft, onChange, showType, disabled = false }: { draft: RulesDraft; onChange: (d: RulesDraft) => void; showType?: boolean; disabled?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.wrap}>
      {showType ? (
        <>
          <Text variant="titleSmall">Game type</Text>
          <SegmentedButtons
            value="points"
            onValueChange={() => {}}
            buttons={[
              { value: 'points', label: 'Points', icon: 'cards-playing-outline' },
              { value: 'pool', label: 'Pool (later)', disabled: true },
            ]}
          />
        </>
      ) : null}
      <View style={styles.row}>
        <TextInput mode="outlined" label="Drop" keyboardType="number-pad" disabled={disabled} value={draft.drop} onChangeText={(t) => onChange({ ...draft, drop: signedField(t) })} style={styles.input} />
        <TextInput mode="outlined" label="Middle drop" keyboardType="number-pad" disabled={disabled} value={draft.middleDrop} onChangeText={(t) => onChange({ ...draft, middleDrop: signedField(t) })} style={styles.input} />
        <TextInput mode="outlined" label="Full count" keyboardType="number-pad" disabled={disabled} value={draft.fullCount} onChangeText={(t) => onChange({ ...draft, fullCount: signedField(t) })} style={styles.input} />
      </View>
      <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
        Drop, Middle drop, and Full count are negative. Defaults are -10, -30, and -80.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  input: { flex: 1 },
});

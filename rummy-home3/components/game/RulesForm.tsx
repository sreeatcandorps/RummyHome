import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { PointsRules } from '@/utils/gameSettings';
import { spacing, useAppTheme } from '@/constants/theme';

export type RulesDraft = { drop: string; middleDrop: string };
export const draftFromRules = (r: PointsRules): RulesDraft => ({ drop: String(Math.abs(r.drop)), middleDrop: String(Math.abs(r.middleDrop)) });

/** Game type (Points only for now), Drop and Middle drop. Shared by Game settings and User settings. */
export function RulesForm({ draft, onChange, showType }: { draft: RulesDraft; onChange: (d: RulesDraft) => void; showType?: boolean }) {
  const { colors } = useAppTheme();
  const digits = (t: string) => t.replace(/[^0-9]/g, '').slice(0, 3);
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
        <TextInput mode="outlined" label="Drop" keyboardType="number-pad" value={draft.drop} onChangeText={(t) => onChange({ ...draft, drop: digits(t) })} style={styles.input} right={<TextInput.Affix text="pts" />} />
        <TextInput mode="outlined" label="Middle drop" keyboardType="number-pad" value={draft.middleDrop} onChangeText={(t) => onChange({ ...draft, middleDrop: digits(t) })} style={styles.input} right={<TextInput.Affix text="pts" />} />
      </View>
      <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
        Points a player gets for dropping before or in the middle of a hand. Rummy defaults are Drop 10 and Middle drop 30.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  input: { flex: 1 },
});

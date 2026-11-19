import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { spacing, useAppTheme } from '@/constants/theme';

/**
 * The numbered how-to under "Order of players" (D56 copy, approved Nov 19): one row per step and a
 * small note under them. The step owns the strings so the New game step and the mid-game sheet can
 * show different subsets.
 */
export function OrderHowTo({ steps, note, testID }: { steps: string[]; note: string; testID: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.root} testID={testID}>
      {steps.map((step, i) => (
        <View key={step} style={styles.row}>
          <Text variant="bodyMedium" style={[styles.number, { color: colors.onSurface }]}>{i + 1}.</Text>
          <Text variant="bodyMedium" style={[styles.step, { color: colors.onSurface }]} testID={`${testID}-${i + 1}`}>{step}</Text>
        </View>
      ))}
      <Text variant="bodySmall" style={[styles.note, { color: colors.onSurfaceVariant }]}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs, paddingBottom: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.xs },
  number: { width: 18 },
  step: { flex: 1 },
  note: { paddingTop: spacing.xs },
});

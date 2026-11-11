import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { radius, spacing, useAppTheme } from '@/constants/theme';

export type WarningLine = { kind: 'active' | 'reused' | 'closed'; text: string; gameId?: string };

const ICON: Record<WarningLine['kind'], string> = { active: 'progress-clock', reused: 'repeat-variant', closed: 'repeat-variant' };

/** Yellow flags for a result, one line per game: still Active, or already part of an earlier result. */
export function ResultWarnings({ warnings }: { warnings: WarningLine[] }) {
  const { colors } = useAppTheme();
  if (warnings.length === 0) return null;
  return (
    <View style={styles.list} testID="result-warnings">
      {warnings.map((warning, index) => (
        <View key={warning.gameId ? `${warning.kind}-${warning.gameId}` : `${warning.kind}-${index}`} style={[styles.warn, { backgroundColor: colors.secondaryContainer }]} accessibilityRole="alert">
          <Icon source={ICON[warning.kind]} size={20} color={colors.onSecondaryContainer} />
          <Text variant="bodyMedium" style={[styles.text, { color: colors.onSecondaryContainer }]}>{warning.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs },
  warn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md },
  text: { flex: 1 },
});

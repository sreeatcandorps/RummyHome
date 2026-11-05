import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { ResultWarning } from '@/utils/results';
import { radius, spacing, useAppTheme } from '@/constants/theme';

/** Yellow flags for a result: an Active game was included, or a game was already in another result. */
export function ResultWarnings({ warnings }: { warnings: ResultWarning[] }) {
  const { colors } = useAppTheme();
  if (warnings.length === 0) return null;
  return (
    <View style={styles.list}>
      {warnings.map((warning) => (
        <View key={warning.kind} style={[styles.warn, { backgroundColor: colors.secondaryContainer }]} accessibilityRole="alert">
          <Icon source={warning.kind === 'active' ? 'progress-clock' : 'repeat-variant'} size={20} color={colors.onSecondaryContainer} />
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

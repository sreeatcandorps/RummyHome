import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { SETTINGS_PRIORITY } from '@/constants/help';
import { radius, spacing, useAppTheme } from '@/constants/theme';

/**
 * Three steps, highest on top: Game settings beat User settings beat Game
 * defaults. The bar on the left is widest for the step that wins.
 */
export function SettingsPriority({ highlight, showTitle = true }: { highlight?: 'Game settings' | 'User settings' | 'Game defaults'; showTitle?: boolean }) {
  const { colors } = useAppTheme();
  const fills = [colors.primary, colors.secondary, colors.outline];
  const widths = [40, 28, 16];
  return (
    <View style={styles.root} accessibilityRole="summary" accessibilityLabel="Which setting wins: Game settings first, then User settings, then Game defaults">
      {showTitle ? <Text variant="labelLarge" style={{ color: colors.onSurfaceVariant }}>Which setting wins</Text> : null}
      {SETTINGS_PRIORITY.map((step, index) => {
        const on = step.title === highlight;
        return (
          <View key={step.title} style={[styles.step, on && { backgroundColor: colors.primaryContainer }]}>
            <View style={styles.bars}>
              <View style={[styles.bar, { width: widths[index], backgroundColor: fills[index] }]} />
            </View>
            <Text variant="labelSmall" style={[styles.rank, { color: colors.onSurfaceVariant }]}>{index + 1}</Text>
            <View style={styles.text}>
              <Text variant="labelLarge" style={{ color: on ? colors.onPrimaryContainer : colors.onSurface }}>
                {step.title}
                <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>  {step.level}</Text>
              </Text>
              <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{step.detail}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 4 },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
  },
  bars: { width: 40, alignItems: 'flex-start' },
  bar: { height: 10, borderRadius: 5 },
  rank: { width: 12, textAlign: 'center' },
  text: { flex: 1 },
});

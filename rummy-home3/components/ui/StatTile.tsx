import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { radius, spacing, tabularNums, useAppTheme } from '@/constants/theme';

type StatTileProps = {
  label: string;
  value: string | number;
  icon?: string;
};

export function StatTile({ label, value, icon }: StatTileProps) {
  const theme = useAppTheme();

  return (
    <View
      style={[styles.tile, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      {icon ? <Icon source={icon} size={18} color={theme.colors.primary} /> : null}
      <Text variant="headlineSmall" style={[styles.value, tabularNums]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  value: {
    fontWeight: '800',
  },
});

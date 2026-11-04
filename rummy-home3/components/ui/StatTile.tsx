import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple } from 'react-native-paper';
import { radius, spacing, tabularNums, useAppTheme } from '@/constants/theme';

type StatTileProps = {
  label: string;
  value: string | number;
  icon?: string;
  onPress?: () => void;
};

export function StatTile({ label, value, icon, onPress }: StatTileProps) {
  const theme = useAppTheme();

  const body = (
    <View style={styles.inner}>
      {icon ? <Icon source={icon} size={18} color={theme.colors.primary} /> : null}
      <Text variant="headlineSmall" style={[styles.value, tabularNums]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  return (
    <View
      style={[styles.tile, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
    >
      {onPress ? (
        <TouchableRipple
          onPress={onPress}
          borderless
          style={styles.ripple}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value}`}
        >
          {body}
        </TouchableRipple>
      ) : (
        <View accessible accessibilityLabel={`${label}: ${value}`}>
          {body}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  ripple: {
    borderRadius: radius.lg,
  },
  inner: {
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  value: {
    fontWeight: '800',
  },
});

import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Icon, Text, TouchableRipple } from 'react-native-paper';
import { radius, useAppTheme } from '@/constants/theme';

type StackedActionProps = {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  height?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
  /** Filled with the soft brand yellow instead of outlined. */
  tonal?: boolean;
  /** Filled dark green: the one primary action in the bar. */
  filled?: boolean;
  /** Bigger icon and label for the action that should dominate the bar. */
  emphasis?: boolean;
};

/** Secondary action with the icon above its label, so it fits narrow phones. */
export function StackedAction({ icon, label, onPress, disabled, height = 56, style, accessibilityLabel, tonal = false, filled = false, emphasis = false }: StackedActionProps) {
  const theme = useAppTheme();
  const color = disabled
    ? theme.colors.onSurfaceDisabled
    : filled ? theme.colors.onPrimary : tonal ? theme.colors.onSecondaryContainer : theme.colors.primary;
  const compact = height < 52;
  const fill = filled
    ? { backgroundColor: disabled ? theme.colors.surfaceDisabled : theme.colors.primary, borderColor: 'transparent' }
    : tonal
      ? { backgroundColor: disabled ? theme.colors.surfaceDisabled : theme.colors.secondaryContainer, borderColor: 'transparent' }
      : null;

  return (
    <View
      style={[
        styles.wrap,
        { height, borderColor: disabled ? theme.colors.surfaceDisabled : theme.colors.outline },
        fill,
        style,
      ]}
    >
      <TouchableRipple
        onPress={onPress}
        disabled={disabled}
        borderless
        style={styles.ripple}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: !!disabled }}
      >
        <View style={[styles.content, compact && styles.contentRow]}>
          <Icon source={icon} size={compact ? 18 : emphasis ? 24 : 20} color={color} />
          <Text variant="labelLarge" numberOfLines={1} style={[styles.label, emphasis && styles.labelEmphasis, { color }]}>
            {label}
          </Text>
        </View>
      </TouchableRipple>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  ripple: {
    flex: 1,
    borderRadius: radius.lg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 4,
  },
  contentRow: {
    flexDirection: 'row',
    gap: 6,
  },
  label: {
    fontWeight: '700',
    fontSize: 13,
  },
  labelEmphasis: {
    fontSize: 15,
    fontWeight: '800',
  },
});

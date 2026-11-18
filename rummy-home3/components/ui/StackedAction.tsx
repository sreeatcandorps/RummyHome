import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Icon, Text, TouchableRipple } from 'react-native-paper';
import { radius, useAppTheme } from '@/constants/theme';
import { BUTTON_EDGE } from '@/components/ui/AppButton';

type StackedActionProps = {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  height?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
  /** Soft green fill (primaryContainer): a secondary action that still reads as a button. */
  tonal?: boolean;
  /** Filled button green with the pressable edge: the one main action in the bar. */
  filled?: boolean;
  /** Bigger icon and label for the action that should dominate the bar. */
  emphasis?: boolean;
};

/**
 * Bottom-bar button: a pill with the icon beside its label, so three fit on a narrow phone.
 * Every variant has a fill or a 2 px border (docs/design/02-design-system.md §5.1); the
 * default is outlined with the button-green label.
 */
export function StackedAction({ icon, label, onPress, disabled, height = 52, style, accessibilityLabel, tonal = false, filled = false, emphasis = false }: StackedActionProps) {
  const theme = useAppTheme();
  const color = disabled
    ? theme.colors.onSurfaceDisabled
    : filled ? theme.colors.onPrimary : tonal ? theme.colors.onPrimaryContainer : theme.colors.primary;
  const compact = height < 48;
  const fill = filled
    ? {
      backgroundColor: disabled ? theme.colors.surfaceDisabled : theme.colors.primary,
      borderColor: 'transparent',
      borderWidth: 0,
      borderBottomWidth: disabled ? 0 : BUTTON_EDGE,
      borderBottomColor: theme.colors.primaryEdge,
    }
    : tonal
      ? { backgroundColor: disabled ? theme.colors.surfaceDisabled : theme.colors.primaryContainer, borderColor: 'transparent', borderWidth: 0 }
      : { backgroundColor: theme.colors.surface, borderColor: disabled ? theme.colors.outlineVariant : theme.colors.outline };

  return (
    <View
      style={[
        styles.wrap,
        { height },
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
        <View style={styles.content}>
          <Icon source={icon} size={compact ? 16 : emphasis ? 22 : 18} color={color} />
          <Text
            variant="labelLarge"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            style={[styles.label, compact && styles.labelCompact, emphasis && styles.labelEmphasis, { color }]}
          >
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
    borderWidth: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  ripple: {
    flex: 1,
    borderRadius: radius.full,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  label: {
    fontWeight: '800',
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 1,
  },
  labelCompact: {
    fontSize: 14,
  },
  labelEmphasis: {
    fontSize: 16,
  },
});

import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { radius, spacing, useAppTheme } from '@/constants/theme';

export type SegmentedOption<V extends string> = {
  value: V;
  label: string;
  icon?: string;
  testID?: string;
  accessibilityLabel?: string;
};

type SegmentedChoiceProps<V extends string> = {
  value: V;
  onChange: (value: V) => void;
  options: readonly SegmentedOption<V>[];
  disabled?: boolean;
  /** Read out as "<label>: <option>" when an option has no label of its own. */
  accessibilityLabel?: string;
  style?: ViewStyle;
  testID?: string;
};

/**
 * Two to four options in one 40-dp outlined pill (design-review-2 §5, B06/B11): one control for every
 * "pick one" question — game type, pool limit, re-entries, theme — instead of Paper's SegmentedButtons,
 * radios and chips. The selected segment is brass (`secondaryContainer`).
 */
export function SegmentedChoice<V extends string>({ value, onChange, options, disabled, accessibilityLabel, style, testID }: SegmentedChoiceProps<V>) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[styles.pill, { borderColor: colors.outline, opacity: disabled ? 0.5 : 1 }, style]}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {options.map((option, index) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => { if (!disabled && !on) onChange(option.value); }}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled }}
            accessibilityLabel={option.accessibilityLabel ?? (accessibilityLabel ? `${accessibilityLabel}: ${option.label}` : option.label)}
            testID={option.testID}
            style={[
              styles.segment,
              index > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.outline },
              on && { backgroundColor: colors.secondaryContainer },
            ]}
          >
            {option.icon ? <Icon source={option.icon} size={16} color={on ? colors.onSecondaryContainer : colors.onSurfaceVariant} /> : null}
            <Text variant="labelLarge" numberOfLines={1} style={{ color: on ? colors.onSecondaryContainer : colors.onSurface }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.full,
    overflow: 'hidden',
    minHeight: 40,
    alignSelf: 'stretch',
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    minHeight: 40,
  },
});

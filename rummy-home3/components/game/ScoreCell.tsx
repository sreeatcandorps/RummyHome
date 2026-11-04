import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { radius, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { CellStatus } from '@/utils/roundEntry';

type ScoreCellProps = {
  name: string;
  status: CellStatus;
  value?: number;
  /** Bump this to flash the cell once, e.g. right after its score was saved. */
  flashKey: number;
  /** Measured by the grid so two (or three) columns fit exactly. */
  width: number;
  compact?: boolean;
  onPress: () => void;
  onClear: () => void;
};

const signed = (value: number) => (value > 0 ? `+${value}` : `${value}`);

const FILL_MS = 220;
const FLASH_MS = 520;

/**
 * One player on the Add round grid: the full name over a score box and an X.
 * White while empty, light green once a score is saved, with a ring while the
 * player is selected for the next number.
 */
export function ScoreCell({ name, status, value, flashKey, width, compact, onPress, onClear }: ScoreCellProps) {
  const { colors } = useAppTheme();

  const isConfirmed = status === 'confirmed';
  const isSelected = status === 'selected' || status === 'pending';
  const hasValue = value !== undefined;

  const fill = useRef(new Animated.Value(isConfirmed ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fill, {
      toValue: isConfirmed ? 1 : 0,
      duration: FILL_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fill, isConfirmed]);

  useEffect(() => {
    if (flashKey === 0) return;
    flash.setValue(0);
    Animated.sequence([
      Animated.timing(flash, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(flash, { toValue: 0, duration: FLASH_MS - 120, easing: Easing.in(Easing.quad), useNativeDriver: false }),
    ]).start();
  }, [flash, flashKey]);

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.97, speed: 40, bounciness: 0, useNativeDriver: false }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, speed: 24, bounciness: 6, useNativeDriver: false }).start();

  const backgroundColor = fill.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.surface, colors.positiveContainer],
  });

  const ringColor = isSelected ? colors.primary : isConfirmed ? colors.positive : colors.outlineVariant;
  const boxBorder = status === 'pending' ? colors.primary : isSelected ? colors.primary : isConfirmed ? colors.positive : colors.outline;
  const valueColor = status === 'pending'
    ? colors.primary
    : isConfirmed
      ? (value ?? 0) > 0 ? colors.positive : colors.onPositiveContainer
      : colors.onSurface;

  const statusLabel = status === 'pending'
    ? `typing ${signed(value ?? 0)}`
    : hasValue
      ? `score ${signed(value ?? 0)}`
      : 'no score';

  return (
    <Animated.View
      style={[
        styles.cell,
        {
          width,
          backgroundColor,
          borderColor: ringColor,
          borderWidth: isSelected ? 2 : 1,
          transform: [{ scale }],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={styles.press}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${statusLabel}${isSelected ? ', selected' : ''}`}
        accessibilityState={{ selected: isSelected }}
      >
        <Text
          variant={compact ? 'bodyMedium' : 'bodyLarge'}
          numberOfLines={1}
          style={[styles.name, { color: isConfirmed ? colors.onPositiveContainer : colors.onSurface }]}
        >
          {name}
        </Text>
        <View style={styles.row}>
          <View
            style={[
              styles.box,
              compact && styles.boxCompact,
              {
                borderColor: boxBorder,
                borderStyle: status === 'pending' ? 'dashed' : 'solid',
                backgroundColor: isConfirmed ? colors.surface : 'transparent',
              },
            ]}
          >
            <Text
              style={[styles.value, compact && styles.valueCompact, tabularNums, { color: valueColor }]}
              numberOfLines={1}
            >
              {hasValue ? signed(value) : ''}
            </Text>
          </View>
          <IconButton
            icon="close"
            size={compact ? 18 : 20}
            style={styles.clear}
            iconColor={hasValue || status === 'pending' ? colors.onSurfaceVariant : colors.outlineVariant}
            disabled={!hasValue && status !== 'pending'}
            onPress={onClear}
            accessibilityLabel={`Clear ${name}`}
          />
        </View>
      </Pressable>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          styles.flash,
          { backgroundColor: colors.primary, opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }) },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cell: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  press: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    gap: spacing.xs,
  },
  name: {
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  box: {
    flex: 1,
    height: 40,
    borderWidth: 1.5,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  boxCompact: {
    height: 34,
  },
  value: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  valueCompact: {
    fontSize: 17,
    lineHeight: 20,
  },
  clear: {
    margin: 0,
  },
  flash: {
    borderRadius: radius.lg,
  },
});

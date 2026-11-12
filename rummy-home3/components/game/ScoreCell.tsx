import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { radius, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { CELL_FILL, CellStatus, cellTone } from '@/utils/roundEntry';
import { scoreTextStyle, scoreTone } from '@/utils/scoreTone';

type ScoreCellProps = {
  name: string;
  status: CellStatus;
  value?: number;
  /** Full count of the game; a saved loss of more than half of it is red text. */
  fullCount?: number | null;
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
const CLEAR_WIDTH = 36;

/** Long names shrink a step instead of being cut off. */
const nameFontSize = (name: string, compact?: boolean) => {
  const base = compact ? 15 : 17;
  if (name.length > 19) return base - 5;
  if (name.length > 15) return base - 2;
  return base;
};

/**
 * One player on the Add round grid: the full name over the score and an X.
 * Beige while nothing is entered, light yellow while selected (or while a
 * number is being typed), light green once a score is confirmed for the round.
 */
export function ScoreCell({ name, status, value, flashKey, width, compact, fullCount, onPress, onClear }: ScoreCellProps) {
  const { colors } = useAppTheme();

  const isConfirmed = status === 'confirmed';
  const isPending = status === 'pending';
  const isSelected = status === 'selected' || isPending;
  const tone = cellTone(status);
  const hasValue = value !== undefined;
  const canClear = hasValue || isPending;

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

  const animatedBackground = fill.interpolate({
    inputRange: [0, 1],
    outputRange: [colors[CELL_FILL.neutral], colors[CELL_FILL.confirmed]],
  });
  const backgroundColor = tone === 'selected' ? colors[CELL_FILL.selected] : animatedBackground;

  const ringColor = tone === 'selected' ? colors.secondary : tone === 'confirmed' ? colors.positive : colors.outlineVariant;
  // The scorecard standard: a win green, a penalty over half the Full count red text, the rest plain.
  const saved = isConfirmed ? scoreTextStyle(scoreTone(value ?? 0, fullCount)) : null;
  const valueColor = isPending
    ? colors.onSecondaryContainer
    : saved
      ? saved.colorKey === 'positive' ? colors.onPositiveContainer : colors[saved.colorKey]
      : colors.onSurface;
  const valueWeight = saved?.fontWeight ?? '800';

  const statusLabel = isPending
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
          transform: [{ scale }],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[styles.press, compact && styles.pressCompact]}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${statusLabel}${isSelected ? ', selected' : ''}`}
        accessibilityState={{ selected: isSelected }}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.name,
            { fontSize: nameFontSize(name, compact), color: isConfirmed ? colors.onPositiveContainer : colors.onSurface },
          ]}
        >
          {name}
        </Text>
        <Text
          style={[styles.value, compact && styles.valueCompact, tabularNums, { color: valueColor, fontWeight: valueWeight }]}
          numberOfLines={1}
        >
          {hasValue ? signed(value) : ''}
        </Text>
      </Pressable>
      {/* A sibling, not a child, of the cell button: nested buttons are invalid on web. */}
      <IconButton
        icon="close"
        size={compact ? 18 : 20}
        style={[styles.clear, compact && styles.clearCompact]}
        iconColor={canClear ? colors.onSurfaceVariant : colors.outlineVariant}
        disabled={!canClear}
        onPress={onClear}
        accessibilityLabel={`Clear ${name}`}
      />
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
    // Constant width so a selection ring never nudges the grid.
    borderWidth: 2,
    overflow: 'hidden',
  },
  press: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    gap: 0,
  },
  pressCompact: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    paddingLeft: spacing.sm,
  },
  name: {
    fontWeight: '700',
    lineHeight: 22,
  },
  value: {
    marginRight: CLEAR_WIDTH,
    // Reserve the line so an empty cell is the same height as a scored one.
    minHeight: 32,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
  },
  valueCompact: {
    minHeight: 26,
    fontSize: 22,
    lineHeight: 26,
  },
  clear: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    margin: 0,
    width: CLEAR_WIDTH,
    height: 36,
  },
  clearCompact: {
    bottom: 2,
  },
  flash: {
    borderRadius: radius.lg,
  },
});

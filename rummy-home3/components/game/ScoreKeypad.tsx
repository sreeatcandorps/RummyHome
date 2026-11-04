import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple } from 'react-native-paper';
import { radius, spacing, tabularNums, useAppTheme } from '@/constants/theme';

type ScoreKeypadProps = {
  negative: boolean;
  /** Digits only count while at least one player is selected. */
  enabled: boolean;
  canSave: boolean;
  compact?: boolean;
  onSign: (negative: boolean) => void;
  onDigit: (digit: string) => void;
  onSave: () => void;
};

const ROWS = [
  ['1', '2', '3', '4', '5'],
  ['6', '7', '8', '9', '0'],
];

/**
 * Two rows: a stacked +/- toggle on the left, five digits per row, and a tall
 * Save score key on the right. Minus is on by default.
 */
export function ScoreKeypad({ negative, enabled, canSave, compact, onSign, onDigit, onSave }: ScoreKeypadProps) {
  const { colors } = useAppTheme();
  const keyHeight = compact ? 40 : 46;

  const signKey = (isNegative: boolean) => {
    const on = negative === isNegative;
    return (
      <View
        key={isNegative ? 'minus' : 'plus'}
        style={[
          styles.key,
          { height: keyHeight, backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.outlineVariant },
        ]}
      >
        <TouchableRipple
          onPress={() => onSign(isNegative)}
          borderless
          style={styles.ripple}
          accessibilityRole="button"
          accessibilityLabel={isNegative ? 'Minus' : 'Plus'}
          accessibilityState={{ selected: on }}
        >
          <View style={styles.keyInner}>
            <Icon source={isNegative ? 'minus' : 'plus'} size={22} color={on ? colors.onPrimary : colors.onSurfaceVariant} />
          </View>
        </TouchableRipple>
      </View>
    );
  };

  const digitKey = (digit: string) => (
    <View
      key={digit}
      style={[
        styles.key,
        { height: keyHeight, backgroundColor: colors.surface, borderColor: colors.outlineVariant, opacity: enabled ? 1 : 0.55 },
      ]}
    >
      <TouchableRipple
        onPress={() => onDigit(digit)}
        disabled={!enabled}
        borderless
        style={styles.ripple}
        accessibilityRole="button"
        accessibilityLabel={digit}
        accessibilityState={{ disabled: !enabled }}
      >
        <View style={styles.keyInner}>
          <Text style={[styles.digit, tabularNums, { color: colors.onSurface }]}>{digit}</Text>
        </View>
      </TouchableRipple>
    </View>
  );

  const saveHeight = keyHeight * 2 + spacing.xs;

  return (
    <View style={styles.pad} accessibilityRole="none">
      <View style={styles.signColumn}>
        {signKey(false)}
        {signKey(true)}
      </View>
      <View style={styles.digits}>
        {ROWS.map((row) => (
          <View key={row[0]} style={styles.row}>
            {row.map(digitKey)}
          </View>
        ))}
      </View>
      <View
        style={[
          styles.save,
          {
            height: saveHeight,
            backgroundColor: canSave ? colors.primary : colors.surfaceVariant,
            borderColor: canSave ? colors.primary : colors.outlineVariant,
          },
        ]}
      >
        <TouchableRipple
          onPress={onSave}
          disabled={!canSave}
          borderless
          style={styles.ripple}
          accessibilityRole="button"
          accessibilityLabel="Save score"
          accessibilityState={{ disabled: !canSave }}
        >
          <View style={styles.keyInner}>
            <Icon source="check" size={22} color={canSave ? colors.onPrimary : colors.onSurfaceDisabled} />
            <Text variant="labelMedium" style={[styles.saveLabel, { color: canSave ? colors.onPrimary : colors.onSurfaceDisabled }]}>
              Save{'\n'}score
            </Text>
          </View>
        </TouchableRipple>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  signColumn: {
    width: 46,
    gap: spacing.xs,
  },
  digits: {
    flex: 1,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  key: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  ripple: {
    flex: 1,
    borderRadius: radius.md,
  },
  keyInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  digit: {
    fontSize: 22,
    fontWeight: '700',
  },
  save: {
    width: 72,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  saveLabel: {
    textAlign: 'center',
    fontWeight: '800',
    lineHeight: 15,
  },
});

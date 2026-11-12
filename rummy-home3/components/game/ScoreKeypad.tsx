import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple } from 'react-native-paper';
import { radius, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { BUTTON_EDGE } from '@/components/ui/AppButton';

type ScoreKeypadProps = {
  /** Digits only count while at least one player is selected. */
  enabled: boolean;
  canSave: boolean;
  compact?: boolean;
  onDigit: (digit: string) => void;
  onSave: () => void;
};

const ROWS = [
  ['1', '2', '3', '4', '5'],
  ['6', '7', '8', '9', '0'],
];

/** Two rows of five big digits and a tall Save score key on the right. */
export function ScoreKeypad({ enabled, canSave, compact, onDigit, onSave }: ScoreKeypadProps) {
  const { colors } = useAppTheme();
  const keyHeight = compact ? 56 : 70;

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
            borderBottomColor: canSave ? colors.primaryEdge : colors.outlineVariant,
          },
          canSave && styles.saveEdge,
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
            <Icon source="check" size={34} color={canSave ? colors.onPrimary : colors.onSurfaceDisabled} />
            <Text style={[styles.saveLabel, { color: canSave ? colors.onPrimary : colors.onSurfaceDisabled }]}>
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
    fontSize: 33,
    lineHeight: 40,
    fontWeight: '700',
  },
  save: {
    width: 108,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  saveEdge: {
    borderBottomWidth: BUTTON_EDGE,
  },
  saveLabel: {
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 18,
    lineHeight: 22,
  },
});

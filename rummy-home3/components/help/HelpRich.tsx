import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { GAME_STATUS_TONE } from '@/utils/gameStatus';
import { HelpChip, splitHelpLine } from '@/utils/helpMarkup';

/** The real tag colours (components/ui/Tag.tsx) for the pills inside help text. */
function useChipPalette() {
  const { colors, gameTypes } = useAppTheme();
  const tone = (t: 'primary' | 'info' | 'neutral' | 'results' | 'warning' | 'danger' | 'pool') => {
    switch (t) {
      case 'primary':
      case 'results':
        return { bg: colors.primaryContainer, fg: colors.onPrimaryContainer };
      case 'info':
        return { bg: colors.tertiaryContainer, fg: colors.onTertiaryContainer };
      case 'warning':
        return { bg: colors.secondaryContainer, fg: colors.onSecondaryContainer };
      case 'danger':
        return { bg: colors.errorContainer, fg: colors.onErrorContainer };
      case 'pool':
        return { bg: gameTypes.pool.container, fg: gameTypes.pool.on };
      default:
        return { bg: colors.surfaceVariant, fg: colors.onSurfaceVariant };
    }
  };
  return (chip: HelpChip) => {
    switch (chip) {
      case 'Active':
      case 'Completed':
      case 'Closed':
        return tone(GAME_STATUS_TONE[chip]);
      case 'Results':
        return tone('results');
      case 'Awards pending':
        return tone('warning');
      case 'OUT':
        return tone('danger');
      case 'Re-entered':
        return tone('info');
      default:
        return tone('neutral');
    }
  };
}

/** One line of help copy with its pills, bold labels, button and score-cell specimens. */
export function HelpLine({ text, variant = 'bodyMedium', color }: { text: string; variant?: 'bodyMedium' | 'bodySmall' | 'bodyLarge'; color?: string }) {
  const { colors } = useAppTheme();
  const palette = useChipPalette();
  const fg = color ?? colors.onSurface;
  return (
    <Text variant={variant} style={[styles.line, { color: fg }]}>
      {splitHelpLine(text).map((part, i) => {
        switch (part.kind) {
          case 'chip': {
            const { bg, fg: chipFg } = palette(part.chip);
            return (
              <Text key={i} style={[styles.pill, { backgroundColor: bg, color: chipFg }]}>
                {' '}{part.chip}{' '}
              </Text>
            );
          }
          case 'bold':
            return <Text key={i} variant={variant} style={[styles.bold, { color: fg }]}>{part.text}</Text>;
          case 'button':
            return (
              <Text key={i} style={[styles.button, { backgroundColor: colors.primary, color: colors.onPrimary }]}>
                {' '}{part.text}{' '}
              </Text>
            );
          case 'cell': {
            const minus = part.text.trim().startsWith('-');
            return (
              <Text key={i} style={[styles.cell, { backgroundColor: colors.surfaceVariant, color: minus ? colors.error : colors.primary }]}>
                {' '}{part.text}{' '}
              </Text>
            );
          }
          default:
            return <Text key={i} variant={variant} style={{ color: fg }}>{part.text}</Text>;
        }
      })}
    </Text>
  );
}

/** A bulleted list of help lines with a hanging indent. */
export function HelpBullets({ lines, numbered = false, color }: { lines: readonly string[]; numbered?: boolean; color?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.list}>
      {lines.map((line, index) => (
        <View key={index} style={styles.row}>
          {numbered ? (
            <View style={[styles.badge, { backgroundColor: colors.onSurface }]}>
              <Text style={[styles.badgeText, { color: colors.surface }]}>{index + 1}</Text>
            </View>
          ) : (
            <Text variant="bodyMedium" style={[styles.dot, { color: color ?? colors.onSurfaceVariant }]}>•</Text>
          )}
          <View style={styles.body}>
            <HelpLine text={line} color={color} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { lineHeight: 22 },
  bold: { fontWeight: '700' },
  pill: {
    fontWeight: '700',
    fontSize: 12,
    ...(Platform.OS === 'ios' ? {} : { borderRadius: radius.xs, overflow: 'hidden' as const }),
  },
  button: {
    fontWeight: '700',
    fontSize: 12,
    ...(Platform.OS === 'ios' ? {} : { borderRadius: radius.full, overflow: 'hidden' as const }),
  },
  cell: {
    fontWeight: '700',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    ...(Platform.OS === 'ios' ? {} : { borderRadius: radius.xs, overflow: 'hidden' as const }),
  },
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  dot: { width: 12, lineHeight: 22 },
  body: { flex: 1 },
  badge: { width: 20, height: 20, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  badgeText: { fontSize: 12, fontWeight: '800' },
});

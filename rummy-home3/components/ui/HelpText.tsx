import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { spacing, useAppTheme } from '@/constants/theme';
import { GAME_STATUS_TONE } from '@/utils/gameStatus';
import { HelpChip, helpHeadingText, isHelpHeading, splitHelpLine } from '@/utils/helpMarkup';

function Chip({ chip }: { chip: HelpChip }) {
  const { colors } = useAppTheme();
  const palette = {
    primary: { bg: colors.primaryContainer, fg: colors.onPrimaryContainer },
    info: { bg: colors.tertiaryContainer, fg: colors.onTertiaryContainer },
    neutral: { bg: colors.surfaceVariant, fg: colors.onSurfaceVariant },
  };
  const { bg, fg } = chip === 'Results'
    ? { bg: colors.secondaryContainer, fg: colors.onSecondaryContainer }
    : palette[GAME_STATUS_TONE[chip]];
  return (
    <Text style={[styles.chip, { backgroundColor: bg, color: fg }]}>
      {' '}{chip}{' '}
    </Text>
  );
}

export function HelpText({ text, color }: { text: string; color?: string }) {
  const { colors } = useAppTheme();
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  return (
    <View style={styles.list}>
      {lines.map((line, index) => {
        if (isHelpHeading(line)) {
          return (
            <Text key={index} variant="labelLarge" style={[styles.heading, index > 0 && styles.headingGap, { color: color ?? colors.onSurfaceVariant }]}>
              {helpHeadingText(line)}
            </Text>
          );
        }
        const isBullet = line.startsWith('•');
        const body = isBullet ? line.slice(1).trim() : line;
        return (
          <View key={index} style={styles.row}>
            {isBullet ? <Text variant="bodyMedium" style={[styles.dot, color ? { color } : null]}>•</Text> : null}
            <Text variant="bodyMedium" style={[styles.body, color ? { color } : null]}>
              {splitHelpLine(body).map((part, i) => (part.kind === 'chip' ? <Chip key={i} chip={part.chip} /> : <Text key={i} variant="bodyMedium" style={color ? { color } : null}>{part.text}</Text>))}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  heading: { textTransform: 'uppercase', letterSpacing: 0.6 },
  headingGap: { marginTop: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  dot: { width: 12, lineHeight: 20 },
  body: { flex: 1, lineHeight: 22 },
  chip: {
    fontWeight: '700',
    fontSize: 13,
    ...(Platform.OS === 'ios' ? {} : { borderRadius: 6, overflow: 'hidden' as const }),
  },
});

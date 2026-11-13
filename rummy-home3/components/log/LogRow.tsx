import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { DOT_COLORS, dotTone, editChanges, formatLogTime, formatLogWhen, LogEntry, scoreText, summarySpans } from '@/utils/eventLog';

type Props = {
  entry: LogEntry;
  /** Absolute date + time (History spans days); the game Log shows time under a day header. */
  absolute?: boolean;
  testID?: string;
};

/**
 * One log line: coloured dot, time, "<Actor> · <summary>" with names bold. An edited round
 * expands to a was→now table on tap (collapsed by default, D4 of the UI plan).
 */
export function LogRow({ entry, absolute = false, testID }: Props) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const changes = editChanges(entry);
  const spans = summarySpans(entry.summary, entry.details.names);
  const time = absolute ? formatLogWhen(entry.at) : formatLogTime(entry.at);
  const routine = entry.level === 'routine';

  const body = (
    <View style={styles.row} testID={testID} accessibilityLabel={`${time}. ${entry.actorName}: ${entry.summary}`}>
      <View style={[styles.dot, { backgroundColor: DOT_COLORS[dotTone(entry)] }]} />
      <View style={styles.text}>
        <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>{time}</Text>
        <Text variant="bodyMedium" style={routine ? { color: colors.onSurfaceVariant } : undefined}>
          <Text style={styles.actor}>{entry.actorName}</Text>
          {' · '}
          {spans.map((span, index) => (
            <Text key={`${index}-${span.text}`} style={span.bold ? styles.bold : undefined}>{span.text}</Text>
          ))}
          {changes.length > 0 ? <Text style={{ color: colors.primary }}>{open ? '  Hide' : '  Show'}</Text> : null}
        </Text>
        {open && changes.length > 0 ? (
          <View style={[styles.table, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceVariant }]} testID={testID ? `${testID}-changes` : undefined}>
            <View style={styles.tableRow}>
              <Text variant="labelSmall" style={[styles.cellName, { color: colors.onSurfaceVariant }]}>Player</Text>
              <Text variant="labelSmall" style={[styles.cell, { color: colors.onSurfaceVariant }]}>Was</Text>
              <Text variant="labelSmall" style={[styles.cell, { color: colors.onSurfaceVariant }]}>Now</Text>
            </View>
            {changes.map((change) => (
              <View key={`${change.name}-${change.ini ?? ''}`} style={styles.tableRow}>
                <Text variant="bodySmall" style={styles.cellName} numberOfLines={1}>{change.name}</Text>
                <Text variant="bodySmall" style={styles.cell}>{scoreText(change.old)}</Text>
                <Text variant="bodySmall" style={[styles.cell, styles.bold]}>{scoreText(change.next)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );

  if (changes.length === 0) return body;
  return (
    <Pressable onPress={() => setOpen((value) => !value)} accessibilityRole="button" accessibilityHint="Shows the old and new scores">
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.sm, gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  text: { flex: 1, gap: 2 },
  actor: { fontWeight: '700' },
  bold: { fontWeight: '700' },
  table: { marginTop: spacing.xs, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  tableRow: { flexDirection: 'row', paddingVertical: 2 },
  cellName: { flex: 1 },
  cell: { width: 56, textAlign: 'right', fontVariant: ['tabular-nums'] },
});

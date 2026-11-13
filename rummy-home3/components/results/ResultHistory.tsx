import React from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { LogRow } from '@/components/log/LogRow';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { ChangedNote, changedNoteLine, formatLogWhen, LogEntry, ResultHistory as History } from '@/utils/eventLog';

export const RESULT_HISTORY_TITLE = 'History';

type Props = {
  history: History | null;
  onLayout?: (event: LayoutChangeEvent) => void;
};

/**
 * What happened to a saved result after it was saved (036): saved, deleted, restored, and
 * "changed" rows when a game it counts was edited, undone, reopened or deleted. Each row is
 * dated because a result can live for weeks. Versions (034) are listed under the rows.
 */
export function ResultHistorySection({ history, onLayout }: Props) {
  const { colors } = useAppTheme();
  const rows: LogEntry[] = history?.rows ?? [];
  return (
    <View style={styles.block} onLayout={onLayout} testID="result-history">
      <Text variant="titleMedium">{RESULT_HISTORY_TITLE}</Text>
      {rows.length === 0 ? (
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }} testID="result-history-empty">
          Nothing has changed since this result was saved.
        </Text>
      ) : (
        rows.map((row, index) => (index === 0
          ? <LogRow key={row.id} entry={row} absolute testID="result-history-first-row" />
          : <LogRow key={row.id} entry={row} absolute />))
      )}
      {history && history.versions.length > 1 ? (
        <View style={styles.versions} testID="result-history-versions">
          <Text variant="labelLarge" style={{ color: colors.onSurfaceVariant }}>Versions</Text>
          {history.versions.map((version) => (
            <Text key={version.version} variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
              {`v${version.version} · ${formatLogWhen(version.savedAt)}${version.note ? ` · ${version.note}` : ''}`}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** The amber one-liner at the top of a changed result; tapping it jumps to History. */
export function ChangedAfterSharingLine({ note, onPress }: { note: ChangedNote; onPress?: () => void }) {
  const { colors } = useAppTheme();
  const line = changedNoteLine(note);
  if (!line) return null;
  return (
    <View style={[styles.changed, { backgroundColor: colors.secondaryContainer }]} accessibilityRole="alert" testID="result-changed-note">
      <Icon source="pencil-outline" size={20} color={colors.onSecondaryContainer} />
      <Text variant="bodyMedium" style={[styles.changedText, { color: colors.onSecondaryContainer }]} onPress={onPress}>
        {line}
        {onPress ? <Text style={[styles.see, { color: colors.onSecondaryContainer }]}> · See History</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.xs, marginTop: spacing.md },
  versions: { marginTop: spacing.sm, gap: 2 },
  changed: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md },
  changedText: { flex: 1 },
  see: { fontWeight: '700' },
});

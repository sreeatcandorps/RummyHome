import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { formatWhen } from '@/utils/formatWhen';
import { ResultStale, resultStaleLines } from '@/utils/results';

/**
 * D49 (option B): a result whose game was reopened after it was saved. The numbers stay as saved; the
 * banner says so, names the game and the person, and offers the two ways on: a new result, or Delete
 * (which lives further down the page).
 */
export function ResultStaleBanner({ stale, canDelete, onNewResult, onDelete }: {
  stale: ResultStale | undefined;
  canDelete: boolean;
  onNewResult: () => void;
  onDelete: () => void;
}) {
  const { colors } = useAppTheme();
  if (!stale) return null;
  const lines = resultStaleLines(stale, formatWhen);
  return (
    <View style={[styles.box, { backgroundColor: colors.secondaryContainer }]} accessibilityRole="alert" testID="result-stale-banner">
      <View style={styles.head}>
        <Icon source="alert-outline" size={22} color={colors.onSecondaryContainer} />
        <Text variant="titleSmall" style={[styles.title, { color: colors.onSecondaryContainer }]}>{lines.title}</Text>
      </View>
      <Text variant="bodyMedium" style={{ color: colors.onSecondaryContainer }} testID="result-stale-body">{lines.body}</Text>
      <Text variant="bodyMedium" style={{ color: colors.onSecondaryContainer }}>{lines.next}</Text>
      <View style={styles.actions}>
        <Button mode="contained" compact onPress={onNewResult} testID="result-stale-new">Make a new result</Button>
        {canDelete ? (
          <Button mode="text" compact textColor={colors.error} onPress={onDelete} testID="result-stale-delete">Delete this result</Button>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontWeight: '800' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.xs },
});

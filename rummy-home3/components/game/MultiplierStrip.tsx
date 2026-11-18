import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Dialog, Icon, Portal, Switch, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { radius, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { ACTUAL_LABEL, ENTERED_LABEL, enteredBanner, ExactLine, exactSheetHint, multiplierLabel, totalsFooter } from '@/utils/multiplier';

/**
 * PR 14: the black `×N ⓘ` chip. Tapping it opens the Exact points sheet (D14.7, M21). Nowhere at ×1.
 */
export function MultiplierChip({ multiplier, onPress, testID = 'multiplier-chip' }: { multiplier: number; onPress?: () => void; testID?: string }) {
  const { colors } = useAppTheme();
  if (multiplier <= 1) return null;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.chip, { backgroundColor: colors.onSurface }]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Multiplier ${multiplierLabel(multiplier)}${onPress ? ', opens the exact points' : ''}`}
      testID={testID}
    >
      <Text style={[styles.chipText, tabularNums, { color: colors.surface }]}>{multiplierLabel(multiplier)}</Text>
      {onPress ? <Icon source="information-outline" size={14} color={colors.surface} /> : null}
    </Pressable>
  );
}

/** The Actual / Entered switch, shown only past ×1 (D14.8); the yellow banner while it is off. */
export function ActualToggle({ multiplier, on, onChange }: { multiplier: number; on: boolean; onChange: (on: boolean) => void }) {
  const { colors } = useAppTheme();
  if (multiplier <= 1) return null;
  return (
    <View style={styles.toggleWrap}>
      <View style={styles.toggleRow} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={on ? ACTUAL_LABEL : ENTERED_LABEL}>
        <Text variant="labelLarge" style={{ color: colors.onSurface }} testID="actual-toggle-label">{on ? ACTUAL_LABEL : ENTERED_LABEL}</Text>
        <Switch value={on} onValueChange={onChange} testID="actual-toggle" />
      </View>
      {!on ? (
        <View style={[styles.banner, { backgroundColor: colors.secondaryContainer }]} testID="entered-banner">
          <Icon source="alert-outline" size={16} color={colors.onSecondaryContainer} />
          <Text variant="bodySmall" style={[styles.bannerText, { color: colors.onSecondaryContainer }]}>{enteredBanner(multiplier)}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The Exact points sheet (M11): one line per player, exact actual total, "entered × N" under it, the
 * whole-game hint, the totals line and Share full details. Exists at ×1 too (then it is the totals
 * as a list, suggestion 4).
 */
export function ExactPointsSheet({ visible, multiplier, lines, sum, shortened, onDismiss, onSharePdf }: {
  visible: boolean;
  multiplier: number;
  lines: ExactLine[];
  sum: number;
  shortened: boolean;
  onDismiss: () => void;
  onSharePdf?: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog} testID="exact-points-sheet">
        <Dialog.Title>Exact points</Dialog.Title>
        <Dialog.Content style={styles.content}>
          {lines.map((line) => (
            <View key={line.id} style={[styles.line, { borderBottomColor: colors.outlineVariant }]} testID={`exact-line-${line.id}`}>
              <View style={styles.nameBlock}>
                <Text variant="titleSmall" numberOfLines={1} style={{ color: colors.onSurface }}>
                  {line.label ? `${line.label} · ${line.name}` : line.name}
                </Text>
                {line.entered ? <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{line.entered}</Text> : null}
              </View>
              <Text variant="titleMedium" style={[tabularNums, { color: line.total < 0 ? colors.loss : colors.onSurface, fontWeight: '800' }]} testID={`exact-total-${line.id}`}>
                {line.exact}
              </Text>
            </View>
          ))}
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant, marginTop: spacing.sm }}>{exactSheetHint(multiplier)}</Text>
          <Text variant="labelLarge" style={{ color: sum === 0 ? colors.onSurface : colors.error, marginTop: spacing.xs }} testID="exact-totals-line">
            {totalsFooter(sum, shortened)}
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          {onSharePdf ? <Button icon="file-pdf-box" onPress={onSharePdf}>Share full details</Button> : null}
          {/* A05 / Nov 18: an info sheet closes with Close; Done is only for ending a game. */}
          <Button mode="contained" onPress={onDismiss}>Close</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  chipText: { fontWeight: '800', fontSize: 14, letterSpacing: 0.2 },
  toggleWrap: { gap: spacing.xs },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.sm },
  bannerText: { flex: 1, fontWeight: '600' },
  dialog: { maxWidth: 480, width: '92%', alignSelf: 'center' },
  content: { gap: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  nameBlock: { flex: 1, minWidth: 0 },
});

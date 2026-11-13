import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { Medal, RankedRow } from '@/utils/resultsDesign';

/** Gold / silver / bronze circles with 1, 2, 3 — drawn, never an emoji, so every surface matches. */
export const MEDAL_COLORS: Record<Medal, { bg: string; fg: string; name: string }> = {
  1: { bg: '#F6C84C', fg: '#3F2D00', name: 'Gold' },
  2: { bg: '#D9DCE0', fg: '#2B3036', name: 'Silver' },
  3: { bg: '#D99A66', fg: '#3B1D08', name: 'Bronze' },
};

export function MedalBadge({ medal, size = 20 }: { medal: Medal; size?: number }) {
  const colour = MEDAL_COLORS[medal];
  return (
    <View
      accessibilityLabel={`${colour.name} medal`}
      testID={`medal-${medal}`}
      style={[styles.medal, { width: size, height: size, borderRadius: size / 2, backgroundColor: colour.bg }]}
    >
      <Text style={[styles.medalText, { color: colour.fg, fontSize: Math.round(size * 0.6) }]}>{medal}</Text>
    </View>
  );
}

/**
 * One player in the scores columns: name with the medal, "#8 · RK" under it, the total on
 * the right. Negative totals read red; everything else is near-black.
 */
export function PlayerLine({ row, large = false, testID }: { row: RankedRow; large?: boolean; testID?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.line, { borderBottomColor: colors.outlineVariant }]} testID={testID ?? `score-line-${row.id}`} accessibilityLabel={`${row.name}, ${row.text}`}>
      <View style={styles.nameBlock}>
        <View style={styles.nameRow}>
          {row.medal ? <MedalBadge medal={row.medal} /> : null}
          <Text variant={large ? 'titleMedium' : 'bodyLarge'} style={[styles.name, { color: colors.onSurface }]} numberOfLines={1}>{row.name}</Text>
        </View>
        {row.sub ? <Text variant="labelSmall" numberOfLines={1} style={{ color: colors.onSurfaceVariant }}>{row.sub}</Text> : null}
      </View>
      <Text
        numberOfLines={1}
        style={[tabularNums, styles.points, large && styles.pointsLarge, { color: row.points < 0 ? colors.negative : colors.onSurface }]}
      >
        {row.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  medal: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.15)' },
  medalText: { fontWeight: '800', lineHeight: 14 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  nameBlock: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontWeight: '700', flexShrink: 1 },
  points: { fontWeight: '800', fontSize: 20, lineHeight: 26 },
  pointsLarge: { fontSize: 24, lineHeight: 30 },
});

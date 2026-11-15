import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { radius, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { PoolStanding } from '@/utils/pool';

export type PoolStandingRow = PoolStanding & {
  name: string;
  label: string;
  number?: number | null;
  /** Null when the player may re-enter now; otherwise why not (shown as a hint). */
  reentryHint: string | null;
  canReenter: boolean;
};

/**
 * Pool standings under the scorecard (D5): players still in, lowest score first, with points left
 * and drops left; players who are out below, struck through, with Re-enter when they may come back.
 * The grid itself shows none of this.
 *
 * F5 (run 6, flow 17): the card sits under the grid in a fixed column, so with 20 players its rows
 * used to take the whole screen and squeeze the grid to nothing. The rows now scroll inside the
 * card, which never grows past `maxHeight` (the screen passes a share of the window height).
 */
export function PoolStandings({ rows, limit, compact = false, onReenter, busyId, maxHeight }: {
  rows: PoolStandingRow[];
  limit: number;
  compact?: boolean;
  onReenter?: (playerId: string) => void;
  busyId?: string | null;
  /** Cap on the card's height; the rows scroll inside it when they need more. */
  maxHeight?: number;
}) {
  const { colors } = useAppTheme();
  const inRows = rows.filter((r) => !r.out);
  const outRows = rows.filter((r) => r.out);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }, compact && styles.cardCompact, maxHeight != null && { maxHeight }]} testID="pool-standings">
      <View style={styles.head}>
        <Text variant="titleSmall" style={{ color: colors.onSurface }}>Standings</Text>
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{`Limit ${limit} · ${limit - 1} in, ${limit} out`}</Text>
      </View>
      <View style={styles.columns}>
        <Text style={[styles.colHead, styles.name, { color: colors.onSurfaceVariant }]}>Player</Text>
        <Text style={[styles.colHead, styles.num, { color: colors.onSurfaceVariant }]}>Score</Text>
        <Text style={[styles.colHead, styles.num, { color: colors.onSurfaceVariant }]}>Left</Text>
        <Text style={[styles.colHead, styles.num, { color: colors.onSurfaceVariant }]}>Drops</Text>
      </View>
      <ScrollView style={styles.rows} nestedScrollEnabled showsVerticalScrollIndicator={rows.length > 8} testID="pool-standings-rows">
      {inRows.map((r, index) => {
        const leader = index === 0 && inRows.length > 1;
        return (
          <View
            key={r.playerId}
            style={[styles.row, { backgroundColor: leader ? colors.leaderContainer : r.reentered ? colors.reentryContainer : 'transparent' }]}
            accessible
            accessibilityLabel={`${r.label} ${r.name}, ${r.total}, ${r.left} left, ${r.drops} drops${r.reentered ? ', re-entered' : ''}${leader ? ', leading' : ''}`}
            testID={`pool-standing-${r.playerId}`}
          >
            <View style={[styles.name, styles.nameCell]}>
              <Text style={[styles.label, { color: r.reentered ? colors.reentry : colors.onSurface }]}>{r.label}</Text>
              <Text variant="bodyMedium" numberOfLines={1} style={[styles.flex, { color: colors.onSurface }]}>{r.name}</Text>
              {r.number != null ? <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{`#${r.number}`}</Text> : null}
              {leader ? <Icon source="crown" size={14} color={colors.leader} /> : null}
              {r.reentered ? <Icon source="restore" size={14} color={colors.reentry} /> : null}
            </View>
            <Text style={[styles.num, styles.value, tabularNums, { color: r.reentered ? colors.reentry : colors.onSurface }]}>{r.total}</Text>
            <Text style={[styles.num, styles.value, tabularNums, { color: r.left <= Math.ceil(limit / 4) ? colors.loss : colors.onSurface }]}>{r.left}</Text>
            <Text style={[styles.num, styles.value, tabularNums, { color: r.drops <= 1 ? colors.loss : colors.onSurface }]}>{r.drops}</Text>
          </View>
        );
      })}
      {outRows.length ? (
        <>
          <Text variant="labelSmall" style={[styles.outHead, { color: colors.onSurfaceVariant }]}>Out</Text>
          {outRows.map((r) => (
            <View key={r.playerId} style={styles.row} accessible accessibilityLabel={`${r.label} ${r.name}, out in round ${r.outRound}, ${r.total}`} testID={`pool-standing-${r.playerId}`}>
              <View style={[styles.name, styles.nameCell]}>
                <Text style={[styles.label, styles.struck, { color: colors.onSurfaceVariant }]}>{r.label}</Text>
                <Text variant="bodyMedium" numberOfLines={1} style={[styles.flex, styles.struck, { color: colors.onSurfaceVariant }]}>{r.name}</Text>
                <Text variant="bodySmall" style={{ color: colors.loss, fontWeight: '700' }}>{`OUT R${r.outRound}`}</Text>
              </View>
              <Text style={[styles.num, styles.value, tabularNums, styles.struck, { color: colors.onSurfaceVariant }]}>{r.total}</Text>
              <View style={[styles.reenterCell]}>
                {onReenter && r.canReenter ? (
                  <Button compact mode="contained-tonal" icon="restore" onPress={() => onReenter(r.playerId)} loading={busyId === r.playerId} disabled={Boolean(busyId)} accessibilityLabel={`Re-enter ${r.name}`} testID={`reenter-${r.playerId}`}>
                    Re-enter
                  </Button>
                ) : (
                  <Text variant="bodySmall" numberOfLines={2} style={{ color: colors.onSurfaceVariant, textAlign: 'right' }}>{r.reentryHint ?? ''}</Text>
                )}
              </View>
            </View>
          ))}
        </>
      ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, padding: spacing.sm, gap: 2, marginTop: spacing.sm },
  cardCompact: { padding: spacing.xs, marginTop: spacing.xs },
  rows: { flexGrow: 0, flexShrink: 1 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: spacing.xs, paddingBottom: 4 },
  columns: { flexDirection: 'row', paddingHorizontal: spacing.xs, paddingBottom: 2 },
  colHead: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs, paddingVertical: 5, borderRadius: radius.sm },
  name: { flex: 1 },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // F13.22: the label keeps its own width; the name beside it is what shrinks.
  label: { fontWeight: '800', minWidth: 30, flexShrink: 0 },
  num: { width: 56, textAlign: 'right' },
  value: { fontWeight: '700' },
  reenterCell: { width: 112, alignItems: 'flex-end' },
  outHead: { paddingHorizontal: spacing.xs, paddingTop: spacing.xs },
  struck: { textDecorationLine: 'line-through' },
  flex: { flexShrink: 1 },
});

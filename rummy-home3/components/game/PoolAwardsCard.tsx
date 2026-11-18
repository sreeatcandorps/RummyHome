import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { radius, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { Game } from '@/types/game';
import { poolStandings } from '@/utils/pool';
import { signedPoints } from '@/utils/poolAwards';

/**
 * The awards block on a completed pool's scorecard (P19 / P30): the saved awards per player with
 * the preset and the given-out line, or "Awards pending" with Give awards for an admin. Awards are
 * points from the pool; the word money never appears (D9, D12).
 */
export function PoolAwardsCard({ game, names, labels, canManage, compact = false, onGiveAwards }: {
  game: Game;
  names: Record<string, string>;
  /** Seat initials (F13.22: shown in full beside the name, never shrunk). */
  labels?: Record<string, string>;
  canManage: boolean;
  compact?: boolean;
  onGiveAwards: () => void;
}) {
  const { colors } = useAppTheme();
  const awards = game.prizeShares ?? {};
  const awarded = Boolean(game.awardedAt);
  const note = game.awardNote;
  const rows = poolStandings(game);
  const closed = Boolean(game.closedAt);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }, compact && styles.cardCompact]} testID="pool-awards">
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Icon source="trophy-outline" size={18} color={awarded ? colors.onSurface : colors.onSurfaceVariant} />
          <Text variant="titleSmall" style={{ color: colors.onSurface }}>{awarded ? 'Awards' : 'Awards pending'}</Text>
        </View>
        {canManage && !closed ? (
          <Button compact mode={awarded ? 'outlined' : 'contained'} icon={awarded ? 'pencil-outline' : 'trophy-outline'} onPress={onGiveAwards} testID="give-awards">
            {awarded ? 'Change awards' : 'Give awards'}
          </Button>
        ) : null}
      </View>
      {awarded ? (
        <>
          {rows.map((r) => {
            const award = awards[r.playerId] ?? 0;
            return (
              <View key={r.playerId} style={styles.row} testID={`award-row-${r.playerId}`}>
                <View style={[styles.name, styles.nameCell]}>
                  {labels?.[r.playerId] ? <Text style={[styles.label, { color: colors.onSurface }, r.out && styles.struck]}>{labels[r.playerId]}</Text> : null}
                  <Text numberOfLines={1} style={[styles.flex, { color: colors.onSurface }, r.out && styles.struck]}>{names[r.playerId] ?? '?'}</Text>
                </View>
                <Text style={[styles.num, tabularNums, { color: colors.onSurfaceVariant }]}>{r.total}</Text>
                <Text style={[styles.num, styles.award, tabularNums, { color: award > 0 ? colors.win : award < 0 ? colors.loss : colors.onSurface }]}>{signedPoints(award)}</Text>
              </View>
            );
          })}
          {note ? (
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }} testID="award-note">
              {`${note.presetLabel} · entry ${note.entry} · pool ${note.poolTotal}${note.givenOut === note.poolTotal ? '' : ` · ${note.givenOut} given out`}`}
            </Text>
          ) : null}
        </>
      ) : (
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
          {canManage ? 'Choose how the pool is shared out. The pool joins a result only once awards are given.' : 'An admin gives the awards; then the pool can join a result.'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.sm, gap: spacing.xs },
  cardCompact: { padding: spacing.sm, marginTop: spacing.xs },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  name: { flex: 1, fontWeight: '600' },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minWidth: 0 },
  label: { fontWeight: '800', minWidth: 30, flexShrink: 0 },
  flex: { flex: 1, fontWeight: '600' },
  struck: { textDecorationLine: 'line-through', opacity: 0.7 },
  num: { width: 56, textAlign: 'right', fontWeight: '600' },
  award: { fontWeight: '800' },
});

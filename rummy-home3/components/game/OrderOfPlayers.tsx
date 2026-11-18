import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { radius, seatColor, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import {
  displayOrder,
  isLastNumbered,
  numberedCounter,
  OrderDraft,
  seatNumberOf,
  seatRowHeight,
  seatRowLabel,
  showsPlayerCode,
  stepNumbered,
  tapPlayer,
} from '@/utils/seating';

export type SeatingPlayer = {
  id: string;
  name: string;
  /** The scorecard's column letters. */
  label: string;
  /** Visible player ID ("#42", `displayPlayerId`); shown when the row is wide enough. */
  playerCode?: string | null;
  /** Pool: out of the pool (grey seat, S07). */
  out?: boolean;
  /** Pool: re-entered (blue, as on the card). */
  reentered?: boolean;
};

/**
 * Order of players (PR 24) — the one list used at game start (New game step) and mid-game (⋮ sheet).
 * Rows: seat circle, avatar, name, initials, player ID when it fits. Tap an unnumbered player to give
 * them the next seat (they rise to the numbered block); tap the most recently numbered player to take
 * it back; tap any other numbered player to highlight them. Numbered players carry ▲ ▼ that work at
 * once; unnumbered players have none. One row is highlighted at a time: the last one touched. The
 * green seat number is who deals next under the order being built. The parent scrolls.
 */
export function OrderOfPlayers({ players, draft, onChange, dealsNext, disabled = false, testIDPrefix = 'seat' }: {
  players: SeatingPlayer[];
  draft: OrderDraft;
  onChange: (draft: OrderDraft) => void;
  /** Who deals next under the order being built (undefined before seat 1 exists). */
  dealsNext?: string;
  disabled?: boolean;
  testIDPrefix?: string;
}) {
  const { colors } = useAppTheme();
  const [rowWidth, setRowWidth] = useState(0);
  const byId = new Map(players.map((player) => [player.id, player]));
  const rows = displayOrder(draft);
  const rowHeight = seatRowHeight(rows.length);
  const compact = rows.length > 8;
  const withCode = showsPlayerCode(rowWidth);
  const onLayout = (event: LayoutChangeEvent) => {
    const width = Math.floor(event.nativeEvent.layout.width);
    if (width !== rowWidth) setRowWidth(width);
  };

  return (
    <View onLayout={onLayout} testID="order-of-players">
      {rows.map((id, index) => {
        const player = byId.get(id);
        if (!player) return null;
        const seat = seatNumberOf(draft, id);
        const numbered = seat != null;
        const deals = numbered && id === dealsNext;
        const focused = draft.focus === id;
        const undoable = isLastNumbered(draft, id);
        return (
          <Pressable
            key={id}
            onPress={() => onChange(tapPlayer(draft, id))}
            disabled={disabled}
            style={[
              styles.row,
              { height: rowHeight, borderColor: colors.outlineVariant },
              focused && { backgroundColor: colors.primaryContainer },
              player.out && { opacity: 0.6 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={seatRowLabel({ seat, name: player.name, dealsNext: deals, out: player.out })}
            accessibilityHint={!numbered ? `Give seat ${draft.numbered.length + 1}` : undoable ? 'Take the number back' : 'Highlight'}
            accessibilityState={{ selected: focused }}
            testID={`${testIDPrefix}-row-${index + 1}`}
          >
            <View
              style={[
                styles.seatNo,
                numbered
                  ? { backgroundColor: deals ? colors.primary : colors.surfaceVariant }
                  : { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: colors.outline, borderStyle: 'dashed' },
              ]}
              testID={`${testIDPrefix}-no-${index + 1}`}
            >
              {numbered ? (
                <Text style={[styles.seatNoText, tabularNums, { color: deals ? colors.onPrimary : colors.onSurfaceVariant, fontSize: compact ? 12 : 14 }]} testID={`${testIDPrefix}-number-${index + 1}`}>
                  {seat}
                </Text>
              ) : null}
            </View>
            <SeatAvatar name={player.name} label={player.label} color={player.out ? colors.surfaceVariant : player.reentered ? colors.tertiary : seatColor(numbered ? seat - 1 : index)} size={compact ? 24 : 30} />
            <Text
              variant={compact ? 'bodySmall' : 'bodyMedium'}
              style={[styles.name, { color: player.out ? colors.onSurfaceVariant : colors.onSurface, textDecorationLine: player.out ? 'line-through' : 'none' }]}
              numberOfLines={1}
              testID={`${testIDPrefix}-name-${index + 1}`}
            >
              {player.name}
            </Text>
            <Text variant="labelMedium" style={{ color: colors.onSurfaceVariant }} testID={`${testIDPrefix}-label-${index + 1}`}>{player.label}</Text>
            {withCode && player.playerCode ? (
              <Text variant="labelSmall" style={[tabularNums, { color: colors.onSurfaceVariant }]} testID={`${testIDPrefix}-code-${index + 1}`}>{player.playerCode}</Text>
            ) : null}
            {deals ? <Text variant="labelSmall" style={{ color: colors.primary }} testID={`${testIDPrefix}-deals-next`}>deals</Text> : null}
            {numbered ? (
              <View style={styles.arrows}>
                <IconButton icon="chevron-up" size={compact ? 14 : 18} iconColor={colors.onSurfaceVariant} disabled={disabled || seat === 1} onPress={() => onChange(stepNumbered(draft, id, -1))} accessibilityLabel={`Move ${player.name} up`} style={styles.arrow} testID={`${testIDPrefix}-up-${index + 1}`} />
                <IconButton icon="chevron-down" size={compact ? 14 : 18} iconColor={colors.onSurfaceVariant} disabled={disabled || seat === draft.numbered.length} onPress={() => onChange(stepNumbered(draft, id, 1))} accessibilityLabel={`Move ${player.name} down`} style={styles.arrow} testID={`${testIDPrefix}-down-${index + 1}`} />
              </View>
            ) : (
              <View style={styles.arrowsGap} />
            )}
          </Pressable>
        );
      })}
      <Text variant="labelSmall" style={[styles.counter, { color: colors.onSurfaceVariant }]} testID="order-counter">
        {numberedCounter(draft.numbered.length, rows.length)}
      </Text>
    </View>
  );
}

const ARROWS_WIDTH = 64;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, paddingHorizontal: spacing.xs },
  seatNo: { width: 24, height: 24, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  seatNoText: { fontWeight: '800' },
  name: { flex: 1, minWidth: 0 },
  arrows: { flexDirection: 'row', alignItems: 'center', width: ARROWS_WIDTH, justifyContent: 'flex-end' },
  arrowsGap: { width: ARROWS_WIDTH },
  arrow: { margin: 0 },
  counter: { paddingTop: spacing.xs, paddingHorizontal: spacing.xs },
});

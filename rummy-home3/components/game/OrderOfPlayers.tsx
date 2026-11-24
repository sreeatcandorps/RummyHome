import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { radius, seatColor, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import {
  displayRows,
  highestCardTag,
  isFirstNumbered,
  isLastNumbered,
  numberedCounter,
  OrderDraft,
  orderComplete,
  seatNumberOf,
  seatRowHeight,
  seatRowLabel,
  showsArrows,
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
 * Rows: seat circle, avatar, name, initials, player ID when it fits. Taps count down (D56): the first
 * tap is the highest card and takes the top row with seat N, each next tap the row under it with the
 * next seat down, and the last tap is seat 1 and deals. Tap the most recent tap to take it back; tap
 * any other numbered player to select them. Numbered players carry ▲ ▼ that work at once (▲ = a
 * higher seat); unnumbered players have none. D74: while a row is selected only its arrows show (green);
 * tap it again once everyone is numbered and every row's arrows come back. The top row has no ▲, the
 * lowest seat no ▼. The green seat number is who deals next once everyone is numbered. The parent scrolls.
 */
export function OrderOfPlayers({ players, draft, onChange, dealsNext, disabled = false, unchanged = false, testIDPrefix = 'seat' }: {
  players: SeatingPlayer[];
  draft: OrderDraft;
  onChange: (draft: OrderDraft) => void;
  /** Who deals next under the order being built (undefined before seat 1 exists). */
  dealsNext?: string;
  disabled?: boolean;
  /** Mid-game: the order on screen is the saved one, so the counter says Done will just close. */
  unchanged?: boolean;
  testIDPrefix?: string;
}) {
  const { colors } = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const [rowWidth, setRowWidth] = useState(0);
  const byId = new Map(players.map((player) => [player.id, player]));
  const rows = displayRows(draft);
  const building = !orderComplete(draft);
  const rowHeight = seatRowHeight(rows.length);
  // v12 point 6: rows are 48 dp at every count, so nothing shrinks; `compact` only trims the player ID line.
  const compact = false;
  const withCode = showsPlayerCode(rowWidth, fontScale);
  const highestTag = highestCardTag(rowWidth, fontScale);
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
        const highest = building && isFirstNumbered(draft, id);
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
            accessibilityHint={!numbered ? `Give seat ${draft.base.length - draft.numbered.length}` : undoable && building ? 'Take the number back' : focused ? 'Deselect' : 'Select'}
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
            {highest ? <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }} testID={`${testIDPrefix}-highest-card`}>{highestTag}</Text> : null}
            {numbered && showsArrows(draft, id) ? (
              <View style={styles.arrows}>
                {seat === draft.base.length ? (
                  <View style={styles.arrowSlot} />
                ) : (
                  <IconButton icon="chevron-up" size={22} iconColor={focused ? colors.primary : colors.onSurfaceVariant} disabled={disabled} onPress={() => onChange(stepNumbered(draft, id, 1))} accessibilityLabel={`Move ${player.name} up`} style={styles.arrow} testID={`${testIDPrefix}-up-${index + 1}`} />
                )}
                {seat === draft.base.length - draft.numbered.length + 1 ? (
                  <View style={styles.arrowSlot} />
                ) : (
                  <IconButton icon="chevron-down" size={22} iconColor={focused ? colors.primary : colors.onSurfaceVariant} disabled={disabled} onPress={() => onChange(stepNumbered(draft, id, -1))} accessibilityLabel={`Move ${player.name} down`} style={styles.arrow} testID={`${testIDPrefix}-down-${index + 1}`} />
                )}
              </View>
            ) : (
              <View style={styles.arrowsGap} />
            )}
          </Pressable>
        );
      })}
      <Text variant="labelSmall" style={[styles.counter, { color: colors.onSurfaceVariant }]} testID="order-counter">
        {numberedCounter(draft.numbered.length, rows.length, unchanged && !building)}
      </Text>
    </View>
  );
}

const ARROWS_WIDTH = 96;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, paddingHorizontal: spacing.xs },
  seatNo: { width: 24, height: 24, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  seatNoText: { fontWeight: '800' },
  // The name keeps at least a few letters whatever else the row carries (font 1.3: it had collapsed to nothing).
  name: { flex: 1, minWidth: 56 },
  arrows: { flexDirection: 'row', alignItems: 'center', width: ARROWS_WIDTH, justifyContent: 'flex-end' },
  arrowsGap: { width: ARROWS_WIDTH },
  arrow: { margin: 0 },
  arrowSlot: { width: 22 + 2 * 8, height: 22 + 2 * 8 },
  counter: { paddingTop: spacing.xs, paddingHorizontal: spacing.xs },
});

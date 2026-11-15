import React, { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Dialog, IconButton, Portal, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { radius, seatColor, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import {
  KEEP_THIS_ORDER,
  midGameSeatingNote,
  nextDealerFor,
  pickedCounter,
  pickedUpText,
  placeAt,
  sameOrder,
  SEATING_DONE,
  SEATING_POPUP_NOTE,
  SEATING_TITLE,
  seatingSubline,
  seatRowHeight,
  seatRowLabel,
  showsPlayerChips,
  stepSeat,
} from '@/utils/seating';

export type SeatingPlayer = {
  id: string;
  name: string;
  /** The scorecard's column letters. */
  label: string;
  /** Pool: out of the pool (grey seat, S07). */
  out?: boolean;
  /** Pool: re-entered (blue, as on the card). */
  reentered?: boolean;
};

/**
 * Seating order (PR 21, S01–S05): seats 1..N, each holding a player; tap a player then the seat they
 * belong in (the rows between shift one seat towards the gap), or ▲ ▼ one seat at a time. Nothing is
 * written until Done. The green seat number is who deals next under the order being built.
 */
export function SeatingSheet({ visible, fromMenu, players, pool, dealerIds, roundCount, onDismiss, onSave }: {
  visible: boolean;
  /** From the ⋮ menu (Cancel, the mid-game note) rather than the once-per-game pop-up (Keep this order). */
  fromMenu: boolean;
  /** Seated players in today's order. */
  players: SeatingPlayer[];
  pool: boolean;
  dealerIds?: (string | null | undefined)[] | null;
  roundCount: number;
  onDismiss: () => void;
  onSave: (order: string[]) => Promise<void> | void;
}) {
  const { colors } = useAppTheme();
  const layout = useLayout();
  const byId = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const base = useMemo(() => players.map((player) => player.id), [players]);
  const [order, setOrder] = useState<string[]>(base);
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Each opening starts from the current order, so Done with no change is one tap.
  useEffect(() => {
    if (visible) { setOrder(base); setPicked(null); setError(null); }
  }, [visible, base]);

  const outIds = useMemo(() => new Set(players.filter((player) => player.out).map((player) => player.id)), [players]);
  const dealsNext = nextDealerFor(order, dealerIds, roundCount, outIds);
  const changed = !sameOrder(base, order);
  const rowHeight = seatRowHeight(order.length);
  const compact = order.length > 8;
  const chips = showsPlayerChips(order.length, layout);
  const note = fromMenu ? midGameSeatingNote(roundCount) : null;

  const pick = (id: string) => {
    if (picked === id) { setPicked(null); return; }
    setPicked(id);
    AccessibilityInfo.announceForAccessibility?.(pickedUpText(byId.get(id)?.name ?? ''));
  };
  const dropAt = (seat: number) => {
    if (!picked) return;
    setOrder((current) => placeAt(current, picked, seat));
    setPicked(null);
  };
  const onRow = (id: string, index: number) => {
    if (picked && picked !== id) dropAt(index);
    else pick(id);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(order);
      onDismiss();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t save the seating.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={saving ? undefined : onDismiss} testID="seating-sheet">
        <Dialog.Title>{SEATING_TITLE}</Dialog.Title>
        <Dialog.Content style={styles.subline}>
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }} testID="seating-subline">
            {seatingSubline({ pool, seatCount: order.length, outCount: outIds.size, fromMenu })}
          </Text>
          {note ? (
            <View style={[styles.note, { backgroundColor: colors.secondaryContainer }]} testID="seating-note">
              <Text variant="bodySmall" style={{ color: colors.onSecondaryContainer }}>{note}</Text>
            </View>
          ) : (
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{SEATING_POPUP_NOTE}</Text>
          )}
          {picked ? (
            <Text variant="labelMedium" style={{ color: colors.primary }} testID="seating-picked" accessibilityLiveRegion="polite">
              {pickedUpText(byId.get(picked)?.name ?? '')}
            </Text>
          ) : null}
        </Dialog.Content>
        <Dialog.ScrollArea style={[styles.scrollArea, { maxHeight: Math.max(200, layout.height * 0.5) }]}>
          <ScrollView contentContainerStyle={styles.body}>
            <View style={styles.columns}>
              <View style={styles.seats}>
                {order.map((id, index) => {
                  const player = byId.get(id);
                  if (!player) return null;
                  const deals = id === dealsNext;
                  const isPicked = picked === id;
                  const target = Boolean(picked) && !isPicked;
                  return (
                    <Pressable
                      key={id}
                      onPress={() => onRow(id, index)}
                      disabled={saving}
                      style={[
                        styles.row,
                        { height: rowHeight, borderColor: colors.outlineVariant },
                        isPicked && { backgroundColor: colors.primaryContainer },
                        target && { borderColor: colors.primary, borderStyle: 'dashed' },
                        player.out && { opacity: 0.6 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={seatRowLabel({ seat: index + 1, name: player.name, dealsNext: deals, out: player.out, picked: isPicked })}
                      accessibilityHint={picked ? (isPicked ? 'Put down' : `Seat ${player.name} here`) : 'Pick up to move'}
                      testID={`seat-row-${index + 1}`}
                    >
                      <View style={[styles.seatNo, { backgroundColor: deals ? colors.primary : colors.surfaceVariant }]}>
                        <Text style={[styles.seatNoText, tabularNums, { color: deals ? colors.onPrimary : colors.onSurfaceVariant, fontSize: compact ? 12 : 14 }]} testID={`seat-no-${index + 1}`}>
                          {index + 1}
                        </Text>
                      </View>
                      <SeatAvatar name={player.name} label={player.label} color={player.out ? colors.surfaceVariant : player.reentered ? colors.tertiary : seatColor(index)} size={compact ? 24 : 30} />
                      <Text variant={compact ? 'bodySmall' : 'bodyMedium'} style={[styles.name, { color: player.out ? colors.onSurfaceVariant : colors.onSurface, textDecorationLine: player.out ? 'line-through' : 'none' }]} numberOfLines={1} testID={`seat-name-${index + 1}`}>
                        {player.name}
                      </Text>
                      {deals ? <Text variant="labelSmall" style={{ color: colors.primary }} testID="seat-deals-next">deals</Text> : null}
                      <IconButton icon="chevron-up" size={compact ? 16 : 20} disabled={saving || index === 0} onPress={() => setOrder((current) => stepSeat(current, id, -1))} accessibilityLabel={`Move ${player.name} up`} style={styles.arrow} testID={`seat-up-${index + 1}`} />
                      <IconButton icon="chevron-down" size={compact ? 16 : 20} disabled={saving || index === order.length - 1} onPress={() => setOrder((current) => stepSeat(current, id, 1))} accessibilityLabel={`Move ${player.name} down`} style={styles.arrow} testID={`seat-down-${index + 1}`} />
                    </Pressable>
                  );
                })}
              </View>
              {chips ? (
                <View style={styles.chipColumn} testID="seating-chips">
                  <Text variant="labelMedium" style={{ color: colors.onSurfaceVariant }}>Players</Text>
                  <View style={styles.chips}>
                    {players.map((player) => {
                      const isPicked = picked === player.id;
                      return (
                        <Pressable
                          key={player.id}
                          onPress={() => pick(player.id)}
                          disabled={saving}
                          style={[styles.chip, { backgroundColor: isPicked ? colors.primary : colors.surfaceVariant }]}
                          accessibilityRole="button"
                          accessibilityLabel={`${player.name}${isPicked ? ', picked up' : ''}`}
                          testID={`seat-chip-${player.label}`}
                        >
                          <Text variant="labelMedium" style={{ color: isPicked ? colors.onPrimary : colors.onSurface }}>{player.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>{pickedCounter(Boolean(picked), order.length)}</Text>
                </View>
              ) : null}
            </View>
            {error ? <Text variant="bodySmall" style={{ color: colors.error, marginTop: spacing.sm }} testID="seating-error">{error}</Text> : null}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={saving} testID="seating-cancel">{fromMenu ? 'Cancel' : KEEP_THIS_ORDER}</Button>
          <Button mode="contained" onPress={save} loading={saving} disabled={saving || (fromMenu && !changed)} testID="seating-done">{SEATING_DONE}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  subline: { gap: spacing.xs, paddingBottom: spacing.xs },
  note: { borderRadius: radius.md, padding: spacing.sm },
  scrollArea: { paddingHorizontal: 0 },
  body: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  columns: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  seats: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderWidth: 0, borderRadius: radius.sm, paddingHorizontal: spacing.xs },
  seatNo: { width: 24, height: 24, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  seatNoText: { fontWeight: '800' },
  name: { flex: 1, minWidth: 0 },
  arrow: { margin: 0 },
  chipColumn: { width: 96, gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
});

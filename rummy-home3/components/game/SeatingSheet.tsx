import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { OrderOfPlayers, SeatingPlayer } from '@/components/game/OrderOfPlayers';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import {
  clearOrder,
  displayOrder,
  midGameSeatingNote,
  nextDealerFor,
  OrderDraft,
  orderChanged,
  orderComplete,
  ORDER_HOW_TO,
  SEATING_CLEAR,
  SEATING_DONE,
  SEATING_TITLE,
  seatingSubline,
  startOrder,
} from '@/utils/seating';

export type { SeatingPlayer } from '@/components/game/OrderOfPlayers';

/**
 * Order of players, mid-game (⋮ menu, admins, Active games). The same list as the New game step,
 * opened with today's order already numbered so one move is one tap or one arrow. Nothing is
 * written until Done; Clear takes every number back; Cancel saves nothing. The green seat number is
 * who deals next under the order being built.
 */
export function SeatingSheet({ visible, players, pool, dealerIds, roundCount, onDismiss, onSave }: {
  visible: boolean;
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
  const base = useMemo(() => players.map((player) => player.id), [players]);
  const [draft, setDraft] = useState<OrderDraft>(() => startOrder(base, true));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Each opening starts from the current order, fully numbered. Keyed on the ids, not the array: a
  // scorecard reload behind the sheet (Realtime, the 20 s poll) must not undo the taps so far.
  const baseKey = base.join(',');
  useEffect(() => {
    if (visible) { setDraft(startOrder(base, true)); setError(null); }
  }, [visible, baseKey]);

  const outIds = useMemo(() => new Set(players.filter((player) => player.out).map((player) => player.id)), [players]);
  const dealsNext = draft.numbered.length ? nextDealerFor(displayOrder(draft), dealerIds, roundCount, outIds) : undefined;
  const complete = orderComplete(draft);
  const changed = orderChanged(draft);
  const note = midGameSeatingNote(roundCount);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(displayOrder(draft));
      onDismiss();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t save the order.');
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
            {seatingSubline({ pool, seatCount: base.length, outCount: outIds.size })}
          </Text>
          {note ? (
            <View style={[styles.note, { backgroundColor: colors.secondaryContainer }]} testID="seating-note">
              <Text variant="bodySmall" style={{ color: colors.onSecondaryContainer }}>{note}</Text>
            </View>
          ) : null}
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{ORDER_HOW_TO}</Text>
        </Dialog.Content>
        <Dialog.ScrollArea style={[styles.scrollArea, { maxHeight: Math.max(200, layout.height * 0.5) }]}>
          <ScrollView contentContainerStyle={styles.body}>
            <OrderOfPlayers players={players} draft={draft} onChange={setDraft} dealsNext={dealsNext} disabled={saving} />
            {error ? <Text variant="bodySmall" style={{ color: colors.error, marginTop: spacing.sm }} testID="seating-error">{error}</Text> : null}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={saving} testID="seating-cancel">Cancel</Button>
          <Button onPress={() => setDraft(clearOrder(draft))} disabled={saving || draft.numbered.length === 0} testID="seating-clear">{SEATING_CLEAR}</Button>
          <Button mode="contained" onPress={save} loading={saving} disabled={saving || !complete || !changed} testID="seating-done">{SEATING_DONE}</Button>
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
});

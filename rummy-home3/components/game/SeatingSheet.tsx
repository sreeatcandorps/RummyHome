import React, { useEffect, useMemo, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { Portal, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { BottomBar } from '@/components/ui/BottomBar';
import { OrderOfPlayers, SeatingPlayer } from '@/components/game/OrderOfPlayers';
import { SeatingTutorial } from '@/components/tutorial/SeatingTutorial';
import { useTutorial } from '@/hooks/useTutorial';
import { MAX_CONTENT_WIDTH, radius, spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import type { DealerOverride } from '@/types/game';
import {
  clearOrder,
  displayOrder,
  midGameSeatingNote,
  nextDealerFor,
  OrderDraft,
  orderChanged,
  orderComplete,
  SEATING_CLEAR,
  SEATING_DONE,
  SEATING_TITLE,
  seatingSubline,
  startOrder,
} from '@/utils/seating';

export type { SeatingPlayer } from '@/components/game/OrderOfPlayers';

/**
 * Order of players, mid-game (⋮ menu, admins, Active games): a full page since the circle (D138), over the
 * scorecard. The same circle as the New game step, opened with today's order already numbered so one move is one
 * tap and one arrow. The Dealer mark is who deals the round being played under the order on screen — the
 * scorecard's own rule (the seat after the last round's dealer, or the Dealer sheet's pick). Nothing is written
 * until Done; Clear takes every number back; Cancel (or the phone's Back) saves nothing.
 */
export function SeatingSheet({ visible, players, pool, dealerIds, nextDealerOverride, roundCount, meId, onDismiss, onSave }: {
  visible: boolean;
  /** Seated players in today's order. */
  players: SeatingPlayer[];
  pool: boolean;
  dealerIds?: (string | null | undefined)[] | null;
  nextDealerOverride?: DealerOverride | null;
  roundCount: number;
  meId?: string | null;
  onDismiss: () => void;
  onSave: (order: string[]) => Promise<void> | void;
}) {
  const { colors } = useAppTheme();
  const { insets, gutterLeft, gutterRight } = useLayout();
  const base = useMemo(() => players.map((player) => player.id), [players]);
  const [draft, setDraft] = useState<OrderDraft>(() => startOrder(base, true));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [height, setHeight] = useState(0);

  // Each opening starts from the current order, fully numbered. Keyed on the ids, not the array: a
  // scorecard reload behind the page (Realtime, the 20 s poll) must not undo the taps so far.
  const baseKey = base.join(',');
  useEffect(() => {
    if (visible) { setDraft(startOrder(base, true)); setError(null); }
  }, [visible, baseKey]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (!saving) onDismiss(); return true; });
    return () => sub.remove();
  }, [visible, saving, onDismiss]);

  const outIds = useMemo(() => new Set(players.filter((player) => player.out).map((player) => player.id)), [players]);
  const complete = orderComplete(draft);
  const dealsNext = complete ? nextDealerFor(displayOrder(draft), dealerIds, roundCount, outIds, nextDealerOverride) : undefined;
  const changed = orderChanged(draft);
  const note = midGameSeatingNote(roundCount);
  // D74: the steps open from Show me only.
  const tutorial = useTutorial('seating');

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

  if (!visible) return null;
  return (
    <Portal>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, paddingTop: insets.top }]} testID="seating-sheet">
        <View style={[styles.head, { paddingLeft: gutterLeft, paddingRight: gutterRight }]}>
          <View style={styles.column}>
            <Text variant="titleLarge" style={{ color: colors.onSurface, fontWeight: '700' }} accessibilityRole="header">{SEATING_TITLE}</Text>
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }} testID="seating-subline">
              {seatingSubline({ pool, seatCount: base.length, outCount: outIds.size })}
            </Text>
            {note ? (
              <View style={[styles.note, { backgroundColor: colors.secondaryContainer }]} testID="seating-note">
                <Text variant="bodySmall" style={{ color: colors.onSecondaryContainer }}>{note}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.flex} onLayout={(event) => setHeight(Math.floor(event.nativeEvent.layout.height))}>
          <ScrollView contentContainerStyle={{ paddingLeft: gutterLeft, paddingRight: gutterRight, paddingVertical: spacing.sm }} testID="seating-scroll">
            <View style={styles.column}>
              {height > 0 ? (
                <OrderOfPlayers
                  players={players}
                  draft={draft}
                  onChange={setDraft}
                  dealsNext={dealsNext}
                  dealRound={roundCount + 1}
                  meId={meId}
                  disabled={saving}
                  unchanged={complete && !changed}
                  availableHeight={height - 2 * spacing.sm - (error ? 40 : 0)}
                  onShowMe={tutorial.show}
                  howToTestID="seating-how-to"
                />
              ) : null}
              {error ? <Text variant="bodySmall" style={{ color: colors.error, marginTop: spacing.sm }} testID="seating-error">{error}</Text> : null}
            </View>
          </ScrollView>
        </View>
        <BottomBar style={styles.bottom}>
          <Button mode="outlined" onPress={onDismiss} disabled={saving} contentStyle={styles.barContent} style={styles.side} testID="seating-cancel">Cancel</Button>
          <Button mode="outlined" onPress={() => setDraft(clearOrder(draft))} disabled={saving || draft.numbered.length === 0} contentStyle={styles.barContent} style={styles.side} testID="seating-clear">{SEATING_CLEAR}</Button>
          <Button mode="contained" onPress={changed ? save : onDismiss} loading={saving} disabled={saving || !complete} contentStyle={styles.barContent} labelStyle={styles.doneLabel} style={styles.done} testID="seating-done">{SEATING_DONE}</Button>
        </BottomBar>
      </View>
      <SeatingTutorial visible={tutorial.visible} onDone={tutorial.done} />
    </Portal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', gap: spacing.xs },
  head: { paddingTop: spacing.md, paddingBottom: spacing.xs },
  note: { borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.xs },
  bottom: { flexDirection: 'row', gap: spacing.sm },
  barContent: { minHeight: 52 },
  side: { flex: 1 },
  done: { flex: 1.2 },
  doneLabel: { fontSize: 16, fontWeight: '800' },
});

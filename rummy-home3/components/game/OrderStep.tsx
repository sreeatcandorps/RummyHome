import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { BottomBar } from '@/components/ui/BottomBar';
import { OrderOfPlayers, SeatingPlayer } from '@/components/game/OrderOfPlayers';
import { SeatingTutorial } from '@/components/tutorial/SeatingTutorial';
import { MAX_CONTENT_WIDTH, spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { useTutorial } from '@/hooks/useTutorial';
import { lightTap } from '@/utils/haptics';
import { clearOrder, displayOrder, nextDealerFor, OrderDraft, ORDER_START, orderComplete, SEATING_CLEAR } from '@/utils/seating';

/**
 * New game, step 3 (PR 24; the circle since D138): Order of players. Nobody is numbered to begin with; tap the
 * players from the highest card to the lowest. Back / Clear / Next — or Start when no co-admin step
 * follows. Pure presentation: the New game screen owns the draft and the create call.
 */
export function OrderStep({ players, draft, onChange, onBack, onNext, nextIsStart, creating, error, meId }: {
  players: SeatingPlayer[];
  draft: OrderDraft;
  onChange: (draft: OrderDraft) => void;
  /** The signed-in player, for "you deal round 1". */
  meId?: string | null;
  onBack: () => void;
  onNext: () => void;
  /** No co-admin step follows: this button starts the game. */
  nextIsStart: boolean;
  creating: boolean;
  error: string | null;
}) {
  const { colors } = useAppTheme();
  const { gutterLeft, gutterRight, isShort } = useLayout();
  const [height, setHeight] = useState(0);
  const complete = orderComplete(draft);
  const dealsNext = complete ? nextDealerFor(displayOrder(draft), null, 0) : undefined;
  // D74: the steps open from Show me only (D61's forced first visit is gone).
  const tutorial = useTutorial('seating');
  const padTop = isShort ? spacing.sm : spacing.md;

  // The real last tap (D61): the middle names the dealer; the phone gives a light tap.
  const change = (next: OrderDraft) => {
    onChange(next);
    if (!orderComplete(draft) && orderComplete(next)) void lightTap();
  };
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.root} onLayout={(event) => setHeight(Math.floor(event.nativeEvent.layout.height))}>
        <ScrollView contentContainerStyle={{ paddingLeft: gutterLeft, paddingRight: gutterRight, paddingTop: padTop, paddingBottom: spacing.md }} keyboardShouldPersistTaps="handled" testID="new-game-order-scroll">
          <View style={styles.column}>
            {height > 0 ? (
              <OrderOfPlayers
                players={players}
                draft={draft}
                onChange={change}
                dealsNext={dealsNext}
                meId={meId}
                disabled={creating}
                availableHeight={height - padTop - spacing.md - (error ? 48 : 0)}
                onShowMe={tutorial.show}
                howToTestID="order-how-to"
              />
            ) : null}
            {error ? <Text variant="bodyMedium" style={{ color: colors.error, paddingTop: spacing.sm }} testID="new-game-problem">{error}</Text> : null}
          </View>
        </ScrollView>
      </View>
      <SeatingTutorial visible={tutorial.visible} onDone={tutorial.done} />
      <BottomBar style={styles.bottom}>
        <Button mode="outlined" onPress={onBack} disabled={creating} icon="arrow-left" contentStyle={styles.barContent} style={styles.back} accessibilityLabel="Back to game type" testID="new-game-order-back">
          Back
        </Button>
        <Button mode="outlined" onPress={() => onChange(clearOrder(draft))} disabled={creating || draft.numbered.length === 0} contentStyle={styles.barContent} style={styles.clear} accessibilityLabel="Clear the order" testID="new-game-order-clear">
          {SEATING_CLEAR}
        </Button>
        {nextIsStart ? (
          <Button mode="contained" onPress={onNext} loading={creating} disabled={creating || !complete} icon="play" contentStyle={styles.barContent} labelStyle={styles.nextLabel} style={styles.next} accessibilityLabel="Start game" testID="start-game">
            {ORDER_START}
          </Button>
        ) : (
          <Button mode="contained" onPress={onNext} loading={creating} disabled={creating || !complete} icon="arrow-right" contentStyle={styles.barContent} labelStyle={styles.nextLabel} style={styles.next} accessibilityLabel="Next: co-admin" testID="new-game-order-next">
            Next
          </Button>
        )}
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  column: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  bottom: { flexDirection: 'row', gap: spacing.sm },
  barContent: { minHeight: 52 },
  back: { flex: 0.8 },
  clear: { flex: 0.8 },
  next: { flex: 1.4 },
  nextLabel: { fontSize: 16, fontWeight: '800' },
});

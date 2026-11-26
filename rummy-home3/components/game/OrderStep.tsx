import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { BottomBar } from '@/components/ui/BottomBar';
import { SectionCard } from '@/components/ui/SectionCard';
import { Toast } from '@/components/ui/Toast';
import { OrderOfPlayers, SeatingPlayer } from '@/components/game/OrderOfPlayers';
import { OrderHowTo } from '@/components/game/OrderHowTo';
import { SeatingTutorial } from '@/components/tutorial/SeatingTutorial';
import { spacing, useAppTheme } from '@/constants/theme';
import { useTutorial } from '@/hooks/useTutorial';
import { lightTap } from '@/utils/haptics';
import { clearOrder, displayOrder, nextDealerFor, OrderDraft, orderComplete, SEATING_CLEAR, SEATING_TITLE } from '@/utils/seating';
import { lowestCardToast } from '@/utils/tutorials';

/**
 * New game, step 3 (PR 24): Order of players. Nobody is numbered to begin with; tap the players in
 * seating order. Back / Clear / Next — or Start game when no co-admin step follows. Pure
 * presentation: the New game screen owns the draft and the create call.
 */
export function OrderStep({ players, draft, onChange, onBack, onNext, nextIsStart, creating, error, meId }: {
  players: SeatingPlayer[];
  draft: OrderDraft;
  onChange: (draft: OrderDraft) => void;
  /** The signed-in player, for the "you deal" toast. */
  meId?: string | null;
  onBack: () => void;
  onNext: () => void;
  /** No co-admin step follows: this button starts the game. */
  nextIsStart: boolean;
  creating: boolean;
  error: string | null;
}) {
  const { colors } = useAppTheme();
  const complete = orderComplete(draft);
  const dealsNext = orderComplete(draft) ? nextDealerFor(displayOrder(draft), null, 0) : undefined;
  // D74: the steps open from Show me only (D61's forced first visit is gone).
  const tutorial = useTutorial('seating');
  const [toast, setToast] = useState<string | null>(null);

  // The real last tap (D61): the seat-1 player is named, with a light tap of the phone.
  const change = (next: OrderDraft) => {
    onChange(next);
    if (!orderComplete(draft) && orderComplete(next)) {
      const dealer = players.find((player) => player.id === next.numbered[0]);
      if (dealer) {
        setToast(lowestCardToast(dealer.name, dealer.id === meId));
        void lightTap();
      }
    }
  };
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Screen contentStyle={styles.content} safeBottom={false}>
        <SectionCard title={SEATING_TITLE} icon="seat-outline">
          <OrderHowTo onShowMe={tutorial.show} testID="order-how-to" />
          <OrderOfPlayers players={players} draft={draft} onChange={change} dealsNext={dealsNext} disabled={creating} />
        </SectionCard>
        {error ? <Text variant="bodyMedium" style={{ color: colors.error, paddingHorizontal: spacing.md }} testID="new-game-problem">{error}</Text> : null}
      </Screen>
      <SeatingTutorial visible={tutorial.visible} onDone={tutorial.done} />
      <Toast message={toast} onDismiss={() => setToast(null)} aboveBar testID="order-lowest-card-toast" />
      <BottomBar style={styles.bottom}>
        <Button mode="outlined" onPress={onBack} disabled={creating} icon="arrow-left" contentStyle={styles.barContent} style={styles.back} accessibilityLabel="Back to game type" testID="new-game-order-back">
          Back
        </Button>
        <Button mode="outlined" onPress={() => onChange(clearOrder(draft))} disabled={creating || draft.numbered.length === 0} contentStyle={styles.barContent} style={styles.clear} accessibilityLabel="Clear the order" testID="new-game-order-clear">
          {SEATING_CLEAR}
        </Button>
        {nextIsStart ? (
          <Button mode="contained" onPress={onNext} loading={creating} disabled={creating || !complete} icon="play" contentStyle={styles.barContent} labelStyle={styles.nextLabel} style={styles.next} accessibilityLabel="Start game" testID="start-game">
            Start game
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
  content: { paddingBottom: spacing.md, gap: spacing.md },
  bottom: { flexDirection: 'row', gap: spacing.sm },
  barContent: { minHeight: 52 },
  back: { flex: 0.8 },
  clear: { flex: 0.8 },
  next: { flex: 1.4 },
  nextLabel: { fontSize: 16, fontWeight: '800' },
});

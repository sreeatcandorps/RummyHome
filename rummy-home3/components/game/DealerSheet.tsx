import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip, Dialog, Portal, RadioButton, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import type { DealerOverride } from '@/types/game';
import { DealerChange, rotationOf } from '@/utils/dealerRotation';
import {
  cardSays,
  consequenceLine,
  currentDealerOf,
  DEALER_DONE,
  DEALER_FOLLOW,
  DEALER_KEEP,
  DEALER_STEP_ROUND,
  DEALER_STEP_THEN,
  DEALER_STEP_WHO,
  DEALER_SUBLINE,
  DEALER_TITLE,
  dealerUnchanged,
  nextRoundChip,
} from '@/utils/dealerSheet';

export type DealerSheetPlayer = {
  id: string;
  name: string;
  label: string;
  /** Pool: the round that put them out (in for round j while j <= outRound). */
  outRound?: number | null;
};

/**
 * The Dealer sheet (052, D60): ⋮ › Dealer or a tap on the DEALS badge. One flow for any round —
 * 1 which round (1 … N, Next), 2 who really deals, 3 follow from here or this round only — with the
 * next round's consequence written out before Done. Scores never change; the server logs every change.
 */
export function DealerSheet({ visible, players, dealerIds, nextDealerOverride, roundCount, initialRound, onDismiss, onSave }: {
  visible: boolean;
  /** Seated players in today's order. */
  players: DealerSheetPlayer[];
  dealerIds?: (string | null | undefined)[] | null;
  nextDealerOverride?: DealerOverride | null;
  roundCount: number;
  /** The round the sheet opens on; default the round being played. */
  initialRound?: number;
  onDismiss: () => void;
  onSave: (change: DealerChange) => Promise<void> | void;
}) {
  const { colors } = useAppTheme();
  const layout = useLayout();
  const nextRound = roundCount + 1;
  const [round, setRound] = useState(initialRound ?? nextRound);
  const [dealerId, setDealerId] = useState<string | undefined>(undefined);
  const [follow, setFollow] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOf = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const ini = (id: string | undefined) => (id ? nameOf.get(id)?.label ?? '?' : '—');

  // The seats in play for the chosen round (D58): a pool player who went out earlier is skipped.
  const gameFor = (forRound: number) => ({
    players: players.map((player) => player.id),
    dealerIds,
    nextDealerOverride,
    outIds: new Set(players.filter((player) => player.outRound != null && player.outRound < forRound).map((player) => player.id)),
  });
  const game = gameFor(round);
  const inPlay = rotationOf(game);
  const current = currentDealerOf(game, roundCount, round);
  const chosen = dealerId && inPlay.includes(dealerId) ? dealerId : current;

  useEffect(() => {
    if (visible) { setRound(initialRound ?? nextRound); setDealerId(undefined); setFollow(true); setError(null); }
  }, [visible, initialRound, nextRound]);

  const change: DealerChange | null = chosen ? { round, dealerId: chosen, follow } : null;
  const unchanged = !change || dealerUnchanged(game, roundCount, change);
  const rounds = Array.from({ length: roundCount }, (_, i) => i + 1);

  const save = async () => {
    if (!change) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(change);
      onDismiss();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t change the dealer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={saving ? undefined : onDismiss} testID="dealer-sheet">
        <Dialog.Title>{DEALER_TITLE}</Dialog.Title>
        <Dialog.Content style={styles.subline}>
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{DEALER_SUBLINE}</Text>
        </Dialog.Content>
        <Dialog.ScrollArea style={[styles.scrollArea, { maxHeight: Math.max(240, layout.height * 0.6) }]}>
          <ScrollView contentContainerStyle={styles.body}>
            <Text variant="titleSmall" style={styles.step}>1  {DEALER_STEP_ROUND}</Text>
            <View style={styles.chips}>
              {rounds.map((n) => (
                <Chip key={n} compact selected={round === n} onPress={() => { setRound(n); setDealerId(undefined); }} disabled={saving} testID={`dealer-round-${n}`} accessibilityLabel={`Round ${n}`}>
                  {String(n)}
                </Chip>
              ))}
              <Chip compact selected={round === nextRound} onPress={() => { setRound(nextRound); setDealerId(undefined); }} disabled={saving} testID="dealer-round-next" accessibilityLabel={`Next round, ${nextRound}`}>
                {nextRoundChip(nextRound)}
              </Chip>
            </View>
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }} testID="dealer-card-says">{cardSays(game, roundCount, round, ini)}</Text>

            <Text variant="titleSmall" style={styles.step}>2  {DEALER_STEP_WHO}</Text>
            <View style={styles.chips}>
              {inPlay.map((id) => (
                <Chip key={id} compact selected={chosen === id} onPress={() => setDealerId(id)} disabled={saving} testID={`dealer-pick-${ini(id)}`} accessibilityLabel={`${nameOf.get(id)?.name ?? ini(id)} deals round ${round}`}>
                  {ini(id)}
                </Chip>
              ))}
            </View>
            {chosen ? (
              <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }} testID="dealer-chosen">
                {`${nameOf.get(chosen)?.name ?? ini(chosen)} deals round ${round}`}
              </Text>
            ) : null}

            <Text variant="titleSmall" style={styles.step}>3  {DEALER_STEP_THEN}</Text>
            {change ? (
              <RadioButton.Group value={follow ? 'follow' : 'keep'} onValueChange={(value) => setFollow(value === 'follow')}>
                <RadioButton.Item
                  label={`${DEALER_FOLLOW} · ${consequenceLine(game, roundCount, { ...change, follow: true }, ini)}`}
                  value="follow" position="leading" labelVariant="bodyMedium" style={styles.radio} disabled={saving}
                  testID="dealer-follow" accessibilityLabel={DEALER_FOLLOW}
                />
                <RadioButton.Item
                  label={`${DEALER_KEEP} · ${consequenceLine(game, roundCount, { ...change, follow: false }, ini)}`}
                  value="keep" position="leading" labelVariant="bodyMedium" style={styles.radio} disabled={saving}
                  testID="dealer-keep" accessibilityLabel={DEALER_KEEP}
                />
              </RadioButton.Group>
            ) : null}
            {error ? <Text variant="bodySmall" style={{ color: colors.error, marginTop: spacing.sm }} testID="dealer-error">{error}</Text> : null}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={saving} testID="dealer-cancel">Cancel</Button>
          <Button mode="contained" onPress={save} loading={saving} disabled={saving || unchanged} testID="dealer-done">{DEALER_DONE}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  subline: { paddingBottom: spacing.xs },
  scrollArea: { paddingHorizontal: 0 },
  body: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, gap: spacing.xs },
  step: { marginTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  radio: { paddingHorizontal: 0 },
});

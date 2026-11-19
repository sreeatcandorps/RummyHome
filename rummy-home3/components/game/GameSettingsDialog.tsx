import React, { useEffect, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { router } from 'expo-router';
import { PointsRules } from '@/utils/gameSettings';
import { draftFromRules, RulesDraft, RulesForm, rulesFromDraft } from '@/components/game/RulesForm';
import { APPLY_WHOLE_GAME, highMultiplierConfirm, multiplierChangeConfirm, multiplierOf, START_NEW_GAME_INSTEAD } from '@/utils/multiplier';
import { DEFAULT_POOL_LIMIT, LimitChangePreview, POOL_LIMIT_CHANGE_TITLE, poolLimitChangeConfirm } from '@/utils/pool';
import { spacing, useAppTheme } from '@/constants/theme';

export const MORE_SETTINGS_NOTE = 'Your defaults for new games are in Settings.';
export const CHANGE_MULTIPLIER_TITLE = 'Change the multiplier?';

type Pending =
  | { kind: 'whole-game'; rules: PointsRules; text: string }
  | { kind: 'high'; rules: PointsRules; text: string }
  | { kind: 'pool-limit'; rules: PointsRules; text: string };

/**
 * Game settings only. Points: change Drop, Middle drop, Full count and (PR 14) the Multiplier any
 * time; a multiplier change with rounds saved confirms first — it applies to the whole game, or the
 * person starts a new game instead (D14.2 final, M22). Pool (051 / D53): the limit may change once
 * rounds exist; the dialog confirms first, naming who comes back in and who goes out.
 */
export function GameSettingsDialog({ visible, rules, title = 'Game settings', onDismiss, onSave, readOnly, roundCount = 0, onStartNewGame, poolLimitPreview }: {
  visible: boolean;
  rules: PointsRules;
  title?: string;
  onDismiss: () => void;
  onSave: (rules: PointsRules) => Promise<void> | void;
  readOnly?: boolean;
  /** Rounds already saved on this game (the multiplier and pool-limit confirms name them). */
  roundCount?: number;
  /** Pool: who changes state at a new limit, for the confirm text. */
  poolLimitPreview?: (limit: number) => LimitChangePreview;
  /** "Start a new game instead": New game with these players and the new rules prefilled. */
  onStartNewGame?: (rules: PointsRules) => void;
}) {
  const { colors } = useAppTheme();
  const [draft, setDraft] = useState<RulesDraft>(draftFromRules(rules));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  // Reset on open, or when the stored rules really change (another admin saved) — not on every reload of
  // the scorecard behind the dialog (Realtime, the 20 s poll), which would wipe what is being typed.
  const rulesKey = JSON.stringify(rules);
  useEffect(() => { if (visible) { setDraft(draftFromRules(rules)); setError(null); setPending(null); } }, [visible, rulesKey]);

  const commit = async (next: PointsRules) => {
    setSaving(true);
    try { await onSave(next); setPending(null); onDismiss(); } catch (e) { setPending(null); setError(e instanceof Error ? e.message : 'Couldn’t save.'); } finally { setSaving(false); }
  };

  const save = async () => {
    Keyboard.dismiss();
    const parsed = rulesFromDraft(draft);
    if (!parsed.rules) { setError(parsed.error); return; }
    setError(null);
    const next = parsed.rules;
    if (next.gameKind === 'points') {
      const from = multiplierOf(rules);
      const to = multiplierOf(next);
      const high = to !== from ? highMultiplierConfirm(to, next.fullCount) : null;
      if (high) { setPending({ kind: 'high', rules: next, text: high }); return; }
      const whole = multiplierChangeConfirm(roundCount, from, to);
      if (whole) { setPending({ kind: 'whole-game', rules: next, text: whole }); return; }
    } else {
      const from = rules.poolLimit ?? DEFAULT_POOL_LIMIT;
      const to = next.poolLimit ?? DEFAULT_POOL_LIMIT;
      const text = poolLimitChangeConfirm(roundCount, from, to, poolLimitPreview ? poolLimitPreview(to) : null);
      if (text) { setPending({ kind: 'pool-limit', rules: next, text }); return; }
    }
    await commit(next);
  };

  /** After the ≥1,000 confirm, the whole-game confirm may still be due. */
  const acceptHigh = async (next: PointsRules) => {
    const whole = multiplierChangeConfirm(roundCount, multiplierOf(rules), multiplierOf(next));
    if (whole) { setPending({ kind: 'whole-game', rules: next, text: whole }); return; }
    await commit(next);
  };

  if (pending) {
    return (
      <Portal>
        <Dialog visible={visible} onDismiss={() => setPending(null)} testID={pending.kind === 'pool-limit' ? 'pool-limit-confirm' : 'multiplier-confirm'}>
          <Dialog.Title>{pending.kind === 'high' ? 'Large multiplier' : pending.kind === 'pool-limit' ? POOL_LIMIT_CHANGE_TITLE : CHANGE_MULTIPLIER_TITLE}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" testID={pending.kind === 'pool-limit' ? 'pool-limit-confirm-body' : 'multiplier-confirm-body'}>{pending.text}</Text>
          </Dialog.Content>
          {pending.kind === 'pool-limit' ? (
            <Dialog.Actions>
              <Button onPress={() => setPending(null)} disabled={saving} testID="pool-limit-confirm-cancel">Cancel</Button>
              <Button mode="contained" onPress={() => commit(pending.rules)} loading={saving} disabled={saving} testID="pool-limit-confirm-change">Change the limit</Button>
            </Dialog.Actions>
          ) : pending.kind === 'high' ? (
            <Dialog.Actions>
              <Button onPress={() => setPending(null)} disabled={saving}>Change</Button>
              <Button mode="contained" onPress={() => acceptHigh(pending.rules)} loading={saving} disabled={saving} testID="multiplier-confirm-keep">Keep it</Button>
            </Dialog.Actions>
          ) : (
            <Dialog.Actions style={styles.stacked}>
              <Button mode="contained" onPress={() => commit(pending.rules)} loading={saving} disabled={saving} style={styles.fullWidth} testID="multiplier-apply-whole-game">{APPLY_WHOLE_GAME}</Button>
              {onStartNewGame ? (
                <Button mode="outlined" onPress={() => { const next = pending.rules; setPending(null); onDismiss(); onStartNewGame(next); }} disabled={saving} style={styles.fullWidth} testID="multiplier-start-new-game">{START_NEW_GAME_INSTEAD}</Button>
              ) : null}
              <Button onPress={() => setPending(null)} disabled={saving} style={styles.fullWidth} testID="multiplier-confirm-cancel">Cancel</Button>
            </Dialog.Actions>
          )}
        </Dialog>
      </Portal>
    );
  }

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            <Text variant="bodyMedium" style={{ marginBottom: 8 }}>{rules.gameKind === 'pool' ? 'Pool game' : 'Points game'}</Text>
            <RulesForm draft={draft} onChange={setDraft} disabled={readOnly} roundCount={roundCount} testIDPrefix="game-settings" helpTopic="scorecard" helpAnchor="game-settings" />
            {readOnly ? (
              <Text style={{ color: colors.onSurfaceVariant, marginTop: 8 }} accessibilityLabel="Only a game admin can save changes">
                You can see this game’s settings, but only a game admin (the organizer or someone they made admin) can save changes. They apply to this game only and win over your Settings.
              </Text>
            ) : null}
            {error ? <Text style={{ color: colors.error, marginTop: 8 }} testID="game-settings-error">{error}</Text> : null}
            <Text variant="bodyMedium" accessibilityRole="link" style={{ color: colors.primary, marginTop: 12, textDecorationLine: 'underline' }}
              onPress={() => { onDismiss(); router.push('/(screens)/settings'); }}>
              {MORE_SETTINGS_NOTE}
            </Text>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{readOnly ? 'Close' : 'Cancel'}</Button>
          {!readOnly ? <Button mode="contained" onPress={save} loading={saving} testID="game-settings-save">Save</Button> : null}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  scrollArea: { maxHeight: 520 },
  body: { paddingVertical: spacing.sm },
  stacked: { flexDirection: 'column', alignItems: 'stretch', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  fullWidth: { alignSelf: 'stretch' },
});

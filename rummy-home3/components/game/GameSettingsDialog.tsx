import React, { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { router } from 'expo-router';
import { parseRuleInput, PointsRules, validateRules } from '@/utils/gameSettings';
import { draftFromRules, RulesDraft, RulesForm } from '@/components/game/RulesForm';
import { useAppTheme } from '@/constants/theme';

export const MORE_SETTINGS_NOTE = 'If you want more settings go to your user settings.';

/** Game settings only. Change them when you create the game or any time during it. */
export function GameSettingsDialog({ visible, rules, title = 'Game settings', onDismiss, onSave, readOnly }: {
  visible: boolean;
  rules: PointsRules;
  title?: string;
  onDismiss: () => void;
  onSave: (rules: PointsRules) => Promise<void> | void;
  readOnly?: boolean;
}) {
  const { colors } = useAppTheme();
  const [draft, setDraft] = useState<RulesDraft>(draftFromRules(rules));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (visible) { setDraft(draftFromRules(rules)); setError(null); } }, [visible, rules]);

  const save = async () => {
    Keyboard.dismiss();
    const drop = parseRuleInput(draft.drop);
    const middleDrop = parseRuleInput(draft.middleDrop);
    const fullCount = parseRuleInput(draft.fullCount);
    if (drop == null || middleDrop == null || fullCount == null) { setError('Type a number for Drop, Middle drop, and Full count.'); return; }
    const next: PointsRules = { gameKind: 'points', drop, middleDrop, fullCount };
    const problem = validateRules(next);
    if (problem) { setError(problem); return; }
    setSaving(true);
    try { await onSave(next); onDismiss(); } catch (e) { setError(e instanceof Error ? e.message : 'Couldn’t save.'); } finally { setSaving(false); }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={{ marginBottom: 8 }}>Points game</Text>
          <RulesForm draft={draft} onChange={setDraft} disabled={readOnly} />
          {readOnly ? (
            <Text style={{ color: colors.onSurfaceVariant, marginTop: 8 }} accessibilityLabel="Only a game admin can save changes">
              You can see this game’s settings, but only a game admin (the organizer or someone they made admin) can save changes. They apply to this game only and win over your User settings.
            </Text>
          ) : null}
          {error ? <Text style={{ color: colors.error, marginTop: 8 }}>{error}</Text> : null}
          <Text variant="bodyMedium" accessibilityRole="link" style={{ color: colors.primary, marginTop: 12, textDecorationLine: 'underline' }}
            onPress={() => { onDismiss(); router.push('/(screens)/settings'); }}>
            {MORE_SETTINGS_NOTE}
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{readOnly ? 'Close' : 'Cancel'}</Button>
          {!readOnly ? <Button mode="contained" onPress={save} loading={saving}>Save</Button> : null}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

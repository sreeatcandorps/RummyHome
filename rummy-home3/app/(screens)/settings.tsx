import React, { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { authService } from '@/services/auth';
import { userSettingsService } from '@/services/userSettings';
import { DEFAULT_POINTS_RULES, parseRuleInput, validateRules } from '@/utils/gameSettings';
import { draftFromRules, RulesDraft, RulesForm } from '@/components/game/RulesForm';
import { Screen } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { spacing, useAppTheme } from '@/constants/theme';

/** User settings: the defaults every new game starts with. Each game can still change its own. */
export default function UserSettings() {
  const { colors } = useAppTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RulesDraft>(draftFromRules(DEFAULT_POINTS_RULES));
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    (async () => {
      const me = await authService.getCurrentPlayer();
      setUserId(me?.id ?? null);
      setDraft(draftFromRules(await userSettingsService.get(me?.id ?? null)));
    })().catch(() => {});
  }, []));

  const save = async () => {
    const drop = parseRuleInput(draft.drop);
    const middleDrop = parseRuleInput(draft.middleDrop);
    const fullCount = parseRuleInput(draft.fullCount);
    if (drop == null || middleDrop == null || fullCount == null) { setNotice('Type a number for Drop, Middle drop, and Full count.'); return; }
    const rules = { gameKind: 'points' as const, drop, middleDrop, fullCount };
    const problem = validateRules(rules);
    if (problem) { setNotice(problem); return; }
    setSaving(true);
    try { await userSettingsService.save(userId, rules); setNotice('Saved. New games start with these.'); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Couldn’t save.'); }
    finally { setSaving(false); }
  };

  return (
    <Screen contentStyle={styles.content}>
      <SectionCard title="Game defaults" icon="cards-playing-outline" supportingText="Every new game starts with these. Change one game from its ⋮ menu > Game settings.">
        <RulesForm draft={draft} onChange={setDraft} showType />
      </SectionCard>
      <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>Points is the only game type for now. Pool is coming later.</Text>
      {notice ? <Text variant="bodyMedium">{notice}</Text> : null}
      <Button mode="contained" onPress={save} loading={saving}>Save</Button>
      <Button mode="text" onPress={() => setDraft(draftFromRules(DEFAULT_POINTS_RULES))}>Use Rummy defaults</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { gap: spacing.md } });

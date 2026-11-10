import React, { useCallback, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { authService } from '@/services/auth';
import { userSettingsService } from '@/services/userSettings';
import { DEFAULT_POINTS_RULES, parseRuleInput, validateRules } from '@/utils/gameSettings';
import { draftFromRules, RulesDraft, RulesForm } from '@/components/game/RulesForm';
import { Screen } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { SettingsPriority } from '@/components/ui/SettingsPriority';
import { radius, spacing, useAppTheme } from '@/constants/theme';

/** User settings: the defaults every new game starts with. Each game can still change its own. */
export default function UserSettings() {
  const { colors } = useAppTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RulesDraft>(draftFromRules(DEFAULT_POINTS_RULES));
  const [notice, setNotice] = useState<{ text: string; tone: 'saved' | 'problem' } | null>(null);
  const [saving, setSaving] = useState(false);
  const problem = (text: string) => setNotice({ text, tone: 'problem' });

  useFocusEffect(useCallback(() => {
    (async () => {
      const me = await authService.getCurrentPlayer();
      setUserId(me?.id ?? null);
      setDraft(draftFromRules(await userSettingsService.get(me?.id ?? null)));
    })().catch(() => {});
  }, []));

  const save = async () => {
    // Saving ends editing: the keyboard goes away and no field keeps a live cursor.
    Keyboard.dismiss();
    const drop = parseRuleInput(draft.drop);
    const middleDrop = parseRuleInput(draft.middleDrop);
    const fullCount = parseRuleInput(draft.fullCount);
    if (drop == null || middleDrop == null || fullCount == null) { problem('Type a number for Drop, Middle drop, and Full count.'); return; }
    const rules = { gameKind: 'points' as const, drop, middleDrop, fullCount };
    const invalid = validateRules(rules);
    if (invalid) { problem(invalid); return; }
    setSaving(true);
    try {
      await userSettingsService.save(userId, rules);
      setDraft(draftFromRules(rules));
      setNotice({ text: `Saved: Drop ${rules.drop}, Middle drop ${rules.middleDrop}, Full count ${rules.fullCount}. New games start with these.`, tone: 'saved' });
    } catch (e) { problem(e instanceof Error ? e.message : 'Couldn’t save.'); }
    finally { setSaving(false); }
  };

  return (
    <Screen contentStyle={styles.content}>
      <SectionCard title="Your defaults" icon="cards-playing-outline" supportingText="Every new game starts with these. Change one game from its ⋮ menu > Game settings.">
        <RulesForm draft={draft} onChange={(next) => { setDraft(next); if (notice?.tone === 'saved') setNotice(null); }} showType />
      </SectionCard>
      <SectionCard title="Which setting wins" icon="sort-variant" mode="outlined">
        <SettingsPriority highlight="User settings" showTitle={false} />
      </SectionCard>
      <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>Points is the only game type for now. Pool is coming later.</Text>
      {notice ? (
        <View
          style={[styles.notice, { backgroundColor: notice.tone === 'saved' ? colors.positiveContainer : colors.errorContainer }]}
          accessibilityLiveRegion="polite"
          accessibilityLabel={notice.text}
        >
          <Icon source={notice.tone === 'saved' ? 'check-circle' : 'alert-circle-outline'} size={20} color={notice.tone === 'saved' ? colors.onPositiveContainer : colors.onErrorContainer} />
          <Text variant="bodyMedium" style={[styles.noticeText, { color: notice.tone === 'saved' ? colors.onPositiveContainer : colors.onErrorContainer }]}>{notice.text}</Text>
        </View>
      ) : null}
      <Button mode="contained" onPress={save} loading={saving}>Save</Button>
      <Button mode="text" onPress={() => setDraft(draftFromRules(DEFAULT_POINTS_RULES))}>Use Rummy defaults</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
  noticeText: { flex: 1, fontWeight: '700' },
});

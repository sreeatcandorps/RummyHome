import React, { useCallback, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { Icon, SegmentedButtons, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { router, useFocusEffect } from 'expo-router';
import { authService } from '@/services/auth';
import { userSettingsService } from '@/services/userSettings';
import { DEFAULT_POINTS_RULES, DEFAULT_POOL_RULES, GameKind } from '@/utils/gameSettings';
import { entryPlusLabel, reentryLimitLabel } from '@/utils/pool';
import { draftFromRules, RulesDraft, RulesForm, rulesFromDraft } from '@/components/game/RulesForm';
import { Screen } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { SettingsPriority } from '@/components/ui/SettingsPriority';
import { radius, spacing, useAppTheme } from '@/constants/theme';

/**
 * User settings (D1): which kind a new game starts as, and the Points and Pool defaults every new
 * game is prefilled with. Each game can still change its own on the Game type screen or later.
 */
export default function UserSettings() {
  const { colors } = useAppTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const [startsAs, setStartsAs] = useState<GameKind>('points');
  const [points, setPoints] = useState<RulesDraft>(draftFromRules(DEFAULT_POINTS_RULES));
  const [pool, setPool] = useState<RulesDraft>(draftFromRules(DEFAULT_POOL_RULES));
  const [notice, setNotice] = useState<{ text: string; tone: 'saved' | 'problem' } | null>(null);
  const [saving, setSaving] = useState(false);
  const problem = (text: string) => setNotice({ text, tone: 'problem' });
  const clearSaved = () => { if (notice?.tone === 'saved') setNotice(null); };

  useFocusEffect(useCallback(() => {
    (async () => {
      const me = await authService.getCurrentPlayer();
      setUserId(me?.id ?? null);
      const all = await userSettingsService.getAll(me?.id ?? null);
      setStartsAs(all.startsAs);
      setPoints(draftFromRules(all.points));
      setPool(draftFromRules(all.pool));
    })().catch(() => {});
  }, []));

  const save = async () => {
    // Saving ends editing: the keyboard goes away and no field keeps a live cursor.
    Keyboard.dismiss();
    const p = rulesFromDraft(points);
    if (!p.rules) { problem(`Points: ${p.error}`); return; }
    const q = rulesFromDraft(pool);
    if (!q.rules) { problem(`Pool: ${q.error}`); return; }
    setSaving(true);
    try {
      await userSettingsService.saveAll(userId, { startsAs, points: p.rules, pool: q.rules });
      setNotice({
        text: `Saved. Points: Drop ${p.rules.drop}, Middle drop ${p.rules.middleDrop}, Full count ${p.rules.fullCount}, Multiplier ×${p.rules.multiplier ?? 1}. Pool: limit ${q.rules.poolLimit}, Drop ${q.rules.drop}, Middle drop ${q.rules.middleDrop}, Full count ${q.rules.fullCount}, Re-entries ${reentryLimitLabel(q.rules.reentryLimit ?? null)}, Re-entry score ${entryPlusLabel(q.rules.reentryPlus ?? 1)}, Late entry ${entryPlusLabel(q.rules.lateEntryPlus ?? 1)}. New games start with these.`,
        tone: 'saved',
      });
    } catch (e) { problem(e instanceof Error ? e.message : 'Couldn’t save.'); }
    finally { setSaving(false); }
  };

  return (
    <Screen contentStyle={styles.content}>
      <SectionCard title="New game starts as" icon="cards-playing-outline" supportingText="You can still switch on the Game type screen when you start a game.">
        <SegmentedButtons
          value={startsAs}
          onValueChange={(v) => { setStartsAs(v as GameKind); clearSaved(); }}
          buttons={[
            { value: 'points', label: 'Points', icon: 'cards-playing-outline', testID: 'settings-starts-points' },
            { value: 'pool', label: 'Pool', icon: 'pool', testID: 'settings-starts-pool' },
          ]}
        />
      </SectionCard>
      <SectionCard title="Points defaults" icon="numeric" supportingText="Every new Points game starts with these, including the multiplier (×1 unless you set one). Change one game from its ⋮ menu > Game settings.">
        <RulesForm draft={points} onChange={(next) => { setPoints(next); clearSaved(); }} testIDPrefix="settings-points" />
      </SectionCard>
      <SectionCard title="Pool defaults" icon="pool" supportingText="Every new Pool game starts with these. The limit and the values lock once a round is saved; Re-entry can change any time.">
        <RulesForm draft={pool} onChange={(next) => { setPool(next); clearSaved(); }} testIDPrefix="settings-pool" />
      </SectionCard>
      <SectionCard title="Which setting wins" icon="sort-variant" mode="outlined">
        <SettingsPriority highlight="User settings" showTitle={false} />
      </SectionCard>
      <SectionCard title="Hidden & deleted" icon="eye-off-outline" mode="outlined" supportingText="Games you hid from Home, and games or results you deleted. Unhide or restore them here.">
        <Button mode="outlined" icon="chevron-right" contentStyle={styles.openRow} onPress={() => router.push('/(screens)/hidden-deleted')} accessibilityLabel="Open Hidden and deleted">
          Open Hidden & deleted
        </Button>
      </SectionCard>
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
      <Button mode="contained" onPress={save} loading={saving} testID="settings-save">Save</Button>
      <Button mode="text" onPress={() => { setPoints(draftFromRules(DEFAULT_POINTS_RULES)); setPool(draftFromRules(DEFAULT_POOL_RULES)); setStartsAs('points'); }}>Use Rummy defaults</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
  noticeText: { flex: 1, fontWeight: '700' },
  openRow: { flexDirection: 'row-reverse' },
});

import React, { useCallback, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { Dialog, Icon, Portal, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { router, useFocusEffect } from 'expo-router';
import { authService } from '@/services/auth';
import { userSettingsService } from '@/services/userSettings';
import { DEFAULT_POINTS_RULES, DEFAULT_POOL_RULES, GameKind } from '@/utils/gameSettings';
import { entryPlusLabel, reentryLimitLabel } from '@/utils/pool';
import { draftFromRules, RulesDraft, RulesForm, rulesFromDraft } from '@/components/game/RulesForm';
import { BottomBar } from '@/components/ui/BottomBar';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { SegmentedChoice } from '@/components/ui/SegmentedChoice';
import { SettingsGroup } from '@/components/ui/SettingsGroup';
import { SettingsPriority } from '@/components/ui/SettingsPriority';
import { SETTINGS_PRIORITY } from '@/constants/help';
import { radius, spacing, useAppTheme } from '@/constants/theme';

/**
 * Settings (D1): which kind a new game starts as, and the Points and Pool defaults every new
 * game is prefilled with. Each game can still change its own on the Game type screen or later.
 * Size-S (D67, design-review-2 §10.2): four grouped lists, segmented rows, one Save in the bar.
 */
export default function UserSettings() {
  const { colors } = useAppTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const [startsAs, setStartsAs] = useState<GameKind>('points');
  const [points, setPoints] = useState<RulesDraft>(draftFromRules(DEFAULT_POINTS_RULES));
  const [pool, setPool] = useState<RulesDraft>(draftFromRules(DEFAULT_POOL_RULES));
  const [notice, setNotice] = useState<{ text: string; tone: 'saved' | 'problem' } | null>(null);
  const [saving, setSaving] = useState(false);
  const [whichWins, setWhichWins] = useState(false);
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
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Screen contentStyle={styles.content} safeBottom={false}>
      <SettingsGroup title="New game starts as" note="You can still switch on the Game type screen." testID="settings-starts">
        <SegmentedChoice
          value={startsAs}
          onChange={(v) => { setStartsAs(v); clearSaved(); }}
          accessibilityLabel="New game starts as"
          options={[
            { value: 'points', label: 'Points', testID: 'settings-starts-points' },
            { value: 'pool', label: 'Pool', testID: 'settings-starts-pool' },
          ]}
          style={styles.choice}
        />
      </SettingsGroup>
      <SettingsGroup title="Points defaults" tip={{ text: ['Every new Points game starts with these, including the multiplier (×1 unless you set one).', 'Change one game from its ⋮ menu › **Game settings**.'], topic: 'settings', testID: 'settings-points-tip' }} testID="settings-points-group">
        <RulesForm draft={points} onChange={(next) => { setPoints(next); clearSaved(); }} testIDPrefix="settings-points" helpTopic="settings" layout="grouped" />
      </SettingsGroup>
      <SettingsGroup title="Pool defaults" tip={{ text: ['Every new Pool game starts with these.', 'In a game, the limit locks once a round is saved; Drop, Middle drop, Full count and Re-entries can change any time.'], topic: 'settings', testID: 'settings-pool-tip' }} testID="settings-pool-group">
        <RulesForm draft={pool} onChange={(next) => { setPool(next); clearSaved(); }} testIDPrefix="settings-pool" helpTopic="settings" layout="grouped" />
      </SettingsGroup>
      <SettingsGroup title="More" testID="settings-more">
        <ListRow title="Which setting wins" description="Game settings › Settings › app defaults" onPress={() => setWhichWins(true)} testID="settings-which-wins" />
        <ListRow title="Hidden & deleted" description="Games you hid, games or results you deleted" onPress={() => router.push('/(screens)/hidden-deleted')} accessibilityLabel="Open Hidden and deleted" testID="settings-hidden-deleted" />
      </SettingsGroup>
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
      </Screen>
      <BottomBar>
        <Button mode="text" onPress={() => { setPoints(draftFromRules(DEFAULT_POINTS_RULES)); setPool(draftFromRules(DEFAULT_POOL_RULES)); setStartsAs('points'); }}>Use Rummy defaults</Button>
        <Button mode="contained" onPress={save} loading={saving} testID="settings-save" style={styles.save}>Save</Button>
      </BottomBar>
      <Portal>
        <Dialog visible={whichWins} onDismiss={() => setWhichWins(false)} testID="settings-which-wins-dialog">
          <Dialog.Title>Which setting wins</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <SettingsPriority highlight="Settings" showTitle={false} />
            {SETTINGS_PRIORITY.map((s) => (
              <Text key={s.title} variant="bodyMedium"><Text style={styles.bold}>{s.title}</Text> ({s.level.toLowerCase()}): {s.detail}.</Text>
            ))}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setWhichWins(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: spacing.lg },
  choice: { marginVertical: spacing.xs },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
  noticeText: { flex: 1, fontWeight: '700' },
  save: { flex: 1 },
  dialogContent: { gap: spacing.sm },
  bold: { fontWeight: '700' },
});

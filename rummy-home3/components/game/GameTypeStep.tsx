import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Dialog, Icon, Portal, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { BottomBar } from '@/components/ui/BottomBar';
import { ListRow } from '@/components/ui/ListRow';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { SegmentedChoice } from '@/components/ui/SegmentedChoice';
import { SettingsGroup } from '@/components/ui/SettingsGroup';
import { draftFromRules, RulesDraft, RulesForm, rulesFromDraft } from '@/components/game/RulesForm';
import { GameKind, PointsRules } from '@/utils/gameSettings';
import { highMultiplierConfirm } from '@/utils/multiplier';
import { radius, seatColor, spacing, useAppTheme } from '@/constants/theme';

export const SETTINGS_LINK = 'You can also set these defaults in Settings.';
/** Size-S (D68): the one grey line under the Points | Pool row; the paragraphs live behind the ⓘ. */
export const GAME_KIND_NOTE = {
  points: 'Points: every round counts, multiplier applies.',
  pool: 'Pool: out at the limit, re-entries allowed.',
} as const;
/** Mini help (ⓘ) beside "Game type": what the picked kind means, in two lines. */
export const GAME_KIND_TIP = {
  points: ['**Points**: every round adds up to 0; the winner takes what the others lost.', 'Drop, Middle drop and Full count are the fixed scores a player can take instead of playing the hand out.'],
  pool: ['**Pool**: the round\u2019s winner scores 0, everyone else adds their hand. Reach the limit and you are out.', 'The admin gives awards once the pool is completed; the awards are what the pool adds to Results.'],
} as const;
/** Mini help (ⓘ) beside "Points settings" / "Pool settings". */
export const KIND_SETTINGS_TIP = 'For this game only, prefilled from your defaults. Changing them here does not change your Settings.';

export type TypeStepPick = { id: string; name: string; label?: string };

/**
 * New game, step 2 (D1): Points or Pool, the settings for this game (prefilled from the user's
 * saved defaults for that kind, editable here for this game only), the picked players, Back and
 * Next (PR 24: Order of players follows; only the last step says Start). Pure presentation: the
 * New game screen owns the draft, the defaults and the create call.
 */
export function GameTypeStep({ kind, rules, defaultsFor, picks, onKindChange, onBack, onNext, creating, error }: {
  kind: GameKind;
  rules: PointsRules;
  /** The user's saved defaults for a kind, so switching kinds prefills that kind's numbers. */
  defaultsFor: (kind: GameKind) => PointsRules;
  picks: TypeStepPick[];
  onKindChange: (kind: GameKind, rules: PointsRules) => void;
  onBack: () => void;
  onNext: (rules: PointsRules) => void;
  creating: boolean;
  error: string | null;
}) {
  const { colors } = useAppTheme();
  const [draft, setDraft] = useState<RulesDraft>(() => draftFromRules(rules));
  const [problem, setProblem] = useState<string | null>(null);
  /** PR 14 (suggestion 2): a multiplier of 1,000 or more asks once before Start. */
  const [highConfirm, setHighConfirm] = useState<{ rules: PointsRules; text: string } | null>(null);

  const switchKind = (next: GameKind) => {
    if (next === kind) return;
    const nextRules = defaultsFor(next);
    setDraft(draftFromRules(nextRules));
    setProblem(null);
    onKindChange(next, nextRules);
  };

  const next = () => {
    const parsed = rulesFromDraft(draft);
    if (!parsed.rules) { setProblem(parsed.error); return; }
    setProblem(null);
    const high = parsed.rules.gameKind === 'points' ? highMultiplierConfirm(parsed.rules.multiplier ?? 1, parsed.rules.fullCount) : null;
    if (high) { setHighConfirm({ rules: parsed.rules, text: high }); return; }
    onNext(parsed.rules);
  };

  const pool = kind === 'pool';

  // Size-S (D68, design-review-2 §10.3): grouped lists, one ⓘ per group, segmented Points | Pool,
  // the players as read-only rows. The bar and the refused-limit strip are as before.
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Screen contentStyle={styles.content} safeBottom={false}>
        <SettingsGroup title="Game type" tip={{ text: GAME_KIND_TIP[kind], topic: 'game-type', testID: 'game-type-tip' }} note={GAME_KIND_NOTE[kind]} testID="game-type-group">
          <SegmentedChoice
            value={kind}
            onChange={switchKind}
            accessibilityLabel="Game type"
            options={[
              { value: 'points', label: 'Points', testID: 'game-type-points' },
              { value: 'pool', label: 'Pool', testID: 'game-type-pool' },
            ]}
            style={styles.choice}
          />
        </SettingsGroup>

        <SettingsGroup
          title={pool ? 'Pool settings' : 'Points settings'}
          tip={{ title: pool ? 'Pool settings' : 'Points settings', text: KIND_SETTINGS_TIP, topic: 'game-type', testID: 'kind-settings-tip' }}
          testID="kind-settings-group"
        >
          <RulesForm draft={draft} onChange={(next) => { setDraft(next); setProblem(null); }} testIDPrefix="new-game" layout="grouped" />
          <Text
            variant="bodyMedium"
            accessibilityRole="link"
            style={{ color: colors.primary, textDecorationLine: 'underline', paddingVertical: spacing.sm }}
            onPress={() => router.push('/(screens)/settings')}
          >
            {SETTINGS_LINK}
          </Text>
        </SettingsGroup>

        <SettingsGroup title={`Playing · ${picks.length}`} testID="playing-group">
          <View accessibilityLabel="Picked players">
            {picks.map((p, i) => (
              <ListRow key={p.id} title={p.name} left={<SeatAvatar name={p.name} label={p.label} color={seatColor(i)} size={32} />} />
            ))}
          </View>
        </SettingsGroup>
      </Screen>

      {/* F3 (chaos c03): pinned above the Next bar, outside the scroller, so a refused limit is never
          below the fold — on a Pixel 6 it used to render under the players card and the button looked dead. */}
      {problem || error ? (
        <View style={[styles.problem, { backgroundColor: colors.errorContainer }]} testID="new-game-problem" accessibilityLiveRegion="polite">
          <Icon source="alert-circle-outline" size={20} color={colors.onErrorContainer} />
          <Text variant="bodyMedium" style={{ color: colors.onErrorContainer, flex: 1 }}>{problem ?? error}</Text>
        </View>
      ) : null}

      <Portal>
        <Dialog visible={Boolean(highConfirm)} onDismiss={() => setHighConfirm(null)} testID="multiplier-high-confirm">
          <Dialog.Title>Large multiplier</Dialog.Title>
          <Dialog.Content><Text variant="bodyMedium">{highConfirm?.text ?? ''}</Text></Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setHighConfirm(null)}>Change</Button>
            <Button mode="contained" onPress={() => { const r = highConfirm?.rules; setHighConfirm(null); if (r) onNext(r); }} testID="multiplier-high-keep">Keep it</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <BottomBar style={styles.bottom}>
        <Button mode="outlined" onPress={onBack} disabled={creating} icon="arrow-left" contentStyle={styles.barContent} style={styles.back} accessibilityLabel="Back to players">
          Back
        </Button>
        <Button mode="contained" onPress={next} loading={creating} disabled={creating} icon="arrow-right" contentStyle={styles.barContent} labelStyle={styles.startLabel} style={styles.start} accessibilityLabel="Next: order of players" testID="new-game-type-next">
          Next
        </Button>
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: spacing.md, gap: spacing.lg },
  choice: { marginVertical: spacing.xs },
  problem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, marginHorizontal: spacing.md, borderRadius: radius.md },
  bottom: { flexDirection: 'row', gap: spacing.sm },
  barContent: { minHeight: 52 },
  back: { flex: 0.8 },
  start: { flex: 1.6 },
  startLabel: { fontSize: 16, fontWeight: '800' },
});

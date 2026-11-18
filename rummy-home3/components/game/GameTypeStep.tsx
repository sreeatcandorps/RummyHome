import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Dialog, Icon, Portal, SegmentedButtons, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { router } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { BottomBar } from '@/components/ui/BottomBar';
import { SectionCard } from '@/components/ui/SectionCard';
import { InfoTip } from '@/components/ui/InfoTip';
import { draftFromRules, RulesDraft, RulesForm, rulesFromDraft } from '@/components/game/RulesForm';
import { GameKind, PointsRules } from '@/utils/gameSettings';
import { highMultiplierConfirm } from '@/utils/multiplier';
import { radius, spacing, useAppTheme } from '@/constants/theme';

export const SETTINGS_LINK = 'You can also set these defaults in Settings.';
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

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Screen contentStyle={styles.content} safeBottom={false}>
        <SectionCard title="Game type" icon={pool ? 'pool' : 'numeric'} right={<InfoTip title="Game type" text={GAME_KIND_TIP[kind]} topic="game-type" testID="game-type-tip" />}>
          <SegmentedButtons
            value={kind}
            onValueChange={(v) => switchKind(v as GameKind)}
            buttons={[
              { value: 'points', label: 'Points', icon: 'numeric', testID: 'game-type-points' },
              { value: 'pool', label: 'Pool', icon: 'pool', testID: 'game-type-pool' },
            ]}
          />
        </SectionCard>

        <SectionCard
          title={pool ? 'Pool settings' : 'Points settings'}
          icon="cog-outline"
          right={<InfoTip title={pool ? 'Pool settings' : 'Points settings'} text={KIND_SETTINGS_TIP} topic="game-type" testID="kind-settings-tip" />}
        >
          <RulesForm draft={draft} onChange={(next) => { setDraft(next); setProblem(null); }} testIDPrefix="new-game" />
          <Text
            variant="bodyMedium"
            accessibilityRole="link"
            style={{ color: colors.primary, textDecorationLine: 'underline', marginTop: spacing.xs }}
            onPress={() => router.push('/(screens)/settings')}
          >
            {SETTINGS_LINK}
          </Text>
        </SectionCard>

        <SectionCard title={`Playing · ${picks.length}`} icon="account-group-outline" mode="outlined">
          <View style={styles.chips} accessibilityLabel="Picked players">
            {picks.map((p) => (
              <View key={p.id} style={[styles.chip, { backgroundColor: colors.surfaceVariant }]}>
                {p.label ? <Text style={[styles.chipInitials, { color: colors.primary }]}>{p.label}</Text> : null}
                <Text variant="bodyMedium" numberOfLines={1} style={{ color: colors.onSurface }}>{p.name}</Text>
              </View>
            ))}
          </View>
        </SectionCard>

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
  content: { paddingBottom: spacing.md, gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.md, maxWidth: '100%' },
  chipInitials: { fontWeight: '800', letterSpacing: 0.3 },
  problem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, marginHorizontal: spacing.md, borderRadius: radius.md },
  bottom: { flexDirection: 'row', gap: spacing.sm },
  barContent: { minHeight: 52 },
  back: { flex: 0.8 },
  start: { flex: 1.6 },
  startLabel: { fontSize: 16, fontWeight: '800' },
});

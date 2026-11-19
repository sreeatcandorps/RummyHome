import React from 'react';
import { StyleSheet, View } from 'react-native';
import { RadioButton, Text, TextInput } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { InfoTip } from '@/components/ui/InfoTip';
import { HelpTopicKey } from '@/constants/helpTopics';
import { ENTRY_PLUS_LABELS, EntryPlus, limitHint, parsePoolLimit, POOL_CUSTOM_MAX, POOL_CUSTOM_MIN, POOL_LIMITS, POOL_REENTRY_LIMIT_MAX, poolLimitRoundsNote } from '@/utils/pool';
import { parseReentryLimit } from '@/utils/rulesDraft';
import { multiplierExample, multiplierFieldInput, MULTIPLIER_RANGE_TEXT, parseMultiplierInput } from '@/utils/multiplier';
import { RulesDraft } from '@/utils/rulesDraft';

export { draftFromRules, rulesFromDraft, showRule } from '@/utils/rulesDraft';
export type { RulesDraft } from '@/utils/rulesDraft';
import { radius, spacing, useAppTheme } from '@/constants/theme';

const signedField = (text: string) => {
  const digits = text.replace(/[^0-9]/g, '').slice(0, 3);
  return digits ? `-${digits}` : '';
};
const plainField = (text: string) => text.replace(/[^0-9]/g, '').slice(0, 3);

export const POINTS_RULES_NOTE = 'Drop, Middle drop, and Full count are negative. Defaults are -10, -30, and -80.';
export const POOL_RULES_NOTE = 'Pool scores are plus points: the winner scores 0 and everyone else adds their hand. Defaults are 25, 50, and 130.';
/** PR 14: under the Multiplier field once rounds exist (Game settings). */
export const multiplierRoundsNote = (rounds: number) => `${rounds === 1 ? '1 round' : `${rounds} rounds`} played · a change re-prices the whole game`;
export const MULTIPLIER_HINT = 'Type the points as usual; the app multiplies. ×1 unless you change it — changeable later for the whole game.';
/** 051 / D53: the limit may change once rounds exist; the ⓘ says what that does. */
export const POOL_LIMIT_CHANGE_NOTE = 'You can change the limit mid-game. Who is out is then read again from every total against the new limit: players under it are back in, players at or over it are out. Totals stay as they are; the Log records it.';
/** Mini help (ⓘ) beside the pool limit chips. */
export const POOL_LIMIT_TIP = 'The limit decides who is out: at 101, a score of 100 is still in and 101 is out. 101, 201 and 251 are the usual limits; Custom takes any number.';
/** Mini help (ⓘ) beside Re-entries; the line under the radios stays and tracks the choice. */
export const REENTRIES_TIP = 'A player who is out may come back; how many times per player? Unlimited lets them come back as often as they like; Limited caps it per player. Re-entry score says where they start: the highest score still in, or that plus 1.';
/** The title above Drop, Middle drop and Full count; its ⓘ carries the kind's note. */
export const VALUES_TITLE = 'Drop · Middle drop · Full count';
/** PR 24: the Re-entries block groups how many and where a re-entry starts; Late entry is its own block. The "how many" question lives in the ⓘ (PR 11). */
export const REENTRY_SCORE_TITLE = 'Re-entry score';
export const REENTRY_SCORE_HINT = 'Where a re-entering player starts.';
export const LATE_ENTRY_TITLE = 'Late entry';
export const LATE_ENTRY_HINT = 'Where a player added after round 1 starts.';
export const REENTRY_COUNT_EMPTY_HINT = 'Type how many re-entries each player gets (0–99).';

/**
 * Drop, Middle drop and Full count for either kind; a pool also has its limit (101 / 201 / 251 /
 * Custom, D2) and Re-entries (D4; 042: Unlimited / Limited N). 051 / D53: the limit stays editable once rounds exist;
 * a note under the chips says a change re-reads who is out
 * once a pool has a saved round (13.5, Q14.23); the three values and Re-entries stay live.
 */
export function RulesForm({ draft, onChange, disabled = false, testIDPrefix = 'rules', roundCount = 0, helpTopic = 'game-type', helpAnchor }: {
  draft: RulesDraft;
  onChange: (d: RulesDraft) => void;
  disabled?: boolean;
  testIDPrefix?: string;
  /** Game settings: rounds already saved, so the Multiplier box can say a change re-prices them (PR 14). */
  roundCount?: number;
  /** Where the ⓘ pop-ups' Full guide goes: the New game Game type page, or the scorecard's Game settings part. */
  helpTopic?: HelpTopicKey;
  helpAnchor?: string;
}) {
  const { colors } = useAppTheme();
  const pool = draft.gameKind === 'pool';
  const field = pool ? plainField : signedField;
  const limitDisabled = disabled;
  const numbersDisabled = disabled;
  const limitNumber = parsePoolLimit(draft.poolLimit);
  const reentryLimit = parseReentryLimit(draft);
  // PR 14 (Points only): the multiplier field and the live example under it (D14.3).
  const parsedMultiplier = parseMultiplierInput(draft.multiplier ?? '');
  const multiplierValue = parsedMultiplier.value ?? 1;
  const fullCountNumber = parseInt((draft.fullCount || '').replace(/[^0-9]/g, '') || '80', 10);
  return (
    <View style={styles.wrap}>
      {pool ? (
        <View style={styles.block}>
          <View style={styles.titleRow}>
            <Text variant="titleSmall">Pool limit</Text>
            <InfoTip title="Pool limit" text={roundCount > 0 ? [POOL_LIMIT_TIP, POOL_LIMIT_CHANGE_NOTE] : POOL_LIMIT_TIP} topic={helpTopic} anchor={helpAnchor} testID={`${testIDPrefix}-tip-limit`} />
          </View>
          <View style={styles.chips}>
            {POOL_LIMITS.map((limit) => {
              const active = !draft.customLimit && draft.poolLimit === String(limit);
              return (
                <Button
                  key={limit}
                  compact
                  mode={active ? 'contained' : 'outlined'}
                  disabled={limitDisabled}
                  onPress={() => onChange({ ...draft, poolLimit: String(limit), customLimit: false })}
                  style={styles.chip}
                  testID={`${testIDPrefix}-limit-${limit}`}
                  accessibilityState={{ selected: active }}
                >
                  {String(limit)}
                </Button>
              );
            })}
            <Button
              compact
              mode={draft.customLimit ? 'contained' : 'outlined'}
              disabled={limitDisabled}
              onPress={() => onChange({ ...draft, customLimit: true, poolLimit: (POOL_LIMITS as readonly number[]).includes(Number(draft.poolLimit)) ? '' : draft.poolLimit })}
              style={styles.chip}
              testID={`${testIDPrefix}-limit-custom`}
              accessibilityState={{ selected: draft.customLimit }}
            >
              Custom…
            </Button>
          </View>
          {draft.customLimit ? (
            <TextInput
              mode="outlined"
              label={`Custom limit (${POOL_CUSTOM_MIN}–${POOL_CUSTOM_MAX})`}
              keyboardType="number-pad"
              disabled={limitDisabled}
              value={draft.poolLimit}
              onChangeText={(t) => onChange({ ...draft, poolLimit: t.replace(/[^0-9]/g, '').slice(0, 3) })}
              error={draft.poolLimit !== '' && limitNumber === null}
              style={styles.limitInput}
              testID={`${testIDPrefix}-limit-input`}
            />
          ) : null}
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
            {limitNumber ? limitHint(limitNumber) : 'Reach the limit and you are out.'}
          </Text>
          {roundCount > 0 ? (
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }} testID={`${testIDPrefix}-limit-rounds-note`}>{poolLimitRoundsNote(roundCount)}</Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.titleRow}>
        <Text variant="titleSmall">{VALUES_TITLE}</Text>
        <InfoTip title={VALUES_TITLE} text={pool ? POOL_RULES_NOTE : POINTS_RULES_NOTE} topic={helpTopic} anchor={helpAnchor} testID={`${testIDPrefix}-tip-values`} />
      </View>
      <View style={styles.row}>
        <TextInput mode="outlined" label="Drop" keyboardType="number-pad" disabled={numbersDisabled} value={draft.drop} onChangeText={(t) => onChange({ ...draft, drop: field(t) })} style={styles.input} testID={`${testIDPrefix}-drop`} />
        <TextInput mode="outlined" label="Middle drop" keyboardType="number-pad" disabled={numbersDisabled} value={draft.middleDrop} onChangeText={(t) => onChange({ ...draft, middleDrop: field(t) })} style={styles.input} testID={`${testIDPrefix}-middle-drop`} />
        <TextInput mode="outlined" label="Full count" keyboardType="number-pad" disabled={numbersDisabled} value={draft.fullCount} onChangeText={(t) => onChange({ ...draft, fullCount: field(t) })} style={styles.input} testID={`${testIDPrefix}-full-count`} />
      </View>
      {!pool ? (
        <View style={styles.block} testID={`${testIDPrefix}-multiplier-block`}>
          <View style={styles.titleRow}>
            <Text variant="titleSmall">Multiplier</Text>
            <InfoTip title="Multiplier" text={MULTIPLIER_HINT} topic={helpTopic} anchor={helpAnchor} testID={`${testIDPrefix}-tip-multiplier`} />
          </View>
          <TextInput
            mode="outlined"
            label="Multiplier"
            keyboardType="number-pad"
            disabled={numbersDisabled}
            value={draft.multiplier ?? ''}
            placeholder="1"
            left={<TextInput.Affix text="×" />}
            onChangeText={(t) => onChange({ ...draft, multiplier: multiplierFieldInput(t) })}
            error={parsedMultiplier.value === null}
            style={styles.limitInput}
            testID={`${testIDPrefix}-multiplier`}
            accessibilityLabel="Multiplier, 1 to 10,000"
          />
          {parsedMultiplier.value === null ? (
            <Text variant="bodySmall" style={{ color: colors.error }} testID={`${testIDPrefix}-multiplier-error`}>{MULTIPLIER_RANGE_TEXT}</Text>
          ) : null}
          <View style={[styles.example, { backgroundColor: colors.secondaryContainer }]} testID={`${testIDPrefix}-multiplier-example`}>
            <Text variant="bodyMedium" style={{ color: colors.onSecondaryContainer, fontWeight: '700' }}>
              {multiplierExample(multiplierValue, fullCountNumber)}
            </Text>
            {roundCount > 0 ? (
              <Text variant="bodySmall" style={{ color: colors.onSecondaryContainer }}>{multiplierRoundsNote(roundCount)}</Text>
            ) : null}
          </View>
        </View>
      ) : null}
      {pool ? (
        <View style={styles.block} testID={`${testIDPrefix}-reentries-block`}>
          <View style={styles.titleRow}>
            <Text variant="titleSmall">Re-entries</Text>
            <InfoTip title="Re-entries" text={REENTRIES_TIP} topic={helpTopic} anchor={helpAnchor} testID={`${testIDPrefix}-tip-reentries`} />
          </View>
          <RadioButton.Group value={draft.reentryMode} onValueChange={(v) => onChange({ ...draft, reentryMode: v as RulesDraft['reentryMode'] })}>
            <View style={styles.radios}>
              <RadioButton.Item label="Unlimited" value="unlimited" disabled={disabled} position="leading" labelVariant="bodyMedium" style={styles.radio} testID={`${testIDPrefix}-reentries-unlimited`} accessibilityLabel="Re-entries unlimited" />
              <RadioButton.Item label="Limited" value="limited" disabled={disabled} position="leading" labelVariant="bodyMedium" style={styles.radio} testID={`${testIDPrefix}-reentries-limited`} accessibilityLabel="Re-entries limited" />
            </View>
          </RadioButton.Group>
          {draft.reentryMode === 'limited' ? (
            <TextInput
              mode="outlined"
              label={`Re-entries per player (0–${POOL_REENTRY_LIMIT_MAX})`}
              keyboardType="number-pad"
              disabled={disabled}
              value={draft.reentryCount}
              onChangeText={(t) => onChange({ ...draft, reentryCount: t.replace(/[^0-9]/g, '').slice(0, 2) })}
              error={reentryLimit === -1 && draft.reentryCount !== ''}
              style={styles.limitInput}
              testID={`${testIDPrefix}-reentries-count`}
            />
          ) : null}
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
            {draft.reentryMode === 'unlimited' ? 'Out players may re-enter as often as they like while someone is still in.' : reentryLimit === 0 ? 'No re-entries: out is out.' : reentryLimit === 1 ? 'Once per player.' : reentryLimit && reentryLimit > 0 ? `Up to ${reentryLimit} times per player.` : draft.reentryCount === '' ? REENTRY_COUNT_EMPTY_HINT : 'Type a whole number.'}
          </Text>
          <Text variant="labelLarge" style={styles.subTitle}>{REENTRY_SCORE_TITLE}</Text>
          <EntryPlusRadios value={draft.reentryPlus} onChange={(v) => onChange({ ...draft, reentryPlus: v })} disabled={disabled} testID={`${testIDPrefix}-reentry-score`} what="Re-entry score" />
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{REENTRY_SCORE_HINT}</Text>
        </View>
      ) : null}
      {pool ? (
        <View style={styles.block} testID={`${testIDPrefix}-late-entry-block`}>
          <Text variant="titleSmall">{LATE_ENTRY_TITLE}</Text>
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{LATE_ENTRY_HINT}</Text>
          <EntryPlusRadios value={draft.lateEntryPlus} onChange={(v) => onChange({ ...draft, lateEntryPlus: v })} disabled={disabled} testID={`${testIDPrefix}-late-entry-score`} what="Late entry score" />
        </View>
      ) : null}
    </View>
  );
}

/** PR 24: "Highest score" / "Highest score + 1" for the re-entry and late-entry rules. */
function EntryPlusRadios({ value, onChange, disabled, testID, what }: { value: EntryPlus; onChange: (v: EntryPlus) => void; disabled: boolean; testID: string; what: string }) {
  return (
    <RadioButton.Group value={String(value)} onValueChange={(v) => onChange(v === '1' ? 1 : 0)}>
      <View style={styles.radios}>
        <RadioButton.Item label={ENTRY_PLUS_LABELS[0]} value="0" disabled={disabled} position="leading" labelVariant="bodyMedium" style={styles.radio} testID={`${testID}-highest`} accessibilityLabel={`${what}: ${ENTRY_PLUS_LABELS[0]}`} />
        <RadioButton.Item label={ENTRY_PLUS_LABELS[1]} value="1" disabled={disabled} position="leading" labelVariant="bodyMedium" style={styles.radio} testID={`${testID}-plus-one`} accessibilityLabel={`${what}: ${ENTRY_PLUS_LABELS[1]}`} />
      </View>
    </RadioButton.Group>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  block: { gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm },
  input: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minWidth: 64 },
  limitInput: { maxWidth: 220 },
  example: { borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 12, gap: 2 },
  radios: { flexDirection: 'row', flexWrap: 'wrap' },
  radio: { paddingHorizontal: 0, paddingVertical: 0, marginRight: spacing.md },
  subTitle: { marginTop: spacing.xs },
});

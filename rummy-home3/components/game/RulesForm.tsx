import React from 'react';
import { StyleSheet, View } from 'react-native';
import { RadioButton, Text, TextInput } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { limitHint, parsePoolLimit, POOL_CUSTOM_MAX, POOL_CUSTOM_MIN, POOL_LIMITS, POOL_REENTRY_LIMIT_MAX } from '@/utils/pool';
import { parseReentryLimit } from '@/utils/rulesDraft';
import { RulesDraft } from '@/utils/rulesDraft';

export { draftFromRules, rulesFromDraft, showRule } from '@/utils/rulesDraft';
export type { RulesDraft } from '@/utils/rulesDraft';
import { spacing, useAppTheme } from '@/constants/theme';

const signedField = (text: string) => {
  const digits = text.replace(/[^0-9]/g, '').slice(0, 3);
  return digits ? `-${digits}` : '';
};
const plainField = (text: string) => text.replace(/[^0-9]/g, '').slice(0, 3);

export const POINTS_RULES_NOTE = 'Drop, Middle drop, and Full count are negative. Defaults are -10, -30, and -80.';
export const POOL_RULES_NOTE = 'Pool scores are plus points: the winner scores 0 and everyone else adds their hand. Defaults are 25, 50, and 130.';
export const POOL_LOCK_NOTE = 'Rounds have been saved, so the pool limit is locked — changing it would change who is out. Drop, Middle drop, Full count and Re-entries can still change; the Log records it.';

/**
 * Drop, Middle drop and Full count for either kind; a pool also has its limit (101 / 201 / 251 /
 * Custom, D2) and Re-entries (D4; 042: Unlimited / Limited N). `lockValues` greys the pool limit
 * once a pool has a saved round (13.5, Q14.23); the three values and Re-entries stay live.
 */
export function RulesForm({ draft, onChange, disabled = false, lockValues = false, testIDPrefix = 'rules' }: {
  draft: RulesDraft;
  onChange: (d: RulesDraft) => void;
  disabled?: boolean;
  lockValues?: boolean;
  testIDPrefix?: string;
}) {
  const { colors } = useAppTheme();
  const pool = draft.gameKind === 'pool';
  const field = pool ? plainField : signedField;
  // Q14.23: once rounds exist only the pool limit is locked (it decides who is out).
  const limitDisabled = disabled || lockValues;
  const numbersDisabled = disabled;
  const limitNumber = parsePoolLimit(draft.poolLimit);
  const reentryLimit = parseReentryLimit(draft);
  return (
    <View style={styles.wrap}>
      {pool ? (
        <View style={styles.block}>
          <Text variant="titleSmall">Pool limit</Text>
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
        </View>
      ) : null}
      <View style={styles.row}>
        <TextInput mode="outlined" label="Drop" keyboardType="number-pad" disabled={numbersDisabled} value={draft.drop} onChangeText={(t) => onChange({ ...draft, drop: field(t) })} style={styles.input} testID={`${testIDPrefix}-drop`} />
        <TextInput mode="outlined" label="Middle drop" keyboardType="number-pad" disabled={numbersDisabled} value={draft.middleDrop} onChangeText={(t) => onChange({ ...draft, middleDrop: field(t) })} style={styles.input} testID={`${testIDPrefix}-middle-drop`} />
        <TextInput mode="outlined" label="Full count" keyboardType="number-pad" disabled={numbersDisabled} value={draft.fullCount} onChangeText={(t) => onChange({ ...draft, fullCount: field(t) })} style={styles.input} testID={`${testIDPrefix}-full-count`} />
      </View>
      <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
        {lockValues ? POOL_LOCK_NOTE : pool ? POOL_RULES_NOTE : POINTS_RULES_NOTE}
      </Text>
      {pool ? (
        <View style={styles.block}>
          <Text variant="titleSmall">Re-entries</Text>
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
            A player who is out may come back at the highest score still in. How many times per player?
          </Text>
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
              error={reentryLimit === -1}
              style={styles.limitInput}
              testID={`${testIDPrefix}-reentries-count`}
            />
          ) : null}
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
            {draft.reentryMode === 'unlimited' ? 'Out players may re-enter as often as they like while someone is still in.' : reentryLimit === 0 ? 'No re-entries: out is out.' : reentryLimit === 1 ? 'Once per player.' : reentryLimit && reentryLimit > 0 ? `Up to ${reentryLimit} times per player.` : 'Type a whole number.'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  block: { gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm },
  input: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minWidth: 64 },
  limitInput: { maxWidth: 220 },
  radios: { flexDirection: 'row', flexWrap: 'wrap' },
  radio: { paddingHorizontal: 0, paddingVertical: 0, marginRight: spacing.md },
});

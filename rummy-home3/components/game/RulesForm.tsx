import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Switch, Text, TextInput } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { limitHint, parsePoolLimit, POOL_CUSTOM_MAX, POOL_CUSTOM_MIN, POOL_LIMITS } from '@/utils/pool';
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
export const POOL_LOCK_NOTE = 'Rounds have been saved, so the limit, Drop, Middle drop and Full count are locked. Re-entry can still change.';

/**
 * Drop, Middle drop and Full count for either kind; a pool also has its limit (101 / 201 / 251 /
 * Custom, D2) and the Re-entry switch (D4). `lockValues` greys the numbers once a pool has a saved
 * round (13.5) while Re-entry stays live.
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
  const numbersDisabled = disabled || lockValues;
  const limitNumber = parsePoolLimit(draft.poolLimit);
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
                  disabled={numbersDisabled}
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
              disabled={numbersDisabled}
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
              disabled={numbersDisabled}
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
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text variant="titleSmall">Re-entry</Text>
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
              A player who is out may come back once, at the highest score still in.
            </Text>
          </View>
          <Switch value={draft.reentry} disabled={disabled} onValueChange={(v) => onChange({ ...draft, reentry: v })} testID={`${testIDPrefix}-reentry`} accessibilityLabel="Re-entry" />
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
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  flex: { flex: 1 },
});

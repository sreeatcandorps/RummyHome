import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Dialog, Icon, Portal, Text, TextInput } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { radius, seatColor, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { HELP } from '@/constants/help';
import { useGameRoster } from '@/hooks/useGameRoster';
import { useLayout } from '@/hooks/useLayout';
import { gamesService } from '@/services/games';
import { ActionBar } from '@/components/ui/ActionBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { HelpButton } from '@/components/ui/HelpButton';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { Tag } from '@/components/ui/Tag';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { DEFAULT_POOL_ENTRY, DEFAULT_POOL_VALUES, isPoolGame, poolLimitOf, poolStandings } from '@/utils/pool';
import { AWARD_PRESETS, AwardPreset, NOT_VIABLE_TEXT, awardsPayload, buildAwardSheet, getsFromAwards, givenOutText, presetGets, saveAnywayText, signedPoints, viablePresets, winnerGetsMost } from '@/utils/poolAwards';
import { afterAwardsRoute } from '@/utils/endFlow';
import { seatLabels } from '@/utils/initials';
import { screenTitle } from '@/utils/gameLabel';

/**
 * Awards for a Completed pool (D8, D9): tap a category to preview every player's award, edit
 * "Gets" inline under Custom, and Save, with "X points weren't given out. Save awards anyway?"
 * when the numbers do not add up. Points only, never money (D12).
 *
 * Nov 18 end flow: opened from Complete (`next=final`) the page goes on to the Final screen after
 * Save or Not now; opened from the scorecard or the Results picker it returns to its caller. No
 * Results button here — Results is its own errand from Home.
 */
export default function AwardScreen() {
  const { id, next } = useLocalSearchParams<{ id: string; next?: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { insets } = useLayout();
  const { game, setGame, players, canScore, loading, error, reload } = useGameRoster(typeof id === 'string' ? id : undefined);

  const [preset, setPreset] = useState<AwardPreset>('winner');
  const [entryText, setEntryText] = useState(String(DEFAULT_POOL_ENTRY));
  const [gets, setGets] = useState<Record<string, number>>({});
  const [customText, setCustomText] = useState<Record<string, string>>({});
  const [seededFrom, setSeededFrom] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [notViable, setNotViable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const entry = Math.max(0, parseInt(entryText, 10) || 0);
  const standings = useMemo(() => (game ? poolStandings(game) : []), [game]);
  const inputs = useMemo(
    () => ({ standings, entry, limit: poolLimitOf(game?.settings), drop: Math.abs(game?.settings.dropAmount ?? DEFAULT_POOL_VALUES.drop) }),
    [standings, entry, game?.settings],
  );

  // Reopen with the saved awards when editing; otherwise start on Winner takes all.
  useEffect(() => {
    if (!game || seededFrom === game.id) return;
    setSeededFrom(game.id);
    if (game.awardedAt && game.prizeShares) {
      const savedEntry = game.awardNote?.entry ?? DEFAULT_POOL_ENTRY;
      const savedPreset = (game.awardNote?.preset as AwardPreset | undefined) ?? 'custom';
      setEntryText(String(savedEntry));
      setPreset(savedPreset);
      const saved = getsFromAwards(game.prizeShares, standings, savedEntry);
      setGets(saved);
      setCustomText(Object.fromEntries(Object.entries(saved).map(([k, v]) => [k, String(v)])));
    } else {
      setGets(presetGets('winner', { ...inputs, entry: DEFAULT_POOL_ENTRY }));
    }
  }, [game, seededFrom, standings, inputs]);

  // A preset recomputes whenever the entry changes; Custom keeps what was typed.
  useEffect(() => {
    if (!game || preset === 'custom') return;
    setGets(presetGets(preset, inputs));
  }, [game, preset, inputs]);

  const sheet = useMemo(() => buildAwardSheet(preset, inputs, gets), [preset, inputs, gets]);
  const givenOut = givenOutText(sheet);
  // F13.23: the lowest score must get the most. A preset that cannot manage it here is greyed and
  // refused with a pop-up; Custom is the admin's own numbers, so it only warns.
  const viable = useMemo(() => viablePresets(inputs), [inputs]);
  const customCheck = preset === 'custom' ? winnerGetsMost(gets, standings) : null;

  const pickPreset = (next: AwardPreset) => {
    if (!viable[next]) {
      setNotViable(true);
      return;
    }
    if (next === 'custom') {
      // Custom starts from the numbers on screen so an admin tweaks rather than retypes.
      setCustomText(Object.fromEntries(sheet.rows.map((r) => [r.playerId, String(r.gets)])));
    }
    setPreset(next);
  };

  const editCustom = (playerId: string, text: string) => {
    const digits = text.replace(/[^\d]/g, '').slice(0, 5);
    setCustomText((cur) => ({ ...cur, [playerId]: digits }));
    setGets((cur) => ({ ...cur, [playerId]: parseInt(digits, 10) || 0 }));
  };

  // After Save (or Not now): the Final screen when we came from Complete, otherwise back to the caller.
  const leave = () => {
    const onward = game ? afterAwardsRoute(game, next) : null;
    if (onward) router.replace(onward);
    else if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const save = async (force = false) => {
    if (!game || saving) return;
    const warning = saveAnywayText(sheet);
    if (warning && !force) {
      setConfirm(warning);
      return;
    }
    setSaving(true);
    try {
      const { awards, note } = awardsPayload(sheet);
      const updated = await gamesService.setPoolAwards(game.id, awards, note as unknown as Record<string, unknown>);
      if (updated) setGame(updated);
      setConfirm(null);
      leave();
    } catch (caught) {
      setConfirm(null);
      setFailure(formatSupabaseError(caught));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (!game || !isPoolGame(game)) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title={error ? "Couldn't load this pool" : 'Not a pool game'}
        message={error ?? 'Awards are given for pool games only.'}
        actionLabel="Retry"
        onAction={reload}
      />
    );
  }

  const title = screenTitle('Awards', game);
  const locked = Boolean(game.closedAt);
  const blocked = !game.isComplete
    ? 'Complete the pool first.'
    : locked
      ? 'This pool is in a result. Delete the result to change its awards.'
      : !canScore
        ? 'Only a game admin gives awards.'
        : null;
  const nameOf = (playerId: string) => players.find((p) => p.id === playerId)?.name ?? '?';
  const labelById = seatLabels(players);
  const labelOf = (playerId: string) => labelById.get(playerId) ?? undefined;
  const colorOf = (playerId: string) => seatColor(Math.max(0, players.findIndex((p) => p.id === playerId)));
  const toneColor = givenOut.tone === 'ok' ? colors.win : givenOut.tone === 'under' ? colors.onSurfaceVariant : colors.loss;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title, headerRight: () => <HelpButton text={HELP.awards} /> }} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingLeft: insets.left + spacing.lg, paddingRight: insets.right + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Tag label={game.awardedAt ? 'Awarded' : 'Completed'} tone="info" icon={game.awardedAt ? 'trophy-outline' : 'flag-checkered'} />
          <View style={styles.entryBox}>
            <Text variant="labelMedium" style={{ color: colors.onSurfaceVariant }}>Entry per player</Text>
            <TextInput
              mode="outlined"
              dense
              value={entryText}
              onChangeText={(t) => setEntryText(t.replace(/[^\d]/g, '').slice(0, 5))}
              keyboardType="number-pad"
              disabled={Boolean(blocked)}
              style={styles.entryInput}
              accessibilityLabel="Entry per player"
              testID="award-entry"
            />
          </View>
        </View>
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
          {`${sheet.rows.reduce((n, r) => n + r.entries, 0)} entries (a re-entry counts twice) · pool ${sheet.poolTotal} points`}
        </Text>

        <View style={styles.chips}>
          {AWARD_PRESETS.map((p) => (
            <Button
              key={p.key}
              compact
              mode={preset === p.key ? 'contained' : 'outlined'}
              onPress={() => pickPreset(p.key)}
              disabled={Boolean(blocked)}
              style={!viable[p.key] ? styles.notViable : undefined}
              accessibilityState={{ selected: preset === p.key }}
              accessibilityHint={!viable[p.key] ? 'Not ideal for this pool: the winner would get less than the others' : undefined}
              testID={`award-preset-${p.key}`}
            >
              {p.label}
            </Button>
          ))}
        </View>
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }} testID="award-hint">
          {AWARD_PRESETS.find((p) => p.key === preset)?.hint}
        </Text>
        {customCheck && !customCheck.ok ? (
          <View style={styles.warnRow}>
            <Icon source="alert-outline" size={16} color={colors.loss} />
            <Text variant="bodySmall" style={{ color: colors.loss, flex: 1 }} testID="award-winner-warning">
              {customCheck.winnerGets < 0
                ? 'The winner gets a negative amount.'
                : `The winner gets ${customCheck.winnerGets}, ${nameOf(customCheck.rival ?? '')} gets ${customCheck.rivalGets}. The lowest score usually gets the most.`}
            </Text>
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
          <View style={[styles.row, styles.headRow, { borderBottomColor: colors.hairline }]}>
            <Text style={[styles.name, styles.colHead, { color: colors.onSurfaceVariant }]}>Player</Text>
            <Text style={[styles.num, styles.colHead, { color: colors.onSurfaceVariant }]}>Score</Text>
            <Text style={[styles.num, styles.colHead, { color: colors.onSurfaceVariant }]}>Put in</Text>
            <Text style={[styles.numWide, styles.colHead, { color: colors.onSurfaceVariant }]}>Gets</Text>
            <Text style={[styles.num, styles.colHead, { color: colors.onSurfaceVariant }]}>Award</Text>
          </View>
          {sheet.rows.map((r) => (
            <View key={r.playerId} style={[styles.row, { borderBottomColor: colors.hairline }]} testID={`award-row-${r.playerId}`}>
              <View style={styles.nameCell}>
                <SeatAvatar name={nameOf(r.playerId)} label={labelOf(r.playerId)} color={colorOf(r.playerId)} size={32} />
                <View style={styles.flex}>
                  <Text variant="bodyMedium" numberOfLines={1} style={[{ fontWeight: '600' }, r.out && styles.struck]}>{nameOf(r.playerId)}</Text>
                  <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>
                    {r.out ? `out R${standings.find((s) => s.playerId === r.playerId)?.outRound ?? ''}` : `${inputs.limit - r.total} left · ${standings.find((s) => s.playerId === r.playerId)?.drops ?? 0} drops`}
                  </Text>
                </View>
              </View>
              <Text style={[styles.num, tabularNums, { color: colors.onSurface }]}>{r.total}</Text>
              <Text style={[styles.num, tabularNums, { color: colors.onSurfaceVariant }]}>{r.entries * entry}</Text>
              {preset === 'custom' && !blocked ? (
                <TextInput
                  mode="outlined"
                  dense
                  value={customText[r.playerId] ?? String(r.gets)}
                  onChangeText={(t) => editCustom(r.playerId, t)}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  style={[styles.numWide, styles.getsInput]}
                  accessibilityLabel={`${nameOf(r.playerId)} gets`}
                  testID={`award-gets-${r.playerId}`}
                />
              ) : (
                <Text style={[styles.numWide, tabularNums, { color: colors.onSurface, fontWeight: '700' }]} testID={`award-gets-text-${r.playerId}`}>{r.gets}</Text>
              )}
              <Text style={[styles.num, tabularNums, { color: r.award > 0 ? colors.win : r.award < 0 ? colors.loss : colors.onSurface, fontWeight: '800' }]} testID={`award-value-${r.playerId}`}>
                {signedPoints(r.award)}
              </Text>
            </View>
          ))}
          <View style={styles.checkRow}>
            <Icon source={givenOut.tone === 'ok' ? 'check-circle-outline' : 'information-outline'} size={18} color={toneColor} />
            <Text variant="bodySmall" style={{ color: toneColor, flex: 1 }} testID="award-given-out">{givenOut.text}</Text>
          </View>
        </View>

        {blocked ? <Text variant="bodyMedium" style={{ color: colors.error }} testID="award-blocked">{blocked}</Text> : null}
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
          Award = Gets − Put in.
        </Text>
      </ScrollView>

      {/* First awards: Not now leaves the pool Completed without awards (give them later from the scorecard). Editing: Cancel + Save changes. */}
      <ActionBar
        secondary={game.awardedAt
          ? { label: 'Cancel', onPress: () => router.back(), disabled: saving, testID: 'award-cancel' }
          : { label: 'Not now', icon: 'clock-outline', onPress: leave, disabled: saving, accessibilityLabel: 'Not now, give awards later', testID: 'award-not-now' }}
        primary={{ label: game.awardedAt ? 'Save changes' : 'Save awards', icon: 'trophy-outline', onPress: () => save(false), disabled: Boolean(blocked) || saving, loading: saving, accessibilityLabel: 'Save awards', testID: 'award-save' }}
      />

      <Portal>
        <Dialog visible={Boolean(confirm)} onDismiss={() => saving || setConfirm(null)} style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Dialog.Icon icon="alert-outline" />
          <Dialog.Title style={styles.dialogTitle}>Not all given out</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant, textAlign: 'center' }} testID="award-save-anyway">{confirm}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirm(null)} disabled={saving}>Change</Button>
            <Button mode="contained" onPress={() => save(true)} loading={saving} disabled={saving} testID="award-save-anyway-yes">Save anyway</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={notViable} onDismiss={() => setNotViable(false)} style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Dialog.Icon icon="information-outline" />
          <Dialog.Title style={styles.dialogTitle}>Not for this pool</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant, textAlign: 'center' }} testID="award-not-viable">{NOT_VIABLE_TEXT}</Text>
          </Dialog.Content>
          <Dialog.Actions><Button mode="contained" onPress={() => setNotViable(false)} testID="award-not-viable-ok">Pick another</Button></Dialog.Actions>
        </Dialog>
        <Dialog visible={Boolean(failure)} onDismiss={() => setFailure(null)} style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Dialog.Icon icon="alert-circle-outline" />
          <Dialog.Title>Could not save awards</Dialog.Title>
          <Dialog.Content><Text variant="bodyMedium">{failure}</Text></Dialog.Content>
          <Dialog.Actions><Button mode="contained" onPress={() => setFailure(null)}>OK</Button></Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  entryBox: { alignItems: 'flex-end', gap: 2 },
  entryInput: { width: 96, height: 40, backgroundColor: 'transparent' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  notViable: { opacity: 0.45 },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, paddingHorizontal: spacing.sm, paddingTop: spacing.xs, marginTop: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  headRow: { paddingVertical: 2 },
  colHead: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  nameCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minWidth: 0 },
  name: { flex: 1 },
  struck: { textDecorationLine: 'line-through', opacity: 0.7 },
  num: { width: 48, textAlign: 'right', fontWeight: '600' },
  numWide: { width: 64, textAlign: 'right', fontWeight: '600' },
  getsInput: { height: 36, backgroundColor: 'transparent', textAlign: 'right' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  dialog: { borderRadius: radius.xl },
  flex: { flex: 1 },
  dialogTitle: { textAlign: 'center', fontWeight: '700' },
});

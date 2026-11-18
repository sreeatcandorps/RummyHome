import { gameLabelOf } from '@/utils/gameLabel';
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { Toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/AppButton';
import { router, useFocusEffect } from 'expo-router';
import { archiveService, DeletedGameRow, DeletedResultRow, HiddenAndDeleted, HiddenGameRow } from '@/services/archive';
import { authService } from '@/services/auth';
import { Screen } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { formatGameDateTime } from '@/utils/gameDisplay';
import { restoreGameNote } from '@/utils/archive';
import { hiddenForGoodLabel, purgeDate, SUPPORT_CARD_BODY, SUPPORT_CARD_TITLE } from '@/utils/deletedGames';
import { formatSupabaseError } from '@/utils/supabaseErrors';

const gameTitle = (row: { gameNumber: number | null; gameLabel?: string | null; creatorName: string }) =>
  `${gameLabelOf(row) ? `Game ${gameLabelOf(row)}` : 'Game'} · ${row.creatorName}`;

/** Settings > Hidden & deleted: games I hid (Unhide), games I deleted (Restore), results I deleted (Restore). */
export default function HiddenAndDeletedScreen() {
  const { colors } = useAppTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<HiddenAndDeleted | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const me = await authService.getCurrentPlayer();
      setUserId(me?.id ?? null);
      setData(await archiveService.list(me?.id ?? null));
    } catch (err) {
      setError(formatSupabaseError(err));
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const run = async (id: string, action: () => Promise<string | null>) => {
    setBusyId(id);
    try {
      const text = await action();
      if (text) setNote(text);
      await load();
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setBusyId(null);
    }
  };

  const row = (key: string, title: string, lines: string[], action: { label: string; onPress: () => void; disabled?: boolean }, open?: () => void) => (
    <View key={key} style={[styles.row, { borderColor: colors.outlineVariant }]}>
      <View style={styles.rowText}>
        <Text variant="titleSmall" onPress={open}>{title}</Text>
        {lines.map((line, i) => <Text key={i} variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{line}</Text>)}
      </View>
      <Button mode="outlined" compact onPress={action.onPress} loading={busyId === key} disabled={busyId !== null || action.disabled}>{action.label}</Button>
    </View>
  );

  const hiddenRow = (g: HiddenGameRow) => row(
    `h-${g.id}`,
    gameTitle(g),
    [`${formatGameDateTime(g.createdAt)} · ${g.playerCount} players · ${g.status === 'completed' ? 'Completed' : 'Active'}`],
    { label: 'Unhide', onPress: () => run(`h-${g.id}`, async () => { await archiveService.unhideGame(g.id, userId); return 'Back on your Home.'; }) },
    () => router.push(`/(screens)/games/${g.id}`),
  );

  const deletedGameRow = (g: DeletedGameRow) => row(
    `g-${g.id}`,
    gameTitle(g),
    [
      `${formatGameDateTime(g.createdAt)} · ${g.playerCount} players`,
      `Deleted ${formatGameDateTime(g.deletedAt)} by ${g.deletedByMe ? 'you' : g.deletedByName}`,
      // 046: the day the nightly step hides it for good; the server's date, or 30 days from the stamp on an older server.
      ...(hiddenForGoodLabel(g.purgeAt ?? purgeDate(g.deletedAt)) ? [`${hiddenForGoodLabel(g.purgeAt ?? purgeDate(g.deletedAt)).replace(/^hidden/, 'Hidden')}.`] : []),
      ...((g.requestCount ?? 0) > 0 ? [g.requestCount === 1 ? '1 player asked to restore it.' : `${g.requestCount} players asked to restore it.`] : []),
      ...(g.removedFromResults > 0 ? [g.removedFromResults === 1 ? 'Removed from 1 saved result; restoring does not add it back.' : `Removed from ${g.removedFromResults} saved results; restoring does not add it back.`] : []),
    ],
    { label: 'Restore', onPress: () => run(`g-${g.id}`, async () => { const r = await archiveService.restoreGame(g.id, userId); return restoreGameNote(r.removedFromResults.length); }) },
  );

  const deletedResultRow = (r: DeletedResultRow) => row(
    `r-${r.id}`,
    `Result · ${formatGameDateTime(r.declaredAt)}`,
    [
      `${r.gameCount} games · ${r.playerCount} players`,
      `Deleted ${formatGameDateTime(r.deletedAt)} by ${r.deletedByMe ? 'you' : r.deletedByName}`,
    ],
    { label: 'Restore', onPress: () => run(`r-${r.id}`, async () => { await archiveService.restoreResult(r.id, userId); return 'Result restored. Its games are Closed again.'; }) },
  );

  const empty = (text: string) => <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>{text}</Text>;

  return (
    <Screen contentStyle={styles.content}>
      {error ? (
        <View style={[styles.notice, { backgroundColor: colors.errorContainer }]}>
          <Icon source="alert-circle-outline" size={20} color={colors.onErrorContainer} />
          <Text variant="bodyMedium" style={[styles.flex, { color: colors.onErrorContainer }]}>{error}</Text>
          <Button compact onPress={load}>Retry</Button>
        </View>
      ) : null}
      {!data && !error ? <LoadingRows /> : null}
      {data ? (
        <>
          <SectionCard title={`Games I hid · ${data.hidden.length}`} icon="eye-off-outline" supportingText="Off your Home only. They still count in results and stats.">
            {data.hidden.length ? data.hidden.map(hiddenRow) : empty('No hidden games.')}
          </SectionCard>
          <SectionCard title={`Deleted games · ${data.deletedGames.length}`} icon="delete-outline" supportingText="Off everyone's Home until restored; players who scored in it can still open it read-only. Hidden for good 30 days after the delete — nothing is erased. A game removed from a saved result is not added back.">
            {data.deletedGames.length ? data.deletedGames.map(deletedGameRow) : empty('No deleted games.')}
          </SectionCard>
          <SectionCard title={`Deleted results · ${data.deletedResults.length}`} icon="podium" supportingText="Their games are not Closed while deleted and can go into a new result.">
            {data.deletedResults.length ? data.deletedResults.map(deletedResultRow) : empty('No deleted results.')}
          </SectionCard>
          <SectionCard title={SUPPORT_CARD_TITLE} icon="lifebuoy" mode="outlined">
            <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }} testID="support-card">{SUPPORT_CARD_BODY}</Text>
          </SectionCard>
        </>
      ) : null}
      <Toast message={note} onDismiss={() => setNote(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  rowText: { flex: 1, gap: 2 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
});

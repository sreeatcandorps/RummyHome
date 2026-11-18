import React, { useCallback, useMemo, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, StyleSheet, View } from 'react-native';
import { Chip, Dialog, Icon, Portal, Text, TouchableRipple } from 'react-native-paper';
import { Toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/AppButton';
import { router, useFocusEffect } from 'expo-router';
import { GameListItem } from '@/components/ui/GameListItem';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { Screen } from '@/components/ui/Screen';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { SectionCard } from '@/components/ui/SectionCard';
import { InfoTip, TitleWithTip } from '@/components/ui/InfoTip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tag } from '@/components/ui/Tag';
import { RESULTS_PLAYER_LIMIT } from '@/constants/limits';
import { radius, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { archiveService, DeletedResultRow } from '@/services/archive';
import { authService } from '@/services/auth';
import { gamesService } from '@/services/games';
import { resultsService } from '@/services/results';
import { isSupabaseConfigured } from '@/services/supabase';
import { Game } from '@/types/game';
import { formatGameDateTime } from '@/utils/gameDisplay';
import {
  GameResultSummary,
  RESULTS_PAGE_SIZE,
  resultsCountLine,
  selectableResultGames,
  DEFAULT_RESULTS_FILTER,
  defaultResultSelection,
  filterResultGames,
  ResultsFilter,
  ResultsStatus,
  RESULTS_FILTER_LABEL,
  RESULTS_STATUSES,
  resultsEmptyText,
  resultsPickerHeading,
  visibleSelection,
  withinResultsPlayerLimit,
} from '@/utils/results';
import {
  applyFilterSwitch,
  canPickForResults,
  FilterSwitch,
  NON_ADMIN_PICK_MESSAGE,
  pastResultRows,
  planFilterSwitch,
  resultReusedNote,
  selectedCountLine,
  winnerInitials,
  MAKE_RESULT_FOLD_NOTE,
} from '@/utils/resultsSave';
import { GIVE_AWARDS_FIRST, poolNeedsAwards } from '@/utils/pool';
import { WhyLink } from '@/components/help/WhyLink';
import {
  DELETED_SECTION_NOTE,
  DELETED_SECTION_TITLE,
  DELETED_TAG,
  listedDeleted,
  RESTORE_RESULT_BUTTON,
  RESTORED_TOAST,
  restoreRowLabel,
} from '@/utils/resultsDelete';
import { storage } from '@/utils/storage';
import { formatSupabaseError } from '@/utils/supabaseErrors';

function newestFirst(a: Game, b: Game): number {
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}

/** One saved result: the winner's initials under a crown, then 1st/2nd/3rd on their own rows. Delete lives on the result page (PR 10b: the row chip is gone). */
function PastResult({ item }: { item: GameResultSummary }) {
  const { colors } = useAppTheme();
  const rows = pastResultRows(item.top);
  const reused = resultReusedNote(item.reusedCount);
  return (
    <View style={[styles.past, { backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderLeftColor: colors.primary }]} testID={`past-result-${item.id}`}>
      <TouchableRipple
        onPress={() => router.push(`/(screens)/results/${item.id}`)}
        borderless
        style={styles.ripple}
        accessibilityRole="button"
        accessibilityLabel={`Open results from ${formatGameDateTime(item.declaredAt)}${reused ? `, ${reused.toLowerCase()}` : ''}`}
      >
        <View style={styles.pastInner}>
          <View style={styles.winner} accessibilityLabel={`Winner ${rows[0]?.name ?? ''}`}>
            <Icon source="crown" size={18} color={colors.secondary} />
            <SeatAvatar name={rows[0]?.name ?? '?'} label={winnerInitials(item.top)} size={44} />
          </View>
          <View style={styles.pastBody}>
            <Text variant="titleSmall" style={styles.left} numberOfLines={1}>{formatGameDateTime(item.declaredAt)}</Text>
            <View style={styles.meta}>
              <Tag label="Results" tone="results" icon="podium" />
              {reused ? <Icon source="alert-outline" size={18} color={colors.secondary} /> : null}
              <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{resultsCountLine(item.gameCount, item.playerCount)}</Text>
            </View>
            {rows.length === 0 ? (
              <Text variant="bodySmall" numberOfLines={1} style={{ color: colors.onSurfaceVariant }}>{item.winnerLine}</Text>
            ) : (
              rows.map((row) => (
                <View key={`${row.label}-${row.name}`} style={styles.placeRow}>
                  <Text variant="bodyLarge" style={[styles.placeLabel, { color: colors.onSurfaceVariant }]}>{row.label}</Text>
                  <Text variant="bodyLarge" style={styles.placeName} numberOfLines={1}>{row.name}</Text>
                  <Text variant="bodyLarge" style={[tabularNums, styles.placePoints, { color: row.points.startsWith('-') ? colors.loss : colors.onSurface }]}>{row.points}</Text>
                </View>
              ))
            )}
          </View>
          <Icon source="chevron-right" size={24} color={colors.onSurfaceVariant} />
        </View>
      </TouchableRipple>
    </View>
  );
}

/** A deleted result, greyed, with Restore (D9.3): shown for 30 days to the people who could delete it. */
function DeletedResult({ row, busy, onRestore }: { row: DeletedResultRow; busy: boolean; onRestore: () => void }) {
  const { colors } = useAppTheme();
  const when = formatGameDateTime(row.declaredAt);
  return (
    <View style={[styles.past, styles.deletedRow, { backgroundColor: colors.surfaceVariant, borderColor: colors.outlineVariant, borderLeftColor: colors.outlineVariant }]} testID={`deleted-result-${row.id}`}>
      <View style={styles.pastInner}>
        <View style={styles.pastBody}>
          <Text variant="titleSmall" style={[styles.left, { color: colors.onSurfaceVariant }]} numberOfLines={1}>{when}</Text>
          <View style={styles.meta}>
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{resultsCountLine(row.gameCount, row.playerCount)}</Text>
            <Tag label={DELETED_TAG} tone="neutral" />
          </View>
        </View>
        <Button
          compact
          mode="outlined"
          icon="restore"
          onPress={onRestore}
          disabled={busy}
          accessibilityLabel={restoreRowLabel(when)}
          testID={`deleted-result-restore-${row.id}`}
        >
          {RESTORE_RESULT_BUTTON}
        </Button>
      </View>
    </View>
  );
}

/** Mini help (PR 11) beside the picker heading. */
export const PICKER_TIP = [
  'Tick the games for this result. Only games you created or admin can be ticked; a pool needs its awards first.',
  '**Show results** only previews — nothing is saved by looking. **Save result** is on the preview.',
];

export default function ResultsScreen() {
  const { colors } = useAppTheme();
  const [games, setGames] = useState<Game[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<GameResultSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ResultsFilter>(DEFAULT_RESULTS_FILTER);
  const [checked, setChecked] = useState<string[]>([]);
  const touched = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<FilterSwitch<Game> | null>(null);
  const [notAdmin, setNotAdmin] = useState<Game | null>(null);
  /** Pool (D10): a Completed pool without awards is listed but cannot be ticked. */
  const [needsAwards, setNeedsAwards] = useState<Game | null>(null);
  const loadingMore = useRef(false);
  /** PR 9: the deleted results still inside 30 days (Restore); PR 10b moved Delete itself to the result page. */
  const [deletedRows, setDeletedRows] = useState<DeletedResultRow[]>([]);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Q10.13: someone who runs no listed game opens on Past results; the picker folds under "Make a result".
  const [pickerOpen, setPickerOpen] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const id = isSupabaseConfigured ? await authService.getCurrentUserId() : await storage.getCurrentPlayer();
      const player = await authService.getCurrentPlayer();
      if (!id) {
        setError('Not signed in.');
        return;
      }
      setUserId(id);
      // Every game the person is in, with the seated players' names. Ones they do not run are listed but cannot be ticked.
      const candidates = await gamesService.listResultCandidates(id, player?.email);
      const listedGames = selectableResultGames(candidates.games).sort(newestFirst);
      setGames(listedGames);
      setNames(candidates.names);
      const first = await resultsService.list(0, RESULTS_PAGE_SIZE);
      setSaved(first);
      setHasMore(first.length === RESULTS_PAGE_SIZE);
      archiveService.list(id).then((lists) => setDeletedRows(listedDeleted(lists.deletedResults))).catch(() => {});
      setChecked((current) => (touched.current
        ? current.filter((gameId) => listedGames.some((game) => game.id === gameId && canPickForResults(game, id)))
        : defaultResultSelection(listedGames, filter, id)));
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const shownGames = useMemo(() => filterResultGames(games, filter), [games, filter]);

  const applySwitch = (plan: FilterSwitch<Game>) => {
    touched.current = true;
    setFilter(plan.next);
    setChecked((current) => applyFilterSwitch(current, plan.hidden));
    setPendingSwitch(null);
  };

  /** A chip that would hide a ticked game asks first; Cancel keeps both the filter and the ticks. */
  const flipStatus = (status: ResultsStatus) => {
    const plan = planFilterSwitch(games, checked, filter, status);
    if (plan.question) {
      setPendingSwitch(plan);
      return;
    }
    applySwitch(plan);
  };

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore.current) return;
    loadingMore.current = true;
    try {
      const next = await resultsService.list(saved.length, RESULTS_PAGE_SIZE);
      setSaved((current) => [...current, ...next.filter((row) => !current.some((item) => item.id === row.id))]);
      setHasMore(next.length === RESULTS_PAGE_SIZE);
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      loadingMore.current = false;
    }
  }, [hasMore, saved.length, userId]);

  const restoreRow = async (id: string) => {
    setRowBusy(id);
    try {
      await archiveService.restoreResult(id, userId);
      setDeletedRows((current) => current.filter((row) => row.id !== id));
      setNote(RESTORED_TOAST);
      await load();
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setRowBusy(null);
    }
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 200) loadMore();
  };

  // Only ticked games that are on screen count; a game hidden by a chip never rides along.
  const selected = useMemo(() => visibleSelection(checked, shownGames), [checked, shownGames]);

  const tooMany = selected.length > 0 && !withinResultsPlayerLimit(selected.map((game) => ({
    players: game.players,
    scores: game.scores,
    names,
  })));

  const toggle = (game: Game) => {
    if (!canPickForResults(game, userId)) {
      setNotAdmin(game);
      return;
    }
    if (poolNeedsAwards(game)) {
      setNeedsAwards(game);
      return;
    }
    touched.current = true;
    setChecked((current) => (current.includes(game.id) ? current.filter((item) => item !== game.id) : [...current, game.id]));
  };

  /** Show results only shows. Saving (which closes the games) is a separate step on the results page. */
  const show = () => {
    if (selected.length === 0 || tooMany) return;
    router.push({
      pathname: '/(screens)/results/view',
      params: { ids: selected.map((game) => game.id).join(','), at: new Date().toISOString() },
    });
  };

  const runsAGame = useMemo(() => games.some((game) => canPickForResults(game, userId)), [games, userId]);
  const showPicker = pickerOpen ?? (loading || runsAGame);

  const picker = (
    <>
      <TitleWithTip variant="titleMedium" title={resultsPickerHeading(filter)} tip={{ title: 'Make a result', text: PICKER_TIP, topic: 'results', anchor: 'the-preview', testID: 'results-picker-tip' }} />
      <View style={styles.filterRow}>
        {RESULTS_STATUSES.map((option) => {
          const on = filter.includes(option);
          return (
            <Chip
              key={option}
              selected={on}
              showSelectedCheck
              mode={on ? 'flat' : 'outlined'}
              onPress={() => flipStatus(option)}
              style={[styles.filterChip, on && { backgroundColor: colors.primary }]}
              textStyle={on ? { color: colors.onPrimary } : undefined}
              selectedColor={on ? colors.onPrimary : undefined}
              accessibilityRole="checkbox"
              accessibilityLabel={`${RESULTS_FILTER_LABEL[option]} games`}
              accessibilityState={{ checked: on }}
            >
              {RESULTS_FILTER_LABEL[option]}
            </Chip>
          );
        })}
      </View>
      <Text variant="titleSmall" testID="results-selected-count" accessibilityLiveRegion="polite" style={{ color: colors.onSurfaceVariant }}>
        {selectedCountLine(selected.length)}
      </Text>
      {error ? (
        <View>
          <Text style={{ color: colors.error }}>{error}</Text>
          <Button onPress={load}>Retry</Button>
        </View>
      ) : null}
      {loading && games.length === 0 ? <LoadingRows /> : null}
      {!loading && shownGames.length === 0 ? (
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>{resultsEmptyText(games, filter)}</Text>
      ) : null}
      <View style={styles.list}>
        {shownGames.map((game) => (
          <GameListItem
            key={game.id}
            game={game}
            viewerId={userId}
            checked={checked.includes(game.id)}
            locked={!canPickForResults(game, userId) || poolNeedsAwards(game)}
            lockedNote={canPickForResults(game, userId) && poolNeedsAwards(game) ? GIVE_AWARDS_FIRST : undefined}
            onPress={() => toggle(game)}
          />
        ))}
      </View>
      {tooMany ? <Text style={{ color: colors.error }}>{RESULTS_PLAYER_LIMIT}</Text> : null}
      <Button
        mode="contained"
        icon="view-list"
        onPress={show}
        disabled={selected.length === 0 || tooMany}
        accessibilityLabel="Show results"
      >
        Show results
      </Button>
    </>
  );

  // Non-admins (Q10.13): a one-line "Make a result ▾" header folds the picker away; a tap opens it.
  const makeResultHeader = !loading && !runsAGame ? (
    <TouchableRipple
      onPress={() => setPickerOpen((cur) => !(cur ?? false))}
      borderless
      style={[styles.foldRow, { borderColor: colors.outlineVariant, backgroundColor: colors.surface }]}
      accessibilityRole="button"
      accessibilityState={{ expanded: showPicker }}
      accessibilityLabel={showPicker ? 'Hide make a result' : 'Make a result'}
      testID="results-make-fold"
    >
      <View style={styles.foldInner}>
        <Icon source="plus-box-outline" size={20} color={colors.onSurfaceVariant} />
        <Text variant="titleSmall" style={styles.flex}>Make a result</Text>
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{MAKE_RESULT_FOLD_NOTE}</Text>
        <Icon source={showPicker ? 'chevron-up' : 'chevron-down'} size={22} color={colors.onSurfaceVariant} />
      </View>
    </TouchableRipple>
  ) : null;

  return (
    <Screen onScroll={onScroll}>
      {makeResultHeader}
      {showPicker ? picker : null}
      <SectionCard title="Past results" icon="podium" tip={{ text: 'Tap one to open it, share it, or save the PDF. Its ⋮ has Copy link, History and Delete result.', topic: 'results', anchor: 'a-saved-result', testID: 'past-results-tip' }}>
        {saved.length === 0 ? (
          <EmptyState icon="podium" title="No results yet" message="Pick completed games above and make a result; it will be listed here." />
        ) : (
          <View style={styles.list}>
            {saved.map((item) => (
              <PastResult key={item.id} item={item} />
            ))}
          </View>
        )}
        {hasMore ? (
          <Button mode="text" onPress={loadMore} accessibilityLabel="Show more past results">Show more</Button>
        ) : null}
        {deletedRows.length > 0 ? (
          <View style={styles.deletedSection} testID="deleted-results">
            <View style={styles.deletedTitle}>
              <Text variant="titleSmall" accessibilityRole="header" style={{ color: colors.onSurfaceVariant }}>{DELETED_SECTION_TITLE}</Text>
              <InfoTip title={DELETED_SECTION_TITLE} text={DELETED_SECTION_NOTE} topic="hidden-deleted" anchor="results" testID="deleted-results-note-tip" />
            </View>
            <View style={styles.list}>
              {deletedRows.map((row) => <DeletedResult key={row.id} row={row} busy={rowBusy === row.id} onRestore={() => restoreRow(row.id)} />)}
            </View>
          </View>
        ) : null}
      </SectionCard>
      <Toast message={note} onDismiss={() => setNote(null)} aboveBar />

      <Portal>
        <Dialog visible={Boolean(pendingSwitch)} onDismiss={() => setPendingSwitch(null)} style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Dialog.Icon icon="checkbox-marked-outline" />
          <Dialog.Title>Deselect games?</Dialog.Title>
          <Dialog.Content><Text variant="bodyMedium">{pendingSwitch?.question}</Text></Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPendingSwitch(null)} accessibilityLabel="Keep the selection">Cancel</Button>
            <Button mode="contained" onPress={() => pendingSwitch && applySwitch(pendingSwitch)} accessibilityLabel="Deselect and switch" testID="deselect-confirm">Deselect</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={Boolean(needsAwards)} onDismiss={() => setNeedsAwards(null)} style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Dialog.Icon icon="trophy-outline" />
          <Dialog.Title>{GIVE_AWARDS_FIRST}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">A pool joins a result through its awards. Open the pool, give the awards, then pick it here.</Text>
            <WhyLink why="giveAwardsFirst" before={() => setNeedsAwards(null)} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setNeedsAwards(null)}>Not now</Button>
            <Button mode="contained" onPress={() => { const g = needsAwards; setNeedsAwards(null); if (g) router.push({ pathname: '/(screens)/games/award', params: { id: g.id } }); }}>Give awards</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={Boolean(notAdmin)} onDismiss={() => setNotAdmin(null)} style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Dialog.Icon icon="lock-outline" />
          <Dialog.Title>Not an admin</Dialog.Title>
          <Dialog.Content><Text variant="bodyMedium">{NON_ADMIN_PICK_MESSAGE}</Text></Dialog.Content>
          <Dialog.Actions><Button mode="contained" onPress={() => setNotAdmin(null)}>OK</Button></Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  deletedTitle: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  left: { textAlign: 'left' },
  list: { gap: spacing.sm },
  ripple: { borderRadius: radius.lg },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  filterChip: { borderRadius: radius.full },
  flex: { flex: 1 },
  foldRow: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  foldInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  past: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderLeftWidth: 5,
    overflow: 'hidden',
  },
  pastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  winner: { alignItems: 'center', gap: 2 },
  pastBody: { flex: 1, gap: 4, alignItems: 'stretch' },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  placeLabel: { width: 36, fontWeight: '700' },
  placeName: { flex: 1, fontWeight: '600' },
  placePoints: { fontWeight: '800' },
  deletedRow: { opacity: 0.85 },
  deletedSection: { gap: spacing.sm, marginTop: spacing.md },
  dialog: { borderRadius: radius.xl, maxWidth: 520, width: '94%', alignSelf: 'center' },
});

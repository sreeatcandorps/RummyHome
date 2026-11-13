import React, { useCallback, useMemo, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, StyleSheet, View } from 'react-native';
import { Chip, Dialog, Icon, Portal, Snackbar, Text, TouchableRipple } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { router, useFocusEffect } from 'expo-router';
import { GameListItem } from '@/components/ui/GameListItem';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { Screen } from '@/components/ui/Screen';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { SectionCard } from '@/components/ui/SectionCard';
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
} from '@/utils/resultsSave';
import {
  DELETED_SECTION_NOTE,
  DELETED_SECTION_TITLE,
  DELETED_TAG,
  deletedToast,
  deleteRowLabel,
  listedDeleted,
  RESTORE_RESULT_BUTTON,
  RESTORED_TOAST,
  restoreRowLabel,
  SHARED_CONFIRM_BODY,
  SHARED_CONFIRM_TITLE,
  UNDO_DELETE_MS,
} from '@/utils/resultsDelete';
import { sharedResults } from '@/utils/sharedResults';
import { storage } from '@/utils/storage';
import { formatSupabaseError } from '@/utils/supabaseErrors';

function newestFirst(a: Game, b: Game): number {
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}

/** One saved result: the winner's initials under a crown, then 1st/2nd/3rd on their own rows; Delete on the row for its admins (PR 9). */
function PastResult({ item, canDelete, onDelete }: { item: GameResultSummary; canDelete: boolean; onDelete: () => void }) {
  const { colors } = useAppTheme();
  const rows = pastResultRows(item.top);
  const reused = resultReusedNote(item.reusedCount);
  const when = formatGameDateTime(item.declaredAt);
  return (
    <View style={[styles.past, { backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderLeftColor: colors.secondary }]}>
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
          {canDelete ? (
            <Chip
              compact
              mode="flat"
              onPress={onDelete}
              style={{ backgroundColor: colors.errorContainer }}
              textStyle={{ color: colors.onErrorContainer, fontWeight: '700' }}
              accessibilityLabel={deleteRowLabel(when)}
              testID={`past-result-delete-${item.id}`}
            >
              Delete
            </Chip>
          ) : (
            <Icon source="chevron-right" size={24} color={colors.onSurfaceVariant} />
          )}
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
        <Chip
          compact
          mode="flat"
          onPress={onRestore}
          disabled={busy}
          style={{ backgroundColor: colors.positiveContainer }}
          textStyle={{ color: colors.onPositiveContainer, fontWeight: '700' }}
          accessibilityLabel={restoreRowLabel(when)}
          testID={`deleted-result-restore-${row.id}`}
        >
          {RESTORE_RESULT_BUTTON}
        </Chip>
      </View>
    </View>
  );
}

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
  const loadingMore = useRef(false);
  /** PR 9: which listed results the viewer may delete, the deleted ones still inside 30 days, and the Undo toast. */
  const [manageable, setManageable] = useState<Set<string>>(new Set());
  const [deletedRows, setDeletedRows] = useState<DeletedResultRow[]>([]);
  const [undoRow, setUndoRow] = useState<GameResultSummary | null>(null);
  const undone = useRef(false);
  const [sharedConfirm, setSharedConfirm] = useState<GameResultSummary | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

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
      archiveService.manageableResults(first.map((row) => row.id), id).then(setManageable).catch(() => {});
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
      archiveService.manageableResults(next.map((row) => row.id), userId)
        .then((more) => setManageable((current) => new Set([...current, ...more])))
        .catch(() => {});
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      loadingMore.current = false;
    }
  }, [hasMore, saved.length, userId]);

  /** Delete on a Past results row: at once with Undo, or after a question when it was shared from here (D9.2). */
  const askDelete = async (item: GameResultSummary) => {
    if (await sharedResults.was(item.id).catch(() => false)) setSharedConfirm(item);
    else deleteRow(item);
  };

  const deleteRow = async (item: GameResultSummary) => {
    setSharedConfirm(null);
    setRowBusy(item.id);
    try {
      await archiveService.deleteResult(item.id, userId);
      undone.current = false;
      setSaved((current) => current.filter((row) => row.id !== item.id));
      setDeletedRows((current) => listedDeleted([
        { id: item.id, declaredAt: item.declaredAt, deletedAt: new Date().toISOString(), deletedByMe: true, deletedByName: '', gameCount: item.gameCount, playerCount: item.playerCount },
        ...current.filter((row) => row.id !== item.id),
      ]));
      setUndoRow(item);
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setRowBusy(null);
    }
  };

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

  const undoDelete = () => {
    if (!undoRow) return;
    undone.current = true;
    const id = undoRow.id;
    setUndoRow(null);
    restoreRow(id);
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

  return (
    <Screen onScroll={onScroll}>
      <Text variant="titleMedium" accessibilityRole="header">{resultsPickerHeading(filter)}</Text>
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
            locked={!canPickForResults(game, userId)}
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
      <SectionCard title="Past results" icon="podium" supportingText="Tap one to open it, share it, or save the PDF.">
        {saved.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>None yet.</Text>
        ) : (
          <View style={styles.list}>
            {saved.map((item) => (
              <PastResult key={item.id} item={item} canDelete={manageable.has(item.id) && rowBusy !== item.id} onDelete={() => askDelete(item)} />
            ))}
          </View>
        )}
        {hasMore ? (
          <Button mode="text" onPress={loadMore} accessibilityLabel="Show more past results">Show more</Button>
        ) : null}
        {deletedRows.length > 0 ? (
          <View style={styles.deletedSection} testID="deleted-results">
            <Text variant="titleSmall" accessibilityRole="header" style={{ color: colors.onSurfaceVariant }}>{DELETED_SECTION_TITLE}</Text>
            <View style={styles.list}>
              {deletedRows.map((row) => <DeletedResult key={row.id} row={row} busy={rowBusy === row.id} onRestore={() => restoreRow(row.id)} />)}
            </View>
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{DELETED_SECTION_NOTE}</Text>
          </View>
        ) : null}
      </SectionCard>
      <Snackbar
        visible={Boolean(undoRow)}
        onDismiss={() => setUndoRow(null)}
        duration={UNDO_DELETE_MS}
        action={{ label: 'Undo', onPress: undoDelete, accessibilityLabel: 'Undo delete result' }}
        testID="past-result-delete-undo"
      >
        {undoRow ? deletedToast([]) : ''}
      </Snackbar>
      <Snackbar visible={Boolean(note)} onDismiss={() => setNote(null)} duration={3000}>{note ?? ''}</Snackbar>

      <Portal>
        <Dialog visible={Boolean(pendingSwitch)} onDismiss={() => setPendingSwitch(null)} style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Dialog.Icon icon="checkbox-marked-outline" />
          <Dialog.Title>Deselect games?</Dialog.Title>
          <Dialog.Content><Text variant="bodyMedium">{pendingSwitch?.question}</Text></Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPendingSwitch(null)} accessibilityLabel="Keep the selection">Cancel</Button>
            <Button mode="contained" onPress={() => pendingSwitch && applySwitch(pendingSwitch)} accessibilityLabel="Deselect and switch">OK</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={Boolean(sharedConfirm)} onDismiss={() => setSharedConfirm(null)} style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Dialog.Icon icon="share-variant" />
          <Dialog.Title>{SHARED_CONFIRM_TITLE}</Dialog.Title>
          <Dialog.Content><Text variant="bodyMedium">{SHARED_CONFIRM_BODY}</Text></Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSharedConfirm(null)} accessibilityLabel="Keep the result">Cancel</Button>
            <Button mode="contained" buttonColor={colors.error} textColor={colors.onError} onPress={() => sharedConfirm && deleteRow(sharedConfirm)} accessibilityLabel="Delete the shared result">Delete</Button>
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
  left: { textAlign: 'left' },
  list: { gap: spacing.sm },
  ripple: { borderRadius: radius.lg },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  filterChip: { borderRadius: radius.full },
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

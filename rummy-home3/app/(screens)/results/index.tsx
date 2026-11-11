import React, { useCallback, useMemo, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, Icon, Portal, Text, TouchableRipple } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { GameListItem } from '@/components/ui/GameListItem';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { Screen } from '@/components/ui/Screen';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { SectionCard } from '@/components/ui/SectionCard';
import { Tag } from '@/components/ui/Tag';
import { RESULTS_PLAYER_LIMIT } from '@/constants/limits';
import { radius, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { authService } from '@/services/auth';
import { gamesService } from '@/services/games';
import { resultsService } from '@/services/results';
import { isSupabaseConfigured } from '@/services/supabase';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
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
import { storage } from '@/utils/storage';
import { formatSupabaseError } from '@/utils/supabaseErrors';

function seatedNames(players: Player[]): Record<string, string> {
  const names: Record<string, string> = {};
  players.forEach((player) => {
    if (player.id === 'EX' || player.seated === false || player.seatRole === 'spectator') return;
    if (player.name?.trim()) names[player.id] = player.name.trim();
  });
  return names;
}

function newestFirst(a: Game, b: Game): number {
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}

/** One saved result: the winner's initials under a crown, then 1st/2nd/3rd on their own rows. */
function PastResult({ item }: { item: GameResultSummary }) {
  const { colors } = useAppTheme();
  const rows = pastResultRows(item.top);
  const reused = resultReusedNote(item.reusedCount);
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
            <SeatAvatar name={rows[0]?.name ?? '?'} label={winnerInitials(item.top)} color={colors.primary} size={44} />
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
                  <Text variant="bodyLarge" style={[tabularNums, styles.placePoints, { color: row.points.startsWith('-') ? colors.negative : colors.positive }]}>{row.points}</Text>
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
      // Every game the person is in. Ones they do not run are listed but cannot be ticked.
      const visible = await gamesService.listGamesForCurrentUser(id, {
        includeScores: true,
        email: player?.email,
      });
      const listedGames = selectableResultGames(visible).sort(newestFirst);
      setGames(listedGames);
      const listed = await Promise.all(listedGames.map((game) => gamesService.listGamePlayers(game.id).catch(() => [] as Player[])));
      const merged: Record<string, string> = {};
      listed.forEach((players) => Object.assign(merged, seatedNames(players)));
      setNames(merged);
      const first = await resultsService.list(0, RESULTS_PAGE_SIZE);
      setSaved(first);
      setHasMore(first.length === RESULTS_PAGE_SIZE);
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
  }, [hasMore, saved.length]);

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
            {saved.map((item) => <PastResult key={item.id} item={item} />)}
          </View>
        )}
        {hasMore ? (
          <Button mode="text" onPress={loadMore} accessibilityLabel="Show more past results">Show more</Button>
        ) : null}
      </SectionCard>

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
  dialog: { borderRadius: radius.xl, maxWidth: 520, width: '94%', alignSelf: 'center' },
});

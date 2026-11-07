import React, { useCallback, useMemo, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, StyleSheet, View } from 'react-native';
import { Button, Chip, Icon, Text, TouchableRipple } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { Screen } from '@/components/ui/Screen';
import { SectionCard } from '@/components/ui/SectionCard';
import { Tag } from '@/components/ui/Tag';
import { RESULTS_PLAYER_LIMIT } from '@/constants/limits';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { authService } from '@/services/auth';
import { gamesService } from '@/services/games';
import { resultsService } from '@/services/results';
import { isSupabaseConfigured } from '@/services/supabase';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { formatGameDateTime, GAME_STATUS_ICON, GAME_STATUS_TONE, gameNumberLabel, gameStatusLabel, gameTypeLabel, gameTypeTint } from '@/utils/gameDisplay';
import { ResultWarnings } from '@/components/results/ResultWarnings';
import {
  canDeclareResults,
  formatPoints,
  GameResultSummary,
  placeLabel,
  RESULTS_PAGE_SIZE,
  resultsCountLine,
  resultsShowMode,
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
  resultWarnings,
  toggleResultsStatus,
  visibleSelection,
  withinResultsPlayerLimit,
} from '@/utils/results';
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

function GameRow({ game, on, onPress }: { game: Game; on: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  const tint = gameTypeTint(game.gameType, theme.gameTypes);
  const status = gameStatusLabel(game);
  const open = status === 'Active';
  const closed = status === 'Closed';
  const gNumber = gameNumberLabel(game);
  const when = formatGameDateTime(game.date);
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: on ? theme.colors.primaryContainer : theme.colors.surface,
          borderColor: on ? theme.colors.primary : theme.colors.outlineVariant,
          borderLeftColor: open ? theme.colors.positive : theme.colors.outline,
        },
      ]}
    >
      <TouchableRipple
        onPress={onPress}
        borderless
        style={styles.ripple}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        accessibilityLabel={`${gNumber ?? 'Game'}, ${when}, ${closed ? 'closed, already in a result' : open ? 'open' : 'completed'}, ${gameTypeLabel(game.gameType)}`}
      >
        <View style={styles.rowInner}>
          <Icon source={on ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} color={on ? theme.colors.primary : theme.colors.onSurfaceVariant} />
          {gNumber ? (
            <View style={[styles.badge, { backgroundColor: tint.container }]}>
              <Text style={[styles.badgeText, { color: tint.on }]}>{gNumber}</Text>
            </View>
          ) : null}
          <View style={styles.rowBody}>
            <Text variant="titleSmall" style={styles.left} numberOfLines={1}>{when}</Text>
            <View style={styles.meta}>
              <Tag label={status} tone={GAME_STATUS_TONE[status]} icon={GAME_STATUS_ICON[status]} />
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{gameTypeLabel(game.gameType)}</Text>
            </View>
          </View>
        </View>
      </TouchableRipple>
    </View>
  );
}

function PastResult({ item }: { item: GameResultSummary }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.past, { backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderLeftColor: colors.secondary }]}>
      <TouchableRipple
        onPress={() => router.push(`/(screens)/results/${item.id}`)}
        borderless
        style={styles.ripple}
        accessibilityRole="button"
        accessibilityLabel={`Open results from ${formatGameDateTime(item.declaredAt)}`}
      >
        <View style={styles.pastInner}>
          <View style={[styles.pastBadge, { backgroundColor: colors.secondaryContainer }]}>
            <Icon source="podium" size={22} color={colors.onSecondaryContainer} />
          </View>
          <View style={styles.pastBody}>
            <Text variant="titleSmall" style={styles.left} numberOfLines={1}>{formatGameDateTime(item.declaredAt)}</Text>
            <View style={styles.meta}>
              <Tag label="Results" tone="results" icon="podium" />
              <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{resultsCountLine(item.gameCount, item.playerCount)}</Text>
            </View>
            {item.top.length === 0 ? (
              <Text variant="bodySmall" numberOfLines={1} style={{ color: colors.onSurfaceVariant }}>{item.winnerLine}</Text>
            ) : (
              <Text variant="bodySmall" numberOfLines={2} style={{ color: colors.onSurfaceVariant }}>
                {item.top.map((row) => `${placeLabel(row.place)} ${row.name} ${formatPoints(row.points)}`).join('  ·  ')}
              </Text>
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
  const [busy, setBusy] = useState(false);
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
        ? current.filter((gameId) => listedGames.some((game) => game.id === gameId))
        : defaultResultSelection(listedGames, filter)));
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

  const flipStatus = (status: ResultsStatus) => {
    const next = toggleResultsStatus(filter, status);
    touched.current = false;
    setFilter(next);
    setChecked(defaultResultSelection(games, next));
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

  const warnings = useMemo(() => resultWarnings(selected), [selected]);
  const tooMany = selected.length > 0 && !withinResultsPlayerLimit(selected.map((game) => ({
    players: game.players,
    scores: game.scores,
    names,
  })));

  const toggle = (id: string) => {
    touched.current = true;
    setChecked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const preview = (reason: 'open' | 'admin') => {
    router.push({
      pathname: '/(screens)/results/view',
      params: { ids: selected.map((game) => game.id).join(','), at: new Date().toISOString(), preview: reason },
    });
  };

  const show = async () => {
    if (selected.length === 0 || tooMany || busy) return;
    if (resultsShowMode(selected) === 'preview') {
      preview('open');
      return;
    }
    if (!userId || !canDeclareResults(selected, userId)) {
      preview('admin');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await resultsService.declare({ games: selected, names, userId });
      touched.current = false;
      setChecked([]);
      router.push(`/(screens)/results/${result.id}`);
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setBusy(false);
    }
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
          <GameRow key={game.id} game={game} on={checked.includes(game.id)} onPress={() => toggle(game.id)} />
        ))}
      </View>
      {tooMany ? <Text style={{ color: colors.error }}>{RESULTS_PLAYER_LIMIT}</Text> : null}
      <ResultWarnings warnings={warnings} />
      <Button
        mode="contained"
        icon="view-list"
        onPress={show}
        disabled={selected.length === 0 || tooMany || busy}
        loading={busy}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  left: { textAlign: 'left' },
  list: { gap: spacing.sm },
  flex: { flex: 1 },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderLeftWidth: 5,
    overflow: 'hidden',
  },
  ripple: { borderRadius: radius.lg },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  badge: {
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { fontWeight: '800', fontSize: 15 },
  rowBody: { flex: 1, gap: 4, alignItems: 'flex-start' },
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
  pastBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pastBody: { flex: 1, gap: 4, alignItems: 'flex-start' },
});

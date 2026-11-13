import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Chip, Text } from 'react-native-paper';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Button } from '@/components/ui/AppButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { HelpButton } from '@/components/ui/HelpButton';
import { Screen } from '@/components/ui/Screen';
import { LogRow } from '@/components/log/LogRow';
import { HELP } from '@/constants/help';
import { spacing, useAppTheme } from '@/constants/theme';
import { eventLogService } from '@/services/eventLog';
import { gamesService } from '@/services/games';
import { defaultLogFilter, groupByDay, LogEntry, LogFilter } from '@/utils/eventLog';
import { gameLabelOf } from '@/utils/gameLabel';
import { formatSupabaseError } from '@/utils/supabaseErrors';

const FILTER_KEY = 'ezscore.gameLogFilter';

function FilterChip({ label, on, onPress, testID }: { label: string; on: boolean; onPress: () => void; testID: string }) {
  const { colors } = useAppTheme();
  return (
    <Chip
      selected={on}
      showSelectedCheck
      mode={on ? 'flat' : 'outlined'}
      onPress={onPress}
      style={[styles.chip, on && { backgroundColor: colors.primary }]}
      textStyle={on ? { color: colors.onPrimary } : undefined}
      selectedColor={on ? colors.onPrimary : undefined}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      testID={testID}
    >
      {label}
    </Chip>
  );
}

/**
 * The game log (036): every change to this game, newest first, grouped by day, with an
 * All / Important filter (All while the game is active, Important once it is completed; the
 * last choice is remembered on this phone). New rows arrive live. Visible to every member,
 * including view-only players.
 */
export default function GameLogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = typeof id === 'string' ? id : undefined;
  const { colors } = useAppTheme();
  const game = gamesService.peekGame(gameId);
  const [filter, setFilter] = useState<LogFilter | null>(null);
  const [rows, setRows] = useState<LogEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(FILTER_KEY)
      .then((saved) => {
        if (!alive) return;
        setFilter(saved === 'all' || saved === 'important' ? saved : defaultLogFilter(game));
      })
      .catch(() => { if (alive) setFilter(defaultLogFilter(game)); });
    return () => { alive = false; };
    // The default depends only on the game's state when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async (level: LogFilter) => {
    if (!gameId) return;
    const request = ++requestRef.current;
    setLoading(true);
    try {
      const page = await eventLogService.listGameLog(gameId, level);
      if (request !== requestRef.current) return;
      setRows(page.rows);
      setHasMore(page.hasMore);
      setError(null);
    } catch (e) {
      if (request !== requestRef.current) return;
      setError(formatSupabaseError(e));
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    if (filter) void load(filter);
  }, [filter, load]);

  useEffect(() => {
    if (!gameId || !filter) return;
    const channel = eventLogService.subscribeToGameLog(gameId, (entry) => {
      if (filter === 'important' && entry.level !== 'important') return;
      setRows((current) => (current.some((row) => row.id === entry.id) ? current : [entry, ...current]));
    });
    return () => eventLogService.unsubscribe(channel);
  }, [gameId, filter]);

  const changeFilter = (next: LogFilter) => {
    if (next === filter) return;
    setFilter(next);
    AsyncStorage.setItem(FILTER_KEY, next).catch(() => {});
  };

  const loadMore = async () => {
    if (!gameId || !filter || loadingMore || rows.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = rows[rows.length - 1].id;
      const page = await eventLogService.listGameLog(gameId, filter, oldest);
      setRows((current) => {
        const known = new Set(current.map((row) => row.id));
        return [...current, ...page.rows.filter((row) => !known.has(row.id))];
      });
      setHasMore(page.hasMore);
    } catch (e) {
      setError(formatSupabaseError(e));
    } finally {
      setLoadingMore(false);
    }
  };

  const groups = useMemo(() => groupByDay(rows), [rows]);
  const title = game ? `Log · ${gameLabelOf(game)}` : 'Log';

  return (
    <Screen>
      <Stack.Screen options={{ title, headerRight: () => <HelpButton text={HELP.gameLog} /> }} />
      <View style={styles.filterRow} testID="game-log-filters">
        <FilterChip label="All" on={filter === 'all'} onPress={() => changeFilter('all')} testID="game-log-filter-all" />
        <FilterChip label="Important" on={filter === 'important'} onPress={() => changeFilter('important')} testID="game-log-filter-important" />
      </View>
      {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}
      {loading && rows.length === 0 ? (
        <ActivityIndicator style={styles.spinner} />
      ) : rows.length === 0 && !error ? (
        <EmptyState
          icon="history"
          title={filter === 'important' ? 'No important changes yet' : 'Nothing logged yet'}
          message={filter === 'important' ? 'Switch to All to see every change.' : 'Changes to this game will appear here as they happen.'}
        />
      ) : (
        groups.map((group) => (
          <View key={group.key} testID={`game-log-day-${group.key}`}>
            <Text variant="labelLarge" style={[styles.day, { color: colors.onSurfaceVariant }]}>{group.day}</Text>
            {group.entries.map((entry, index) => (
              group === groups[0] && index === 0
                ? <LogRow key={entry.id} entry={entry} testID="game-log-first-row" />
                : <LogRow key={entry.id} entry={entry} />
            ))}
          </View>
        ))
      )}
      {hasMore ? (
        <Button mode="outlined" onPress={loadMore} loading={loadingMore} disabled={loadingMore} testID="game-log-show-earlier">
          Show earlier
        </Button>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  chip: { marginRight: spacing.xs },
  day: { marginTop: spacing.md, marginBottom: spacing.xs },
  spinner: { marginTop: spacing.xl },
});

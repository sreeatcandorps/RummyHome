import React, { useCallback, useMemo, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, StyleSheet, View } from 'react-native';
import { Button, Icon, Text, TouchableRipple } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { Screen } from '@/components/ui/Screen';
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
import { formatGameDateTime, gameNumberLabel, gameStatusLabel, gameTypeLabel, gameTypeTint } from '@/utils/gameDisplay';
import {
  canDeclareResults,
  formatPoints,
  GameResultSummary,
  placeLabel,
  RESULTS_PAGE_SIZE,
  resultsCountLine,
  resultsShowMode,
  selectableResultGames,
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
  const open = gameStatusLabel(game) === 'Active';
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
        accessibilityLabel={`${gNumber ?? 'Game'}, ${when}, ${open ? 'open' : 'completed'}, ${gameTypeLabel(game.gameType)}`}
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
              <Tag label={open ? 'Active' : 'Completed'} tone={open ? 'positive' : 'neutral'} icon={open ? 'circle-medium' : 'flag-checkered'} />
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
    <TouchableRipple
      onPress={() => router.push(`/(screens)/results/${item.id}`)}
      style={[styles.past, { borderColor: colors.outlineVariant }]}
      accessibilityRole="button"
      accessibilityLabel={`View results from ${formatGameDateTime(item.declaredAt)}`}
    >
      <View style={styles.pastInner}>
        <View style={styles.pastHead}>
          <Text variant="titleSmall" style={styles.left}>{formatGameDateTime(item.declaredAt)}</Text>
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{resultsCountLine(item.gameCount, item.playerCount)}</Text>
        </View>
        {item.top.length === 0 ? (
          <Text variant="bodyMedium">{item.winnerLine}</Text>
        ) : item.top.map((row) => (
          <View key={`${row.place}-${row.name}`} style={styles.topRow}>
            <Text variant="bodyMedium" style={styles.topPlace}>{placeLabel(row.place)}</Text>
            <Text variant="bodyMedium" style={styles.topName} numberOfLines={1}>{row.name}</Text>
            <Text variant="bodyMedium" style={[tabularNums, styles.topPoints, { color: row.points < 0 ? colors.error : colors.primary }]}>
              {formatPoints(row.points)}
            </Text>
          </View>
        ))}
      </View>
    </TouchableRipple>
  );
}

export default function ResultsScreen() {
  const { colors } = useAppTheme();
  const [games, setGames] = useState<Game[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<GameResultSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
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
      setChecked((current) => current.filter((gameId) => listedGames.some((game) => game.id === gameId)));
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

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

  const selected = useMemo(
    () => checked.map((id) => games.find((game) => game.id === id)).filter((game): game is Game => Boolean(game)),
    [checked, games],
  );

  const tooMany = selected.length > 0 && !withinResultsPlayerLimit(selected.map((game) => ({
    players: game.players,
    scores: game.scores,
    names,
  })));

  const toggle = (id: string) => {
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
      <Text variant="bodyLarge" style={styles.left}>
        Select games and then show the results.
      </Text>
      {error ? (
        <View>
          <Text style={{ color: colors.error }}>{error}</Text>
          <Button onPress={load}>Retry</Button>
        </View>
      ) : null}
      {loading && games.length === 0 ? <LoadingRows /> : null}
      {!loading && games.length === 0 ? (
        <Text variant="bodyLarge">No games to add up yet. Start a game from Home, then select it here.</Text>
      ) : null}
      <View style={styles.list}>
        {games.map((game) => (
          <GameRow key={game.id} game={game} on={checked.includes(game.id)} onPress={() => toggle(game.id)} />
        ))}
      </View>
      {tooMany ? <Text style={{ color: colors.error }}>{RESULTS_PLAYER_LIMIT}</Text> : null}
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
      <SectionCard title="Past results">
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
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  past: { borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: radius.md },
  pastInner: { padding: spacing.md, gap: 4 },
  pastHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  topPlace: { width: 36, fontWeight: '800' },
  topName: { flex: 1 },
  topPoints: { fontWeight: '800' },
});

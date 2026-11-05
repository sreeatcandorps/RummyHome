import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Button, IconButton, Menu, Searchbar, SegmentedButtons, Text } from 'react-native-paper';
import { router, Stack, useFocusEffect } from 'expo-router';
import { Player } from '@/types/player';
import { gamesService } from '@/services/games';
import { authService } from '@/services/auth';
import { playerIdentityService } from '@/services/playerIdentity';
import { userSettingsService } from '@/services/userSettings';
import { isSupabaseConfigured } from '@/services/supabase';
import { storage } from '@/utils/storage';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { isNotReadyMessage } from '@/utils/notReady';
import { matchesMyPlayer } from '@/utils/playerSearch';
import { takePlayersToCheck } from '@/utils/pendingPlayer';
import { DEFAULT_POINTS_RULES, gameTypeForKind, PointsRules } from '@/utils/gameSettings';
import { Candidate, CandidateSort, newGameGrid, newGameSeats, orderCandidates, PICKER_PAGE } from '@/utils/playerIdentity';
import { DraftPick, newGameDraft } from '@/utils/newGameDraft';
import { SelectedPlayersStrip } from '@/components/players/SelectedPlayersStrip';
import { BoldName } from '@/components/ui/BoldName';
import { MAX_SEATED_PLAYERS, SEATED_PLAYER_LIMIT } from '@/constants/limits';
import { HELP } from '@/constants/help';
import { Screen } from '@/components/ui/Screen';
import { BottomBar } from '@/components/ui/BottomBar';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { HelpButton } from '@/components/ui/HelpButton';
import { GameSettingsDialog } from '@/components/game/GameSettingsDialog';
import { playerIdBadge, registrationLabel } from '@/utils/myPlayersList';
import { Tag } from '@/components/ui/Tag';
import { REGISTRATION_TONE } from '@/utils/myPlayersList';
import { radius, spacing, useAppTheme } from '@/constants/theme';

type Pick = DraftPick;

/**
 * "Playing · N". The number sits in a big yellow badge with a soft green halo
 * that keeps breathing while anyone is seated, and it pops each time N changes.
 */
function PlayingCount({ count }: { count: number }) {
  const { colors } = useAppTheme();
  const pop = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    pop.setValue(0);
    Animated.sequence([
      Animated.timing(pop, { toValue: 1, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(pop, { toValue: 0, duration: 460, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
    ]).start();
  }, [count, pop]);

  useEffect(() => {
    if (count === 0) { halo.stopAnimation(); halo.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(halo, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(halo, { toValue: 0, duration: 1100, easing: Easing.in(Easing.quad), useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [count === 0, halo]);

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const fill = pop.interpolate({ inputRange: [0, 1], outputRange: [colors.secondaryContainer, colors.positiveContainer] });
  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const haloOpacity = halo.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.05] });
  const seated = count > 0;

  return (
    <View style={styles.playingRow} accessibilityLiveRegion="polite" accessibilityLabel={`Playing, ${count} ${count === 1 ? 'player' : 'players'}`}>
      <Text variant="titleLarge" style={{ color: colors.onSurface, fontWeight: '800' }}>Playing</Text>
      <View style={styles.countWrap}>
        {seated ? <Animated.View pointerEvents="none" style={[styles.countHalo, { backgroundColor: colors.primary, opacity: haloOpacity, transform: [{ scale: haloScale }] }]} /> : null}
        <Animated.View style={[styles.countBubble, { backgroundColor: seated ? fill : colors.surfaceVariant, borderColor: seated ? colors.primary : colors.outlineVariant, transform: [{ scale }] }]}>
          <Text style={[styles.countText, { color: seated ? colors.onSecondaryContainer : colors.onSurfaceVariant }]}>{count}</Text>
        </Animated.View>
      </View>
      <Text variant="bodyMedium" style={[styles.flex, { color: colors.onSurfaceVariant }]}>
        {count === 0 ? 'Nobody yet. Tap players below; tap yourself if you are playing.' : count === 1 ? 'player · pick one more to start' : 'players'}
      </Text>
    </View>
  );
}

export default function NewGame() {
  const { colors } = useAppTheme();
  const [me, setMe] = useState<Player | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Pick[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<CandidateSort>('frequent');
  const [rules, setRules] = useState<PointsRules>(DEFAULT_POINTS_RULES);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const userId = isSupabaseConfigured ? await authService.getCurrentUserId() : await storage.getCurrentPlayer();
      const current = await authService.getCurrentPlayer();
      setMe(current);
      if (!userId || !current) {
        setError('You must be signed in to create a game.');
        return;
      }
      const [list, defaults] = await Promise.all([
        playerIdentityService.listCandidates(current.id),
        userSettingsService.get(current.id),
      ]);
      setCandidates(list);
      setRules(defaults);
      // Seats edited on the screens above us (Add New Players, Add player from database) come back through the draft.
      const pending = takePlayersToCheck();
      let next = newGameDraft.get();
      for (const row of pending) {
        if (next.some((p) => p.id === row.id)) continue;
        if (next.length >= MAX_SEATED_PLAYERS) break;
        const found = list.find((c) => c.id === row.id);
        next = [...next, found ? { id: found.id, name: found.name, playerCode: found.playerCode } : row];
      }
      newGameDraft.set(next);
      setSelected(next);
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Leaving New game without starting forgets the draft.
  useEffect(() => () => newGameDraft.clear(), []);

  const selectedIds = selected.map((p) => p.id);
  const seatedCount = selected.length;
  const atCap = seatedCount >= MAX_SEATED_PLAYERS;

  const meCandidate = useMemo<Candidate | null>(() => (me
    ? { id: me.id, name: me.name, playerCode: me.playerCode, status: 'registered', totalGames: 0, lastPlayedAt: null }
    : null), [me]);

  const grid = useMemo(() => {
    const pool = query.trim()
      ? candidates.filter((c) => matchesMyPlayer({ name: c.name, playerCode: c.playerCode }, query))
      : candidates;
    const meMatches = !query.trim() || (meCandidate ? matchesMyPlayer({ name: meCandidate.name, playerCode: meCandidate.playerCode }, query) : false);
    return newGameGrid(orderCandidates(pool, sort), selectedIds, meMatches ? meCandidate : null, PICKER_PAGE);
  }, [candidates, selectedIds, meCandidate, query, sort]);

  const pick = (c: Pick) => {
    if (atCap) return;
    newGameDraft.add({ id: c.id, name: c.name, playerCode: c.playerCode });
    setSelected(newGameDraft.get());
    setQuery('');
  };
  const unpick = (id: string) => {
    newGameDraft.remove(id);
    setSelected(newGameDraft.get());
  };

  const startGame = async () => {
    if (!me) return;
    const playerIds = newGameSeats(selectedIds);
    if (playerIds.length < 2) return;
    if (playerIds.length > MAX_SEATED_PLAYERS) { setError(SEATED_PLAYER_LIMIT); return; }
    setCreating(true);
    try {
      const game = await gamesService.createGame({
        playerIds,
        gameType: gameTypeForKind(rules.gameKind),
        createdBy: me.id,
        rules,
      });
      newGameDraft.clear();
      router.replace(`/(screens)/games/${game.id}`);
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'New game',
          headerRight: () => (
            <View style={styles.headerActions}>
              <HelpButton text={HELP.newGame} />
              <Menu visible={menuOpen} onDismiss={() => setMenuOpen(false)}
                anchor={<IconButton icon="dots-vertical" onPress={() => setMenuOpen(true)} accessibilityLabel="New game menu" />}>
                <Menu.Item leadingIcon="cog-outline" title="Game settings" onPress={() => { setMenuOpen(false); setSettingsOpen(true); }} />
              </Menu>
            </View>
          ),
        }}
      />

      <Screen contentStyle={styles.content} safeBottom={false}>
        <PlayingCount count={seatedCount} />
        <SelectedPlayersStrip picks={selected} meId={me?.id} onRemove={unpick} />
        {atCap ? <Text style={{ color: colors.error }}>{SEATED_PLAYER_LIMIT}</Text> : null}

        <View style={styles.searchRow}>
          <Searchbar placeholder="Search name, initials, or ID" value={query} onChangeText={setQuery} style={[styles.search, styles.flex]} inputStyle={styles.searchInput} />
          <SegmentedButtons
            value={sort}
            onValueChange={(value) => setSort(value as CandidateSort)}
            density="small"
            style={styles.sortControl}
            buttons={[
              { value: 'frequent', icon: 'fire', accessibilityLabel: 'Sort by Frequent', style: styles.sortButton },
              { value: 'name', icon: 'sort-alphabetical-ascending', accessibilityLabel: 'Sort alphabetically', style: styles.sortButton },
            ]}
          />
        </View>
        <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>
          {sort === 'frequent' ? 'Sorted by Frequent: recent partners first, then most games together.' : 'Sorted alphabetically.'}
        </Text>
        {error ? <Text style={{ color: isNotReadyMessage(error) ? colors.onSurfaceVariant : colors.error }}>{error}</Text> : null}
        {loading && candidates.length === 0 ? <LoadingRows /> : null}

        <View style={styles.grid}>
          {grid.map((c) => {
            const isMe = c.id === me?.id;
            const status = registrationLabel(c.status);
            return (
              <Pressable key={c.id} onPress={() => pick(c)} disabled={atCap} accessibilityRole="checkbox" accessibilityState={{ checked: false }}
                accessibilityLabel={`Add ${c.name}${isMe ? ' (you)' : ''}`}
                style={[styles.cell, { borderColor: isMe ? colors.primary : colors.outlineVariant, backgroundColor: colors.surface, opacity: atCap ? 0.5 : 1 }]}>
                <BoldName name={c.name} suffix={isMe ? ' (you)' : undefined} variant="titleSmall" numberOfLines={2} style={styles.cellName} />
                <View style={styles.cellMeta}>
                  <Tag label={status} tone={REGISTRATION_TONE[status]} small wrap />
                  {playerIdBadge(c) ? <Text variant="labelSmall" numberOfLines={1} style={{ color: colors.onSurfaceVariant }}>{playerIdBadge(c)}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        {!loading && grid.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
            {query ? 'No one in My players matches. Try Add player from database.' : 'No more players in My players. Add players below.'}
          </Text>
        ) : null}
      </Screen>

      <BottomBar style={styles.bottom}>
        <View style={styles.addRow}>
          <Button mode="contained-tonal" icon="account-plus-outline" style={styles.flex} contentStyle={styles.toolContent} labelStyle={styles.toolLabel}
            onPress={() => router.push({ pathname: '/(screens)/players/add', params: { from: 'new-game' } })} accessibilityLabel="Add players">
            Add players
          </Button>
          <Button mode="contained-tonal" icon="database-search" style={styles.flex} contentStyle={styles.toolContent} labelStyle={styles.toolLabel}
            onPress={() => router.push({ pathname: '/(screens)/players/new', params: { from: 'new-game', seated: selectedIds.join(',') } })} accessibilityLabel="Add player from database">
            From database
          </Button>
        </View>
        <Button mode="contained" onPress={startGame} loading={creating} disabled={seatedCount < 2 || creating} contentStyle={styles.startContent} labelStyle={styles.startLabel} accessibilityLabel="Start game">
          {seatedCount < 2 ? (seatedCount === 0 ? 'Pick at least two players' : 'Pick at least one more player') : `Start game · ${seatedCount} players`}
        </Button>
      </BottomBar>

      <GameSettingsDialog visible={settingsOpen} rules={rules} onDismiss={() => setSettingsOpen(false)} onSave={(r) => setRules(r)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: spacing.md, gap: spacing.sm },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  playingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 60 },
  countWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  countHalo: { position: 'absolute', width: 56, height: 56, borderRadius: 28 },
  countBubble: { minWidth: 56, height: 56, paddingHorizontal: 12, borderRadius: 28, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 30, fontWeight: '900', lineHeight: 34 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  search: { marginVertical: 2 },
  searchInput: { fontSize: 15, minHeight: 0 },
  sortControl: { width: 104 },
  sortButton: { minWidth: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 6 },
  cell: { width: '49%', borderWidth: 1.5, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 10, minHeight: 72, gap: 4, justifyContent: 'center' },
  cellMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cellName: { lineHeight: 18 },
  bottom: { flexDirection: 'column', alignItems: 'stretch', gap: spacing.sm },
  addRow: { flexDirection: 'row', gap: spacing.sm },
  toolContent: { minHeight: 44 },
  toolLabel: { fontSize: 14 },
  startContent: { minHeight: 52 },
  startLabel: { fontSize: 16, fontWeight: '800' },
  flex: { flex: 1 },
});

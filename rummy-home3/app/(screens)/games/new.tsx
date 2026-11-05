import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Button, IconButton, Menu, Searchbar, Text } from 'react-native-paper';
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
import { Candidate, chipInitials, newGameGrid, newGameSeats, PICKER_PAGE } from '@/utils/playerIdentity';
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
import { seatColor, spacing, useAppTheme } from '@/constants/theme';

type Pick = { id: string; name: string; playerCode?: string };

function Chip({ pick, index, isMe, onPress }: { pick: Pick; index: number; isMe: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={6}
      accessibilityLabel={`Remove ${pick.name}${isMe ? ' (you)' : ''}`} style={[styles.chip, { backgroundColor: colors.primaryContainer }]}>
      <View style={[styles.chipDot, { backgroundColor: seatColor(index) }]}>
        <Text style={styles.chipInitials}>{chipInitials(pick.name)}</Text>
      </View>
      <Text variant="labelLarge" numberOfLines={1} style={[styles.chipName, { color: colors.onPrimaryContainer }]}>
        {isMe ? `${pick.name} (you)` : pick.name}
      </Text>
      <Text style={[styles.chipX, { color: colors.onPrimaryContainer }]}>×</Text>
    </Pressable>
  );
}

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
      const pending = takePlayersToCheck();
      if (pending.length) {
        setSelected((cur) => {
          let next = cur;
          for (const row of pending) {
            if (next.some((p) => p.id === row.id)) continue;
            if (next.length >= MAX_SEATED_PLAYERS) break;
            const found = list.find((c) => c.id === row.id);
            next = [...next, found ? { id: found.id, name: found.name, playerCode: found.playerCode } : row];
          }
          return next;
        });
      }
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
    return newGameGrid(pool, selectedIds, meMatches ? meCandidate : null, PICKER_PAGE);
  }, [candidates, selectedIds, meCandidate, query]);

  const pick = (c: Pick) => {
    if (atCap) return;
    setSelected((cur) => [...cur, { id: c.id, name: c.name, playerCode: c.playerCode }]);
    setQuery('');
  };
  const unpick = (id: string) => setSelected((cur) => cur.filter((p) => p.id !== id));

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
      router.replace(`/(screens)/games/${game.id}`);
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
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

      <PlayingCount count={seatedCount} />
      <View style={styles.chips}>
        {selected.map((p, i) => <Chip key={p.id} pick={p} index={i} isMe={p.id === me?.id} onPress={() => unpick(p.id)} />)}
      </View>
      {atCap ? <Text style={{ color: colors.error }}>{SEATED_PLAYER_LIMIT}</Text> : null}

      <Searchbar placeholder="Search name, initials, or player ID" value={query} onChangeText={setQuery} style={styles.search} />
      {error ? <Text style={{ color: isNotReadyMessage(error) ? colors.onSurfaceVariant : colors.error }}>{error}</Text> : null}
      {loading && candidates.length === 0 ? <LoadingRows /> : null}

      <View style={styles.grid}>
        {grid.map((c) => (
          <Pressable key={c.id} onPress={() => pick(c)} disabled={atCap} accessibilityRole="checkbox" accessibilityState={{ checked: false }}
            accessibilityLabel={`Add ${c.name}${c.id === me?.id ? ' (you)' : ''}`}
            style={[styles.cell, { borderColor: c.id === me?.id ? colors.primary : colors.outlineVariant, backgroundColor: colors.surface, opacity: atCap ? 0.5 : 1 }]}>
            <View style={[styles.cellDot, { backgroundColor: c.id === me?.id ? colors.primaryContainer : colors.surfaceVariant }]}>
              <Text style={[styles.cellInitials, { color: colors.onSurface }]}>{chipInitials(c.name)}</Text>
            </View>
            <View style={styles.flex}>
              <Text variant="labelLarge" numberOfLines={2} style={styles.cellName}>{c.id === me?.id ? `${c.name} (you)` : c.name}</Text>
              <View style={styles.cellMeta}>
                <Tag label={registrationLabel(c.status)} tone={REGISTRATION_TONE[registrationLabel(c.status)]} small wrap />
                {playerIdBadge(c) ? <Text variant="labelSmall" numberOfLines={1} style={{ color: colors.onSurfaceVariant }}>{playerIdBadge(c)}</Text> : null}
              </View>
            </View>
          </Pressable>
        ))}
      </View>
      {!loading && grid.length === 0 ? (
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
          {query ? 'No one in My players matches. Try Add player from database.' : 'No more players in My players. Add players below.'}
        </Text>
      ) : null}

      <View style={styles.bottomTools}>
        <Button mode="contained" icon="account-plus-outline" onPress={() => router.push({ pathname: '/(screens)/players/add', params: { from: 'new-game' } })} contentStyle={styles.toolContent} accessibilityLabel="Add players">
          Add players
        </Button>
        <Button mode="contained-tonal" icon="database-search" contentStyle={styles.toolContent}
          onPress={() => router.push({ pathname: '/(screens)/players/new', params: { from: 'new-game', seated: selectedIds.join(',') } })}>
          Add player from database
        </Button>
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
          New players by initials are seated as you save them. Players from the database are seated here and added to My players at once.
        </Text>
      </View>

      <BottomBar>
        <Button mode="contained" onPress={startGame} loading={creating} disabled={seatedCount < 2 || creating} style={styles.flex}>
          {seatedCount < 2 ? (seatedCount === 0 ? 'Pick at least two players' : 'Pick at least one more player') : `Start game · ${seatedCount} players`}
        </Button>
      </BottomBar>

      <GameSettingsDialog visible={settingsOpen} rules={rules} onDismiss={() => setSettingsOpen(false)} onSave={(r) => setRules(r)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 120, gap: spacing.sm },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  playingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 60 },
  countWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  countHalo: { position: 'absolute', width: 56, height: 56, borderRadius: 28 },
  countBubble: { minWidth: 56, height: 56, paddingHorizontal: 12, borderRadius: 28, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 30, fontWeight: '900', lineHeight: 34 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 22, paddingRight: 12, paddingVertical: 4, paddingLeft: 4, minHeight: 44 },
  chipDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  chipInitials: { color: '#fff', fontWeight: '700', fontSize: 13 },
  chipName: { maxWidth: 170 },
  chipX: { fontSize: 18, marginLeft: 2, fontWeight: '700' },
  search: { marginVertical: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 6 },
  cell: { width: '49%', flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, padding: 8, minHeight: 64 },
  cellMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  cellDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cellInitials: { fontWeight: '700', fontSize: 12 },
  cellName: { lineHeight: 16 },
  bottomTools: { gap: spacing.sm, marginTop: spacing.sm },
  toolContent: { minHeight: 48 },
  flex: { flex: 1 },
});

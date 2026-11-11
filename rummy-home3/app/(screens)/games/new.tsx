import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, LayoutAnimation, Platform, StyleSheet, UIManager, View } from 'react-native';
import { Button, Dialog, IconButton, Menu, Portal, Searchbar, SegmentedButtons, Text } from 'react-native-paper';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Player } from '@/types/player';
import { Game } from '@/types/game';
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
import { Candidate, CandidateSort, newGameGrid, newGameSeats, orderCandidates, PICKER_PREFETCH, pinOrganiser } from '@/utils/playerIdentity';
import { DraftPick, newGameDraft } from '@/utils/newGameDraft';
import { seatRemovalProblem } from '@/utils/seatRemoval';
import { SelectedPlayersStrip } from '@/components/players/SelectedPlayersStrip';
import { PlayerPickerRow } from '@/components/players/PlayerPickerRow';
import { MAX_SEATED_PLAYERS, SEATED_PLAYER_LIMIT } from '@/constants/limits';
import { HELP } from '@/constants/help';
import { Screen } from '@/components/ui/Screen';
import { BottomBar } from '@/components/ui/BottomBar';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { HelpButton } from '@/components/ui/HelpButton';
import { GameSettingsDialog } from '@/components/game/GameSettingsDialog';
import { radius, spacing, useAppTheme } from '@/constants/theme';

type Pick = DraftPick;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Diameter of the Playing count badge: room for "15" on one line. */
const PLAYING_BADGE = 68;

/** Slide the list shut and the strip open together; a no-op on web, where the chip/row entry animations still run. */
const animateMove = () => LayoutAnimation.configureNext(LayoutAnimation.create(260, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));

/**
 * "Playing · N". The number sits in a big yellow badge with a soft green halo
 * that keeps breathing while anyone is seated, and it pops each time N changes.
 */
function PlayingCount({ count, hint, label = 'Playing' }: { count: number; hint: string; label?: string }) {
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
    <View style={styles.playingRow} accessibilityLiveRegion="polite" accessibilityLabel={`${label}, ${count} ${count === 1 ? 'player' : 'players'}`}>
      <Text variant="titleLarge" style={{ color: colors.onSurface, fontWeight: '800' }}>{label}</Text>
      <View style={styles.countWrap}>
        {seated ? <Animated.View pointerEvents="none" style={[styles.countHalo, { backgroundColor: colors.primary, opacity: haloOpacity, transform: [{ scale: haloScale }] }]} /> : null}
        <Animated.View style={[styles.countBubble, { backgroundColor: seated ? fill : colors.surfaceVariant, borderColor: seated ? colors.primary : colors.outlineVariant, transform: [{ scale }] }]}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.countText, { color: seated ? colors.onSecondaryContainer : colors.onSurfaceVariant }]}>{count}</Text>
        </Animated.View>
      </View>
      <Text variant="bodyMedium" style={[styles.flex, { color: colors.onSurfaceVariant }]}>{hint}</Text>
    </View>
  );
}

/**
 * New game, and — with `?gameId=` — "Add players to game": the same picker in
 * add mode, where the seats already in the game sit in the strip, newly picked
 * people are staged until Return to game, and × on a saved seat removes them
 * only while every one of their round scores is 0.
 */
export default function NewGame() {
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ gameId?: string }>();
  const gameId = typeof params.gameId === 'string' && params.gameId ? params.gameId : null;
  const addMode = Boolean(gameId);

  const [me, setMe] = useState<Player | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [saved, setSaved] = useState<Pick[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [staged, setStaged] = useState<Pick[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<CandidateSort>('frequent');
  const [rules, setRules] = useState<PointsRules>(DEFAULT_POINTS_RULES);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGame = useCallback(async (id: string) => {
    const [current, seats] = await Promise.all([gamesService.getGame(id), gamesService.listGamePlayers(id)]);
    if (!current) throw new Error('This game is not available.');
    setGame(current);
    setSaved(
      seats
        .filter((seat) => seat.seatRole !== 'spectator' && seat.seated !== false && seat.id !== 'EX')
        .map((seat) => ({ id: seat.id, name: seat.name, playerCode: seat.playerCode })),
    );
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const userId = isSupabaseConfigured ? await authService.getCurrentUserId() : await storage.getCurrentPlayer();
      const current = await authService.getCurrentPlayer();
      setMe(current);
      if (!userId || !current) {
        setError(addMode ? 'You must be signed in to add players.' : 'You must be signed in to create a game.');
        return;
      }
      const [list, defaults] = await Promise.all([
        playerIdentityService.listCandidates(current.id),
        userSettingsService.get(current.id),
        gameId ? loadGame(gameId) : Promise.resolve(),
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
      setStaged(next);
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, [addMode, gameId, loadGame]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Leaving without starting (or returning) forgets the draft.
  useEffect(() => () => newGameDraft.clear(), []);

  const savedIds = useMemo(() => new Set(saved.map((p) => p.id)), [saved]);
  const selected = useMemo(() => [...saved, ...staged.filter((p) => !savedIds.has(p.id))], [saved, staged, savedIds]);
  const selectedIds = selected.map((p) => p.id);
  const seatedCount = selected.length;
  const atCap = seatedCount >= MAX_SEATED_PLAYERS;

  const meCandidate = useMemo<Candidate | null>(() => (me
    ? { id: me.id, name: me.name, playerCode: me.playerCode, status: 'registered', totalGames: 0, lastPlayedAt: null }
    : null), [me]);

  const list = useMemo(() => {
    const others = meCandidate ? candidates.filter((c) => c.id !== meCandidate.id) : candidates;
    const pool = query.trim()
      ? others.filter((c) => matchesMyPlayer({ name: c.name, playerCode: c.playerCode }, query))
      : others;
    // The whole remaining list (not a ten-row page): the organiser scrolls and searches instead of picking to reveal more.
    const grid = newGameGrid(orderCandidates(pool, sort), selectedIds, PICKER_PREFETCH);
    // The organiser always has a row (first) until seated: they are not in the server's stats, so no sort or page may hide them.
    const meMatches = !meCandidate || matchesMyPlayer({ name: meCandidate.name, playerCode: meCandidate.playerCode }, query);
    // Mid-game, an organiser who is in the game as a non-playing admin or viewer cannot be seated from here (parked: P3).
    const meWatching = Boolean(addMode && game && me && (game.spectators?.includes(me.id) || game.unseatedAdminIds?.includes(me.id)));
    return pinOrganiser(grid, meWatching ? null : meCandidate, selectedIds, meMatches);
  }, [candidates, selectedIds, meCandidate, query, sort, addMode, game, me]);

  const pick = (c: Pick) => {
    if (atCap) return;
    animateMove();
    newGameDraft.add({ id: c.id, name: c.name, playerCode: c.playerCode });
    setStaged(newGameDraft.get());
    setQuery('');
  };

  const unpick = async (id: string) => {
    if (!savedIds.has(id)) {
      animateMove();
      newGameDraft.remove(id);
      setStaged(newGameDraft.get());
      return;
    }
    if (!game) return;
    // A saved seat: only while every round score is 0 (checked per round, never the total).
    const problem = seatRemovalProblem(game.scores[id]);
    if (problem) { setBlocked(problem); return; }
    setRemoving(id);
    try {
      await gamesService.removeSeatIfNoScores(game.id, id);
      animateMove();
      await loadGame(game.id);
    } catch (err) {
      setBlocked(formatSupabaseError(err));
    } finally {
      setRemoving(null);
    }
  };

  const startGame = async () => {
    if (!me) return;
    const playerIds = newGameSeats(selectedIds);
    if (playerIds.length < 2) return;
    if (playerIds.length > MAX_SEATED_PLAYERS) { setError(SEATED_PLAYER_LIMIT); return; }
    setCreating(true);
    try {
      const created = await gamesService.createGame({
        playerIds,
        gameType: gameTypeForKind(rules.gameKind),
        createdBy: me.id,
        rules,
      });
      newGameDraft.clear();
      router.replace(`/(screens)/games/${created.id}`);
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setCreating(false);
    }
  };

  /** Add mode: seat every staged pick (zeros for rounds already played), then go back to the game. */
  const returnToGame = async () => {
    if (!game) return;
    setCreating(true);
    try {
      for (const pickRow of staged) {
        if (savedIds.has(pickRow.id)) continue;
        await gamesService.addSeatedPlayer(game.id, pickRow.id);
      }
      newGameDraft.clear();
      if (router.canGoBack()) router.back();
      else router.replace(`/(screens)/games/${game.id}`);
    } catch (err) {
      setError(formatSupabaseError(err));
      // Whatever was seated before the failure is now saved; refresh so the strip tells the truth.
      await loadGame(game.id).catch(() => {});
    } finally {
      setCreating(false);
    }
  };

  const newCount = staged.filter((p) => !savedIds.has(p.id)).length;
  const hint = addMode
    ? (newCount === 0 ? `${saved.length} in the game. Tap a player below to add them; they get 0 for every round already played.` : `new · ${saved.length} already in the game · tap Return to game to seat them`)
    : (seatedCount === 0 ? 'Nobody yet. Tap players below; tap yourself if you are playing.' : seatedCount === 1 ? 'player · pick one more to start' : 'players');

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: addMode ? 'Add players to game' : 'New game',
          headerRight: () => (
            <View style={styles.headerActions}>
              <HelpButton text={addMode ? HELP.addPlayersToGame : HELP.newGame} />
              {addMode ? null : (
                <Menu visible={menuOpen} onDismiss={() => setMenuOpen(false)}
                  anchor={<IconButton icon="dots-vertical" onPress={() => setMenuOpen(true)} accessibilityLabel="New game menu" />}>
                  <Menu.Item leadingIcon="cog-outline" title="Game settings" onPress={() => { setMenuOpen(false); setSettingsOpen(true); }} />
                </Menu>
              )}
            </View>
          ),
        }}
      />

      <Screen contentStyle={styles.content} safeBottom={false}>
        <PlayingCount count={addMode ? newCount : seatedCount} hint={hint} label={addMode ? 'Added' : 'Playing'} />
        <SelectedPlayersStrip picks={selected} meId={me?.id} onRemove={unpick} onReturn={unpick} savedIds={addMode ? savedIds : undefined} busyId={removing} />
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

        <View style={styles.list} accessibilityLabel="Players to add">
          {list.map((c, index) => (
            <PlayerPickerRow key={c.id} candidate={c} index={index} disabled={atCap} isMe={c.id === me?.id} onPress={() => pick(c)} />
          ))}
        </View>
        {!loading && list.length === 0 ? (
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
        {addMode ? (
          <Button mode="contained" onPress={returnToGame} loading={creating} disabled={creating || Boolean(removing)} icon="arrow-left" contentStyle={styles.startContent} labelStyle={styles.startLabel} accessibilityLabel="Return to game">
            {newCount === 0 ? 'Return to game' : `Return to game · add ${newCount}`}
          </Button>
        ) : (
          <Button mode="contained" onPress={startGame} loading={creating} disabled={seatedCount < 2 || creating} contentStyle={styles.startContent} labelStyle={styles.startLabel} accessibilityLabel="Start game">
            {seatedCount < 2 ? (seatedCount === 0 ? 'Pick at least two players' : 'Pick at least one more player') : `Start game · ${seatedCount} players`}
          </Button>
        )}
      </BottomBar>

      <GameSettingsDialog visible={settingsOpen} rules={rules} onDismiss={() => setSettingsOpen(false)} onSave={(r) => setRules(r)} />

      <Portal>
        <Dialog visible={Boolean(blocked)} onDismiss={() => setBlocked(null)} style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Dialog.Icon icon="account-cancel-outline" />
          <Dialog.Title>Can’t remove this player</Dialog.Title>
          <Dialog.Content><Text variant="bodyMedium">{blocked}</Text></Dialog.Content>
          <Dialog.Actions><Button mode="contained" onPress={() => setBlocked(null)}>Got it</Button></Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: spacing.md, gap: spacing.sm },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  playingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 60 },
  // Wide enough for two digits on one line ("11" used to wrap) at the same type size.
  countWrap: { width: PLAYING_BADGE + 4, height: PLAYING_BADGE + 4, alignItems: 'center', justifyContent: 'center' },
  countHalo: { position: 'absolute', width: PLAYING_BADGE, height: PLAYING_BADGE, borderRadius: PLAYING_BADGE / 2 },
  countBubble: { width: PLAYING_BADGE, height: PLAYING_BADGE, paddingHorizontal: 6, borderRadius: PLAYING_BADGE / 2, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 30, fontWeight: '900', lineHeight: 36, textAlign: 'center', minWidth: 44 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  search: { marginVertical: 2 },
  searchInput: { fontSize: 15, minHeight: 0 },
  sortControl: { width: 104 },
  sortButton: { minWidth: 0 },
  list: { gap: 6 },
  bottom: { flexDirection: 'column', alignItems: 'stretch', gap: spacing.sm },
  addRow: { flexDirection: 'row', gap: spacing.sm },
  toolContent: { minHeight: 44 },
  toolLabel: { fontSize: 14 },
  startContent: { minHeight: 52 },
  startLabel: { fontSize: 16, fontWeight: '800' },
  dialog: { borderRadius: radius.xl, maxWidth: 520, width: '94%', alignSelf: 'center' },
  flex: { flex: 1 },
});

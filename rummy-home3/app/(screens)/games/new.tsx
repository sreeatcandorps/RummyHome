import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
import { takePlayerToCheck } from '@/utils/pendingPlayer';
import { DEFAULT_POINTS_RULES, gameTypeForKind, PointsRules } from '@/utils/gameSettings';
import { Candidate, chipInitials, pickerGrid, PICKER_PAGE, seatedOrder } from '@/utils/playerIdentity';
import { MAX_SEATED_PLAYERS, SEATED_PLAYER_LIMIT } from '@/constants/limits';
import { HELP } from '@/constants/help';
import { Screen } from '@/components/ui/Screen';
import { BottomBar } from '@/components/ui/BottomBar';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { HelpButton } from '@/components/ui/HelpButton';
import { GameSettingsDialog } from '@/components/game/GameSettingsDialog';
import { NewPlayerStepper } from '@/components/players/NewPlayerStepper';
import { AddPlayersDialog } from '@/components/players/AddPlayersDialog';
import { seatColor, spacing, useAppTheme } from '@/constants/theme';

type Pick = { id: string; name: string; playerCode?: string };

function Chip({ pick, index, isMe, onPress }: { pick: Pick; index: number; isMe: boolean; onPress?: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable onPress={onPress} disabled={isMe} accessibilityRole="button"
      accessibilityLabel={isMe ? `${pick.name}, you` : `Remove ${pick.name}`} style={[styles.chip, { backgroundColor: colors.primaryContainer }]}>
      <View style={[styles.chipDot, { backgroundColor: seatColor(index) }]}>
        <Text style={styles.chipInitials}>{chipInitials(pick.name)}</Text>
      </View>
      <Text variant="labelSmall" style={{ color: colors.onPrimaryContainer }}>{isMe ? 'You' : pick.playerCode ?? '—'}</Text>
      {!isMe ? <Text style={[styles.chipX, { color: colors.onPrimaryContainer }]}>×</Text> : null}
    </Pressable>
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
  const [newCount, setNewCount] = useState(3);
  const [addOpen, setAddOpen] = useState(false);
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
      const pending = takePlayerToCheck();
      if (pending) {
        const found = list.find((c) => c.id === pending);
        if (found) setSelected((cur) => (cur.some((p) => p.id === pending) ? cur : [...cur, found]));
      }
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const selectedIds = selected.map((p) => p.id);
  const seatedCount = selected.length + (me ? 1 : 0);
  const atCap = seatedCount >= MAX_SEATED_PLAYERS;

  const grid = useMemo(() => {
    const pool = query.trim()
      ? candidates.filter((c) => matchesMyPlayer({ name: c.name, playerCode: c.playerCode }, query))
      : candidates;
    return pickerGrid(pool, selectedIds, me?.id, PICKER_PAGE);
  }, [candidates, selectedIds, me?.id, query]);

  const pick = (c: Pick) => {
    if (atCap) return;
    setSelected((cur) => [...cur, { id: c.id, name: c.name, playerCode: c.playerCode }]);
    setQuery('');
  };
  const unpick = (id: string) => setSelected((cur) => cur.filter((p) => p.id !== id));

  const onNewSaved = (player: Player) => {
    setCandidates((cur) => [{ id: player.id, name: player.name, playerCode: player.playerCode, status: 'unregistered', totalGames: 0, lastPlayedAt: null }, ...cur.filter((c) => c.id !== player.id)]);
    setSelected((cur) => (cur.some((p) => p.id === player.id)
      ? cur.map((p) => (p.id === player.id ? { ...p, name: player.name } : p))
      : (seatedCount >= MAX_SEATED_PLAYERS ? cur : [...cur, { id: player.id, name: player.name, playerCode: player.playerCode }])));
  };
  const onNewDeleted = (id: string) => {
    setCandidates((cur) => cur.filter((c) => c.id !== id));
    unpick(id);
  };

  const startGame = async () => {
    if (!me) return;
    const playerIds = seatedOrder(me.id, selectedIds);
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

      <Text variant="labelLarge" style={{ color: colors.onSurfaceVariant }}>Playing · {seatedCount}</Text>
      <View style={styles.chips}>
        {me ? <Chip pick={{ id: me.id, name: me.name, playerCode: me.playerCode }} index={0} isMe /> : null}
        {selected.map((p, i) => <Chip key={p.id} pick={p} index={i + 1} isMe={false} onPress={() => unpick(p.id)} />)}
      </View>
      {atCap ? <Text style={{ color: colors.error }}>{SEATED_PLAYER_LIMIT}</Text> : null}

      <Searchbar placeholder="Search name, initials, or player ID" value={query} onChangeText={setQuery} style={styles.search} />
      {error ? <Text style={{ color: isNotReadyMessage(error) ? colors.onSurfaceVariant : colors.error }}>{error}</Text> : null}
      {loading && candidates.length === 0 ? <LoadingRows /> : null}

      <View style={styles.grid}>
        {grid.map((c) => (
          <Pressable key={c.id} onPress={() => pick(c)} disabled={atCap} accessibilityRole="checkbox" accessibilityState={{ checked: false }}
            accessibilityLabel={`Add ${c.name}`} style={[styles.cell, { borderColor: colors.outlineVariant, opacity: atCap ? 0.5 : 1 }]}>
            <View style={[styles.cellDot, { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.cellInitials, { color: colors.onSurface }]}>{chipInitials(c.name)}</Text>
            </View>
            <View style={styles.flex}>
              <Text variant="labelLarge" numberOfLines={1}>{chipInitials(c.name)}</Text>
              <Text variant="labelSmall" numberOfLines={1} style={{ color: colors.onSurfaceVariant }}>
                {c.playerCode ?? '—'}{c.status === 'unregistered' || c.status === 'pending' ? ' · Unregistered' : ''}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
      {!loading && grid.length === 0 ? (
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
          {query ? 'No one in My players matches. Try Find player in database.' : 'No more players in My players. Add a new player below.'}
        </Text>
      ) : null}

      <View style={styles.bottomTools}>
        <NewPlayerStepper count={newCount} onChange={setNewCount} onAdd={() => setAddOpen(true)} />
        <Button mode="outlined" icon="database-search" onPress={() => router.push({ pathname: '/(screens)/players/new', params: { from: 'new-game' } })}>
          Find player in database
        </Button>
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
          Not in the database? Use Add new player. After you start the game, you can register these players from the ⋮ menu so they can download the app and see their games.
        </Text>
      </View>

      <BottomBar>
        <Button mode="contained" onPress={startGame} loading={creating} disabled={seatedCount < 2 || creating} style={styles.flex}>
          {seatedCount < 2 ? 'Pick at least one more player' : `Start game · ${seatedCount} players`}
        </Button>
      </BottomBar>

      {me ? (
        <AddPlayersDialog visible={addOpen} count={newCount} ownerId={me.id} onClose={() => setAddOpen(false)} onSaved={onNewSaved} onDeleted={onNewDeleted} />
      ) : null}
      <GameSettingsDialog visible={settingsOpen} rules={rules} onDismiss={() => setSettingsOpen(false)} onSave={(r) => setRules(r)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 120, gap: spacing.sm },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 16, paddingRight: 8, paddingVertical: 2, paddingLeft: 2 },
  chipDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  chipInitials: { color: '#fff', fontWeight: '700', fontSize: 11 },
  chipX: { fontSize: 14, marginLeft: 2 },
  search: { marginVertical: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 6 },
  cell: { width: '49%', flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, padding: 6 },
  cellDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cellInitials: { fontWeight: '700', fontSize: 12 },
  bottomTools: { gap: spacing.sm, marginTop: spacing.sm },
  flex: { flex: 1 },
});

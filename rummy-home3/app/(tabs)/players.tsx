import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Searchbar, Text, TouchableRipple } from 'react-native-paper';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { Player } from '@/types/player';
import { authService } from '@/services/auth';
import { playersService } from '@/services/players';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { isNotReadyMessage } from '@/utils/notReady';
import { listInitials, matchesMyPlayer } from '@/utils/playerSearch';
import { shareInvite } from '@/utils/invite';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { Tag } from '@/components/ui/Tag';
import { NewPlayerStepper } from '@/components/players/NewPlayerStepper';
import { ClaimRequestsCard } from '@/components/players/ClaimRequestsCard';
import { AddPlayersDialog } from '@/components/players/AddPlayersDialog';
import { RegisterPlayersDialog } from '@/components/players/RegisterPlayersDialog';
import { playerIdentityService } from '@/services/playerIdentity';

export default function PlayersTab() {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const [me, setMe] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'games' | 'name'>('games');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Player | null>(null);
  const [removing, setRemoving] = useState(false);
  const [unregistered, setUnregistered] = useState<Record<string, Player>>({});
  const [newCount, setNewCount] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const player = await authService.getCurrentPlayer();
      setMe(player);
      if (!player) {
        setError('Not signed in.');
        return;
      }
      const cached = await playersService.readMyPlayers(player.id);
      if (cached.length) setPlayers(cached);
      const fresh = await playersService.listMyPlayers(player.id);
      setPlayers(fresh);
      const open = await playerIdentityService.listUnregistered(player.id).catch(() => []);
      setUnregistered(Object.fromEntries(open.map((p) => [p.id, p])));
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: `My players · ${players.length}` });
  }, [navigation, players.length]);

  const shown = players
    .filter((player) => matchesMyPlayer(player, query))
    .sort((a, b) => (
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : (b.gamesTogether ?? 0) - (a.gamesTogether ?? 0) || a.name.localeCompare(b.name)
    ));

  const openRow = (player: Player) => {
    if (me && player.id === me.id) {
      router.push('/(tabs)/me');
      return;
    }
    setSelected(player);
  };

  const remove = async () => {
    if (!selected || !me) return;
    const removed = selected;
    setPlayers((current) => current.filter((player) => player.id !== removed.id));
    setSelected(null);
    setRemoving(true);
    try {
      await playersService.removeMyPlayer(me.id, removed.id);
    } catch (err) {
      setPlayers((current) => [removed, ...current.filter((player) => player.id !== removed.id)]);
      setError(err instanceof Error ? err.message : 'Couldn’t remove them. Try again.');
    } finally {
      setRemoving(false);
    }
  };

  const confirmRemove = () => {
    if (!selected) return;
    Alert.alert(`Remove ${selected.name} from your list?`, 'Their account stays. Past games stay.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: remove },
    ]);
  };

  return (
    <Screen>
      <Searchbar
        placeholder="Search name or player ID"
        value={query}
        onChangeText={setQuery}
        style={styles.search}
      />
      <View style={styles.actions}>
        <Button mode="contained" icon="database-search" onPress={() => router.push('/(screens)/players/new')}>
          Find player in database
        </Button>
        <Button mode="outlined" icon="account-check-outline" onPress={() => setRegisterOpen(true)}>
          Register players{Object.keys(unregistered).length ? ` · ${Object.keys(unregistered).length}` : ''}
        </Button>
        <Button mode="text" onPress={() => setSort((current) => (current === 'games' ? 'name' : 'games'))}>
          {sort === 'games' ? 'Most games' : 'Name'}
        </Button>
      </View>
      {me ? <ClaimRequestsCard ownerId={me.id} onChanged={load} /> : null}
      <NewPlayerStepper count={newCount} onChange={setNewCount} onAdd={() => setAddOpen(true)} />
      {error ? (
        <View>
          <Text variant="bodyMedium" style={{ color: isNotReadyMessage(error) ? colors.onSurfaceVariant : colors.error }}>{error}</Text>
          {isNotReadyMessage(error) ? null : <Button onPress={load}>Retry</Button>}
        </View>
      ) : null}
      {loading && players.length === 0 ? <LoadingRows /> : null}
      {!loading && players.length === 0 && !error ? (
        <EmptyState
          icon="account-group-outline"
          title="No one in My players yet."
          message="Add a new player with just initials, or find a registered player in the database."
          actionLabel="Find player in database"
          onAction={() => router.push('/(screens)/players/new')}
        />
      ) : null}
      {!loading && players.length === 0 ? (
        <Button mode="outlined" icon="share-variant" onPress={() => shareInvite().catch(() => {})}>
          Invite
        </Button>
      ) : null}
      {!loading && players.length > 0 && shown.length === 0 ? (
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
          No one in My players matches that. Try the name, the initials, or the player ID.
        </Text>
      ) : null}
      {shown.map((player) => (
        <TouchableRipple
          key={player.id}
          onPress={() => openRow(player)}
          style={[styles.row, { borderColor: colors.outlineVariant, backgroundColor: colors.surface }]}
          accessibilityRole="button"
          accessibilityLabel={`${player.name}, ${player.playerCode || 'no player ID'}`}
        >
          <View style={styles.rowInner}>
            <SeatAvatar name={player.name} label={listInitials(player.name)} size={36} />
            <View style={styles.rowText}>
              <Text variant="titleMedium">{player.name}{me?.id === player.id ? ' · This is you' : ''}</Text>
              <View style={styles.idLine}>
                <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{player.playerCode || 'No player ID yet'}</Text>
                {unregistered[player.id] ? <Tag label={unregistered[player.id].status === 'pending' ? 'Pending' : 'Unregistered'} /> : null}
              </View>
            </View>
          </View>
        </TouchableRipple>
      ))}

      {me ? <AddPlayersDialog visible={addOpen} count={newCount} ownerId={me.id} onClose={() => { setAddOpen(false); load(); }} onSaved={() => {}} onDeleted={() => {}} /> : null}
      <RegisterPlayersDialog visible={registerOpen} me={me} onDismiss={() => { setRegisterOpen(false); load(); }} />
      <Portal>
        <Dialog visible={!!selected} onDismiss={() => setSelected(null)}>
          <Dialog.Title>{selected?.name}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyLarge">ID {selected?.playerCode || '—'}</Text>
            <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
              {selected?.gamesTogether ?? 0} games with you
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSelected(null)}>Close</Button>
            {selected && unregistered[selected.id] ? (
              <Button onPress={() => { setSelected(null); setRegisterOpen(true); }}>Register</Button>
            ) : null}
            <Button textColor={colors.error} onPress={confirmRemove} loading={removing}>
              Remove from My players
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  row: {
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  idLine: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  inviteEmpty: {
    alignSelf: 'flex-start',
  },
});

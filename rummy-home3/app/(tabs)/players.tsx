import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Searchbar, Text } from 'react-native-paper';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { Player } from '@/types/player';
import { authService } from '@/services/auth';
import { playersService } from '@/services/players';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { matchesMyPlayer } from '@/utils/playerSearch';
import { shareInvite } from '@/utils/invite';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { spacing, useAppTheme } from '@/constants/theme';

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
    navigation.setOptions({ title: `Players · ${players.length}` });
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
        <Button mode="contained" icon="account-search" onPress={() => router.push('/(screens)/players/new')}>
          Find players
        </Button>
        <Button mode="outlined" icon="share-variant" onPress={() => shareInvite().catch(() => {})}>
          Invite
        </Button>
        <Button mode="text" onPress={() => setSort((current) => (current === 'games' ? 'name' : 'games'))}>
          {sort === 'games' ? 'Most games' : 'Name'}
        </Button>
      </View>
      {error ? (
        <View>
          <Text variant="bodyMedium" style={{ color: colors.error }}>{error}</Text>
          <Button onPress={load}>Retry</Button>
        </View>
      ) : null}
      {loading && players.length === 0 ? <LoadingRows /> : null}
      {!loading && players.length === 0 && !error ? (
        <EmptyState
          icon="account-group-outline"
          title="No players yet."
          message="Find someone who already has an account, or invite them."
          actionLabel="Find players"
          onAction={() => router.push('/(screens)/players/new')}
        />
      ) : null}
      {!loading && players.length === 0 ? (
        <Button mode="outlined" icon="share-variant" onPress={() => shareInvite().catch(() => {})}>
          Invite
        </Button>
      ) : null}
      {shown.map((player) => (
        <Button
          key={player.id}
          mode="outlined"
          onPress={() => openRow(player)}
          style={styles.row}
          contentStyle={styles.rowContent}
        >
          <View style={styles.rowInner}>
            <SeatAvatar name={player.name} size={36} />
            <View>
              <Text variant="titleMedium">{player.name}{me?.id === player.id ? ' · This is you' : ''}</Text>
              <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{player.playerCode || 'No player ID yet'}</Text>
            </View>
          </View>
        </Button>
      ))}

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
            <Button textColor={colors.error} onPress={confirmRemove} loading={removing}>
              Remove from my players
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
    alignItems: 'stretch',
  },
  rowContent: {
    justifyContent: 'flex-start',
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  inviteEmpty: {
    alignSelf: 'flex-start',
  },
});

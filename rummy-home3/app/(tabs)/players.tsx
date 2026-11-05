import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { Button, Dialog, Icon, Portal, Searchbar, Text, TouchableRipple } from 'react-native-paper';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { Player } from '@/types/player';
import { authService } from '@/services/auth';
import { playersService } from '@/services/players';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { isNotReadyMessage } from '@/utils/notReady';
import { matchesMyPlayer } from '@/utils/playerSearch';
import { chipInitials } from '@/utils/playerIdentity';
import { DEFAULT_MY_PLAYERS_SORT, MyPlayersSort, myPlayersGridHeight, MY_PLAYERS_CARD_HEIGHT, nextSort, playerIdBadge, registrationLabel, REGISTRATION_TONE, SORT_LABEL, sortMyPlayers } from '@/utils/myPlayersList';
import { shareInvite } from '@/utils/invite';
import { PLAYERS_NOTE } from '@/constants/help';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { Tag } from '@/components/ui/Tag';
import { ClaimRequestsCard } from '@/components/players/ClaimRequestsCard';
import { RegisterPlayersDialog } from '@/components/players/RegisterPlayersDialog';
import { playerIdentityService } from '@/services/playerIdentity';

function PlayersHeader({ count, sort, onToggleSort, color }: { count: number; sort: MyPlayersSort; onToggleSort: () => void; color: string }) {
  return (
    <View style={styles.headerTitle}>
      <Text variant="titleLarge" numberOfLines={1} style={[styles.headerText, { color }]}>
        My players · {count}
      </Text>
      <Button
        compact
        mode="text"
        icon={sort === 'name' ? 'sort-alphabetical-ascending' : 'sort-numeric-descending'}
        onPress={onToggleSort}
        labelStyle={styles.sortLabel}
        accessibilityLabel={`${SORT_LABEL[sort]}. Tap to ${SORT_LABEL[nextSort(sort)].toLowerCase()}`}
      >
        {SORT_LABEL[sort]}
      </Button>
    </View>
  );
}

export default function PlayersTab() {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const [me, setMe] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<MyPlayersSort>(DEFAULT_MY_PLAYERS_SORT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Player | null>(null);
  const [removing, setRemoving] = useState(false);
  const [unregistered, setUnregistered] = useState<Record<string, Player>>({});
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

  const toggleSort = useCallback(() => setSort((current) => nextSort(current)), []);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: `My players · ${players.length}`,
      headerTitle: () => (
        <PlayersHeader count={players.length} sort={sort} onToggleSort={toggleSort} color={colors.onSurface} />
      ),
    });
  }, [navigation, players.length, sort, toggleSort, colors.onSurface]);

  const shown = sortMyPlayers(players.filter((player) => matchesMyPlayer(player, query)), sort);
  const unregisteredCount = Object.keys(unregistered).length;

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

  const renderCard = ({ item: player }: { item: Player }) => {
    const badge = playerIdBadge(player);
    const open = unregistered[player.id];
    const isMe = me?.id === player.id;
    const status = registrationLabel(open?.status ?? player.status);
    return (
      <TouchableRipple
        onPress={() => openRow(player)}
        style={[styles.card, { borderColor: colors.outlineVariant, backgroundColor: colors.surface }]}
        accessibilityRole="button"
        accessibilityLabel={`${player.name}, ${badge ?? 'no player ID yet'}, ${status.toLowerCase()}`}
      >
        <View style={styles.cardInner}>
          <View style={styles.cardTop}>
            <SeatAvatar name={player.name} label={chipInitials(player.name)} size={34} />
            <Text variant="titleSmall" numberOfLines={2} style={styles.cardName}>
              {player.name}
            </Text>
          </View>
          <View style={styles.cardMeta}>
            {badge ? (
              <View style={[styles.idBadge, { borderColor: colors.outline }]}>
                <Text variant="labelSmall" style={[styles.idText, { color: colors.onSurfaceVariant }]}>{badge}</Text>
              </View>
            ) : null}
            {isMe ? <Tag label="You" tone="primary" /> : null}
            <Tag label={status} tone={REGISTRATION_TONE[status]} small />
          </View>
        </View>
      </TouchableRipple>
    );
  };

  return (
    <Screen>
      <View style={[styles.note, { backgroundColor: colors.secondaryContainer }]}>
        <Icon source="information-outline" size={18} color={colors.onSecondaryContainer} />
        <Text variant="bodySmall" style={[styles.noteText, { color: colors.onSecondaryContainer }]}>
          {PLAYERS_NOTE}
        </Text>
      </View>
      <Searchbar
        placeholder="Search name or player ID"
        value={query}
        onChangeText={setQuery}
        style={styles.search}
      />
      {me ? <ClaimRequestsCard ownerId={me.id} onChanged={load} /> : null}
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
          message="Add new players with just initials, or find registered players in the database."
          actionLabel="Add new players"
          onAction={() => router.push('/(screens)/players/add')}
        />
      ) : null}
      {!loading && players.length > 0 && shown.length === 0 ? (
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
          No one in My players matches that. Try the name, the initials, or the player ID.
        </Text>
      ) : null}
      {shown.length > 0 ? (
        <FlatList
          data={shown}
          keyExtractor={(player) => player.id}
          renderItem={renderCard}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          style={[styles.grid, { height: myPlayersGridHeight(shown.length), borderColor: colors.outlineVariant }]}
          nestedScrollEnabled
          showsVerticalScrollIndicator
          accessibilityLabel="My players list"
        />
      ) : null}
      <View style={styles.actions}>
        <Button
          mode="contained"
          icon="account-plus-outline"
          onPress={() => router.push('/(screens)/players/add')}
          contentStyle={styles.actionContent}
          accessibilityLabel="Add new players"
        >
          Add new players
        </Button>
        <Button
          mode="contained-tonal"
          icon="database-search"
          onPress={() => router.push('/(screens)/players/new')}
          contentStyle={styles.actionContent}
        >
          Find player in database
        </Button>
        <Button
          mode="outlined"
          icon="account-check-outline"
          onPress={() => setRegisterOpen(true)}
          contentStyle={styles.actionContent}
        >
          Register players{unregisteredCount ? ` · ${unregisteredCount}` : ''}
        </Button>
        {!loading && players.length === 0 ? (
          <Button mode="text" icon="share-variant" onPress={() => shareInvite().catch(() => {})}>
            Invite
          </Button>
        ) : null}
      </View>

      <RegisterPlayersDialog visible={registerOpen} me={me} onDismiss={() => { setRegisterOpen(false); load(); }} />
      <Portal>
        <Dialog visible={!!selected} onDismiss={() => setSelected(null)}>
          <Dialog.Title>{selected?.name ?? ''}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyLarge">{selected ? (playerIdBadge(selected) ?? 'No player ID yet') : ''}</Text>
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
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  headerText: {
    fontWeight: '700',
    flexShrink: 1,
  },
  sortLabel: {
    fontSize: 13,
    marginVertical: 6,
  },
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  noteText: {
    flex: 1,
    lineHeight: 18,
  },
  search: {
    marginBottom: 0,
  },
  grid: {
    flexGrow: 0,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.sm,
    paddingBottom: 0,
  },
  gridRow: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  card: {
    flex: 1,
    height: MY_PLAYERS_CARD_HEIGHT - spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  cardInner: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    justifyContent: 'space-between',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardName: {
    flex: 1,
    minWidth: 0,
    lineHeight: 18,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  idBadge: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  idText: {
    fontWeight: '700',
  },
  actions: {
    gap: spacing.sm,
  },
  actionContent: {
    minHeight: 48,
  },
});

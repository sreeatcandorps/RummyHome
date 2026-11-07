import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, Icon, Portal, Searchbar, Text, TouchableRipple } from 'react-native-paper';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { Player } from '@/types/player';
import { authService } from '@/services/auth';
import { playersService } from '@/services/players';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { isNotReadyMessage } from '@/utils/notReady';
import { matchesMyPlayer } from '@/utils/playerSearch';
import { DEFAULT_MY_PLAYERS_SORT, filterMyPlayers, MyPlayersFilter, MyPlayersSort, myPlayersGridHeight, MY_PLAYERS_CARD_HEIGHT, playerIdBadge, registrationLabel, REGISTRATION_TONE, SORT_CHIP, SORT_OPTIONS, sortMyPlayers } from '@/utils/myPlayersList';
import { shareInvite } from '@/utils/invite';
import { PLAYERS_NOTE } from '@/constants/help';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { BoldName } from '@/components/ui/BoldName';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { Tag } from '@/components/ui/Tag';
import { ClaimRequestsCard } from '@/components/players/ClaimRequestsCard';
import { RegisterPlayersDialog } from '@/components/players/RegisterPlayersDialog';
import { playerIdentityService } from '@/services/playerIdentity';

export default function PlayersTab() {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const [me, setMe] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<MyPlayersSort>(DEFAULT_MY_PLAYERS_SORT);
  const [filter, setFilter] = useState<MyPlayersFilter>('all');
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


  React.useLayoutEffect(() => {
    navigation.setOptions({ title: `My players · ${players.length}` });
  }, [navigation, players.length]);

  const statusOf = (player: Player) => registrationLabel(unregistered[player.id]?.status ?? player.status);
  const shown = sortMyPlayers(
    filterMyPlayers(players.filter((player) => matchesMyPlayer(player, query)), filter, statusOf),
    sort,
  );
  const openCount = players.filter((player) => statusOf(player) !== 'Registered').length;
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
    const status = statusOf(player);
    return (
      <TouchableRipple
        onPress={() => openRow(player)}
        style={[styles.card, { borderColor: colors.outlineVariant, backgroundColor: colors.surface }]}
        accessibilityRole="button"
        accessibilityLabel={`${player.name}, ${badge ?? 'no player ID yet'}, ${status.toLowerCase()}`}
      >
        <View style={styles.cardInner}>
          <BoldName name={player.name} numberOfLines={2} style={styles.cardName} />
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
      <View style={styles.controls}>
        <View style={styles.sortGroup}>
          {SORT_OPTIONS.map((option) => (
            <Chip
              key={option}
              compact
              selected={sort === option}
              showSelectedCheck={false}
              mode={sort === option ? 'flat' : 'outlined'}
              onPress={() => setSort(option)}
              style={[styles.chip, sort === option && { backgroundColor: colors.secondaryContainer }]}
              textStyle={styles.chipText}
              accessibilityLabel={`Sort by ${SORT_CHIP[option]}`}
              accessibilityState={{ selected: sort === option }}
            >
              {SORT_CHIP[option]}
            </Chip>
          ))}
        </View>
        <Chip
          compact
          icon={filter === 'unregistered' ? 'filter-check' : 'filter-outline'}
          selected={filter === 'unregistered'}
          showSelectedCheck={false}
          mode={filter === 'unregistered' ? 'flat' : 'outlined'}
          onPress={() => setFilter((cur) => (cur === 'all' ? 'unregistered' : 'all'))}
          style={[styles.chip, filter === 'unregistered' && { backgroundColor: colors.tertiaryContainer }]}
          textStyle={styles.chipText}
          accessibilityLabel={filter === 'unregistered' ? 'Showing unregistered only. Tap to show everyone' : 'Show unregistered only'}
          accessibilityState={{ selected: filter === 'unregistered' }}
        >
          {`Unregistered · ${openCount}`}
        </Chip>
      </View>
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
          {filter === 'unregistered' && !query.trim()
            ? 'Everyone in My players is registered.'
            : 'No one in My players matches that. Try the name, the initials, or the player ID.'}
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
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  sortGroup: { flexDirection: 'row', gap: spacing.xs },
  chip: { borderRadius: radius.full },
  chipText: { fontSize: 12, marginVertical: 2 },
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
  cardName: {
    lineHeight: 19,
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

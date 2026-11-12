import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, Icon, Portal, Searchbar, Text, TouchableRipple } from 'react-native-paper';
import { ActionTile } from '@/components/ui/ActionTile';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { Player } from '@/types/player';
import { authService } from '@/services/auth';
import { playersService } from '@/services/players';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { isNotReadyMessage } from '@/utils/notReady';
import { matchesMyPlayer } from '@/utils/playerSearch';
import { DEFAULT_MY_PLAYERS_SORT, filterMyPlayers, MyPlayersFilter, MyPlayersSort, myPlayersGridHeight, MY_PLAYERS_CARD_HEIGHT, playerIdBadge, registrationLabel, REGISTRATION_TONE, SORT_CHIP, SORT_OPTIONS, sortMyPlayers, withOwnerFirst } from '@/utils/myPlayersList';
import { shareInvite } from '@/utils/invite';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { BoldName } from '@/components/ui/BoldName';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { Tag } from '@/components/ui/Tag';
import { ClaimRequestsCard } from '@/components/players/ClaimRequestsCard';
import { RegisterPlayersDialog } from '@/components/players/RegisterPlayersDialog';
import { InitialsDialog } from '@/components/players/InitialsDialog';
import { playerIdentityService } from '@/services/playerIdentity';
import { assignInitials, initialsFitName, NAME_CHANGED_NOTE } from '@/utils/initials';

type PlayerCardProps = { player: Player; status: ReturnType<typeof registrationLabel>; isMe: boolean; initials?: string; nameChanged: boolean; onPress: (player: Player) => void };

/** One roster tile. Memoised: typing in the search box redraws only tiles whose inputs changed. */
const PlayerCard = React.memo(function PlayerCard({ player, status, isMe, initials, nameChanged, onPress }: PlayerCardProps) {
  const { colors } = useAppTheme();
  const badge = playerIdBadge(player);
  return (
    <TouchableRipple
      onPress={() => onPress(player)}
      style={[styles.card, { borderColor: colors.outlineVariant, backgroundColor: colors.surface }]}
      accessibilityRole="button"
      accessibilityLabel={`${player.name}, ${initials ? `initials ${initials}, ` : ''}${badge ?? 'no player ID yet'}, ${status.toLowerCase()}${nameChanged ? ', name changed' : ''}`}
    >
      <View style={styles.cardInner}>
        <BoldName name={player.name} numberOfLines={2} style={styles.cardName} />
        <View style={styles.cardMeta}>
          {initials ? (
            <View style={[styles.idBadge, { borderColor: nameChanged ? colors.error : colors.primary, backgroundColor: nameChanged ? colors.errorContainer : colors.primaryContainer }]}>
              <Text variant="labelSmall" style={[styles.idText, { color: nameChanged ? colors.onErrorContainer : colors.onPrimaryContainer }]}>{initials}</Text>
            </View>
          ) : null}
          {badge ? (
            <View style={[styles.idBadge, { borderColor: colors.outline }]}>
              <Text variant="labelSmall" style={[styles.idText, { color: colors.onSurfaceVariant }]}>{badge}</Text>
            </View>
          ) : null}
          {isMe ? <Tag label="You" tone="primary" /> : null}
          {nameChanged ? <Tag label="Name changed" tone="results" small icon="alert-outline" /> : <Tag label={status} tone={REGISTRATION_TONE[status]} small />}
        </View>
      </View>
    </TouchableRipple>
  );
});

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
  const [editingInitials, setEditingInitials] = useState(false);
  const [savingInitials, setSavingInitials] = useState(false);
  const [initialsError, setInitialsError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const player = await authService.getCurrentPlayer();
      setMe(player);
      if (!player) {
        setError('Not signed in.');
        return;
      }
      // The offline copy shows at once; the server list and the open (unregistered) set load side by side.
      const fresh = playersService.listMyPlayers(player.id);
      const open = playerIdentityService.listUnregistered(player.id).catch(() => [] as Player[]);
      const cached = await playersService.readMyPlayers(player.id);
      if (cached.length) setPlayers((current) => (current.length ? current : cached));
      setPlayers(await fresh);
      setUnregistered(Object.fromEntries((await open).map((p) => [p.id, p])));
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

  const statusOf = useCallback((player: Player) => registrationLabel(unregistered[player.id]?.status ?? player.status), [unregistered]);
  // Stored initials (022) win; on an older server every row is derived here, oldest first, the same way.
  const initialsOf = useMemo(() => assignInitials(players.map((player) => ({ id: player.id, name: player.name, initials: player.initials, addedAt: player.addedAt }))), [players]);
  const nameChanged = useCallback((player: Player) => Boolean(player.initials) && !initialsFitName(player.initials, player.name), []);
  const takenFor = useCallback((except: Player | null) => new Map(
    players.filter((player) => player.id !== except?.id).map((player) => [initialsOf.get(player.id) ?? '', player.name] as const).filter(([label]) => label),
  ), [players, initialsOf]);
  // Search, filter and sort run only when their inputs change, not on every render (each keystroke redraws the grid).
  const shown = useMemo(() => {
    const others = sortMyPlayers(
      filterMyPlayers(players.filter((player) => matchesMyPlayer(player, query)), filter, statusOf),
      sort,
    );
    // You are not a roster row, so you are pinned first whenever the search and filter would show you.
    return withOwnerFirst(others, me, Boolean(me) && filter === 'all' && matchesMyPlayer(me as Player, query));
  }, [players, query, filter, sort, statusOf, me]);
  const openCount = useMemo(() => players.filter((player) => statusOf(player) !== 'Registered').length, [players, statusOf]);
  const unregisteredCount = Object.keys(unregistered).length;

  const openRow = useCallback((player: Player) => {
    if (me && player.id === me.id) {
      router.push('/(tabs)/me');
      return;
    }
    setSelected(player);
  }, [me]);

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

  const saveInitials = async (value: string) => {
    if (!selected || !me) return;
    setSavingInitials(true);
    setInitialsError(null);
    try {
      const stored = await playersService.setInitials(me.id, selected.id, value);
      setPlayers((current) => current.map((player) => (player.id === selected.id ? { ...player, initials: stored } : player)));
      setSelected((current) => (current ? { ...current, initials: stored } : current));
      setEditingInitials(false);
    } catch (err) {
      setInitialsError(err instanceof Error ? err.message : formatSupabaseError(err));
    } finally {
      setSavingInitials(false);
    }
  };

  const renderCard = useCallback(({ item: player }: { item: Player }) => (
    <PlayerCard
      player={player}
      status={statusOf(player)}
      isMe={me?.id === player.id}
      initials={me?.id === player.id ? undefined : initialsOf.get(player.id)}
      nameChanged={nameChanged(player)}
      onPress={openRow}
    />
  ), [statusOf, me?.id, openRow, initialsOf, nameChanged]);

  return (
    <Screen>
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
      {!loading && players.length === 0 && !error ? (
        <EmptyState
          icon="account-group-outline"
          title="Only you in My players so far."
          message="Add new players with just initials, or find registered players in the database."
          actionLabel="Add new players"
          onAction={() => router.push('/(screens)/players/add')}
        />
      ) : null}
      <View style={styles.actions} accessibilityRole="toolbar">
        <ActionTile
          icon="account-plus-outline"
          label="Add new players"
          tone="primary"
          onPress={() => router.push('/(screens)/players/add')}
          accessibilityLabel="Add new players"
        />
        <ActionTile
          icon="database-search"
          label="Find player in database"
          tone="tonal"
          onPress={() => router.push('/(screens)/players/new')}
          accessibilityLabel="Find player in database"
        />
        <ActionTile
          icon="account-check-outline"
          label="Register unregistered players"
          tone="outlined"
          badge={unregisteredCount || undefined}
          onPress={() => setRegisterOpen(true)}
          accessibilityLabel={`Register unregistered players${unregisteredCount ? `, ${unregisteredCount} waiting` : ''}`}
        />
      </View>
      {!loading && players.length === 0 ? (
        <Button mode="text" icon="share-variant" onPress={() => shareInvite().catch(() => {})}>
          Invite
        </Button>
      ) : null}

      <RegisterPlayersDialog visible={registerOpen} me={me} onDismiss={() => { setRegisterOpen(false); load(); }} />
      <Portal>
        <Dialog visible={!!selected && !editingInitials} onDismiss={() => setSelected(null)}>
          <Dialog.Title>{selected?.name ?? ''}</Dialog.Title>
          <Dialog.Content style={styles.detail}>
            <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
              {[selected ? (playerIdBadge(selected) ?? 'No player ID yet') : '', selected ? statusOf(selected) : '', `${selected?.gamesTogether ?? 0} games with you`].filter(Boolean).join(' · ')}
            </Text>
            <View style={[styles.initialsBox, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceVariant }]}>
              <View style={styles.flex}>
                <Text variant="labelMedium" style={{ color: colors.onSurfaceVariant }}>Initials on your scorecards</Text>
                <Text variant="headlineSmall" style={styles.initialsText} accessibilityLabel={`Initials ${selected ? initialsOf.get(selected.id) ?? '' : ''}`}>
                  {selected ? initialsOf.get(selected.id) ?? '' : ''}
                </Text>
              </View>
              <Button mode="outlined" compact icon="pencil-outline" onPress={() => { setInitialsError(null); setEditingInitials(true); }} accessibilityLabel="Edit initials">
                Edit
              </Button>
            </View>
            {selected && nameChanged(selected) ? (
              <View style={[styles.note, { backgroundColor: colors.tertiaryContainer }]} accessibilityRole="alert">
                <Icon source="alert-outline" size={18} color={colors.onSurface} />
                <Text variant="bodySmall" style={styles.flex}>
                  {NAME_CHANGED_NOTE} {initialsOf.get(selected.id)} was set when this player had a different name; the name updated by itself, the initials did not. Edit them if you like.
                </Text>
              </View>
            ) : null}
            {initialsError ? <Text variant="bodySmall" style={{ color: colors.error }}>{initialsError}</Text> : null}
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
        {selected && editingInitials ? (
          <InitialsDialog
            name={selected.name}
            current={initialsOf.get(selected.id)}
            taken={takenFor(selected)}
            scope="my-players"
            busy={savingInitials}
            onDismiss={() => setEditingInitials(false)}
            onSave={saveInitials}
          />
        ) : null}
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
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'stretch',
  },
  detail: { gap: spacing.sm },
  flex: { flex: 1 },
  initialsBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm },
  initialsText: { fontWeight: '800', letterSpacing: 2 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, borderRadius: radius.md, padding: spacing.sm },
});

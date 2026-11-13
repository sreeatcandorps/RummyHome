import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, SectionList, StyleSheet, View } from 'react-native';
import { Chip, Dialog, Icon, Portal, Searchbar, Snackbar, Text, TouchableRipple } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { PlayerActionMenu } from '@/components/players/PlayerActionMenu';
import { LinkPlayerDialog } from '@/components/players/LinkPlayerDialog';
import { LinkRequestSentDialog } from '@/components/players/LinkRequestSentDialog';
import { InviteToRegisterDialog } from '@/components/players/InviteToRegisterDialog';
import { EditNameDialog } from '@/components/players/EditNameDialog';
import { myPlayerMenu, SeatMenu, SeatMenuItem } from '@/utils/gamePlayers';
import { LinkRequestOutcome } from '@/utils/linkPlayer';
import { PendingLink } from '@/utils/playerIdentity';
import { ActionTile } from '@/components/ui/ActionTile';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { Player } from '@/types/player';
import { authService } from '@/services/auth';
import { PagedPlayer, playersService } from '@/services/players';
import { REMOVE_CONFIRM_BODY, REMOVE_CONFIRM_TITLE, REMOVED_TOAST, UNDO_REMOVE_MS } from '@/utils/removeMyPlayer';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { isNotReadyMessage } from '@/utils/notReady';
import { matchesMyPlayer } from '@/utils/playerSearch';
import { appendPage, DEFAULT_MY_PLAYERS_SORT, filterMyPlayers, mergeSearchResults, MyPlayersCursor, MyPlayersFilter, MyPlayersSort, myPlayersGridHeight, MY_PLAYERS_CARD_HEIGHT, MY_PLAYERS_PAGE_SIZE, MY_PLAYERS_SEARCH_DEBOUNCE_MS, MY_PLAYERS_SEARCH_LIMIT, nextPageCursor, playerIdBadge, registrationLabel, REGISTRATION_TONE, SEARCH_FULL_NOTE, sectionsByLetter, shouldLoadMore, SORT_CHIP, SORT_OPTIONS, sortMyPlayers, visibleRegistration, withOwnerFirst } from '@/utils/myPlayersList';
import { seatColor } from '@/constants/theme';
import { shareInvite } from '@/utils/invite';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { BoldName } from '@/components/ui/BoldName';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { Tag } from '@/components/ui/Tag';
import { ClaimRequestsCard } from '@/components/players/ClaimRequestsCard';
import { InitialsDialog } from '@/components/players/InitialsDialog';
import { playerIdentityService } from '@/services/playerIdentity';
import { assignInitials, initialsFitName, NAME_CHANGED_NOTE } from '@/utils/initials';

type PlayerCardProps = {
  player: Player;
  status: ReturnType<typeof registrationLabel>;
  index: number;
  initials?: string;
  nameChanged: boolean;
  menu: SeatMenu;
  menuOpen: boolean;
  onPress: (player: Player) => void;
  onMenuOpen: (player: Player) => void;
  onMenuDismiss: () => void;
  onMenuSelect: (item: SeatMenuItem, player: Player) => void;
};

/** One row per player: letters, name, Player ID, status, and the unified ⋮ menu. Memoised: typing in the search box redraws only rows whose inputs changed. */
const PlayerCard = React.memo(function PlayerCard({ player, status, index, initials, nameChanged, menu, menuOpen, onPress, onMenuOpen, onMenuDismiss, onMenuSelect }: PlayerCardProps) {
  const { colors } = useAppTheme();
  const badge = playerIdBadge(player);
  return (
    <View style={[styles.card, { borderBottomColor: colors.outlineVariant }]} testID={`my-player-row-${player.id}`}>
      <TouchableRipple
        onPress={() => onPress(player)}
        style={styles.cardPress}
        accessibilityRole="button"
        accessibilityLabel={`${player.name}, ${initials ? `initials ${initials}, ` : ''}${badge ?? 'no player ID yet'}, ${status.toLowerCase()}${nameChanged ? ', name changed' : ''}`}
      >
        <View style={styles.cardInner}>
          <SeatAvatar name={player.name} label={initials} color={seatColor(index)} size={36} />
          <View style={styles.flex}>
            <BoldName name={player.name} numberOfLines={1} style={styles.cardName} />
            <View style={styles.cardMeta}>
              {badge ? (
                <View style={[styles.idBadge, { borderColor: colors.outline }]}>
                  <Text variant="labelSmall" style={[styles.idText, { color: colors.onSurfaceVariant }]}>{badge}</Text>
                </View>
              ) : null}
              {nameChanged ? <Tag label="Name changed" tone="results" icon="alert-outline" /> : visibleRegistration(status) ? <Tag label={status} tone={REGISTRATION_TONE[status]} wrap /> : null}
            </View>
          </View>
        </View>
      </TouchableRipple>
      <PlayerActionMenu
        name={player.name}
        items={menu}
        visible={menuOpen}
        onOpen={() => onMenuOpen(player)}
        onDismiss={onMenuDismiss}
        onSelect={(item) => onMenuSelect(item, player)}
      />
    </View>
  );
});

export default function PlayersTab() {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const [me, setMe] = useState<Player | null>(null);
  /** The pages loaded so far (030), in `sort` order. */
  const [players, setPlayers] = useState<PagedPlayer[]>([]);
  const [cursor, setCursor] = useState<MyPlayersCursor>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  /** How many My players there are in all, for the header; the list may hold fewer until scrolled. */
  const [total, setTotal] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  /** The server's answer for the current query (030), or null while nothing is typed. */
  const [searchRows, setSearchRows] = useState<PagedPlayer[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [sort, setSort] = useState<MyPlayersSort>(DEFAULT_MY_PLAYERS_SORT);
  const [filter, setFilter] = useState<MyPlayersFilter>('all');
  const [loading, setLoading] = useState(true);
  const sortRef = useRef(sort);
  sortRef.current = sort;
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Player | null>(null);
  const [removing, setRemoving] = useState(false);
  /** The player just removed, while the Undo toast is up. */
  const [undo, setUndo] = useState<Player | null>(null);
  const [unregistered, setUnregistered] = useState<Record<string, Player>>({});
  // Open Link to Player ID requests (025) I sent, so those rows read Link pending.
  const [linkRequests, setLinkRequests] = useState<Record<string, PendingLink>>({});
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [sheet, setSheet] = useState<
    | { kind: 'invite'; player: Player }
    | { kind: 'link'; player: Player }
    | { kind: 'link_sent'; outcome: LinkRequestOutcome }
    | { kind: 'edit_name'; player: Player }
    | null
  >(null);
  const [sheetBusy, setSheetBusy] = useState(false);
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
      // The offline copy shows at once; the first page, the count and the open (unregistered) set load side by side.
      const currentSort = sortRef.current;
      const firstPage = playersService.listMyPlayersPage(player.id, currentSort, null);
      const count = playersService.countMyPlayers(player.id).catch(() => null);
      const open = playerIdentityService.listUnregistered(player.id).catch(() => [] as Player[]);
      const requests = playerIdentityService.listLinkRequests(player.id).catch(() => [] as PendingLink[]);
      const cached = await playersService.readMyPlayers(player.id);
      if (cached.length) setPlayers((current) => (current.length ? current : sortMyPlayers(cached, currentSort)));
      const page = await firstPage;
      setPlayers(page);
      setCursor(nextPageCursor(page, MY_PLAYERS_PAGE_SIZE));
      setHasMore(page.length >= MY_PLAYERS_PAGE_SIZE);
      const n = await count;
      setTotal(n ?? page.length);
      setUnregistered(Object.fromEntries((await open).map((p) => [p.id, p])));
      setLinkRequests(Object.fromEntries((await requests).map((l) => [l.playerId, l])));
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  // A different sort is a different page order: start again from the first page.
  const firstSort = useRef(true);
  useEffect(() => {
    if (firstSort.current) { firstSort.current = false; return; }
    setPlayers([]);
    setCursor(null);
    setHasMore(false);
    load();
  }, [sort, load]);

  /** The next page (030), when the list nears its end. */
  const loadMore = useCallback(async () => {
    if (!me || !hasMore || loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await playersService.listMyPlayersPage(me.id, sort, cursor);
      setPlayers((current) => appendPage(current, page));
      setCursor(nextPageCursor(page, MY_PLAYERS_PAGE_SIZE));
      setHasMore(page.length >= MY_PLAYERS_PAGE_SIZE);
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setLoadingMore(false);
    }
  }, [me, hasMore, loadingMore, cursor, sort]);

  // The Unregistered filter looks across everyone, so it pulls the remaining pages in.
  useEffect(() => {
    if (filter === 'unregistered' && hasMore && !loadingMore) void loadMore();
  }, [filter, hasMore, loadingMore, loadMore]);

  // Typing: the rows on the phone that match show at once; the server search (030) follows after a pause.
  useEffect(() => {
    const trimmed = query.trim();
    if (!me || !trimmed) { setSearchRows(null); setSearching(false); return; }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await playersService.searchMyPlayers(me.id, trimmed);
        if (!cancelled) setSearchRows(rows);
      } catch {
        if (!cancelled) setSearchRows(null);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, MY_PLAYERS_SEARCH_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, me]);

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: `My players · ${total ?? players.length}` });
  }, [navigation, total, players.length]);

  const statusOf = useCallback((player: Player) => registrationLabel(unregistered[player.id]?.status ?? player.status, Boolean(linkRequests[player.id])), [unregistered, linkRequests]);
  // Stored initials (022) win; on an older server every row is derived here, oldest first, the same way.
  const initialsOf = useMemo(() => assignInitials(players.map((player) => ({ id: player.id, name: player.name, initials: player.initials, addedAt: player.addedAt }))), [players]);
  const nameChanged = useCallback((player: Player) => Boolean(player.initials) && !initialsFitName(player.initials, player.name), []);
  const takenFor = useCallback((except: Player | null) => new Map(
    players.filter((player) => player.id !== except?.id).map((player) => [initialsOf.get(player.id) ?? '', player.name] as const).filter(([label]) => label),
  ), [players, initialsOf]);
  // Search, filter and sort run only when their inputs change, not on every render (each keystroke redraws the grid).
  const shown = useMemo(() => {
    const trimmed = query.trim();
    const pool = trimmed ? mergeSearchResults(players.filter((player) => matchesMyPlayer(player, trimmed)), searchRows) : players;
    // Pages arrive in server order; a search answer is re-sorted the same way so the list never jumps.
    const others = trimmed ? sortMyPlayers(filterMyPlayers(pool, filter, statusOf), sort) : filterMyPlayers(pool, filter, statusOf);
    // You are not a roster row, so you are pinned first whenever the search and filter would show you.
    return withOwnerFirst(others, me, Boolean(me) && filter === 'all' && matchesMyPlayer(me as Player, query));
  }, [players, query, searchRows, filter, sort, statusOf, me]);
  const sections = useMemo(() => (sort === 'name' && !query.trim() ? sectionsByLetter(shown, me?.id) : null), [sort, query, shown, me?.id]);
  const searchFull = Boolean(query.trim()) && (searchRows?.length ?? 0) >= MY_PLAYERS_SEARCH_LIMIT;
  const openCount = useMemo(() => players.filter((player) => statusOf(player) !== 'Registered').length, [players, statusOf]);

  const openRow = useCallback((player: Player) => {
    if (me && player.id === me.id) {
      router.push('/(tabs)/me');
      return;
    }
    setSelected(player);
  }, [me]);

  const remove = async (target?: Player) => {
    const removed = target ?? selected;
    if (!removed || !me) return;
    setPlayers((current) => current.filter((player) => player.id !== removed.id));
    setSelected(null);
    setRemoving(true);
    try {
      await playersService.removeMyPlayer(me.id, removed.id);
      setUndo(removed);
      setTotal((n) => (n == null ? n : Math.max(0, n - 1)));
    } catch (err) {
      setPlayers((current) => [removed, ...current.filter((player) => player.id !== removed.id)]);
      setError(err instanceof Error ? err.message : 'Couldn’t remove them. Try again.');
    } finally {
      setRemoving(false);
    }
  };

  /** Undo on the toast: the row comes back with its games together and, when still free, its initials. */
  const undoRemove = async () => {
    const back = undo;
    if (!back || !me) return;
    setUndo(null);
    setPlayers((current) => [back, ...current.filter((player) => player.id !== back.id)]);
    try {
      await playersService.restoreMyPlayer(me.id, back.id);
      setTotal((n) => (n == null ? n : n + 1));
      await load();
    } catch (err) {
      setPlayers((current) => current.filter((player) => player.id !== back.id));
      setError(formatSupabaseError(err));
    }
  };

  const confirmRemove = (target?: Player) => {
    const who = target ?? selected;
    if (!who) return;
    Alert.alert(REMOVE_CONFIRM_TITLE(who.name), REMOVE_CONFIRM_BODY, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove(who) },
    ]);
  };

  /** The unified ⋮ menu (utils/gamePlayers.myPlayerMenu): Invite · Link · Edit initials · Edit name · Remove from My players. */
  const act = (item: SeatMenuItem, player: Player) => {
    setMenuFor(null);
    const full = unregistered[player.id] ? { ...player, ...unregistered[player.id], initials: player.initials, addedAt: player.addedAt } : player;
    if (item === 'invite') setSheet({ kind: 'invite', player: full });
    else if (item === 'link_id') setSheet({ kind: 'link', player: full });
    else if (item === 'edit_name') setSheet({ kind: 'edit_name', player: full });
    else if (item === 'edit_initials') { setInitialsError(null); setSelected(player); setEditingInitials(true); }
    else if (item === 'remove_from_list') confirmRemove(player);
  };

  const saveName = async (first: string, last: string) => {
    if (!me || sheet?.kind !== 'edit_name') return;
    setSheetBusy(true);
    try {
      await playerIdentityService.updateNewPlayer(me.id, sheet.player.id, first, last);
      setSheet(null);
      await load();
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setSheetBusy(false);
    }
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

  const menuFor_ = useCallback((player: Player) => myPlayerMenu({ id: player.id, status: unregistered[player.id]?.status ?? player.status, managedBy: unregistered[player.id]?.managedBy ?? player.managedBy ?? (unregistered[player.id] ? me?.id : undefined) }, me?.id), [unregistered, me?.id]);
  const openMenu = useCallback((player: Player) => setMenuFor(player.id), []);
  const closeMenu = useCallback(() => setMenuFor(null), []);

  const onEndReached = useCallback(() => {
    if (!query.trim() && shouldLoadMore(hasMore, loadingMore)) void loadMore();
  }, [query, hasMore, loadingMore, loadMore]);

  const footer = useMemo(() => (loadingMore || (searching && searchRows == null)
    ? <ActivityIndicator style={styles.footer} accessibilityLabel={searching ? 'Searching' : 'Loading more players'} />
    : null), [loadingMore, searching, searchRows]);

  const renderSectionHeader = useCallback(({ section }: { section: { title: string } }) => (
    <View style={[styles.sectionHeader, { backgroundColor: colors.surfaceVariant }]} accessibilityRole="header">
      <Text variant="labelLarge" style={{ color: colors.onSurfaceVariant }}>{section.title}</Text>
    </View>
  ), [colors]);

  const renderCard = useCallback(({ item: player, index }: { item: Player; index: number }) => (
    <PlayerCard
      player={player}
      status={statusOf(player)}
      index={index}
      initials={me?.id === player.id ? undefined : initialsOf.get(player.id)}
      nameChanged={nameChanged(player)}
      menu={menuFor_(player)}
      menuOpen={menuFor === player.id}
      onPress={openRow}
      onMenuOpen={openMenu}
      onMenuDismiss={closeMenu}
      onMenuSelect={act}
    />
  ), [statusOf, me?.id, openRow, initialsOf, nameChanged, menuFor_, menuFor, openMenu, closeMenu, act]);

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
      {searchFull ? (
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }} testID="search-full-note">{SEARCH_FULL_NOTE(MY_PLAYERS_SEARCH_LIMIT)}</Text>
      ) : null}
      {shown.length > 0 && sections ? (
        <SectionList
          sections={sections}
          keyExtractor={(player) => player.id}
          renderItem={renderCard}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={footer}
          initialNumToRender={12}
          windowSize={7}
          style={[styles.grid, { height: myPlayersGridHeight(shown.length), borderColor: colors.outlineVariant }]}
          nestedScrollEnabled
          showsVerticalScrollIndicator
          accessibilityLabel="My players list, A to Z"
          testID="my-players-sections"
        />
      ) : null}
      {shown.length > 0 && !sections ? (
        <FlatList
          data={shown}
          keyExtractor={(player) => player.id}
          renderItem={renderCard}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={footer}
          initialNumToRender={12}
          windowSize={7}
          getItemLayout={(_, index) => ({ length: MY_PLAYERS_CARD_HEIGHT, offset: MY_PLAYERS_CARD_HEIGHT * index, index })}
          style={[styles.grid, { height: myPlayersGridHeight(shown.length), borderColor: colors.outlineVariant }]}
          nestedScrollEnabled
          showsVerticalScrollIndicator
          accessibilityLabel="My players list"
          testID="my-players-list"
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
          icon={filter === 'unregistered' ? 'filter-check' : 'account-question-outline'}
          label={filter === 'unregistered' ? 'Showing unregistered' : `Unregistered · ${openCount}`}
          tone={filter === 'unregistered' ? 'tonal' : 'outlined'}
          onPress={() => setFilter((cur) => (cur === 'all' ? 'unregistered' : 'all'))}
          accessibilityLabel={filter === 'unregistered' ? 'Showing unregistered only. Tap to show everyone' : `Show unregistered only, ${openCount}`}
        />
      </View>
      {!loading && players.length === 0 ? (
        <Button mode="text" icon="share-variant" onPress={() => shareInvite().catch(() => {})}>
          Invite
        </Button>
      ) : null}

      <Portal>
        {sheet?.kind === 'invite' && me ? (
          <InviteToRegisterDialog player={sheet.player} owner={me} onDismiss={() => { setSheet(null); load(); }} />
        ) : null}
        {sheet?.kind === 'link' && me ? (
          <LinkPlayerDialog
            player={sheet.player}
            owner={me}
            pending={linkRequests[sheet.player.id] ?? null}
            onDismiss={() => setSheet(null)}
            onRequested={(outcome) => { setSheet({ kind: 'link_sent', outcome }); load(); }}
            onCancelled={() => { setSheet(null); load(); }}
          />
        ) : null}
        {sheet?.kind === 'link_sent' ? <LinkRequestSentDialog outcome={sheet.outcome} onDismiss={() => setSheet(null)} /> : null}
        {sheet?.kind === 'edit_name' ? (
          <EditNameDialog seat={sheet.player} busy={sheetBusy} onDismiss={() => setSheet(null)} onSave={saveName} />
        ) : null}
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
            <Button textColor={colors.error} onPress={() => confirmRemove()} loading={removing}>
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
        <Snackbar
          visible={Boolean(undo)}
          onDismiss={() => setUndo(null)}
          duration={UNDO_REMOVE_MS}
          action={{ label: 'Undo', onPress: undoRemove }}
          testID="remove-undo"
        >
          {undo ? REMOVED_TOAST(undo.name) : ''}
        </Snackbar>
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
  card: {
    height: MY_PLAYERS_CARD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cardPress: { flex: 1, height: '100%', justifyContent: 'center' },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  cardName: {
    lineHeight: 19,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  idBadge: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 8,
    minHeight: 28,
    justifyContent: 'center',
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
  footer: { paddingVertical: spacing.sm },
  sectionHeader: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  flex: { flex: 1 },
  initialsBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm },
  initialsText: { fontWeight: '800', letterSpacing: 2 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, borderRadius: radius.md, padding: spacing.sm },
});

import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Portal, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Player } from '@/types/player';
import { authService } from '@/services/auth';
import { playersService } from '@/services/players';
import { isSupabaseConfigured } from '@/services/supabase';
import { storage } from '@/utils/storage';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { noOneHasLine, parsePlayerIdQuery } from '@/utils/playerSearch';
import { shareInvite } from '@/utils/invite';
import { newGameDraft } from '@/utils/newGameDraft';
import { HelpButton } from '@/components/ui/HelpButton';
import { Screen } from '@/components/ui/Screen';
import { PlayerIdBox, PlayerIdResultCard } from '@/components/players/PlayerIdSearch';
import { InitialsDialog } from '@/components/players/InitialsDialog';
import { assignInitials, defaultInitials } from '@/utils/initials';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { ADD_NEW_PLAYERS, ADD_TO_GAME, ADD_TO_MY_PLAYERS, FIND_IN_DATABASE, FROM_DATABASE_ACCESSIBILITY, PLAYER_ID_NUMBER_ONLY } from '@/utils/addPlayers';

/**
 * Two jobs, one screen. From My players it adds people to your list.
 * From New game (`from=new-game`) it also seats them in the game being set up.
 * The search is a Player ID only (D113): type the number, tap Search, check the one name that comes
 * back ("#57 · Ravi K.") or "No one has #58.", then add. Names are never searched.
 */
export default function FindPlayersScreen() {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ from?: string; seated?: string }>();
  const fromNewGame = params.from === 'new-game';
  const seatedIds = React.useMemo(() => new Set((params.seated ?? '').split(',').filter(Boolean)), [params.seated]);
  const [addedHere, setAddedHere] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<Player | null>(null);
  /** The Player ID last searched; null while typing, so nothing shows until Search. */
  const [searchedNo, setSearchedNo] = useState<number | null>(null);
  const [myIds, setMyIds] = useState<Set<string>>(new Set());
  const [mine, setMine] = useState<Player[]>([]);
  /** Players added on this screen whose initials came out as three letters (a clash in My players). */
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [editInitials, setEditInitials] = useState<Player | null>(null);
  const [savingInitials, setSavingInitials] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: FIND_IN_DATABASE,
      headerRight: () => <HelpButton topic="add-players" anchor="find-in-database" />,
    });
  }, [navigation, fromNewGame]);

  useEffect(() => {
    const loadOwner = async () => {
      const id = isSupabaseConfigured ? await authService.getCurrentUserId() : await storage.getCurrentPlayer();
      setOwnerId(id);
      if (!id) return;
      const cached = await playersService.readMyPlayers(id).catch(() => [] as Player[]);
      setMyIds(new Set(cached.map((player) => player.id)));
      setMine(cached);
      playersService.listMyPlayers(id)
        .then((fresh) => { setMyIds(new Set(fresh.map((player) => player.id))); setMine(fresh); })
        .catch(() => {});
    };
    loadOwner();
  }, []);

  const changeQuery = useCallback((text: string) => {
    setQuery(text);
    setResult(null);
    setSearchedNo(null);
    setError(null);
  }, []);

  const search = useCallback(async () => {
    const playerNo = parsePlayerIdQuery(query);
    setResult(null);
    setSearchedNo(null);
    if (playerNo === null) {
      setError(PLAYER_ID_NUMBER_ONLY);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const found = await playersService.searchPlayers(String(playerNo));
      setResult(found[0] ?? null);
      setSearchedNo(playerNo);
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setSearching(false);
    }
  }, [query]);

  const add = useCallback(async (player: Player) => {
    if (!ownerId) {
      setError('Not signed in.');
      return;
    }
    setBusy((current) => ({ ...current, [player.id]: true }));
    try {
      let name = player.name;
      // The organiser is never a roster row of their own; adding "you" only seats you in the new game.
      if (player.id !== ownerId) {
        await playersService.addMyPlayer(ownerId, player);
        setMyIds((current) => new Set([...current, player.id]));
        // The database gave them unique initials; say so when the short form was already someone else's.
        const fresh = await playersService.listMyPlayers(ownerId, { fresh: true }).catch(() => null);
        if (fresh) {
          setMine(fresh);
          // The lookup showed "Ravi K."; once they are in My players the list has their full name.
          name = fresh.find((row) => row.id === player.id)?.name ?? name;
          const labels = assignInitials(fresh.map((row) => ({ id: row.id, name: row.name, initials: row.initials, addedAt: row.addedAt })));
          const label = labels.get(player.id);
          const short = defaultInitials(player.name);
          if (label && label !== short) {
            const holder = fresh.find((row) => row.id !== player.id && labels.get(row.id) === short);
            setNotes((current) => ({ ...current, [player.id]: holder ? `${short} is ${holder.name}, so ${player.name.split(' ')[0]} is ${label} on your scorecards.` : `${player.name.split(' ')[0]} is ${label} on your scorecards.` }));
          }
        }
      }
      if (fromNewGame) {
        newGameDraft.add({ id: player.id, name, playerCode: player.playerCode });
        setAddedHere((current) => new Set([...current, player.id]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : formatSupabaseError(err));
    } finally {
      setBusy((current) => ({ ...current, [player.id]: false }));
    }
  }, [ownerId, fromNewGame]);

  const initialsOf = assignInitials(mine.map((row) => ({ id: row.id, name: row.name, initials: row.initials, addedAt: row.addedAt })));
  const saveInitials = async (value: string) => {
    if (!editInitials || !ownerId) return;
    setSavingInitials(true);
    try {
      await playersService.setInitials(ownerId, editInitials.id, value);
      const fresh = await playersService.listMyPlayers(ownerId, { fresh: true }).catch(() => null);
      if (fresh) setMine(fresh);
      setNotes((current) => { const next = { ...current }; delete next[editInitials.id]; return next; });
      setEditInitials(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : formatSupabaseError(err));
      setEditInitials(null);
    } finally {
      setSavingInitials(false);
    }
  };

  // From New game the question is "already seated?", not "already in My players?".
  const inList = result ? (fromNewGame ? seatedIds.has(result.id) || addedHere.has(result.id) : myIds.has(result.id)) : false;
  const isMe = result?.id === ownerId;

  return (
    <Screen>
      <PlayerIdBox
        value={query}
        onChangeText={changeQuery}
        onSearch={search}
        searching={searching}
        accessibilityLabel={fromNewGame ? FROM_DATABASE_ACCESSIBILITY : FIND_IN_DATABASE}
        autoFocus
      />
      {error ? <Text variant="bodyMedium" style={{ color: colors.error }}>{error}</Text> : null}
      {result && searchedNo !== null ? (
        <PlayerIdResultCard playerNo={searchedNo} name={result.name}>
          {isMe && !fromNewGame ? (
            <View style={[styles.inList, { backgroundColor: colors.surfaceVariant }]} accessibilityLabel="This is you">
              <Text variant="labelMedium" style={{ color: colors.onSurfaceVariant }}>This is you</Text>
            </View>
          ) : inList ? (
            <View
              style={[styles.inList, { backgroundColor: colors.surfaceVariant }]}
              accessibilityLabel={fromNewGame ? `${result.name} is in this game` : `${result.name} is in your player list`}
            >
              <Icon source="check" size={16} color={colors.onSurfaceVariant} />
              <Text variant="labelMedium" style={{ color: colors.onSurfaceVariant }}>{fromNewGame ? 'In this game' : 'In your player list'}</Text>
            </View>
          ) : (
            <Button
              mode="contained"
              onPress={() => add(result)}
              loading={!!busy[result.id]}
              disabled={!!busy[result.id]}
              accessibilityLabel={fromNewGame ? (isMe ? 'Add yourself to this game' : `Add ${result.name} to this game`) : `Add ${result.name} to My players`}
              testID="player-id-add"
            >
              {fromNewGame ? ADD_TO_GAME : ADD_TO_MY_PLAYERS}
            </Button>
          )}
        </PlayerIdResultCard>
      ) : null}
      {result && notes[result.id] ? (
        <View style={styles.note}>
          <Text variant="labelSmall" style={[styles.flex, { color: colors.onSurfaceVariant }]}>{notes[result.id]}</Text>
          <Button compact mode="text" onPress={() => setEditInitials(result)} accessibilityLabel={`Edit initials for ${result.name}`}>Edit</Button>
        </View>
      ) : null}
      {!result && searchedNo !== null && !searching ? (
        <View style={styles.none} testID="player-id-none">
          <Text variant="bodyLarge" style={{ fontWeight: '700' }}>{noOneHasLine(searchedNo)}</Text>
          <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
            Check the number with them. No app yet? Go back and use {ADD_NEW_PLAYERS}.
          </Text>
        </View>
      ) : null}
      <Portal>
        {editInitials ? (
          <InitialsDialog
            name={editInitials.name}
            current={initialsOf.get(editInitials.id)}
            taken={new Map(mine.filter((row) => row.id !== editInitials.id).map((row) => [initialsOf.get(row.id) ?? '', row.name] as const).filter(([label]) => label))}
            scope="my-players"
            busy={savingInitials}
            onDismiss={() => setEditInitials(null)}
            onSave={saveInitials}
          />
        ) : null}
      </Portal>
      {fromNewGame ? (
        <Button mode="outlined" icon="arrow-left" onPress={() => router.back()} style={styles.back}>
          Back to new game
        </Button>
      ) : (
        <Button mode="text" icon="share-variant" onPress={() => shareInvite().catch(() => {})} style={styles.back}>
          Invite someone new
        </Button>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  inList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  back: {
    marginTop: spacing.sm,
  },
  note: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  none: { gap: spacing.xxs },
  flex: { flex: 1 },
});

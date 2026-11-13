import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Portal, Searchbar, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Player } from '@/types/player';
import { authService } from '@/services/auth';
import { playersService } from '@/services/players';
import { isSupabaseConfigured } from '@/services/supabase';
import { storage } from '@/utils/storage';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { playerSearchMode } from '@/utils/playerSearch';
import { orderDatabaseResults, playerIdBadge } from '@/utils/myPlayersList';
import { shareInvite } from '@/utils/invite';
import { newGameDraft } from '@/utils/newGameDraft';
import { HELP } from '@/constants/help';
import { HelpButton } from '@/components/ui/HelpButton';
import { Screen } from '@/components/ui/Screen';
import { BoldName } from '@/components/ui/BoldName';
import { InitialsDialog } from '@/components/players/InitialsDialog';
import { assignInitials, defaultInitials } from '@/utils/initials';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { FROM_DATABASE_ACCESSIBILITY } from '@/utils/addPlayers';

/**
 * Two jobs, one screen. From My players it adds people to your list.
 * From New game (`from=new-game`) it also seats them in the game being set up.
 */
export default function FindPlayersScreen() {
  const { colors } = useAppTheme();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ from?: string; seated?: string }>();
  const fromNewGame = params.from === 'new-game';
  const seatedIds = React.useMemo(() => new Set((params.seated ?? '').split(',').filter(Boolean)), [params.seated]);
  const [addedHere, setAddedHere] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Player[]>([]);
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
      title: fromNewGame ? 'From the EZ Score database' : 'Find player in database',
      headerRight: () => <HelpButton text={fromNewGame ? HELP.addToGame : HELP.find} />,
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

  useEffect(() => {
    const mode = playerSearchMode(query);
    if (mode === 'none') {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        setError(null);
        const found = await playersService.searchPlayers(query);
        setResults(found);
      } catch (err) {
        setResults([]);
        setError(formatSupabaseError(err));
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const add = useCallback(async (player: Player) => {
    if (!ownerId) {
      setError('Not signed in.');
      return;
    }
    setBusy((current) => ({ ...current, [player.id]: true }));
    try {
      // The organiser is never a roster row of their own; adding "you" only seats you in the new game.
      if (player.id !== ownerId) {
        await playersService.addMyPlayer(ownerId, player);
        setMyIds((current) => new Set([...current, player.id]));
        // The database gave them unique initials; say so when the short form was already someone else's.
        const fresh = await playersService.listMyPlayers(ownerId, { fresh: true }).catch(() => null);
        if (fresh) {
          setMine(fresh);
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
        newGameDraft.add({ id: player.id, name: player.name, playerCode: player.playerCode });
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
  const ordered = orderDatabaseResults(results, fromNewGame ? new Set([...seatedIds, ...addedHere]) : myIds);
  const nothing = playerSearchMode(query) !== 'none' && !searching && results.length === 0;

  return (
    <Screen>
      <Searchbar
        placeholder="Name or player ID"
        value={query}
        onChangeText={setQuery}
        style={[styles.search, { backgroundColor: colors.leaderContainer }]}
        iconColor={colors.onLeaderContainer}
        placeholderTextColor={colors.onLeaderContainer}
        accessibilityLabel={fromNewGame ? FROM_DATABASE_ACCESSIBILITY : 'Find player in database'}
        autoFocus
      />
      {error ? <Text variant="bodyMedium" style={{ color: colors.error }}>{error}</Text> : null}
      <View style={styles.list}>
      {ordered.map((player) => {
        const badge = playerIdBadge(player);
        const isMe = player.id === ownerId;
        const inList = player.inMyPlayers;
        return (
          <View key={player.id} style={[styles.row, { borderColor: colors.outlineVariant, backgroundColor: colors.surface }]}>
            <View style={styles.text}>
              <BoldName name={player.name} variant="titleMedium" numberOfLines={2} style={styles.name} />
              {badge ? (
                <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{badge}</Text>
              ) : null}
              {notes[player.id] ? (
                <View style={styles.note}>
                  <Text variant="labelSmall" style={[styles.flex, { color: colors.onSurfaceVariant }]}>{notes[player.id]}</Text>
                  <Button compact mode="text" onPress={() => setEditInitials(player)} accessibilityLabel={`Edit initials for ${player.name}`}>Edit</Button>
                </View>
              ) : null}
            </View>
            {isMe && !fromNewGame ? (
              <View style={[styles.inList, { backgroundColor: colors.surfaceVariant }]} accessibilityLabel="This is you">
                <Text variant="labelMedium" style={{ color: colors.onSurfaceVariant }}>This is you</Text>
              </View>
            ) : inList ? (
              <View
                style={[styles.inList, { backgroundColor: colors.surfaceVariant }]}
                accessibilityLabel={fromNewGame ? `${player.name} is in this game` : `${player.name} is in your player list`}
              >
                <Icon source="check" size={16} color={colors.onSurfaceVariant} />
                <Text variant="labelMedium" style={{ color: colors.onSurfaceVariant }}>{fromNewGame ? 'In this game' : 'In your player list'}</Text>
              </View>
            ) : (
              <Button
                mode="contained"
                compact
                onPress={() => add(player)}
                loading={!!busy[player.id]}
                disabled={!!busy[player.id]}
                accessibilityLabel={fromNewGame ? (isMe ? 'Add yourself to this game' : `Add ${player.name} to this game`) : `Add ${player.name} to My players`}
              >
                {fromNewGame ? (isMe ? '+ Add me' : '+ Add') : '+ My players'}
              </Button>
            )}
          </View>
        );
      })}
      </View>
      {nothing ? (
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
          No registered player matches that. Not in the database? Go back and use {fromNewGame ? 'Add players' : 'Add new players'}.
        </Text>
      ) : null}
      {!nothing && results.length === 0 ? (
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
          {fromNewGame ? `${FROM_DATABASE_ACCESSIBILITY}. ` : ''}Type at least two letters of a name, or a player ID such as 42.
        </Text>
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
        <Button mode="contained-tonal" icon="arrow-left" onPress={() => router.back()} style={styles.back}>
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
  search: {
    marginBottom: 0,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    lineHeight: 20,
  },
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
  flex: { flex: 1 },
});

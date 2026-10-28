import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Searchbar, Text } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { Player } from '@/types/player';
import { authService } from '@/services/auth';
import { playersService } from '@/services/players';
import { isSupabaseConfigured } from '@/services/supabase';
import { storage } from '@/utils/storage';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { playerSearchMode } from '@/utils/playerSearch';
import { shareInvite } from '@/utils/invite';
import { markPlayerToCheck } from '@/utils/pendingPlayer';
import { Screen } from '@/components/ui/Screen';
import { spacing, useAppTheme } from '@/constants/theme';

export default function FindPlayersScreen() {
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ from?: string }>();
  const fromNewGame = params.from === 'new-game';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Player[]>([]);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  useEffect(() => {
    const loadOwner = async () => {
      const id = isSupabaseConfigured ? await authService.getCurrentUserId() : await storage.getCurrentPlayer();
      setOwnerId(id);
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

  const add = async (player: Player) => {
    if (!ownerId) {
      setError('Not signed in.');
      return;
    }
    setAdded((current) => ({ ...current, [player.id]: true }));
    try {
      await playersService.addMyPlayer(ownerId, player);
      if (fromNewGame) markPlayerToCheck(player.id);
    } catch (err) {
      setAdded((current) => ({ ...current, [player.id]: false }));
      setError(err instanceof Error ? err.message : formatSupabaseError(err));
    }
  };

  const nothing = playerSearchMode(query) !== 'none' && !searching && results.length === 0;

  return (
    <Screen>
      <Searchbar
        placeholder="First, last, email, or ID"
        value={query}
        onChangeText={setQuery}
        style={styles.search}
        accessibilityLabel="Find players"
      />
      {error ? <Text variant="bodyMedium" style={{ color: colors.error }}>{error}</Text> : null}
      {results.map((player) => (
        <View key={player.id} style={[styles.row, { borderColor: colors.outlineVariant }]}>
          <View style={styles.text}>
            <Text variant="titleMedium">{player.name}</Text>
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{player.playerCode || '—'}</Text>
          </View>
          <Button
            mode={added[player.id] ? 'text' : 'contained'}
            onPress={() => add(player)}
            disabled={!!added[player.id]}
            accessibilityLabel={added[player.id] ? 'Added' : `Add ${player.name}`}
          >
            {added[player.id] ? 'Added' : '+'}
          </Button>
        </View>
      ))}
      {nothing ? (
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
          No account matches that. Invite them and they can join after they sign up.
        </Text>
      ) : null}
      <Button mode="outlined" icon="share-variant" onPress={() => shareInvite().catch(() => {})} style={styles.invite}>
        Invite someone new
      </Button>
      {fromNewGame ? (
        <Button mode="text" onPress={() => router.back()}>Back to new game</Button>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  text: {
    flex: 1,
  },
  invite: {
    marginTop: spacing.lg,
  },
});

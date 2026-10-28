import React, { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, Searchbar, Switch, Text, TextInput } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { Player } from '@/types/player';
import { gamesService } from '@/services/games';
import { playersService } from '@/services/players';
import { authService } from '@/services/auth';
import { isSupabaseConfigured } from '@/services/supabase';
import { storage } from '@/utils/storage';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { matchesMyPlayer } from '@/utils/playerSearch';
import { takePlayerToCheck } from '@/utils/pendingPlayer';
import { pointsGameLabel } from '@/constants/features';
import { legacySettingsForGameType } from '@/utils/scoring';
import { Screen } from '@/components/ui/Screen';
import { BottomBar } from '@/components/ui/BottomBar';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { spacing, useAppTheme } from '@/constants/theme';

export default function NewGame() {
  const { colors } = useAppTheme();
  const defaults = legacySettingsForGameType('stake');
  const [selected, setSelected] = useState<string[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [me, setMe] = useState<Player | null>(null);
  const [includeMe, setIncludeMe] = useState(true);
  const [expenseEnabled, setExpenseEnabled] = useState(true);
  const [expenseDigits, setExpenseDigits] = useState(String(Math.abs(defaults.expenseAmount)));
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const userId = isSupabaseConfigured ? await authService.getCurrentUserId() : await storage.getCurrentPlayer();
      const current = await authService.getCurrentPlayer();
      setMe(current);
      if (!userId) {
        setError('You must be signed in to create a game.');
        return;
      }
      const mine = await playersService.listMyPlayers(userId);
      setPlayers(mine);
      const pending = takePlayerToCheck();
      if (pending) setSelected((currentIds) => (currentIds.includes(pending) ? currentIds : [...currentIds, pending]));
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const others = useMemo(
    () => players.filter((player) => player.id !== me?.id && matchesMyPlayer(player, query)),
    [players, me?.id, query],
  );

  const seatedCount = selected.filter((id) => id !== me?.id).length + (includeMe && me ? 1 : 0);
  const startDisabled = seatedCount < 2;

  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const startGame = async () => {
    if (!me) return;
    const playerIds = includeMe
      ? [me.id, ...selected.filter((id) => id !== me.id)]
      : selected.filter((id) => id !== me.id);
    if (playerIds.length < 2) return;
    setCreating(true);
    try {
      const game = await gamesService.createGame({
        playerIds,
        gameType: 'stake',
        expenseEnabled,
        expenseAmount: -Math.abs(parseInt(expenseDigits || '0', 10) || 0),
        createdBy: me.id,
      });
      router.replace(`/(screens)/games/${game.id}`);
    } catch (err) {
      Alert.alert('Could not create game', formatSupabaseError(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Screen
      contentStyle={styles.content}
    >
      <Text variant="titleMedium">{pointsGameLabel()}</Text>
      <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
        Drop {defaults.dropAmount} · Middle {defaults.mdAmount} · Max {defaults.maxCount}
      </Text>
      <View style={styles.expense}>
        <Text variant="bodyLarge">Expense</Text>
        <TextInput
          mode="outlined"
          dense
          value={expenseDigits}
          onChangeText={(text) => setExpenseDigits(text.replace(/[^0-9]/g, ''))}
          style={styles.expenseInput}
          disabled={!expenseEnabled}
        />
        <Switch value={expenseEnabled} onValueChange={setExpenseEnabled} accessibilityLabel="Expense" />
      </View>
      <View style={styles.meRow}>
        <Text variant="titleMedium">I’m playing</Text>
        <Switch value={includeMe} onValueChange={setIncludeMe} accessibilityLabel="I’m playing" />
      </View>
      <Text variant="titleMedium">Who’s in</Text>
      <Searchbar placeholder="Search my players" value={query} onChangeText={setQuery} style={styles.search} />
      {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}
      {loading && players.length === 0 ? <LoadingRows /> : null}
      {others.map((player) => {
        const checked = selected.includes(player.id);
        return (
          <Button
            key={player.id}
            mode={checked ? 'contained' : 'outlined'}
            onPress={() => toggle(player.id)}
            style={styles.player}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
          >
            {`${checked ? '✓ ' : ''}${player.name}${player.playerCode ? `  ${player.playerCode}` : ''}`}
          </Button>
        );
      })}
      <Button mode="outlined" icon="account-search" onPress={() => router.push({ pathname: '/(screens)/players/new', params: { from: 'new-game' } })}>
        Find players
      </Button>
      <Text variant="bodyMedium" style={styles.count}>
        {seatedCount} selected
        {startDisabled ? (includeMe ? ' · Pick at least one more player.' : ' · Pick at least two players.') : ''}
      </Text>
      <BottomBar>
        <Button
          mode="contained"
          onPress={startGame}
          loading={creating}
          disabled={startDisabled || creating}
          style={styles.start}
        >
          Start game
        </Button>
      </BottomBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 120,
  },
  expense: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  expenseInput: {
    width: 80,
  },
  meRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  search: {
    marginVertical: spacing.sm,
  },
  player: {
    marginBottom: spacing.sm,
  },
  count: {
    marginTop: spacing.md,
  },
  start: {
    flex: 1,
  },
});

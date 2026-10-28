import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { Game } from '@/types/game';
import { authService } from '@/services/auth';
import { gamesService } from '@/services/games';
import { sessionsService } from '@/services/sessions';
import { isSupabaseConfigured } from '@/services/supabase';
import { storage } from '@/utils/storage';
import { userAdminsGame } from '@/utils/gameAccess';
import { formatGameDateTime, gameIdLabel, isLocalToday } from '@/utils/gameDisplay';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { EMPTY_SETTLE } from '@/constants/help';
import { Screen } from '@/components/ui/Screen';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { spacing, useAppTheme } from '@/constants/theme';

export default function SettlePicker() {
  const { colors } = useAppTheme();
  const [games, setGames] = useState<Game[]>([]);
  const [past, setPast] = useState<{ id: string; status: 'open' | 'settled'; createdAt: string }[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [chip, setChip] = useState<'today' | 'all'>('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const userId = isSupabaseConfigured ? await authService.getCurrentUserId() : await storage.getCurrentPlayer();
      const player = await authService.getCurrentPlayer();
      if (!userId) {
        setError('Not signed in.');
        return;
      }
      const visible = await gamesService.listGamesForCurrentUser(userId, {
        includeScores: true,
        email: player?.email,
      });
      setGames(visible.filter((game) => game.isComplete && userAdminsGame(game, userId)));
      const sessions = await sessionsService.list();
      setPast(sessions);
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const shown = games.filter((game) => chip === 'all' || isLocalToday(game.date));

  const toggle = (id: string) => {
    setChecked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const continueSettle = async () => {
    if (checked.length === 0) return;
    setBusy(true);
    try {
      const names = new Map<string, string>();
      const chosen = games.filter((game) => checked.includes(game.id));
      for (const game of chosen) {
        const seated = await gamesService.listGamePlayers(game.id);
        seated.forEach((player) => {
          if (player.id === 'EX' || player.seated === false || player.seatRole === 'spectator') return;
          names.set(player.id, player.name);
        });
      }
      const session = await sessionsService.create(checked, names);
      router.push(`/(screens)/sessions/${session.id}`);
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.chips}>
        <Button mode={chip === 'today' ? 'contained' : 'outlined'} onPress={() => setChip('today')}>Today</Button>
        <Button mode={chip === 'all' ? 'contained' : 'outlined'} onPress={() => setChip('all')}>All</Button>
      </View>
      {error ? (
        <View>
          <Text style={{ color: colors.error }}>{error}</Text>
          <Button onPress={load}>Retry</Button>
        </View>
      ) : null}
      {loading && games.length === 0 ? <LoadingRows /> : null}
      {!loading && games.length === 0 ? (
        <Text variant="bodyLarge">{EMPTY_SETTLE}</Text>
      ) : null}
      {shown.map((game) => {
        const on = checked.includes(game.id);
        return (
          <Button
            key={game.id}
            mode={on ? 'contained' : 'outlined'}
            onPress={() => toggle(game.id)}
            style={styles.row}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
          >
            {`${on ? '✓ ' : ''}${formatGameDateTime(game.date)}  ${gameIdLabel(game)}  Stake`}
          </Button>
        );
      })}
      {games.length > 0 ? (
        <Button
          mode="contained"
          disabled={checked.length === 0 || busy}
          loading={busy}
          onPress={continueSettle}
          style={styles.continue}
        >
          {`Continue · ${checked.length} ${checked.length === 1 ? 'game' : 'games'}`}
        </Button>
      ) : null}
      {past.length > 0 ? (
        <View style={styles.past}>
          <Text variant="titleMedium">Past sessions</Text>
          {past.map((session) => (
            <Button key={session.id} mode="text" onPress={() => router.push(`/(screens)/sessions/${session.id}`)}>
              {`${session.status === 'settled' ? 'Settled' : 'Open'} · ${formatGameDateTime(session.createdAt)}`}
            </Button>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  row: {
    marginBottom: spacing.sm,
  },
  continue: {
    marginTop: spacing.md,
  },
  past: {
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
});

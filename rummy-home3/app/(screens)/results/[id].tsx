import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, Menu, Portal, Snackbar, Text } from 'react-native-paper';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { archiveService } from '@/services/archive';
import { authService } from '@/services/auth';
import { EmptyState } from '@/components/ui/EmptyState';
import { HelpButton } from '@/components/ui/HelpButton';
import { HELP } from '@/constants/help';
import { radius, spacing } from '@/constants/theme';
import { DELETE_RESULT_BODY, DELETE_RESULT_TITLE, deletedBody, removedGamesNote, RESULT_DELETED_TITLE } from '@/utils/archive';
import { ResultsPage } from '@/components/results/ResultsPage';
import { ResultsShare } from '@/components/results/ResultsShare';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/constants/theme';
import { gamesService } from '@/services/games';
import { resultsService } from '@/services/results';
import { formatGameDateTime } from '@/utils/gameDisplay';
import { buildResultsShareCard, sharePlaces } from '@/utils/shareCard';
import { buildResultsDetails } from '@/utils/resultsDetails';
import { GameResult, RESULT_EXPENSE_ID, resultFooter, ResultSheet, gameClock } from '@/utils/results';
import { RESULT_NOT_AVAILABLE } from '@/utils/resultsAccess';
import { resultReusedNote, resultShareNotes, reusedGameIds, reusedWarningLines } from '@/utils/resultsSave';
import { ResultWarnings } from '@/components/results/ResultWarnings';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { Player } from '@/types/player';

function sheetFor(result: GameResult): ResultSheet {
  if (result.sheet && result.sheet.players.length > 0) return result.sheet;
  return {
    players: result.standings.map((row) => ({ id: row.id, name: row.name })),
    games: result.sheet?.games ?? [],
  };
}

/**
 * Saved results only carry per-game totals. The PDF wants every round, so the
 * closed games are read again; a game that cannot be read keeps totals only.
 */
async function withRounds(result: GameResult): Promise<GameResult> {
  const sheet = sheetFor(result);
  const games = await Promise.all(sheet.games.map(async (game) => {
    if (game.rounds) return game;
    try {
      const loaded = await gamesService.getGame(game.id);
      if (!loaded) return game;
      const rounds: Record<string, number[]> = {};
      Object.keys(game.scores).forEach((id) => {
        if (id === RESULT_EXPENSE_ID) return;
        rounds[id] = (loaded.scores[id] ?? []).map((value) => Number(value) || 0);
      });
      return { ...game, rounds };
    } catch {
      return game;
    }
  }));
  return { ...result, sheet: { ...sheet, games } };
}

export default function DeclaredResult() {
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [result, setResult] = useState<GameResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reused, setReused] = useState<string[]>([]);
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const actorId = async () => authService.getCurrentPlayer().then((me) => me?.id ?? null).catch(() => null);

  const confirmDelete = async () => {
    if (!result) return;
    setBusy(true);
    try {
      await archiveService.deleteResult(result.id, await actorId());
      setDeleteOpen(false);
      router.back();
    } catch (err) {
      setDeleteOpen(false);
      setError(formatSupabaseError(err));
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!result) return;
    setBusy(true);
    try {
      await archiveService.restoreResult(result.id, await actorId());
      setNote('Result restored. Its games are Closed again.');
      setLoading(true);
      await load();
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Which games here were already in an earlier result? 018 sends reusedGameIds with the
   * result; before 018 (or when absent) the games' closedAt is compared with the declaration.
   */
  const flagReuse = useCallback(async (loaded: GameResult) => {
    if (loaded.reusedGameIds) {
      setReused(loaded.reusedGameIds);
      return;
    }
    const games = await Promise.all(loaded.gameIds.map((gameId) => gamesService.getGame(gameId).catch(() => null)));
    const present = games.filter((game): game is NonNullable<typeof game> => Boolean(game));
    setReused(reusedGameIds(present, loaded.declaredAt));
  }, []);

  /**
   * Player IDs come with the result on 018; older servers get them from the games' seats.
   * Column initials (022) always come from the seats: the first game's label for each player.
   */
  const fillPlayerNos = useCallback(async (loaded: GameResult): Promise<GameResult> => {
    const sheet = sheetFor(loaded);
    const seatLists = await Promise.all(loaded.gameIds.map((gameId) => gamesService.listGamePlayers(gameId).catch(() => [] as Player[])));
    const numbers: Record<string, number> = {};
    const labels: Record<string, string> = {};
    seatLists.flat().forEach((seat) => {
      if (seat.playerNo != null) numbers[seat.id] = seat.playerNo;
      if (seat.label && !labels[seat.id]) labels[seat.id] = seat.label;
    });
    if (Object.keys(numbers).length === 0 && Object.keys(labels).length === 0) return loaded;
    return {
      ...loaded,
      sheet: {
        ...sheet,
        players: sheet.players.map((player) => ({ ...player, playerNo: player.playerNo ?? numbers[player.id] ?? null, label: labels[player.id] ?? null })),
      },
    };
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const loaded = await resultsService.get(id);
      setResult(loaded);
      if (loaded) {
        withRounds(loaded).then(fillPlayerNos).then(setResult).catch(() => {});
        flagReuse(loaded).catch(() => {});
      }
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, [id, flagReuse, fillPlayerNos]);

  const warnings = useMemo(() => (result ? reusedWarningLines(sheetFor(result).games, reused) : []), [result, reused]);
  const reusedNote = resultReusedNote(reused.length);
  // The saved screen's warning lines (and the removed-games note) travel with every share.
  const notes = useMemo(() => {
    const removed = removedGamesNote(result?.removedGameIds?.length ?? 0);
    return [...resultShareNotes(warnings, true), ...(removed ? [removed] : [])];
  }, [warnings, result?.removedGameIds?.length]);

  useEffect(() => {
    load();
  }, [load]);

  const card = useMemo(() => {
    if (!result) return null;
    return buildResultsShareCard({
      title: 'Results',
      date: `Saved ${formatGameDateTime(result.declaredAt)}`,
      rows: result.standings.map((row) => ({ id: row.id, name: row.name, points: row.points, place: row.place })),
      places: sharePlaces(result.standings),
      gameCount: result.gameIds.length || sheetFor(result).games.length,
      games: sheetFor(result).games,
      players: sheetFor(result).players,
      notes,
      footer: resultFooter({ resultId: result.id }),
    });
  }, [result, notes]);

  const details = useMemo(() => {
    if (!result) return null;
    const sheet = sheetFor(result);
    return buildResultsDetails({
      createdAtLabel: formatGameDateTime(result.declaredAt),
      standings: result.standings,
      players: sheet.players,
      games: sheet.games.map((game) => ({
        id: game.id,
        name: game.name,
        label: game.label,
        when: gameClock(game.date),
        scores: game.scores,
        rounds: game.rounds,
      })),
      saved: true,
      notes,
      footer: resultFooter({ resultId: result.id }),
    });
  }, [result, notes]);

  if (result?.deletedAt) {
    return (
      <Screen>
        <EmptyState
          icon="delete-outline"
          title={RESULT_DELETED_TITLE}
          message={deletedBody('result', Boolean(result.canRestore))}
          actionLabel={result.canRestore ? 'Restore' : undefined}
          onAction={result.canRestore && !busy ? restore : undefined}
        />
        {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}
        <Snackbar visible={Boolean(note)} onDismiss={() => setNote(null)} duration={3000}>{note ?? ''}</Snackbar>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerActions}>
              <HelpButton text={HELP.results} />
              {result?.canManage ? (
                <Menu
                  visible={menuOpen}
                  onDismiss={() => setMenuOpen(false)}
                  anchor={<Button compact icon="dots-vertical" onPress={() => setMenuOpen(true)} accessibilityLabel="Result menu"> </Button>}
                >
                  <Menu.Item leadingIcon="delete-outline" title="Delete result" titleStyle={{ color: colors.error }} onPress={() => { setMenuOpen(false); setDeleteOpen(true); }} />
                </Menu>
              ) : null}
            </View>
          ),
        }}
      />
      <ResultsShare card={card} details={details} createdAt={result?.declaredAt} />
      <ResultWarnings warnings={warnings} />
      {error ? (
        <>
          <Text style={{ color: colors.error }}>{error}</Text>
          <Button onPress={load}>Retry</Button>
        </>
      ) : null}
      {loading ? <LoadingRows /> : null}
      {!loading && !error && !result ? (
        <Text variant="bodyLarge">{RESULT_NOT_AVAILABLE}</Text>
      ) : null}
      {result ? (
        <ResultsPage createdAt={result.declaredAt} saved standings={result.standings} sheet={sheetFor(result)} reusedNote={reusedNote} removedCount={result.removedGameIds?.length ?? 0} />
      ) : null}
      <Portal>
        <Dialog visible={deleteOpen} onDismiss={() => busy || setDeleteOpen(false)} style={styles.dialog}>
          <Dialog.Title>{DELETE_RESULT_TITLE}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>{DELETE_RESULT_BODY}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteOpen(false)} disabled={busy}>Cancel</Button>
            <Button mode="contained" buttonColor={colors.error} textColor={colors.onError} onPress={confirmDelete} loading={busy} disabled={busy}>Delete</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar visible={Boolean(note)} onDismiss={() => setNote(null)} duration={3000}>{note ?? ''}</Snackbar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  dialog: { borderRadius: radius.xl, maxWidth: 480, width: '90%', alignSelf: 'center' },
});

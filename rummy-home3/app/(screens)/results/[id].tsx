import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Dialog, Menu, Portal, Snackbar, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { archiveService } from '@/services/archive';
import { authService } from '@/services/auth';
import { EmptyState } from '@/components/ui/EmptyState';
import { HelpButton } from '@/components/ui/HelpButton';
import { HELP } from '@/constants/help';
import { radius, spacing } from '@/constants/theme';
import { deletedBody, removedGamesNote, RESULT_DELETED_TITLE } from '@/utils/archive';
import { DELETE_RESULT_BUTTON, deleteConsequence, deletedToast, gameLabelsOf, RESTORED_TOAST, SHARED_CONFIRM_BODY, SHARED_CONFIRM_TITLE, UNDO_DELETE_MS } from '@/utils/resultsDelete';
import { sharedResults } from '@/utils/sharedResults';
import { ChangedAfterSharingLine, ResultHistorySection, RESULT_HISTORY_TITLE } from '@/components/results/ResultHistory';
import { ResultsPage } from '@/components/results/ResultsPage';
import { ResultsShare } from '@/components/results/ResultsShare';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/constants/theme';
import { gamesService } from '@/services/games';
import { eventLogService } from '@/services/eventLog';
import { resultsService } from '@/services/results';
import { changedNoteLine, ResultHistory } from '@/utils/eventLog';
import { formatGameDateTime } from '@/utils/gameDisplay';
import { gameAdminLines } from '@/utils/gameAdmins';
import { playersService } from '@/services/players';
import { buildResultsShareCard } from '@/utils/shareCard';
import { buildResultsDetails } from '@/utils/resultsDetails';
import { GameMeta, resultLinkText } from '@/utils/resultsDesign';
import { GameResult, RESULT_EXPENSE_ID, resultFooter, ResultSheet } from '@/utils/results';
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

/** Creator and admins of each game, for "Games in this result"; a game that cannot be read has none. */
async function loadGameMeta(result: GameResult): Promise<Record<string, GameMeta>> {
  const entries = await Promise.all(result.gameIds.map(async (gameId): Promise<[string, GameMeta] | null> => {
    try {
      const [game, roster] = await Promise.all([gamesService.getGame(gameId), gamesService.listGamePlayers(gameId).catch(() => [] as Player[])]);
      if (!game) return null;
      const lines = gameAdminLines(roster, game);
      const creator = lines.find((line) => line.role === 'Creator')?.name ?? null;
      return [gameId, { creatorName: creator, adminNames: lines.filter((line) => line.role === 'Admin').map((line) => line.name) }];
    } catch {
      return null;
    }
  }));
  return Object.fromEntries(entries.filter((entry): entry is [string, GameMeta] => Boolean(entry)));
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
  /** The Undo toast after Delete this result; the page goes back when it closes without Undo. */
  const [undoToast, setUndoToast] = useState<string | null>(null);
  const undone = useRef(false);
  const [wasShared, setWasShared] = useState(false);
  const [gameMeta, setGameMeta] = useState<Record<string, GameMeta>>({});
  const [declarerName, setDeclarerName] = useState<string | null>(null);
  const [history, setHistory] = useState<ResultHistory | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const historyY = useRef(0);

  const scrollToHistory = () => {
    setMenuOpen(false);
    scrollRef.current?.scrollTo({ y: Math.max(0, historyY.current - spacing.md), animated: true });
  };

  const actorId = async () => authService.getCurrentPlayer().then((me) => me?.id ?? null).catch(() => null);

  const gameLabels = result ? gameLabelsOf(sheetFor(result).games) : [];

  /**
   * Delete this result: straight away with a 10-second Undo, or after a question when it was shared
   * from here (D9.2). The marker is read again here so a share made on this very visit counts.
   */
  const startDelete = async () => {
    setMenuOpen(false);
    const shared = wasShared || (result ? await sharedResults.was(result.id).catch(() => false) : false);
    if (shared) {
      setWasShared(true);
      setDeleteOpen(true);
    } else {
      await confirmDelete();
    }
  };

  const confirmDelete = async () => {
    if (!result) return;
    setBusy(true);
    try {
      await archiveService.deleteResult(result.id, await actorId());
      setDeleteOpen(false);
      undone.current = false;
      setUndoToast(deletedToast(gameLabels));
    } catch (err) {
      setDeleteOpen(false);
      setError(formatSupabaseError(err));
    } finally {
      setBusy(false);
    }
  };

  /** Undo on the toast: `restore_result` puts it back and the games are Closed again. */
  const undoDelete = async () => {
    if (!result) return;
    undone.current = true;
    setUndoToast(null);
    setBusy(true);
    try {
      await archiveService.restoreResult(result.id, await actorId());
      setNote(RESTORED_TOAST);
      setLoading(true);
      await load();
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setBusy(false);
    }
  };

  /** The toast closed: without Undo the deleted result is left behind (it stays under Deleted for 30 days). */
  const undoToastClosed = () => {
    setUndoToast(null);
    if (!undone.current) router.back();
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
        sharedResults.was(loaded.id).then(setWasShared).catch(() => {});
        withRounds(loaded).then(fillPlayerNos).then(setResult).catch(() => {});
        flagReuse(loaded).catch(() => {});
        loadGameMeta(loaded).then(setGameMeta).catch(() => {});
        eventLogService.listResultHistory(loaded.id).then(setHistory).catch(() => {});
        if (loaded.declaredBy) {
          const seated = sheetFor(loaded).players.find((player) => player.id === loaded.declaredBy);
          if (seated) setDeclarerName(seated.name);
          else playersService.getPlayer(loaded.declaredBy).then((player) => setDeclarerName(player?.name ?? null)).catch(() => {});
        }
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
    const changed = changedNoteLine(history?.changedNote ?? null);
    return [...resultShareNotes(warnings, true), ...(removed ? [removed] : []), ...(changed ? [changed] : [])];
  }, [warnings, result?.removedGameIds?.length, history?.changedNote]);

  useEffect(() => {
    load();
  }, [load]);

  // The reused flag rides with the game meta so the games block can mark the game.
  const metaWithReuse = useMemo(() => {
    const merged: Record<string, GameMeta> = { ...gameMeta };
    reused.forEach((gameId) => { merged[gameId] = { ...(merged[gameId] ?? {}), reused: true }; });
    return merged;
  }, [gameMeta, reused]);

  const card = useMemo(() => {
    if (!result) return null;
    return buildResultsShareCard({
      standings: result.standings,
      players: sheetFor(result).players,
      games: sheetFor(result).games,
      createdAtLabel: formatGameDateTime(result.declaredAt),
      resultId: result.id,
      generatedByName: declarerName,
      notes,
      footer: resultFooter({ resultId: result.id }),
    });
  }, [result, notes, declarerName]);

  const details = useMemo(() => {
    if (!result) return null;
    const sheet = sheetFor(result);
    return buildResultsDetails({
      createdAtLabel: formatGameDateTime(result.declaredAt),
      standings: result.standings,
      players: sheet.players,
      games: sheet.games.map((game) => ({ ...game, ...(metaWithReuse[game.id] ?? {}) })),
      saved: true,
      resultId: result.id,
      notes,
      footer: resultFooter({ resultId: result.id }),
    });
  }, [result, notes, metaWithReuse]);

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
    <Screen scrollRef={scrollRef}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerActions}>
              <HelpButton text={HELP.results} />
              {result ? (
                <Menu
                  visible={menuOpen}
                  onDismiss={() => setMenuOpen(false)}
                  anchor={<Button compact icon="dots-vertical" onPress={() => setMenuOpen(true)} accessibilityLabel="Result menu"> </Button>}
                >
                  <Menu.Item leadingIcon="history" title={RESULT_HISTORY_TITLE} onPress={scrollToHistory} testID="result-menu-history" />
                  {result.canManage ? (
                    <Menu.Item leadingIcon="delete-outline" title="Delete result" titleStyle={{ color: colors.error }} onPress={startDelete} />
                  ) : null}
                </Menu>
              ) : null}
            </View>
          ),
        }}
      />
      <ResultsShare card={card} details={details} createdAt={result?.declaredAt} resultId={result?.id} />
      <ChangedAfterSharingLine note={history?.changedNote ?? null} onPress={scrollToHistory} />
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
        <ResultsPage
          createdAt={result.declaredAt}
          saved
          standings={result.standings}
          sheet={sheetFor(result)}
          reusedNote={reusedNote}
          removedCount={result.removedGameIds?.length ?? 0}
          resultId={result.id}
          gameMeta={metaWithReuse}
          link={resultLinkText(result.id)}
        />
      ) : null}
      {result ? <ResultHistorySection history={history} onLayout={(event) => { historyY.current = event.nativeEvent.layout.y; }} /> : null}
      {result?.canManage ? (
        <View style={styles.deleteBlock}>
          <Button
            mode="outlined"
            icon="delete-outline"
            textColor={colors.error}
            style={[styles.deleteButton, { borderColor: colors.error }]}
            contentStyle={styles.deleteContent}
            labelStyle={styles.deleteLabel}
            onPress={startDelete}
            disabled={busy || Boolean(undoToast)}
            accessibilityLabel={DELETE_RESULT_BUTTON}
            testID="result-delete"
          >
            {DELETE_RESULT_BUTTON}
          </Button>
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant, textAlign: 'center' }} testID="result-delete-consequence">
            {deleteConsequence(gameLabels)}
          </Text>
        </View>
      ) : null}
      <Portal>
        <Dialog visible={deleteOpen} onDismiss={() => busy || setDeleteOpen(false)} style={styles.dialog}>
          <Dialog.Icon icon="share-variant" />
          <Dialog.Title>{SHARED_CONFIRM_TITLE}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>{SHARED_CONFIRM_BODY}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteOpen(false)} disabled={busy} accessibilityLabel="Keep the result">Cancel</Button>
            <Button mode="contained" buttonColor={colors.error} textColor={colors.onError} onPress={confirmDelete} loading={busy} disabled={busy} accessibilityLabel="Delete the shared result">Delete</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar visible={Boolean(note)} onDismiss={() => setNote(null)} duration={3000}>{note ?? ''}</Snackbar>
      <Snackbar
        visible={Boolean(undoToast)}
        onDismiss={undoToastClosed}
        duration={UNDO_DELETE_MS}
        action={{ label: 'Undo', onPress: undoDelete, accessibilityLabel: 'Undo delete result' }}
        testID="result-delete-undo"
      >
        {undoToast ?? ''}
      </Snackbar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  deleteBlock: { gap: spacing.sm, marginTop: spacing.md },
  deleteButton: { borderWidth: 2, borderRadius: radius.full },
  deleteContent: { minHeight: 52 },
  deleteLabel: { fontSize: 17, fontWeight: '800' },
  dialog: { borderRadius: radius.xl, maxWidth: 480, width: '90%', alignSelf: 'center' },
});

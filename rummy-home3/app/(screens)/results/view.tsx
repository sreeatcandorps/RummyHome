import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ResultsPage } from '@/components/results/ResultsPage';
import { ResultsShare } from '@/components/results/ResultsShare';
import { ResultWarnings } from '@/components/results/ResultWarnings';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { Screen } from '@/components/ui/Screen';
import { RESULTS_PLAYER_LIMIT } from '@/constants/limits';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { authService } from '@/services/auth';
import { gamesService } from '@/services/games';
import { resultsService } from '@/services/results';
import { emailsService } from '@/services/emails';
import { isSupabaseConfigured } from '@/services/supabase';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { gameCache } from '@/utils/gameCache';
import { formatGameDateTime } from '@/utils/gameDisplay';
import { buildResultsShareCard, sharePlaces } from '@/utils/shareCard';
import { buildResultsDetails } from '@/utils/resultsDetails';
import { gameLabelFor, gameResultName, presentResults, resultFooter, ResultSheet, ResultStanding, withinResultsPlayerLimit, gameClock } from '@/utils/results';
import { resultWarningLines, saveBlockedReason, saveStatusChanges, StatusChange } from '@/utils/resultsSave';
import { storage } from '@/utils/storage';
import { formatSupabaseError } from '@/utils/supabaseErrors';

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

type Seats = { names: Record<string, string>; numbers: Record<string, number>; labels: Record<string, string> };

function seated(players: Player[], into: Seats) {
  players.forEach((player) => {
    if (player.id === 'EX' || player.seated === false || player.seatRole === 'spectator') return;
    if (player.name?.trim()) into.names[player.id] = player.name.trim();
    if (player.playerNo != null) into.numbers[player.id] = player.playerNo;
    // The first game's label wins when the same person has different letters in later games.
    if (player.label && !into.labels[player.id]) into.labels[player.id] = player.label;
  });
}

/**
 * Results for the picked games. Nothing is saved by looking. Save result closes
 * the games (the P1 fix: a result that is not saved never closed anything) and
 * says which game changed status; Share opens once the result is saved.
 */
export default function ShownResults() {
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ ids?: string; at?: string }>();
  const idKey = param(params.ids);
  const createdAt = param(params.at) || new Date().toISOString();
  const [games, setGames] = useState<Game[]>([]);
  const [seats, setSeats] = useState<Seats>({ names: {}, numbers: {}, labels: {} });
  const [userId, setUserId] = useState<string | null>(null);
  const [standings, setStandings] = useState<ResultStanding[]>([]);
  const [sheet, setSheet] = useState<ResultSheet>({ players: [], games: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedChanges, setSavedChanges] = useState<{ id: string; changes: StatusChange[] } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setBlocked(false);
    try {
      const id = isSupabaseConfigured ? await authService.getCurrentUserId() : await storage.getCurrentPlayer();
      setUserId(id);
      const idList = idKey.split(',').map((item) => item.trim()).filter(Boolean);
      const loaded = (await Promise.all(idList.map((gameId) => gamesService.getGame(gameId)))).filter((game): game is Game => Boolean(game));
      if (loaded.length === 0) {
        setError('These games are not here.');
        return;
      }
      const listed = await Promise.all(loaded.map((game) => gamesService.listGamePlayers(game.id).catch(() => [] as Player[])));
      const found: Seats = { names: {}, numbers: {}, labels: {} };
      listed.forEach((players) => seated(players, found));
      const shaped = loaded.map((game) => ({
        id: game.id,
        name: gameResultName(game),
        label: gameLabelFor(game),
        date: game.date,
        players: game.players,
        scores: game.scores,
        names: found.names,
      }));
      if (!withinResultsPlayerLimit(shaped)) {
        setBlocked(true);
        return;
      }
      const presented = presentResults(shaped);
      setGames(loaded);
      setSeats(found);
      setStandings(presented.standings);
      setSheet({
        ...presented.sheet,
        players: presented.sheet.players.map((player) => ({ ...player, playerNo: found.numbers[player.id] ?? null, label: found.labels[player.id] ?? null })),
      });
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, [idKey]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const warnings = useMemo(() => resultWarningLines(games), [games]);
  const blockedReason = useMemo(() => (loading ? 'Loading…' : saveBlockedReason(games, userId)), [games, userId, loading]);

  const save = async () => {
    if (blockedReason || saving || !userId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await resultsService.declare({ games, names: seats.names, userId });
      // The scorecard and Home read from the cache first; show these games Closed right away.
      games.forEach((game) => gameCache.putGame({ ...game, closedAt: game.closedAt ?? result.declaredAt }));
      setSavedChanges({ id: result.id, changes: saveStatusChanges(games) });
      // Result-saved emails were queued inside declare_game_result; deliver them, best effort.
      emailsService.resultSaved().catch(() => {});
    } catch (err) {
      setSaveError(formatSupabaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const openSaved = () => {
    const id = savedChanges?.id;
    setSavedChanges(null);
    if (id) router.replace(`/(screens)/results/${id}`);
  };

  const card = useMemo(() => {
    if (standings.length === 0) return null;
    return buildResultsShareCard({
      title: 'Results',
      date: formatGameDateTime(createdAt),
      rows: standings.map((row) => ({ id: row.id, name: row.name, points: row.points, place: row.place })),
      places: sharePlaces(standings),
      gameCount: games.length,
      games: sheet.games,
      players: sheet.players,
      footer: resultFooter({ preview: true }),
    });
  }, [standings, createdAt, games.length, sheet]);

  const details = useMemo(() => {
    if (standings.length === 0) return null;
    return buildResultsDetails({
      createdAtLabel: formatGameDateTime(createdAt),
      standings,
      players: sheet.players,
      games: sheet.games.map((game) => ({
        id: game.id,
        name: game.name,
        label: game.label,
        when: gameClock(game.date),
        scores: game.scores,
        rounds: game.rounds,
      })),
      footer: resultFooter({ preview: true }),
    });
  }, [standings, sheet, createdAt]);

  const ready = !loading && !error && !blocked;

  return (
    <Screen>
      <ResultsShare
        card={card}
        details={details}
        createdAt={createdAt}
        onSave={save}
        saveDisabled={Boolean(blockedReason)}
        saving={saving}
        shareEnabled={false}
      />
      <ResultWarnings warnings={warnings} />
      {ready ? (
        <View style={[styles.saveBox, { backgroundColor: colors.surfaceVariant }]} testID="results-save-box">
          <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
            {blockedReason ?? 'Not saved yet. Saving moves these games to Closed and lets you share the result.'}
          </Text>
          <Button
            mode="contained"
            icon="content-save-outline"
            onPress={save}
            loading={saving}
            disabled={Boolean(blockedReason) || saving}
            accessibilityLabel="Save result"
            testID="results-save-button"
          >
            Save result
          </Button>
          {saveError ? <Text style={{ color: colors.error }}>{saveError}</Text> : null}
        </View>
      ) : null}
      {error ? (
        <>
          <Text style={{ color: colors.error }}>{error}</Text>
          <Button onPress={load}>Retry</Button>
        </>
      ) : null}
      {blocked ? <Text variant="bodyLarge">{RESULTS_PLAYER_LIMIT}</Text> : null}
      {loading ? <LoadingRows /> : null}
      {ready ? <ResultsPage createdAt={createdAt} standings={standings} sheet={sheet} /> : null}

      <Portal>
        <Dialog visible={Boolean(savedChanges)} onDismiss={openSaved} style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Dialog.Icon icon="check-circle-outline" />
          <Dialog.Title>Result saved</Dialog.Title>
          <Dialog.Content>
            <View style={styles.changes}>
              {savedChanges?.changes.map((change) => (
                <Text key={change.gameId} variant="bodyMedium" testID={`status-change-${change.label}`}>{change.line}</Text>
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button mode="contained" onPress={openSaved} accessibilityLabel="OK, open the saved result">OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  saveBox: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg },
  changes: { gap: spacing.xs },
  dialog: { borderRadius: radius.xl, maxWidth: 520, width: '94%', alignSelf: 'center' },
});

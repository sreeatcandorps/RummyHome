import React, { useCallback, useMemo, useState } from 'react';
import { Button, Text } from 'react-native-paper';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ResultsPage } from '@/components/results/ResultsPage';
import { ResultsShare } from '@/components/results/ResultsShare';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { Screen } from '@/components/ui/Screen';
import { RESULTS_PLAYER_LIMIT } from '@/constants/limits';
import { useAppTheme } from '@/constants/theme';
import { gamesService } from '@/services/games';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { formatGameDateTime } from '@/utils/gameDisplay';
import { buildResultsShareCard, sharePlaces } from '@/utils/shareCard';
import { buildResultsDetails } from '@/utils/resultsDetails';
import { gameResultName, presentResults, ResultSheet, ResultStanding, withinResultsPlayerLimit } from '@/utils/results';
import { formatSupabaseError } from '@/utils/supabaseErrors';

function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function seatedNames(players: Player[]): Record<string, string> {
  const names: Record<string, string> = {};
  players.forEach((player) => {
    if (player.id === 'EX' || player.seated === false || player.seatRole === 'spectator') return;
    if (player.name?.trim()) names[player.id] = player.name.trim();
  });
  return names;
}

export default function ShownResults() {
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ ids?: string; at?: string }>();
  const idKey = param(params.ids);
  const createdAt = param(params.at) || new Date().toISOString();
  const [standings, setStandings] = useState<ResultStanding[]>([]);
  const [sheet, setSheet] = useState<ResultSheet>({ players: [], games: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setBlocked(false);
    try {
      const idList = idKey.split(',').map((id) => id.trim()).filter(Boolean);
      const loaded = (await Promise.all(idList.map((id) => gamesService.getGame(id)))).filter((game): game is Game => Boolean(game));
      if (loaded.length === 0) {
        setError('These games are not here.');
        return;
      }
      const listed = await Promise.all(loaded.map((game) => gamesService.listGamePlayers(game.id).catch(() => [] as Player[])));
      const names: Record<string, string> = {};
      listed.forEach((players) => Object.assign(names, seatedNames(players)));
      const shaped = loaded.map((game) => ({
        id: game.id,
        name: gameResultName(game),
        date: game.date,
        players: game.players,
        scores: game.scores,
        names,
      }));
      if (!withinResultsPlayerLimit(shaped)) {
        setBlocked(true);
        return;
      }
      const presented = presentResults(shaped);
      setStandings(presented.standings);
      setSheet(presented.sheet);
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, [idKey]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const card = useMemo(() => {
    if (standings.length === 0) return null;
    return buildResultsShareCard({
      title: 'Results',
      date: formatGameDateTime(createdAt),
      rows: standings.map((row) => ({ name: row.name, points: row.points })),
      places: sharePlaces(standings),
    });
  }, [standings, createdAt]);

  const details = useMemo(() => {
    if (standings.length === 0) return null;
    return buildResultsDetails({
      createdAtLabel: formatGameDateTime(createdAt),
      standings,
      players: sheet.players,
      games: sheet.games.map((game) => ({
        id: game.id,
        name: game.name,
        when: formatGameDateTime(game.date),
        scores: game.scores,
      })),
    });
  }, [standings, sheet, createdAt]);

  return (
    <Screen>
      <ResultsShare card={card} details={details} />
      {error ? (
        <>
          <Text style={{ color: colors.error }}>{error}</Text>
          <Button onPress={load}>Retry</Button>
        </>
      ) : null}
      {blocked ? <Text variant="bodyLarge">{RESULTS_PLAYER_LIMIT}</Text> : null}
      {loading ? <LoadingRows /> : null}
      {!loading && !error && !blocked ? (
        <ResultsPage createdAt={createdAt} standings={standings} sheet={sheet} />
      ) : null}
    </Screen>
  );
}

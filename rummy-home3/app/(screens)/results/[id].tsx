import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Text } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import { ResultsPage } from '@/components/results/ResultsPage';
import { ResultsShare } from '@/components/results/ResultsShare';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/constants/theme';
import { resultsService } from '@/services/results';
import { formatGameDateTime } from '@/utils/gameDisplay';
import { buildShareCard, sharePlaces } from '@/utils/shareCard';
import { GameResult, ResultSheet } from '@/utils/results';
import { formatSupabaseError } from '@/utils/supabaseErrors';

function sheetFor(result: GameResult): ResultSheet {
  if (result.sheet && result.sheet.players.length > 0) return result.sheet;
  return {
    players: result.standings.map((row) => ({ id: row.id, name: row.name })),
    games: result.sheet?.games ?? [],
  };
}

export default function DeclaredResult() {
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [result, setResult] = useState<GameResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      setResult(await resultsService.get(id));
    } catch (err) {
      setError(formatSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const card = useMemo(() => {
    if (!result) return null;
    return buildShareCard({
      title: 'Results',
      date: formatGameDateTime(result.declaredAt),
      rows: result.standings.map((row) => ({ name: row.name, points: row.points })),
      places: sharePlaces(result.standings),
    });
  }, [result]);

  return (
    <Screen>
      <ResultsShare card={card} />
      {error ? (
        <>
          <Text style={{ color: colors.error }}>{error}</Text>
          <Button onPress={load}>Retry</Button>
        </>
      ) : null}
      {loading ? <LoadingRows /> : null}
      {!loading && !error && !result ? (
        <Text variant="bodyLarge">These results are not here.</Text>
      ) : null}
      {result ? (
        <ResultsPage createdAt={result.declaredAt} standings={result.standings} sheet={sheetFor(result)} />
      ) : null}
    </Screen>
  );
}

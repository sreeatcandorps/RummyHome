import { useCallback, useEffect, useState } from 'react';
import { Button, Text } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import { ResultsBoard } from '@/components/results/ResultsBoard';
import { LoadingRows } from '@/components/ui/LoadingRows';
import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/constants/theme';
import { resultsService } from '@/services/results';
import { GameResult } from '@/utils/results';
import { formatSupabaseError } from '@/utils/supabaseErrors';

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

  return (
    <Screen>
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
        <>
          <Text variant="bodyLarge">
            {result.gameIds.length === 1 ? '1 game' : `${result.gameIds.length} games`}
          </Text>
          <ResultsBoard standings={result.standings} />
        </>
      ) : null}
    </Screen>
  );
}

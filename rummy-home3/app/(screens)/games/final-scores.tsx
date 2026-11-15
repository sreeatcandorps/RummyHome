import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { Stack, useLocalSearchParams } from 'expo-router';
import { spacing, useAppTheme } from '@/constants/theme';
import { useGameRoster } from '@/hooks/useGameRoster';
import { useLayout } from '@/hooks/useLayout';
import { BottomBar } from '@/components/ui/BottomBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { FinalScoresView } from '@/components/share/FinalScoresView';
import { OffscreenShareCard, useShareCapture } from '@/components/share/OffscreenShareCard';
import { ShareCardView } from '@/components/share/ShareCardView';
import { buildFinalScoresSheet, totalsLine } from '@/utils/finalScoresSheet';
import { gameAdminLines, gameAdminTextLines } from '@/utils/gameAdmins';
import { IMAGE_READY, shareFinalScoresImage } from '@/utils/shareImage';
import { PDF_READY, shareFinalScoresPdf } from '@/utils/shareResultsPdf';
import { pointsGameMultiplier } from '@/utils/multiplier';
import { isPoolGame, poolLimitOf } from '@/utils/pool';

/**
 * One game's final scores (PR 8 design, PR 10b words and colour). The shared picture is the
 * standings card only — the same engine a saved result shares, in the game's marigold frame
 * so a game and a result never look alike in a chat. Every player is on it. The rounds sit
 * below in blocks of five players with the game total in each column head, and go out as a
 * PDF from "Share full details". This is a single game, not a Result: no "Results" wording.
 */
export default function FinalScoresScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const { insets } = useLayout();
  const { game, players, roster, loading, error } = useGameRoster(typeof id === 'string' ? id : undefined);
  const capture = useShareCapture();
  const [busy, setBusy] = useState<'image' | 'rounds' | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const sheet = useMemo(
    () => (game
      ? buildFinalScoresSheet({
          game,
          players,
          scores: game.scores,
          admins: gameAdminTextLines(gameAdminLines(roster, game)),
          pool: isPoolGame(game)
            ? { limit: poolLimitOf(game.settings), fullCount: Math.abs(game.settings.maxCount || 0), seats: game.poolSeats ?? {}, awards: game.awardedAt ? game.prizeShares : null }
            : undefined,
          multiplier: pointsGameMultiplier(game),
        })
      : null),
    [game, players, roster],
  );

  const shareImage = async () => {
    if (!sheet || busy) return;
    setBusy('image');
    setNote(null);
    try {
      const result = await shareFinalScoresImage(sheet, capture.ref.current, capture.size);
      setNote(result === IMAGE_READY ? 'Shared.' : result);
    } catch (caught) {
      setNote(caught instanceof Error ? caught.message : 'Could not make the image.');
    } finally {
      setBusy(null);
    }
  };

  const shareRounds = async () => {
    if (!sheet || busy) return;
    setBusy('rounds');
    setNote(null);
    try {
      const result = await shareFinalScoresPdf(sheet);
      setNote(result === PDF_READY ? 'Shared.' : result);
    } catch (caught) {
      setNote(caught instanceof Error ? caught.message : 'Could not make the rounds file.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: sheet ? sheet.heading : 'Final scores' }} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : !game || !sheet ? (
        <EmptyState icon="alert-circle-outline" title="Game not available" message={error ?? 'Try again from the scorecard.'} />
      ) : (
        <>
          <ScrollView contentContainerStyle={[styles.content, { paddingLeft: insets.left + spacing.lg, paddingRight: insets.right + spacing.lg }]}>
            <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
              This is the picture that will be shared: the scores of this game. The rounds below go out as a separate file.
            </Text>
            <ShareCardView card={sheet.card} />
            <OffscreenShareCard card={sheet.card} cardRef={capture.ref} onHeight={capture.onHeight} />
            <Text variant="titleMedium" style={[styles.heading, { color: colors.onSurface }]} accessibilityRole="header">Round by round</Text>
            {sheet.multiplierLine ? (
              <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }} testID="final-scores-multiplier">{sheet.multiplierLine}</Text>
            ) : null}
            {sheet.adminLines.map((line) => (
              <Text key={line} variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{line}</Text>
            ))}
            <FinalScoresView sheet={sheet} />
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }} testID="final-scores-totals">
              {sheet.roundCount === 1 ? '1 round' : `${sheet.roundCount} rounds`} ·{' '}
              <Text variant="bodySmall" style={sheet.poolLine || sheet.totalSum === 0 ? { color: colors.onSurfaceVariant } : [styles.bold, { color: colors.negative }]}>
                {sheet.poolLine ?? totalsLine(sheet.totalSum)}
              </Text>
            </Text>
            {note ? <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }} testID="final-scores-note">{note}</Text> : null}
          </ScrollView>
          <BottomBar>
            <Button
              mode="outlined"
              icon="file-pdf-box"
              onPress={shareRounds}
              loading={busy === 'rounds'}
              disabled={busy !== null}
              style={styles.flex}
              accessibilityLabel="Share full details"
              testID="share-rounds"
            >
              Share full details
            </Button>
            <Button
              mode="contained"
              icon="share-variant"
              onPress={shareImage}
              loading={busy === 'image'}
              disabled={busy !== null}
              style={styles.flex}
              accessibilityLabel="Share final scores"
              testID="share-final-scores"
            >
              Share final scores
            </Button>
          </BottomBar>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  heading: { fontWeight: '700', marginTop: spacing.xs },
  bold: { fontWeight: '700' },
  flex: { flex: 1 },
});

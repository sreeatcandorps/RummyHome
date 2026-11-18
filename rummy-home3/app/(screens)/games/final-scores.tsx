import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Portal, Text } from 'react-native-paper';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { spacing, useAppTheme } from '@/constants/theme';
import { useGameRoster } from '@/hooks/useGameRoster';
import { useLayout } from '@/hooks/useLayout';
import { ActionBar } from '@/components/ui/ActionBar';
import { ShareSheet } from '@/components/share/ShareSheet';
import { HOME_ROUTE, showsDone } from '@/utils/endFlow';
import { useMenuThenShare } from '@/hooks/useMenuThenShare';
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
 * The Final screen of a game (PR 8 design, PR 10b words and colour; Nov 18 end flow). The shared
 * picture is the standings card only — the same engine a saved result shares, in the game's
 * marigold frame so a game and a result never look alike in a chat. Every player is on it. A pool
 * with awards shows the Awards card instead. The details sit below; the full details (awards,
 * entries, pool scores, limit, outs and re-entries, every round) go out as the PDF.
 * Bar: Share (picture or full PDF) + Done. Done always goes Home; the header arrow returns to the
 * completed scorecard. This is a single game, not a Result: no "Results" wording.
 */
export default function FinalScoresScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { insets } = useLayout();
  const { game, players, roster, loading, error } = useGameRoster(typeof id === 'string' ? id : undefined);
  const capture = useShareCapture();
  const [busy, setBusy] = useState<'image' | 'rounds' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // The share sheet is a Paper dialog; the native share Activity waits for its close animation (useMenuThenShare).
  const { open: shareOpen, setOpen: setShareOpen, run: afterSheet } = useMenuThenShare();

  const done = () => router.navigate(HOME_ROUTE);

  const sheet = useMemo(
    () => (game
      ? buildFinalScoresSheet({
          game,
          players,
          scores: game.scores,
          admins: gameAdminTextLines(gameAdminLines(roster, game)),
          pool: isPoolGame(game)
            ? { limit: poolLimitOf(game.settings), fullCount: Math.abs(game.settings.maxCount || 0), seats: game.poolSeats ?? {}, awards: game.awardedAt ? game.prizeShares : null, drop: Math.abs(game.settings.dropAmount ?? 0) || undefined, awardNote: game.awardedAt ? game.awardNote : null }
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
      <Stack.Screen options={{ title: sheet ? sheet.card.title : 'Final scores' }} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : !game || !sheet ? (
        <EmptyState icon="alert-circle-outline" title="Game not available" message={error ?? 'Try again from the scorecard.'} />
      ) : (
        <>
          <ScrollView contentContainerStyle={[styles.content, { paddingLeft: insets.left + spacing.lg, paddingRight: insets.right + spacing.lg }]}>
            <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
              {sheet.showsAwards
                ? 'This is the picture that will be shared: the awards. The full details below go out as a PDF.'
                : 'This is the picture that will be shared: the scores of this game. The full details below go out as a PDF.'}
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
          <ActionBar
            secondary={showsDone(game) ? { label: 'Done', icon: 'check', onPress: done, disabled: busy !== null, accessibilityLabel: 'Done, back to Home', testID: 'final-done' } : undefined}
            primary={{ label: 'Share', icon: 'share-variant', onPress: () => setShareOpen(true), loading: busy !== null, disabled: busy !== null, accessibilityLabel: 'Share', testID: 'final-share' }}
          />
          <Portal>
            <ShareSheet
              visible={shareOpen}
              onDismiss={() => setShareOpen(false)}
              options={[
                { key: 'image', icon: 'image', label: sheet.showsAwards ? 'Share awards picture' : 'Share final scores', detail: 'The picture above, as shown.', onPress: () => afterSheet(shareImage), testID: 'share-final-scores' },
                { key: 'pdf', icon: 'file-pdf-box', label: 'Share full details', detail: sheet.poolLine ? 'PDF: awards, entries, pool scores, limit, outs and re-entries, every round.' : 'PDF: final scores, every round, who ran the game.', onPress: () => afterSheet(shareRounds), testID: 'share-rounds' },
              ]}
            />
          </Portal>
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
});

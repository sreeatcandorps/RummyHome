import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { spacing, useAppTheme } from '@/constants/theme';
import { useGameRoster } from '@/hooks/useGameRoster';
import { useLayout } from '@/hooks/useLayout';
import { BottomBar } from '@/components/ui/BottomBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { FinalScoresView, IMAGE_WIDTH } from '@/components/share/FinalScoresView';
import { buildFinalScoresSheet } from '@/utils/finalScoresSheet';
import { IMAGE_READY, shareFinalScoresImage } from '@/utils/shareImage';

/**
 * Preview of the "Final scores" picture before the device share sheet opens.
 * This is one game's scores, not a Result: no podium, yellow theme.
 */
export default function FinalScoresScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { width, insets } = useLayout();
  const { game, players, loading, error } = useGameRoster(typeof id === 'string' ? id : undefined);
  const shot = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [previewHeight, setPreviewHeight] = useState(0);

  const sheet = useMemo(
    () => (game ? buildFinalScoresSheet({ game, players, scores: game.scores }) : null),
    [game, players],
  );

  const previewWidth = Math.min(width - spacing.lg * 2, IMAGE_WIDTH);
  const scale = previewWidth / IMAGE_WIDTH;

  const share = async () => {
    if (!sheet || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const result = await shareFinalScoresImage(sheet, shot.current);
      setNote(result === IMAGE_READY ? 'Shared.' : result);
    } catch (caught) {
      setNote(caught instanceof Error ? caught.message : 'Could not make the image.');
    } finally {
      setBusy(false);
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Final scores' }} />
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : !game || !sheet ? (
        <EmptyState icon="alert-circle-outline" title="Game not available" message={error ?? 'Try again from the scorecard.'} />
      ) : (
        <>
          <ScrollView contentContainerStyle={[styles.content, { paddingLeft: insets.left + spacing.lg, paddingRight: insets.right + spacing.lg }]}>
            <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
              This is the picture that will be shared. Scroll to check it, then tap Share final scores.
            </Text>
            <View style={[styles.previewFrame, { width: previewWidth, height: previewHeight * scale || undefined }]}>
              <View
                onLayout={(event) => setPreviewHeight(event.nativeEvent.layout.height)}
                style={{ width: IMAGE_WIDTH, transform: [{ translateX: -(IMAGE_WIDTH - previewWidth) / 2 }, { translateY: -((previewHeight || 0) * (1 - scale)) / 2 }, { scale }] }}
              >
                <FinalScoresView sheet={sheet} />
              </View>
            </View>
            {note ? <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>{note}</Text> : null}
          </ScrollView>
          <View style={styles.offscreen} pointerEvents="none">
            <FinalScoresView sheet={sheet} viewRef={shot} />
          </View>
          <BottomBar>
            <Button mode="outlined" onPress={back} disabled={busy}>Back</Button>
            <Button mode="contained" icon="share-variant" onPress={share} loading={busy} disabled={busy} style={styles.flex} accessibilityLabel="Share final scores">
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
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md, alignItems: 'center' },
  previewFrame: { overflow: 'hidden', borderRadius: 12 },
  offscreen: { position: 'absolute', left: -4000, top: 0 },
  flex: { flex: 1 },
});

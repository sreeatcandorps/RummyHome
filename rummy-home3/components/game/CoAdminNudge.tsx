import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { Screen } from '@/components/ui/Screen';
import { BottomBar } from '@/components/ui/BottomBar';
import { SectionCard } from '@/components/ui/SectionCard';
import { spacing, useAppTheme } from '@/constants/theme';
import { CO_ADMIN_NUDGE_BODY, CO_ADMIN_NUDGE_TITLE } from '@/utils/coAdmin';

export { coAdminCandidates } from '@/utils/coAdmin';

export const CO_ADMIN_STEP_NOTE = 'Pick one, or start without. Only registered players can be admins; you can change this later from Players · Admins.';

/**
 * New game, last step (PR 24; the PR 7 dialog as a page): when the organiser is the only admin and a
 * registered player is seated, pick a co-admin — or none — then Start game. The one button that
 * says Start; every earlier step says Next.
 */
export function CoAdminStep({ candidates, playerCount, busy, error, onBack, onStart }: {
  candidates: { id: string; name: string }[];
  playerCount: number;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  /** Starts the game with the chosen co-admin, or none. */
  onStart: (coAdminId: string | null) => void;
}) {
  const { colors } = useAppTheme();
  const [choice, setChoice] = useState<string | null>(null);
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Screen contentStyle={styles.content} safeBottom={false}>
        <SectionCard title={CO_ADMIN_NUDGE_TITLE} icon="shield-account-outline" supportingText={CO_ADMIN_NUDGE_BODY}>
          <View style={styles.chips} accessibilityLabel="Pick a co-admin" testID="co-admin-choices">
            {candidates.map((c) => (
              <Chip key={c.id} selected={choice === c.id} showSelectedCheck onPress={() => setChoice((current) => (current === c.id ? null : c.id))} accessibilityLabel={`Make ${c.name} co-admin`} testID={`co-admin-${c.id}`}>{c.name}</Chip>
            ))}
          </View>
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{CO_ADMIN_STEP_NOTE}</Text>
        </SectionCard>
        {error ? <Text variant="bodyMedium" style={{ color: colors.error, paddingHorizontal: spacing.md }} testID="new-game-problem">{error}</Text> : null}
      </Screen>
      <BottomBar style={styles.bottom}>
        <Button mode="outlined" onPress={onBack} disabled={busy} icon="arrow-left" contentStyle={styles.barContent} style={styles.back} accessibilityLabel="Back to order of players" testID="new-game-coadmin-back">
          Back
        </Button>
        <Button mode="contained" onPress={() => onStart(choice)} loading={busy} disabled={busy} icon="play" contentStyle={styles.barContent} labelStyle={styles.startLabel} style={styles.start} accessibilityLabel="Start game" testID="start-game">
          {`Start game · ${playerCount} players`}
        </Button>
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: spacing.md, gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  bottom: { flexDirection: 'row', gap: spacing.sm },
  barContent: { minHeight: 52 },
  back: { flex: 0.8 },
  start: { flex: 1.6 },
  startLabel: { fontSize: 16, fontWeight: '800' },
});

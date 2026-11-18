import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { InitialsConflict } from '@/utils/initials';
import { BottomBar } from '@/components/ui/BottomBar';
import { ConflictChoices, InitialsConflictList } from '@/components/players/InitialsConflictList';

/**
 * Shown right before Start game (or Return to game) when two seated players would get
 * the same column letters. Every clash is on one screen. "Not now" starts with the
 * suggested letters for this game only; "Apply and start" also saves them to My players
 * so the next game agrees.
 */
export function FixInitialsScreen({ conflicts, choices, onChoose, taken, youId, busy, error, applyLabel, onNotNow, onApply }: {
  conflicts: InitialsConflict[];
  choices: ConflictChoices;
  onChoose: (playerId: string, initials: string) => void;
  taken: Map<string, string>;
  youId?: string | null;
  busy: boolean;
  error?: string | null;
  applyLabel: string;
  onNotNow: () => void;
  onApply: () => void;
}) {
  const { colors } = useAppTheme();
  const pairs = conflicts.length === 1 ? 'Two players' : `${conflicts.length} groups of players`;
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} accessibilityLabel="Fix initials">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.banner, { backgroundColor: colors.tertiaryContainer }]}>
          <Icon source="information-outline" size={20} color={colors.onSurface} />
          <Text variant="bodyMedium" style={styles.flex}>
            {pairs} in this game share initials. Pick new letters for the players who joined your My players later, or type your own.
          </Text>
        </View>
        <InitialsConflictList conflicts={conflicts} choices={choices} onChoose={onChoose} taken={taken} youId={youId} />
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
          The player who joined your My players first keeps the short form. Initials stay the same in every game you create.
        </Text>
        {error ? <Text variant="bodyMedium" style={{ color: colors.error }}>{error}</Text> : null}
      </ScrollView>
      <BottomBar>
        <Button mode="outlined" onPress={onNotNow} disabled={busy} style={styles.flex} accessibilityLabel="Not now, use these for this game only">
          Not now
        </Button>
        <Button mode="contained" onPress={onApply} loading={busy} disabled={busy} style={styles.flex} accessibilityLabel={applyLabel}>
          {applyLabel}
        </Button>
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.sm },
  flex: { flex: 1 },
});

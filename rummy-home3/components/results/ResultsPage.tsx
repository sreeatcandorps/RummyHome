import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { GameScoreGrid } from '@/components/results/GameScoreGrid';
import { spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { formatGameDateTime } from '@/utils/gameDisplay';
import { initialsById } from '@/utils/playerInitials';
import { formatPoints, placeLabel, podiumPlaces, resultsCountLine, ResultSheet, ResultStanding, splitTotals, gameClock } from '@/utils/results';
import { totalsSubline } from '@/utils/resultsSave';
import { removedGamesNote } from '@/utils/archive';

export function ResultsPage({
  createdAt,
  standings,
  sheet,
  reusedNote,
  removedCount = 0,
}: {
  createdAt: string;
  standings: ResultStanding[];
  sheet: ResultSheet;
  /** Set when the result counts a game from an earlier result; shows a small flag beside the title. */
  reusedNote?: string | null;
  /** Games deleted since this result was saved (023); the totals no longer count them. */
  removedCount?: number;
}) {
  const removedNote = removedGamesNote(removedCount);
  const { colors } = useAppTheme();
  const { positive, negative } = splitTotals(standings);
  const places = podiumPlaces(standings);
  const initials = initialsById(sheet.players.length ? sheet.players : standings);
  const byId = new Map(sheet.players.map((player) => [player.id, player]));
  const games = sheet.games.map((game) => ({
    id: game.id,
    name: game.name,
    label: game.label,
    when: gameClock(game.date),
    scores: game.scores,
  }));

  return (
    <View style={styles.page}>
      <View>
        <View style={styles.titleRow}>
          <Text variant="headlineMedium" style={[styles.title, { color: colors.onSurface }]} accessibilityRole="header">Results</Text>
          {reusedNote ? (
            <View style={styles.flag} accessibilityLabel={reusedNote} testID="result-reused-flag">
              <Icon source="alert-outline" size={22} color={colors.secondary} />
            </View>
          ) : null}
        </View>
        <Text variant="titleMedium">{formatGameDateTime(createdAt)}</Text>
        {reusedNote ? <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{reusedNote}</Text> : null}
        {removedNote ? <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }} testID="result-removed-note">{removedNote}</Text> : null}
      </View>

      <View testID="results-totals" accessibilityLabel="Totals" style={styles.totals}>
        <Text variant="titleMedium" style={styles.section}>Totals</Text>
        <Text variant="bodyMedium" testID="results-counts" style={{ color: colors.onSurfaceVariant }}>
          {resultsCountLine(sheet.games.length, standings.length)}
        </Text>
        <View style={styles.columns}>
          <View testID="results-positive" accessibilityLabel="Positive totals" style={styles.column}>
            {positive.map((row) => (
              <View key={row.id} style={styles.totalRow}>
                <View style={styles.totalName}>
                  <Text variant="bodyLarge" style={styles.totalNameText} numberOfLines={1}>{row.name}</Text>
                  <Text variant="labelSmall" numberOfLines={1} style={{ color: colors.onSurfaceVariant }}>{totalsSubline(initials.get(row.id), byId.get(row.id))}</Text>
                </View>
                <Text variant="bodyLarge" numberOfLines={1} style={[tabularNums, styles.totalPoints, { color: colors.primary }]}>
                  {formatPoints(row.points)}
                </Text>
              </View>
            ))}
          </View>
          <View testID="results-negative" accessibilityLabel="Negative totals" style={styles.column}>
            {negative.map((row) => (
              <View key={row.id} style={styles.totalRow}>
                <View style={styles.totalName}>
                  <Text variant="bodyLarge" style={styles.totalNameText} numberOfLines={1}>{row.name}</Text>
                  <Text variant="labelSmall" numberOfLines={1} style={{ color: colors.onSurfaceVariant }}>{totalsSubline(initials.get(row.id), byId.get(row.id))}</Text>
                </View>
                <Text variant="bodyLarge" numberOfLines={1} style={[tabularNums, styles.totalPoints, { color: colors.error }]}>
                  {formatPoints(row.points)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <GameScoreGrid
        players={sheet.players}
        games={games}
        totals={Object.fromEntries(standings.map((row) => [row.id, row.points]))}
      />

      <View testID="results-places" accessibilityLabel="Places" style={[styles.places, { borderTopColor: colors.outlineVariant }]}>
        <Text variant="titleMedium" style={styles.section}>Top 3</Text>
        {places.map((group) => {
          const place = group[0].place;
          const names = group.map((row) => row.name).join(', ');
          return (
            <View
              key={place}
              style={styles.placeRow}
              accessibilityLabel={`${placeLabel(place)} place, ${names}, ${formatPoints(group[0].points)}`}
            >
              <Text variant="titleMedium" style={styles.placeLabel}>{placeLabel(place)}</Text>
              <Text variant="titleMedium" style={styles.placeNames}>{names}</Text>
              <Text variant="titleMedium" style={[tabularNums, styles.placePoints]}>{formatPoints(group[0].points)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: spacing.lg,
  },
  title: {
    fontWeight: '800',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flag: { paddingTop: 4 },
  section: {
    fontWeight: '800',
  },
  totals: {
    gap: spacing.sm,
  },
  columns: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  column: {
    flex: 1,
    gap: spacing.xs,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 32,
  },
  totalName: {
    flex: 1,
  },
  totalNameText: {
    fontWeight: '600',
  },
  totalPoints: {
    fontWeight: '800',
  },
  places: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    position: 'relative',
    zIndex: 1,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    minHeight: 32,
  },
  placeLabel: {
    width: 48,
    fontWeight: '800',
  },
  placeNames: {
    flex: 1,
    fontWeight: '700',
  },
  placePoints: {
    fontWeight: '800',
  },
});

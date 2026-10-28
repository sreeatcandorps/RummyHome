import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { GameScoreGrid } from '@/components/results/GameScoreGrid';
import { spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { formatGameDateTime } from '@/utils/gameDisplay';
import { formatPoints, placeLabel, podiumPlaces, ResultSheet, ResultStanding, splitTotals } from '@/utils/results';

export function ResultsPage({
  createdAt,
  standings,
  sheet,
}: {
  createdAt: string;
  standings: ResultStanding[];
  sheet: ResultSheet;
}) {
  const { colors } = useAppTheme();
  const { positive, negative } = splitTotals(standings);
  const places = podiumPlaces(standings);
  const games = sheet.games.map((game) => ({
    id: game.id,
    name: game.name,
    when: formatGameDateTime(game.date),
    scores: game.scores,
  }));

  return (
    <View style={styles.page}>
      <View>
        <Text variant="headlineMedium" style={[styles.title, { color: colors.onSurface }]} accessibilityRole="header">Results</Text>
        <Text variant="titleMedium">{formatGameDateTime(createdAt)}</Text>
      </View>

      <View testID="results-totals" accessibilityLabel="Totals" style={styles.totals}>
        <Text variant="titleMedium" style={styles.section}>Totals</Text>
        <View style={styles.columns}>
          <View testID="results-positive" accessibilityLabel="Positive totals" style={styles.column}>
            {positive.map((row) => (
              <View key={row.id} style={styles.totalRow}>
                <Text variant="bodyLarge" style={styles.totalName} numberOfLines={1}>{row.name}</Text>
                <Text variant="bodyLarge" style={[tabularNums, styles.totalPoints, { color: colors.primary }]}>
                  {formatPoints(row.points)}
                </Text>
              </View>
            ))}
          </View>
          <View testID="results-negative" accessibilityLabel="Negative totals" style={styles.column}>
            {negative.map((row) => (
              <View key={row.id} style={styles.totalRow}>
                <Text variant="bodyLarge" style={styles.totalName} numberOfLines={1}>{row.name}</Text>
                <Text variant="bodyLarge" style={[tabularNums, styles.totalPoints, { color: colors.error }]}>
                  {formatPoints(row.points)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <GameScoreGrid players={sheet.players} games={games} />

      <View testID="results-places" accessibilityLabel="Places" style={styles.places}>
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
    fontWeight: '600',
  },
  totalPoints: {
    fontWeight: '800',
  },
  places: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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

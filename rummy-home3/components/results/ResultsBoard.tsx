import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { brand, radius, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { formatPoints, placeLabel, podiumPlaces, ResultStanding, winnerLine } from '@/utils/results';

const STEP: Record<number, { height: number; fill: string; ink: string }> = {
  1: { height: 132, fill: brand.gold, ink: brand.felt },
  2: { height: 104, fill: '#D5DDE6', ink: '#1C2833' },
  3: { height: 80, fill: '#E0A36A', ink: '#3D2412' },
};

function stepStyle(place: number) {
  return STEP[place] ?? { height: 72, fill: '#E7E0D4', ink: '#1B1F1C' };
}

export function ResultsBoard({ standings }: { standings: ResultStanding[] }) {
  if (standings.length === 0) {
    return <Text variant="bodyLarge">No seated players in these games.</Text>;
  }

  const groups = podiumPlaces(standings);
  const visual = groups.length === 3
    ? [groups[1], groups[0], groups[2]]
    : groups.length === 2
      ? [groups[1], groups[0]]
      : groups;

  return (
    <View style={styles.wrap}>
      <Text variant="labelLarge" style={styles.placesLabel}>Places</Text>
      <Text variant="titleMedium" style={styles.winner}>{winnerLine(standings)}</Text>
      <View style={styles.podium}>
        {visual.map((group) => {
          const place = group[0].place;
          const look = stepStyle(place);
          const names = group.map((row) => row.name).join(', ');
          return (
            <View
              key={place}
              style={[styles.step, { minHeight: look.height, backgroundColor: look.fill }]}
              accessibilityLabel={`${placeLabel(place)} place, ${names}, ${formatPoints(group[0].points)} points`}
            >
              <Text variant="titleMedium" style={[styles.place, { color: look.ink }]}>{placeLabel(place)}</Text>
              {group.map((row) => (
                <Text key={row.id} variant="bodyMedium" style={[styles.name, { color: look.ink }]} numberOfLines={2}>
                  {row.name}
                </Text>
              ))}
              <Text variant="bodySmall" style={[styles.points, tabularNums, { color: look.ink }]}>
                {formatPoints(group[0].points)}
              </Text>
            </View>
          );
        })}
      </View>
      <TotalsTable standings={standings} />
    </View>
  );
}

function TotalsTable({ standings }: { standings: ResultStanding[] }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[styles.table, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
      accessibilityLabel="Totals"
    >
      <Text variant="headlineSmall" style={styles.tableTitle}>Totals</Text>
      <View style={[styles.header, { borderBottomColor: colors.outlineVariant }]}>
        <Text variant="labelLarge" style={styles.placeCol}>Place</Text>
        <Text variant="labelLarge" style={styles.nameCol}>Player</Text>
        <Text variant="labelLarge" style={styles.gamesCol}>Games</Text>
        <Text variant="labelLarge" style={[styles.pointsCol, tabularNums]}>Points</Text>
      </View>
      {standings.map((row, index) => (
        <View
          key={row.id}
          style={[
            styles.line,
            { backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceVariant },
          ]}
          accessibilityLabel={`${placeLabel(row.place)} place ${row.name} ${formatPoints(row.points)} points`}
        >
          <Text variant="bodyLarge" style={[styles.placeCol, tabularNums]}>{placeLabel(row.place)}</Text>
          <Text variant="bodyLarge" style={styles.nameCol} numberOfLines={1}>{row.name}</Text>
          <Text variant="bodyLarge" style={[styles.gamesCol, tabularNums]}>{row.games}</Text>
          <Text variant="bodyLarge" style={[styles.pointsCol, tabularNums]}>{formatPoints(row.points)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  placesLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  winner: {
    fontWeight: '700',
  },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  step: {
    flex: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    justifyContent: 'flex-end',
    gap: spacing.xxs,
  },
  place: {
    fontWeight: '800',
  },
  name: {
    fontWeight: '700',
  },
  points: {
    fontWeight: '600',
  },
  table: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
    paddingBottom: spacing.xs,
  },
  tableTitle: {
    fontWeight: '800',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  placeCol: {
    width: 52,
    fontWeight: '700',
  },
  nameCol: {
    flex: 1,
    fontWeight: '600',
  },
  gamesCol: {
    width: 56,
    textAlign: 'right',
  },
  pointsCol: {
    width: 72,
    textAlign: 'right',
    fontWeight: '700',
  },
});

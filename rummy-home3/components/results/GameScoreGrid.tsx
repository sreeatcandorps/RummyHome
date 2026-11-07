import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { brand, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { sheetGameLabel, playersByFirstName, resultsColumnWidths, resultsTableScrollsHorizontally, scoreCell } from '@/utils/results';

export type GridPlayer = { id: string; name: string };

export type GridGame = {
  id: string;
  name: string;
  when: string;
  scores: Record<string, number>;
};

const HEADER_H = 44;
const ROW_MIN_H = 40;

export function GameScoreGrid({
  players,
  games,
  totals,
}: {
  players: GridPlayer[];
  games: GridGame[];
  totals: Record<string, number>;
}) {
  const { colors } = useAppTheme();
  const [frameWidth, setFrameWidth] = useState(0);
  const rows = playersByFirstName(players);
  const widths = resultsColumnWidths(frameWidth, games.length);
  const nameWidth = widths[0];
  const scoreWidths = widths.slice(1);
  const contentWidth = widths.reduce((sum, value) => sum + value, 0);
  const scrolls = frameWidth > 0 && resultsTableScrollsHorizontally(frameWidth, games.length);
  const stripe = (index: number) => (index % 2 === 0 ? colors.surface : colors.surfaceVariant);

  const scoreLook = (text: string) => {
    if (text === '—') return { color: colors.onSurfaceVariant };
    if (text.startsWith('-')) return { color: colors.error };
    return { color: colors.primary };
  };

  const isWeb = Platform.OS === 'web';
  const totalFor = (player: GridPlayer) => scoreCell({ [player.id]: totals[player.id] ?? 0 }, player.id);

  const table = (
    <View style={{ width: Math.max(contentWidth, frameWidth) }} testID="results-grid">
      <View style={[styles.headerLine, { height: HEADER_H, borderBottomColor: colors.outlineVariant, backgroundColor: brand.felt }]}>
        <View style={[styles.corner, styles.stuckLeft, { width: nameWidth, borderRightColor: colors.outlineVariant, backgroundColor: brand.felt }]}>
          <Text variant="labelLarge" style={styles.cornerText}>Player</Text>
        </View>
        {games.map((game, index) => (
          <View
            key={game.id}
            testID={`col-${index + 1}`}
            accessibilityLabel={`${sheetGameLabel(game)}${game.when ? `, started ${game.when}` : ''}`}
            style={[styles.headCell, { width: scoreWidths[index], backgroundColor: brand.felt }]}
          >
            <Text numberOfLines={1} style={styles.headLabel}>{sheetGameLabel(game)}</Text>
            <Text numberOfLines={1} style={styles.headSmall}>{game.when}</Text>
          </View>
        ))}
        <View
          testID="col-Total"
          style={[styles.headCell, styles.stuckRight, styles.totalEdge, { width: scoreWidths[games.length], backgroundColor: brand.felt, borderLeftColor: colors.outlineVariant }]}
        >
          <Text numberOfLines={1} style={styles.headLabel}>Total</Text>
        </View>
      </View>
      {rows.map((player, index) => (
        <View key={player.id} style={[styles.scoreRow, { backgroundColor: stripe(index) }]}>
          <View
            testID={`player-row-${player.name}`}
            style={[styles.nameCell, styles.stuckLeft, { width: nameWidth, borderRightColor: colors.outlineVariant, backgroundColor: stripe(index) }]}
          >
            <Text variant="labelLarge" style={styles.nameText}>{player.name}</Text>
          </View>
          {games.map((game, gameIndex) => {
            const text = scoreCell(game.scores, player.id);
            return (
              <View
                key={game.id}
                testID={`cell-${player.name}-${game.name}`}
                accessibilityLabel={`${player.name}, ${game.name}, ${text === '—' ? 'did not play' : text}`}
                style={[styles.scoreCell, { width: scoreWidths[gameIndex] }]}
              >
                <Text variant="bodyMedium" style={[tabularNums, styles.scoreText, scoreLook(text)]}>{text}</Text>
              </View>
            );
          })}
          <View
            testID={`cell-${player.name}-Total`}
            accessibilityLabel={`${player.name}, total, ${totalFor(player)}`}
            style={[
              styles.scoreCell,
              styles.stuckRight,
              styles.totalEdge,
              { width: scoreWidths[games.length], backgroundColor: stripe(index), borderLeftColor: colors.outlineVariant },
            ]}
          >
            <Text variant="bodyMedium" style={[tabularNums, styles.scoreText, scoreLook(totalFor(player))]}>{totalFor(player)}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  // Measured on the scroll area itself, inside the frame border, so the table is exactly as wide as the space it has.
  const onLayout = (event: { nativeEvent: { layout: { width: number } } }) => setFrameWidth(Math.floor(event.nativeEvent.layout.width));

  return (
    <View
      style={[styles.frame, { borderColor: colors.outlineVariant, backgroundColor: colors.surface }]}
      testID="results-grid-scroll"
      accessibilityLabel="Scores by player"
    >
      {isWeb ? (
        <View onLayout={onLayout} style={{ overflow: (scrolls ? 'auto' : 'hidden') as 'scroll' }}>{table}</View>
      ) : (
        <ScrollView onLayout={onLayout} horizontal scrollEnabled={scrolls} nestedScrollEnabled showsHorizontalScrollIndicator={scrolls}>
          {table}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  headerLine: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  corner: {
    justifyContent: 'flex-end',
    paddingHorizontal: 6,
    paddingBottom: spacing.xs,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  cornerText: {
    color: brand.cream,
    fontWeight: '800',
  },
  headCell: {
    paddingHorizontal: 4,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingBottom: spacing.xs,
  },
  headLabel: {
    color: brand.cream,
    fontWeight: '800',
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'right',
  },
  headSmall: {
    color: brand.cream,
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: -0.2,
    fontWeight: '600',
    opacity: 0.9,
    textAlign: 'right',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: ROW_MIN_H,
  },
  nameCell: {
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  nameText: {
    fontSize: 13,
    lineHeight: 16,
  },
  scoreCell: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  scoreText: {
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'right',
  },
  // Sticky edges only exist on web; on phones they would pull cells out of the row.
  stuckLeft: Platform.OS === 'web' ? { position: 'sticky' as 'absolute', left: 0, zIndex: 2 } : {},
  stuckRight: Platform.OS === 'web' ? { position: 'sticky' as 'absolute', right: 0, zIndex: 2 } : {},
  totalEdge: {
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
});

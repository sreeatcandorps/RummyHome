import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { brand, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { playersByFirstName, resultsColumnWidths, scoreCell } from '@/utils/results';

export type GridPlayer = { id: string; name: string };

export type GridGame = {
  id: string;
  name: string;
  when: string;
  scores: Record<string, number>;
};

const HEADER_H = 52;
const ROW_H = 40;
const VISIBLE_ROWS = 8;

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
  const nameWidth = widths[0] ?? 76;
  const scoreWidths = widths.slice(1);
  const contentWidth = widths.reduce((sum, value) => sum + value, 0);
  const bodyHeight = Math.min(Math.max(rows.length, 1), VISIBLE_ROWS) * ROW_H;
  const stripe = (index: number) => (index % 2 === 0 ? colors.surface : colors.surfaceVariant);

  const scoreLook = (text: string) => {
    if (text === '—') return { color: colors.onSurfaceVariant };
    if (text.startsWith('-')) return { color: colors.error };
    return { color: colors.primary };
  };

  return (
    <View style={[styles.frame, { borderColor: colors.outlineVariant, backgroundColor: colors.surface }]}>
      <View
        testID="results-grid-scroll"
        accessibilityLabel="Scores by player"
        onLayout={(event) => setFrameWidth(Math.floor(event.nativeEvent.layout.width))}
        style={{ height: HEADER_H + bodyHeight, overflow: 'auto' as 'scroll' }}
      >
        <View style={{ width: Math.max(contentWidth, frameWidth) }} testID="results-grid">
          <View style={[styles.headerLine, styles.stuckTop, { height: HEADER_H, borderBottomColor: colors.outlineVariant, backgroundColor: brand.felt, zIndex: 4 }]}>
            <View style={[styles.corner, styles.stuckLeft, { width: nameWidth, height: HEADER_H, borderRightColor: colors.outlineVariant, backgroundColor: brand.felt, zIndex: 5 }]}>
              <Text variant="labelLarge" style={styles.cornerText}>Player</Text>
            </View>
            {games.map((game, index) => (
              <View key={game.id} testID={`col-${index + 1}`} accessibilityLabel={`Game ${index + 1}${game.when ? `, started ${game.when}` : ''}`} style={[styles.headCell, styles.gameHead, { width: scoreWidths[index], backgroundColor: brand.felt }]}>
                <Text numberOfLines={1} style={styles.headSmall}>Game</Text>
                <Text numberOfLines={1} style={styles.headNumber}>{index + 1}</Text>
                <Text numberOfLines={1} style={styles.headSmall}>{game.when}</Text>
              </View>
            ))}
            <View
              testID="col-Total"
              style={[
                styles.headCell,
                styles.stuckRight,
                styles.totalEdge,
                { width: scoreWidths[games.length], height: HEADER_H, backgroundColor: brand.felt, zIndex: 6, borderLeftColor: colors.outlineVariant },
              ]}
            >
              <Text numberOfLines={1} style={styles.headerText}>Total</Text>
            </View>
          </View>
          {rows.map((player, index) => (
            <View key={player.id} style={[styles.scoreRow, { height: ROW_H, backgroundColor: stripe(index) }]}>
              <View
                testID={`player-row-${player.name}`}
                style={[styles.nameCell, styles.stuckLeft, { width: nameWidth, height: ROW_H, borderRightColor: colors.outlineVariant, backgroundColor: stripe(index) }]}
              >
                <Text variant="labelLarge" numberOfLines={1} style={styles.nameText}>{player.name}</Text>
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
                accessibilityLabel={`${player.name}, total, ${scoreCell({ [player.id]: totals[player.id] ?? 0 }, player.id)}`}
                style={[
                  styles.scoreCell,
                  styles.stuckRight,
                  styles.totalEdge,
                  { width: scoreWidths[games.length], height: ROW_H, backgroundColor: stripe(index), zIndex: 3, borderLeftColor: colors.outlineVariant },
                ]}
              >
                <Text variant="bodyMedium" style={[tabularNums, styles.scoreText, scoreLook(scoreCell({ [player.id]: totals[player.id] ?? 0 }, player.id))]}>
                  {scoreCell({ [player.id]: totals[player.id] ?? 0 }, player.id)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 12,
  },
  headerLine: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  corner: {
    justifyContent: 'flex-end',
    paddingHorizontal: 6,
    paddingBottom: spacing.sm,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  cornerText: {
    color: brand.cream,
    fontWeight: '800',
  },
  headCell: {
    height: HEADER_H,
    paddingHorizontal: 2,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingBottom: spacing.xs,
  },
  headerText: {
    color: brand.cream,
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'right',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameCell: {
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  scoreCell: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 4,
  },
  scoreText: {
    fontWeight: '700',
    fontSize: 13,
  },
  nameText: {
    fontSize: 13,
  },
  gameHead: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 2,
  },
  headSmall: {
    color: brand.cream,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
    opacity: 0.9,
  },
  headNumber: {
    color: brand.cream,
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '800',
  },
  stuckLeft: {
    position: 'sticky' as 'absolute',
    left: 0,
    zIndex: 2,
  },
  stuckTop: {
    position: 'sticky' as 'absolute',
    top: 0,
    zIndex: 3,
  },
  stuckRight: {
    position: 'sticky' as 'absolute',
    right: 0,
  },
  totalEdge: {
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
});

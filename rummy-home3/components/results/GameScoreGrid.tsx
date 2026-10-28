import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { brand, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { scoreCell } from '@/utils/results';

export type GridPlayer = { id: string; name: string };

export type GridGame = {
  id: string;
  name: string;
  when: string;
  scores: Record<string, number>;
};

const GAME_COL = 132;
const PLAYER_COL = 92;
const HEADER_H = 68;
const ROW_H = 56;
const BODY_MAX = 112;

export function GameScoreGrid({ players, games }: { players: GridPlayer[]; games: GridGame[] }) {
  const { colors } = useAppTheme();
  const bodyHeight = Math.min(Math.max(games.length, 1) * ROW_H, BODY_MAX);
  const contentWidth = GAME_COL + Math.max(players.length, 1) * PLAYER_COL;
  const stripe = (index: number) => (index % 2 === 0 ? colors.surface : colors.surfaceVariant);

  return (
    <View
      testID="results-grid-scroll"
      accessibilityLabel="Scores by game"
      style={[styles.frame, { height: HEADER_H + bodyHeight, borderColor: colors.outlineVariant, backgroundColor: colors.surface, overflow: 'scroll' }]}
    >
      <View style={{ width: contentWidth }} testID="results-grid">
        <View style={[styles.headerLine, styles.stuckTop, { height: HEADER_H, borderBottomColor: colors.outlineVariant, backgroundColor: brand.felt, zIndex: 4 }]}>
          <View style={[styles.corner, styles.stuckLeft, { width: GAME_COL, borderRightColor: colors.outlineVariant, backgroundColor: brand.felt, zIndex: 5 }]}>
            <Text variant="labelLarge" style={styles.cornerText}>Game</Text>
          </View>
          {players.map((player) => (
            <View key={player.id} style={[styles.playerHead, { backgroundColor: brand.felt }]}>
              <Text variant="labelLarge" numberOfLines={2} style={styles.headerText}>{player.name}</Text>
            </View>
          ))}
        </View>
        {games.map((game, index) => (
          <View key={game.id} style={[styles.scoreRow, { height: ROW_H, backgroundColor: stripe(index) }]}>
            <View
              testID={`game-row-${game.name}`}
              style={[styles.gameCell, styles.stuckLeft, { width: GAME_COL, height: ROW_H, borderRightColor: colors.outlineVariant, backgroundColor: stripe(index) }]}
            >
              <Text variant="labelLarge" numberOfLines={1}>{game.name}</Text>
              <Text variant="bodySmall" numberOfLines={2} style={{ color: colors.onSurfaceVariant }}>{game.when}</Text>
            </View>
            {players.map((player) => {
              const text = scoreCell(game.scores, player.id);
              const negative = text.startsWith('-');
              const missing = text === '—';
              return (
                <View
                  key={player.id}
                  testID={`cell-${game.name}-${player.name}`}
                  accessibilityLabel={`${game.name}, ${player.name}, ${missing ? 'did not play' : text}`}
                  style={styles.scoreCell}
                >
                  <Text
                    variant="bodyLarge"
                    style={[
                      tabularNums,
                      styles.scoreText,
                      negative && { color: colors.error },
                      !negative && !missing && { color: colors.primary },
                      missing && { color: colors.onSurfaceVariant },
                    ]}
                  >
                    {text}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
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
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  cornerText: {
    color: brand.cream,
    fontWeight: '800',
  },
  playerHead: {
    width: PLAYER_COL,
    height: HEADER_H,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
    justifyContent: 'flex-end',
  },
  headerText: {
    color: brand.cream,
    fontWeight: '700',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gameCell: {
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    gap: 2,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  scoreCell: {
    width: PLAYER_COL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontWeight: '700',
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
});

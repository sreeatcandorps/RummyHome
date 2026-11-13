import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { gameCountsLine, GameInfo, gamePeopleLine } from '@/utils/resultsDesign';

/**
 * "Games in this result": one block per game. Label chip, then the start — time in bold,
 * then the date — the player and round counts, the Game ID last in italics, and who ran it.
 */
export function GamesInResult({ games }: { games: GameInfo[] }) {
  const { colors } = useAppTheme();
  return (
    <View testID="results-games">
      {games.map((info) => {
        const people = gamePeopleLine(info);
        return (
          <View key={info.id} style={[styles.game, { borderBottomColor: colors.outlineVariant }]} testID={`result-game-${info.label}`}>
            <View style={styles.firstLine}>
              <View style={[styles.chip, { backgroundColor: colors.primary }]}>
                <Text style={[styles.chipText, { color: colors.onPrimary }]}>{info.label}</Text>
              </View>
              <Text variant="bodyLarge" style={{ color: colors.onSurface, flexShrink: 1 }}>
                <Text variant="bodyLarge" style={styles.time}>{info.start.time}</Text>
                {info.start.date ? ` ${info.start.date}` : ''}
              </Text>
            </View>
            <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
              {gameCountsLine(info)}
              {' · '}
              <Text variant="bodyMedium" style={[styles.gameId, { color: colors.onSurfaceVariant }]}>{`Game ID ${info.code}`}</Text>
            </Text>
            {people ? <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>{people}</Text> : null}
            {info.reused ? <Text variant="bodyMedium" style={{ color: colors.onSecondaryContainer }}>Already counted in an earlier result</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  game: { paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  firstLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chip: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: radius.xs },
  chipText: { fontWeight: '800', fontSize: 13 },
  time: { fontWeight: '800' },
  gameId: { fontStyle: 'italic', fontWeight: '400' },
});

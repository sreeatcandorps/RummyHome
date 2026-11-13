import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { BandTable } from '@/components/results/BandTable';
import { GamesInResult } from '@/components/results/GamesInResult';
import { PlayerLine } from '@/components/results/PlayerLine';
import { spacing, useAppTheme } from '@/constants/theme';
import { formatGameDateTime } from '@/utils/gameDisplay';
import { removedGamesNote } from '@/utils/archive';
import { resultsCountLine, ResultSheet, ResultStanding, resultShortId } from '@/utils/results';
import { GameMeta } from '@/utils/resultsDesign';
import { buildResultsDetails } from '@/utils/resultsDetails';

/**
 * The results page (Nov 13 design): title and count line, Scores in two columns with
 * medals, "How you got there" in bands of five bordered boxes, the legend, and the games.
 * The share image, the PDF and /r/<id> are built from the same model (utils/resultsDetails).
 */
export function ResultsPage({
  createdAt,
  standings,
  sheet,
  reusedNote,
  removedCount = 0,
  saved = false,
  resultId,
  gameMeta,
  link,
}: {
  createdAt: string;
  /** A saved result shows "Saved <date>"; a preview shows the date alone (the screen's banner says it is not saved). */
  saved?: boolean;
  standings: ResultStanding[];
  sheet: ResultSheet;
  /** Set when the result counts a game from an earlier result; shows a small flag beside the title. */
  reusedNote?: string | null;
  /** Games deleted since this result was saved (023); the totals no longer count them. */
  removedCount?: number;
  resultId?: string | null;
  /** Creator, admins, rounds and the reused flag per game id, when the screen has loaded them. */
  gameMeta?: Record<string, GameMeta>;
  /** The public link, printed under the games on a saved result. */
  link?: string | null;
}) {
  const removedNote = removedGamesNote(removedCount);
  const { colors } = useAppTheme();
  const details = useMemo(() => buildResultsDetails({
    createdAtLabel: formatGameDateTime(createdAt),
    standings,
    players: sheet.players.length ? sheet.players : standings.map((row) => ({ id: row.id, name: row.name })),
    games: sheet.games.map((game) => ({ ...game, ...(gameMeta?.[game.id] ?? {}) })),
    saved,
    resultId,
  }), [createdAt, standings, sheet, saved, resultId, gameMeta]);
  const { scores } = details;

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
          <View style={styles.grow} />
          {resultId ? <Text variant="labelLarge" style={{ color: colors.onSurfaceVariant }} testID="result-code">{resultShortId(resultId)}</Text> : null}
        </View>
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }} testID="result-date">
          {saved ? `Saved ${formatGameDateTime(createdAt)}` : formatGameDateTime(createdAt)}
        </Text>
        <Text variant="titleMedium" testID="results-counts" style={styles.count}>
          {resultsCountLine(sheet.games.length, details.playerCount)}
        </Text>
        {reusedNote ? <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{reusedNote}</Text> : null}
        {removedNote ? <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }} testID="result-removed-note">{removedNote}</Text> : null}
      </View>

      <View testID="results-totals" accessibilityLabel="Scores" style={styles.block}>
        <Text variant="labelLarge" style={[styles.section, { color: colors.onSurfaceVariant }]}>Scores</Text>
        <View style={styles.columns}>
          <View testID="results-positive" accessibilityLabel="Positive totals" style={styles.column}>
            {scores.positive.length === 0 ? <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>None</Text> : null}
            {scores.positive.map((row) => <PlayerLine key={row.id} row={row} />)}
          </View>
          <View testID="results-negative" accessibilityLabel="Negative totals" style={styles.column}>
            {scores.negative.length === 0 ? <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>None</Text> : null}
            {scores.negative.map((row) => <PlayerLine key={row.id} row={row} />)}
          </View>
        </View>
        {details.evenLine ? <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }} testID="results-even">{details.evenLine}</Text> : null}
      </View>

      {sheet.games.length > 0 ? (
        <View style={styles.block}>
          <Text variant="labelLarge" style={[styles.section, { color: colors.onSurfaceVariant }]}>How you got there · game by game</Text>
          <BandTable table={details.table} legend={details.legend} />
        </View>
      ) : null}

      {details.games.length > 0 ? (
        <View style={styles.block}>
          <Text variant="labelLarge" style={[styles.section, { color: colors.onSurfaceVariant }]}>Games in this result</Text>
          <GamesInResult games={details.games} />
        </View>
      ) : null}

      {link ? (
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }} testID="result-link" selectable>
          {`Read-only copy · ${link}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  title: { fontWeight: '800' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  flag: { paddingTop: 4 },
  count: { fontWeight: '800', marginTop: 2 },
  section: { fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  block: { gap: spacing.sm },
  columns: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  column: { flex: 1, minWidth: 0 },
});

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Icon, Text } from 'react-native-paper';
import { BandTable } from '@/components/results/BandTable';
import { GamesInResult } from '@/components/results/GamesInResult';
import { PlayerLine } from '@/components/results/PlayerLine';
import { spacing, useAppTheme } from '@/constants/theme';
import { formatGameDateTime } from '@/utils/gameDisplay';
import { removedGamesNote } from '@/utils/archive';
import { resultsCountLine, ResultSheet, ResultStanding, resultShortId } from '@/utils/results';
import { GAME_BY_GAME_TITLE, GameMeta, UNIQUE_RESULT_ID_LABEL } from '@/utils/resultsDesign';
import { buildResultsDetails } from '@/utils/resultsDetails';

/**
 * The results page (Nov 13 design, PR 10b words): title and count line, Scores in two columns
 * with medals, "Game by game" in bands of five, the legend, the games, and the Unique result ID
 * at the foot (tap to copy). The raw link is gone from the page; Share and the ⋮ menu carry it.
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
}) {
  const removedNote = removedGamesNote(removedCount);
  const [copied, setCopied] = useState(false);
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
          <Text variant="labelLarge" style={[styles.section, { color: colors.onSurfaceVariant }]}>{GAME_BY_GAME_TITLE}</Text>
          <BandTable table={details.table} legend={details.legend} testID="results-band-table" />
        </View>
      ) : null}

      {details.games.length > 0 ? (
        <View style={styles.block}>
          <Text variant="labelLarge" style={[styles.section, { color: colors.onSurfaceVariant }]}>Games in this result</Text>
          <GamesInResult games={details.games} />
        </View>
      ) : null}

      {resultId ? (
        <Pressable
          onPress={() => { Clipboard.setStringAsync(resultShortId(resultId)).catch(() => {}); setCopied(true); }}
          accessibilityRole="button"
          accessibilityLabel={`${UNIQUE_RESULT_ID_LABEL} ${resultShortId(resultId)}, tap to copy`}
          style={styles.footId}
          testID="result-code"
        >
          <Icon source="pound" size={16} color={colors.onSurfaceVariant} />
          <Text variant="labelLarge" style={{ color: colors.onSurfaceVariant }}>{`${UNIQUE_RESULT_ID_LABEL} · ${resultShortId(resultId)}`}</Text>
          <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>{copied ? 'Copied' : 'Tap to copy'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  footId: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingVertical: spacing.xs },
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

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { BAND_SIZE, BandCell, BandTable as BandTableModel, LegendEntry } from '@/utils/resultsDesign';

/**
 * "How you got there": players down, games across in bands of five. Player and Total sit
 * on the left. Every band is a filled strip (variant V4): the header's bands are tinted
 * green with a green base line, the rows' bands are gray, every second band a shade darker.
 * The last band is only as wide as the games it holds, so with seven games the header and
 * every row show the same 5 + 2 shape and nothing is drawn past the seventh game. Numbers
 * are plain weight, black for a win, red for a loss; only the total is bold. No borders.
 * Nothing scrolls sideways; the PDF and the web page draw the same strips.
 */
export function BandTable({ table, legend, testID = 'results-band-table' }: { table: BandTableModel; legend: LegendEntry[]; testID?: string }) {
  const { colors } = useAppTheme();
  const bandWidth = (count: number) => ({ width: `${(count / BAND_SIZE) * 100}%` as `${number}%` });
  const bandFill = (index: number, head: boolean) => ({
    backgroundColor: head ? (index % 2 === 1 ? colors.bandHeadAlt : colors.bandHead) : index % 2 === 1 ? colors.bandAlt : colors.band,
  });
  const cellText = (cell: BandCell) => {
    switch (cell.tone) {
      case 'neg': return { color: colors.negative };
      case 'dash': return { color: colors.outline };
      default: return { color: colors.onSurface };
    }
  };
  return (
    <View testID={testID} accessibilityLabel={`Game by game, ${table.gameCount} games in ${table.bandCount} ${table.bandCount === 1 ? 'band' : 'bands'}`}>
      <View style={[styles.row, styles.headRow, { borderBottomColor: colors.primaryEdge }]} testID="band-table-header">
        <Text variant="labelMedium" style={[styles.playerCell, styles.headText, { color: colors.onSurfaceVariant }]}>Player</Text>
        <Text variant="labelMedium" style={[styles.totalCell, styles.headText, { color: colors.onSurfaceVariant }]}>Total</Text>
        <View style={styles.boxes}>
          {table.header.map((band, bandIndex) => (
            <View key={bandIndex} style={[styles.box, styles.headBox, bandWidth(band.length), bandFill(bandIndex, true), { borderBottomColor: colors.primary }]} testID={`band-header-${bandIndex + 1}`}>
              {band.map((label, cellIndex) => (
                <View key={cellIndex} style={[styles.cell, styles.headCell, cellIndex > 0 && styles.cellLine]}>
                  <Text style={[styles.headLabel, { color: colors.onSurface }]} numberOfLines={1}>{label}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
      {table.rows.map((row) => (
        <View key={row.id} style={[styles.row, { borderBottomColor: colors.outlineVariant }]} testID={`band-row-${row.id}`} accessibilityLabel={`${row.name}, total ${row.total}`}>
          <View style={styles.playerCell}>
            <Text style={[styles.initials, { color: colors.onSurface }]} numberOfLines={1}>{row.initials}</Text>
            {row.playerNo != null ? <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }} numberOfLines={1}>{`#${row.playerNo}`}</Text> : null}
          </View>
          <Text style={[styles.totalCell, styles.total, tabularNums, { color: row.totalTone === 'neg' ? colors.negative : colors.onSurface }]} numberOfLines={1}>
            {row.total}
          </Text>
          <View style={styles.boxes}>
            {row.bands.map((band, bandIndex) => (
              <View key={bandIndex} style={[styles.box, bandWidth(band.length), bandFill(bandIndex, false)]}>
                {band.map((cell, cellIndex) => (
                  <View key={cellIndex} style={[styles.cell, cellIndex > 0 && styles.cellLine, cell.tone === 'dash' && styles.dashCell]}>
                    <Text style={[styles.cellText, tabularNums, cellText(cell)]} numberOfLines={1}>{cell.text}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      ))}
      <Text variant="bodySmall" style={[styles.legend, { color: colors.onSurfaceVariant }]} testID="results-legend">
        {legend.map((entry, index) => (
          <Text key={entry.initials + index} variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
            {index > 0 ? '  ·  ' : ''}
            <Text variant="bodySmall" style={[styles.legendInitials, { color: colors.onSurface }]}>{entry.initials}</Text>
            {entry.playerNo != null ? ` #${entry.playerNo}` : ''} {entry.name}
          </Text>
        ))}
      </Text>
    </View>
  );
}

const PLAYER_W = 52;
const TOTAL_W = 58;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headRow: { borderBottomWidth: 2 },
  headText: { fontWeight: '700', alignSelf: 'center' },
  playerCell: { width: PLAYER_W, justifyContent: 'center' },
  totalCell: { width: TOTAL_W, textAlign: 'right', alignSelf: 'center' },
  initials: { fontWeight: '800', fontSize: 15 },
  total: { fontWeight: '800', fontSize: 15 },
  boxes: { flex: 1, minWidth: 0, gap: 3, alignItems: 'flex-start' },
  box: {
    flexDirection: 'row',
    borderRadius: 5,
    overflow: 'hidden',
  },
  headBox: { borderBottomWidth: 2, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  cell: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    paddingVertical: 3,
    paddingHorizontal: 4,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  cellLine: { borderLeftColor: '#FFFFFF', borderLeftWidth: 1 },
  dashCell: { alignItems: 'center' },
  headCell: { alignItems: 'center' },
  headLabel: { fontWeight: '800', fontSize: 13 },
  cellText: { fontSize: 14 },
  legend: { marginTop: spacing.sm, lineHeight: 20 },
  legendInitials: { fontWeight: '800' },
});

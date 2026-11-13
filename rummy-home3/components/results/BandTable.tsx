import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { BandCell, BandTable as BandTableModel, LegendEntry } from '@/utils/resultsDesign';

/**
 * "How you got there": players down, games across in bands of five. Player and Total sit
 * on the left; every band — the header's and each row's — is one bordered box of five
 * cells, so with seven games the same two-box shape repeats in the header and in every row.
 * Nothing scrolls sideways; the image, the PDF and the web page draw the same boxes.
 */
export function BandTable({ table, legend, testID = 'results-band-table' }: { table: BandTableModel; legend: LegendEntry[]; testID?: string }) {
  const { colors } = useAppTheme();
  const border = { borderColor: colors.primary };
  const headBorder = { borderColor: colors.primaryEdge, backgroundColor: colors.tableHeader };
  const cellStyle = (cell: BandCell) => {
    switch (cell.tone) {
      case 'win': return [styles.cell, { backgroundColor: colors.winContainer }];
      case 'blank': return [styles.cell, { backgroundColor: colors.surfaceSunken }];
      default: return [styles.cell];
    }
  };
  const cellText = (cell: BandCell) => {
    switch (cell.tone) {
      case 'neg': return { color: colors.negative };
      case 'dash': return { color: colors.outline };
      case 'win': return { color: colors.onWinContainer, fontWeight: '700' as const };
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
            <View key={bandIndex} style={[styles.box, headBorder]} testID={`band-header-${bandIndex + 1}`}>
              {band.map((label, cellIndex) => (
                <View key={cellIndex} style={[styles.cell, styles.headCell, cellIndex > 0 && { borderLeftColor: colors.outlineVariant, borderLeftWidth: StyleSheet.hairlineWidth }]}>
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
              <View key={bandIndex} style={[styles.box, border]}>
                {band.map((cell, cellIndex) => (
                  <View key={cellIndex} style={[...cellStyle(cell), cellIndex > 0 && { borderLeftColor: colors.outlineVariant, borderLeftWidth: StyleSheet.hairlineWidth }]}>
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
  boxes: { flex: 1, minWidth: 0, gap: 3 },
  box: {
    flexDirection: 'row',
    borderWidth: 2,
    borderRadius: 5,
    overflow: 'hidden',
  },
  cell: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    paddingVertical: 3,
    paddingHorizontal: 4,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headCell: { alignItems: 'center' },
  headLabel: { fontWeight: '800', fontSize: 13 },
  cellText: { fontSize: 14 },
  legend: { marginTop: spacing.sm, lineHeight: 20 },
  legendInitials: { fontWeight: '800' },
});

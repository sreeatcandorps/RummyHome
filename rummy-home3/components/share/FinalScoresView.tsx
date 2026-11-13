import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { FinalScoresSheet } from '@/utils/finalScoresSheet';
import { RoundBlock } from '@/utils/resultsDetails';

/**
 * One game's rounds, five players to a block, with the game total in each column head
 * (PR 8 design, the same shape as the "Round by round" pages of the results PDF). This is
 * the on-screen preview; the shared picture is the standings card and the rounds go in
 * the PDF, so nothing here needs to fit a 720 px image.
 */
export function FinalScoresView({ sheet, testID = 'final-scores-rounds' }: { sheet: FinalScoresSheet; testID?: string }) {
  const { colors } = useAppTheme();
  const { table } = sheet;
  const blockCount = table.blocks.length;
  return (
    <View testID={testID} style={styles.wrap} accessibilityLabel={`Round by round, ${table.names.length} players in ${blockCount} ${blockCount === 1 ? 'block' : 'blocks'}`}>
      {table.blocks.map((block, blockIndex) => (
        <RoundBlockView
          key={blockIndex}
          block={block}
          title={blockCount > 1 ? `Players ${blockIndex * ROUND_BLOCK + 1}–${blockIndex * ROUND_BLOCK + block.heads.length} of ${table.names.length}` : null}
          testID={blockIndex === 0 ? 'final-scores-block-1' : `final-scores-block-${blockIndex + 1}`}
        />
      ))}
      <Text variant="bodySmall" style={[styles.legend, { color: colors.onSurfaceVariant }]} testID="final-scores-legend">
        {table.initials.map((initials, index) => (
          <Text key={initials + index} variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
            {index > 0 ? '  ·  ' : ''}
            <Text variant="bodySmall" style={[styles.legendInitials, { color: colors.onSurface }]}>{initials}</Text>
            {' '}{table.names[index]}
          </Text>
        ))}
      </Text>
    </View>
  );
}

const ROUND_BLOCK = 5;

function RoundBlockView({ block, title, testID }: { block: RoundBlock; title: string | null; testID: string }) {
  const { colors } = useAppTheme();
  const line = { borderColor: colors.outlineVariant };
  return (
    <View style={[styles.block, { borderColor: colors.primary, backgroundColor: colors.surface }]} testID={testID}>
      {title ? <Text variant="labelMedium" style={[styles.blockTitle, { color: colors.onSurfaceVariant }]}>{title}</Text> : null}
      <View style={[styles.row, styles.headRow, { backgroundColor: colors.tableHeader, borderBottomColor: colors.primaryEdge }]}>
        <Text variant="labelSmall" style={[styles.roundCell, { color: colors.onSurfaceVariant }]}>Rnd</Text>
        {block.heads.map((head, index) => (
          <View key={index} style={[styles.cell, styles.headCell, index > 0 && [styles.leftLine, line]]}>
            <Text style={[styles.initials, { color: colors.onSurface }]} numberOfLines={1}>{head.initials}</Text>
            {head.playerNo != null ? <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }} numberOfLines={1}>{`#${head.playerNo}`}</Text> : null}
            <Text style={[styles.total, tabularNums, { color: head.total.startsWith('-') ? colors.negative : colors.onSurface }]} numberOfLines={1}>{head.total}</Text>
          </View>
        ))}
      </View>
      {block.rows.length === 0 ? (
        <Text variant="bodySmall" style={[styles.empty, { color: colors.onSurfaceVariant }]}>No rounds yet.</Text>
      ) : (
        block.rows.map((row) => (
          <View key={row.round} style={[styles.row, { borderBottomColor: colors.outlineVariant }]}>
            <Text variant="labelSmall" style={[styles.roundCell, { color: colors.onSurfaceVariant }]}>{row.round}</Text>
            {row.cells.map((cell, index) => {
              const win = cell.startsWith('+');
              const neg = cell.startsWith('-');
              return (
                <View key={index} style={[styles.cell, index > 0 && [styles.leftLine, line], win && { backgroundColor: colors.winContainer }]}>
                  <Text style={[styles.cellText, tabularNums, { color: win ? colors.onWinContainer : neg ? colors.negative : colors.onSurface }, win && styles.bold]} numberOfLines={1}>
                    {cell}
                  </Text>
                </View>
              );
            })}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  block: { borderWidth: 2, borderRadius: 8, overflow: 'hidden' },
  blockTitle: { paddingHorizontal: 8, paddingTop: 6, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: StyleSheet.hairlineWidth },
  headRow: { borderBottomWidth: 2 },
  roundCell: { width: 34, paddingHorizontal: 6, alignSelf: 'center' },
  cell: { flex: 1, flexBasis: 0, minWidth: 0, paddingVertical: 4, paddingHorizontal: 4, alignItems: 'flex-end', justifyContent: 'center' },
  headCell: { alignItems: 'center', paddingVertical: 6 },
  leftLine: { borderLeftWidth: StyleSheet.hairlineWidth },
  initials: { fontWeight: '800', fontSize: 14 },
  total: { fontWeight: '800', fontSize: 15 },
  cellText: { fontSize: 14 },
  bold: { fontWeight: '700' },
  empty: { padding: spacing.sm },
  legend: { marginTop: spacing.xs, lineHeight: 20 },
  legendInitials: { fontWeight: '800' },
});

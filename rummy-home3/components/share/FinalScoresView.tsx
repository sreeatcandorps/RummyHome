import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { radius, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { LegendKey } from '@/components/results/LegendKey';
import { FinalScoresSheet } from '@/utils/finalScoresSheet';
import { widestChars } from '@/utils/multiplier';
import { RoundBlock } from '@/utils/resultsDetails';
import { rechunkRoundTable, ROUND_COLUMN_WIDTH, screenBlockSize } from '@/utils/roundBlocks';

/**
 * One game's rounds in blocks of players with the game total in each column head (PR 8 design,
 * the same shape as the "Round by round" pages of the results PDF). v12 point 13 (Sree, Nov 19:
 * "I can't see the fifth one. It's cutting off"): the view measures its width and shows as many
 * players per block as fit at a readable size; a short last block keeps the full block's column
 * width (empty cells fill the rest) so it is left-aligned, not stretched. Player IDs live in the
 * two-column key under the blocks, not in the heads. This is the on-screen preview; the shared
 * picture is the standings card and the rounds go in the PDF.
 */
export function FinalScoresView({ sheet }: { sheet: FinalScoresSheet }) {
  const { table } = sheet;
  const [width, setWidth] = React.useState(0);
  const perBlock = screenBlockSize(width, widestChars([...table.totals, ...table.rows.flatMap((row) => row.cells)]), table.blockSize);
  const blocks = rechunkRoundTable(table, perBlock);
  const blockCount = blocks.length;
  return (
    <View
      testID="final-scores-rounds"
      style={styles.wrap}
      onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}
      accessibilityLabel={`Round by round, ${table.names.length} players in ${blockCount} ${blockCount === 1 ? 'block' : 'blocks'}`}
    >
      {blocks.map((block, blockIndex) => (
        <RoundBlockView
          key={blockIndex}
          block={block}
          perBlock={perBlock}
          title={blockCount > 1 ? `Players ${blockIndex * perBlock + 1}–${blockIndex * perBlock + block.heads.length} of ${table.names.length}` : null}
          testID={`final-scores-block-${blockIndex + 1}`}
        />
      ))}
      <LegendKey
        entries={table.initials.map((initials, index) => ({ initials, name: table.names[index], playerNo: table.playerNos?.[index] ?? null }))}
        testID="final-scores-legend"
      />
    </View>
  );
}

function RoundBlockView({ block, perBlock, title, testID }: { block: RoundBlock; perBlock: number; title: string | null; testID: string }) {
  const { colors } = useAppTheme();
  const line = { borderColor: colors.outlineVariant };
  // Empty cells after a short last block keep every column the same width across blocks.
  const fillers = Array.from({ length: Math.max(0, perBlock - block.heads.length) }, (_, index) => index);
  return (
    <View style={[styles.block, { borderColor: colors.primary, backgroundColor: colors.surface }]} testID={testID}>
      {title ? <Text variant="labelMedium" style={[styles.blockTitle, { color: colors.onSurfaceVariant }]}>{title}</Text> : null}
      <View style={[styles.row, styles.headRow, { backgroundColor: colors.tableHeader, borderBottomColor: colors.primaryEdge }]}>
        <Text variant="labelSmall" style={[styles.roundCell, { color: colors.onSurfaceVariant }]}>Rd</Text>
        {block.heads.map((head, index) => (
          <View key={index} style={[styles.cell, styles.headCell, index > 0 && [styles.leftLine, line]]}>
            <Text style={[styles.initials, { color: colors.onSurface }]} numberOfLines={1}>{head.initials}</Text>
            <Text style={[styles.total, tabularNums, { color: head.total.startsWith('-') ? colors.negative : colors.onSurface }]} numberOfLines={1}>{head.total}</Text>
          </View>
        ))}
        {fillers.map((index) => <View key={`f${index}`} style={styles.cell} />)}
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
            {fillers.map((index) => <View key={`f${index}`} style={styles.cell} />)}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  block: { borderWidth: 2, borderRadius: radius.sm, overflow: 'hidden' },
  blockTitle: { paddingHorizontal: 8, paddingTop: 6, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: StyleSheet.hairlineWidth },
  headRow: { borderBottomWidth: 2 },
  roundCell: { width: ROUND_COLUMN_WIDTH, paddingHorizontal: 6, alignSelf: 'center' },
  cell: { flex: 1, minWidth: 0, paddingVertical: 4, paddingHorizontal: 4, alignItems: 'flex-end', justifyContent: 'center' },
  headCell: { alignItems: 'center', paddingVertical: 6 },
  leftLine: { borderLeftWidth: StyleSheet.hairlineWidth },
  initials: { fontWeight: '800', fontSize: 14 },
  total: { fontWeight: '800', fontSize: 15 },
  cellText: { fontSize: 14 },
  bold: { fontWeight: '700' },
  empty: { padding: spacing.sm },
});

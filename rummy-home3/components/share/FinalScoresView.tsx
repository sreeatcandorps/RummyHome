import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { CELLS_PER_ROW, FinalScoresSheet } from '@/utils/finalScoresSheet';

/** Yellow palette: single-game final scores. Consolidated results stay green. */
export const FINAL_SCORES_COLORS = {
  header: '#F2C14E',
  onHeader: '#2E2300',
  onHeaderMuted: '#5A4A10',
  paper: '#FFF8E6',
  card: '#FFFFFF',
  line: '#EADFC2',
  ink: '#1B1F1C',
  muted: '#6B6455',
  pos: '#0E7A43',
  posBg: '#E3F4E8',
  neg: '#8C2F2F',
  negBg: '#FBE7E6',
  zeroBg: '#F4F1EA',
} as const;

export const IMAGE_WIDTH = 720;
const PAD = 24;
export const CELL = Math.floor((IMAGE_WIDTH - PAD * 2 - 32 - (CELLS_PER_ROW - 1) * 8) / CELLS_PER_ROW);

/** The long image captured on the phone. Web draws the same sheet on a canvas. */
export function FinalScoresView({ sheet, viewRef }: { sheet: FinalScoresSheet; viewRef?: React.Ref<View> }) {
  const c = FINAL_SCORES_COLORS;
  return (
    <View ref={viewRef} collapsable={false} style={styles.card} accessibilityLabel="EZ Score: Rummy final scores">
      <View style={styles.header}>
        <Text style={styles.brand}>EZ SCORE: RUMMY</Text>
        <Text style={styles.heading}>{sheet.heading}</Text>
        <Text style={styles.meta}>{sheet.startedLine}</Text>
        <Text style={styles.meta}>{sheet.completedLine}</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Totals</Text>
        {sheet.summary.map((row) => (
          <View key={row.id} style={styles.summaryRow}>
            <Text style={styles.summaryName} numberOfLines={1}>{row.name}</Text>
            <Text style={[styles.summaryTotal, { color: row.total < 0 ? c.neg : row.total > 0 ? c.pos : c.ink }]}>{row.totalText}</Text>
          </View>
        ))}
        <Text style={styles.sum}>
          {sheet.roundCount === 1 ? '1 round' : `${sheet.roundCount} rounds`} · {sheet.totalSum === 0 ? 'Totals add to 0' : `Totals add to ${sheet.totalSum}`}
        </Text>
      </View>

      {sheet.players.map((player) => (
        <View key={player.id} style={styles.block}>
          <View style={styles.summaryRow}>
            <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
            <Text style={[styles.playerTotal, { color: player.total < 0 ? c.neg : player.total > 0 ? c.pos : c.ink }]}>{player.totalText}</Text>
          </View>
          {player.rows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.cellRow}>
              {row.map((cell) => (
                <View
                  key={cell.round}
                  style={[styles.cell, { backgroundColor: cell.sign === 'pos' ? c.posBg : cell.sign === 'neg' ? c.negBg : c.zeroBg }]}
                >
                  <Text style={styles.cellRound}>{`R${cell.round}`}</Text>
                  <Text style={[styles.cellValue, { color: cell.sign === 'pos' ? c.pos : cell.sign === 'neg' ? c.neg : c.ink }]}>{cell.text}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>{sheet.footer}</Text>
        <Text style={styles.footerText}>{sheet.generatedLine}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: FINAL_SCORES_COLORS.paper, width: IMAGE_WIDTH },
  header: { backgroundColor: FINAL_SCORES_COLORS.header, padding: PAD },
  brand: { color: FINAL_SCORES_COLORS.onHeaderMuted, fontWeight: '700', letterSpacing: 1 },
  heading: { color: FINAL_SCORES_COLORS.onHeader, fontSize: 34, fontWeight: '800', marginTop: 6 },
  meta: { color: FINAL_SCORES_COLORS.onHeaderMuted, marginTop: 4, fontSize: 15, fontWeight: '600' },
  block: {
    marginHorizontal: PAD,
    marginTop: 16,
    padding: 16,
    backgroundColor: FINAL_SCORES_COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FINAL_SCORES_COLORS.line,
  },
  blockTitle: { color: FINAL_SCORES_COLORS.muted, fontWeight: '800', letterSpacing: 1, fontSize: 13, marginBottom: 6 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  summaryName: { color: FINAL_SCORES_COLORS.ink, fontSize: 20, fontWeight: '700', flex: 1, paddingRight: 12 },
  summaryTotal: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sum: { color: FINAL_SCORES_COLORS.muted, marginTop: 8, fontSize: 13 },
  playerName: { color: FINAL_SCORES_COLORS.ink, fontSize: 18, fontWeight: '800', flex: 1, paddingRight: 12 },
  playerTotal: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  cellRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  cell: { width: CELL, height: CELL, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cellRound: { color: FINAL_SCORES_COLORS.muted, fontSize: 12, fontWeight: '700' },
  cellValue: { fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 2 },
  footer: { padding: PAD, gap: 2 },
  footerText: { color: FINAL_SCORES_COLORS.muted, fontSize: 13, fontWeight: '600' },
});

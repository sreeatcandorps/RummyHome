import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { placeLine, ScorecardSheet } from '@/utils/scorecardSheet';

/** The layout captured on the phone. Web draws the same sheet on a canvas. */
export function ScorecardImageView({ sheet, viewRef }: { sheet: ScorecardSheet; viewRef?: React.Ref<View> }) {
  return (
    <View ref={viewRef} collapsable={false} style={styles.card} accessibilityLabel="EZ Score: Rummy results">
      <View style={styles.header}>
        <Text style={styles.brand}>EZ SCORE: RUMMY</Text>
        <Text style={styles.heading}>{sheet.heading}</Text>
        <Text style={styles.when}>{`${sheet.when}  ·  ${sheet.status}`}</Text>
      </View>
      <View style={styles.table}>
        <View style={styles.row}>
          <Text style={[styles.cell, styles.round, styles.head]}>Rnd</Text>
          {sheet.columns.map((column, index) => (
            <View key={`${column.label}-${index}`} style={styles.col}>
              <Text style={styles.head}>{column.label}</Text>
              <Text style={[styles.total, column.total < 0 ? styles.neg : styles.pos]}>{column.totalText}</Text>
            </View>
          ))}
        </View>
        {sheet.rounds.map((round) => (
          <View key={round.round} style={styles.row}>
            <Text style={[styles.cell, styles.round]}>{round.round}</Text>
            {round.cells.map((cell, index) => (
              <Text key={`${round.round}-${sheet.columns[index]?.label}`} style={[styles.cell, cell.sign === 'pos' ? styles.pos : cell.sign === 'neg' ? styles.neg : styles.zero]}>
                {cell.text}
              </Text>
            ))}
          </View>
        ))}
      </View>
      <View style={styles.places}>
        {sheet.places.map((place) => (
          <Text key={place.label} style={styles.place}>{placeLine(place)}</Text>
        ))}
        <Text style={styles.sum}>{sheet.totalSum === 0 ? 'Totals add to 0' : `Totals add to ${sheet.totalSum}`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#F7F1E6', width: 720 },
  header: { backgroundColor: '#14382A', padding: 24 },
  brand: { color: '#E3B341', fontWeight: '700', letterSpacing: 1 },
  heading: { color: '#FBF1E1', fontSize: 36, fontWeight: '800', marginTop: 8 },
  when: { color: '#FBF1E1', marginTop: 4 },
  table: { margin: 16, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E7E0D4' },
  col: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  cell: { flex: 1, textAlign: 'center', paddingVertical: 8, fontVariant: ['tabular-nums'] },
  round: { flex: 0, width: 48 },
  head: { color: '#14382A', fontWeight: '800' },
  total: { fontWeight: '800' },
  pos: { color: '#0E7A43', fontWeight: '700', textAlign: 'center' },
  neg: { color: '#8C2F2F', fontWeight: '700', textAlign: 'center' },
  zero: { color: '#1B1F1C', textAlign: 'center' },
  places: { paddingHorizontal: 24, paddingBottom: 24, gap: 6 },
  place: { color: '#14382A', fontSize: 20, fontWeight: '800' },
  sum: { color: '#5C6560', marginTop: 4 },
});

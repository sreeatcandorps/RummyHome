import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { spacing, useAppTheme } from '@/constants/theme';
import { legendColumns, legendRows } from '@/utils/legendKey';
import { LegendEntry } from '@/utils/resultsDesign';

/**
 * The abbreviation key under a score table. v12 point 14 (Sree, Nov 19): "too busy and pretty
 * nasty … divide this into 2 columns, put the initials and the name" — a two-column table of
 * initials · name · #ID with light row lines, not one run-on line.
 */
export function LegendKey({ entries, testID }: { entries: LegendEntry[]; testID: string }) {
  const { colors } = useAppTheme();
  const [width, setWidth] = React.useState(0);
  const columns = legendColumns(width);
  const rows = legendRows(entries, columns);
  return (
    <View
      style={styles.wrap}
      onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}
      testID={testID}
      accessibilityLabel={`Key: ${entries.map((entry) => `${entry.initials} ${entry.name}`).join(', ')}`}
    >
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={[styles.row, { borderBottomColor: colors.outlineVariant }]}>
          {row.map((entry, column) => (
            <View key={column} style={[styles.cell, column > 0 && [styles.leftLine, { borderLeftColor: colors.outlineVariant }]]}>
              {entry ? (
                <Text variant="bodySmall" numberOfLines={1} style={{ color: colors.onSurfaceVariant }}>
                  <Text variant="bodySmall" style={[styles.initials, { color: colors.onSurface }]}>{entry.initials}</Text>
                  {'  '}{entry.name}
                  {entry.playerNo != null ? ` · #${entry.playerNo}` : ''}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm },
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  cell: { flex: 1, minWidth: 0, paddingVertical: 4, paddingHorizontal: 6 },
  leftLine: { borderLeftWidth: StyleSheet.hairlineWidth },
  initials: { fontWeight: '800' },
});

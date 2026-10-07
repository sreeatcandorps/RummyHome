import React, { useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { radius, spacing, tabularNums, useAppTheme } from '@/constants/theme';

export type ScoreColumn = {
  id: string;
  label: string;
  color: string;
  isExpense?: boolean;
};

type ScoreTableProps = {
  columns: ScoreColumn[];
  scores: Record<string, number[]>;
  roundCount: number;
  totals: Record<string, number>;
  roundTotals: number[];
  grandTotal: number;
  dealerLabelForRound: (roundIndex: number) => string | undefined;
  nextDealerId?: string;
  leaderIds: string[];
  /** Short screens (phone landscape) trade padding for visible rows. */
  compact?: boolean;
  emptyMessage: string;
};

/** Below this a column can no longer show "-1234" legibly, so the table scrolls sideways instead. */
const MIN_COLUMN_WIDTH = 38;

const fontSizeFor = (columnWidth: number) => {
  if (columnWidth >= 64) return 16;
  if (columnWidth >= 52) return 15;
  if (columnWidth >= 44) return 14;
  return 13;
};

export function ScoreTable({
  columns,
  scores,
  roundCount,
  totals,
  roundTotals,
  grandTotal,
  dealerLabelForRound,
  nextDealerId,
  leaderIds,
  compact = false,
  emptyMessage,
}: ScoreTableProps) {
  const theme = useAppTheme();
  const { colors } = theme;
  const [tableWidth, setTableWidth] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const verticalRef = useRef<ScrollView>(null);
  const shownRounds = useRef(0);

  const roundColumnWidth = compact ? 48 : 42;
  const available = Math.max(tableWidth - roundColumnWidth, 0);
  const fitWidth = columns.length ? available / columns.length : available;
  const columnWidth = Math.max(MIN_COLUMN_WIDTH, fitWidth);
  const contentWidth = columnWidth * columns.length;
  const scrollsSideways = fitWidth < MIN_COLUMN_WIDTH;

  const fontSize = fontSizeFor(columnWidth);
  const rowHeight = compact ? 34 : columns.length > 8 ? 40 : 44;
  const headerHeight = compact ? 38 : 48;
  const totalsHeight = compact ? 40 : 48;

  const translate = { transform: [{ translateX: Animated.multiply(scrollX, -1) }] };
  const onHorizontalScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: Platform.OS !== 'web',
  });

  const handleLayout = (event: LayoutChangeEvent) => {
    const width = Math.floor(event.nativeEvent.layout.width);
    if (width !== tableWidth) setTableWidth(width);
  };

  // Follow the newest round so the latest hand is always on screen.
  const handleContentSizeChange = () => {
    if (roundCount > shownRounds.current) {
      verticalRef.current?.scrollToEnd({ animated: shownRounds.current > 0 });
    }
    shownRounds.current = roundCount;
  };

  const isLeader = (id: string) => leaderIds.includes(id);

  const headerCells = columns.map((column) => {
    const dealsNext = column.id === nextDealerId;
    const leader = isLeader(column.id);
    return (
      <View
        key={column.id}
        style={[
          styles.cell,
          { width: columnWidth, height: headerHeight, borderRightColor: colors.hairline },
          dealsNext && { backgroundColor: colors.primary },
        ]}
      >
        <View style={styles.headerLabelRow}>
          {leader ? <Icon source="crown" size={compact ? 12 : 14} color={dealsNext ? colors.onPrimary : colors.leader} /> : null}
          <Text
            numberOfLines={1}
            style={[
              styles.headerText,
              {
                fontSize: fontSize - 1,
                color: dealsNext ? colors.onPrimary : column.isExpense ? colors.onSurfaceVariant : column.color,
              },
            ]}
          >
            {column.label}
          </Text>
        </View>
        {dealsNext ? (
          <Text style={[styles.dealsText, { color: colors.onPrimary }]} numberOfLines={1}>
            DEALS
          </Text>
        ) : (
          <View style={[styles.seatBar, { backgroundColor: column.isExpense ? colors.outlineVariant : column.color }]} />
        )}
      </View>
    );
  });

  const totalCells = columns.map((column) => {
    const total = totals[column.id] ?? 0;
    const leader = isLeader(column.id);
    return (
      <View
        key={column.id}
        style={[
          styles.cell,
          { width: columnWidth, height: totalsHeight, borderRightColor: colors.hairline },
          leader && { backgroundColor: colors.leaderContainer },
        ]}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[
            styles.totalText,
            tabularNums,
            {
              fontSize: fontSize + 1,
              color: leader
                ? colors.onLeaderContainer
                : total > 0
                  ? colors.positive
                  : total < 0
                    ? colors.negative
                    : colors.onSurfaceVariant,
            },
          ]}
        >
          {total}
        </Text>
      </View>
    );
  });

  const body =
    roundCount === 0 ? (
      <View style={styles.emptyTable}>
        <Icon source="cards-playing-outline" size={32} color={colors.onSurfaceVariant} />
        <Text variant="bodyMedium" style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
          {emptyMessage}
        </Text>
      </View>
    ) : (
      <View style={styles.row}>
        <View style={{ width: roundColumnWidth }}>
          {Array.from({ length: roundCount }, (_, roundIndex) => {
            const dealer = dealerLabelForRound(roundIndex);
            const offBy = roundTotals[roundIndex] ?? 0;
            const isLatest = roundIndex === roundCount - 1;
            return (
              <View
                key={roundIndex}
                style={[
                  styles.cell,
                  styles.roundCell,
                  {
                    width: roundColumnWidth,
                    height: rowHeight,
                    borderRightColor: colors.outlineVariant,
                    borderBottomColor: colors.hairline,
                    backgroundColor: offBy !== 0 ? colors.errorContainer : isLatest ? colors.tableLatest : colors.tableHeader,
                  },
                ]}
              >
                <Text style={[styles.roundText, tabularNums, { fontSize: fontSize - 1, color: colors.onSurface }]}>
                  {roundIndex + 1}
                </Text>
                {offBy !== 0 ? (
                  <Text style={[styles.roundMeta, { color: colors.onErrorContainer }]} numberOfLines={1}>
                    {offBy > 0 ? `+${offBy}` : offBy}
                  </Text>
                ) : dealer ? (
                  <Text style={[styles.roundMeta, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                    {dealer}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>

        <Animated.ScrollView
          horizontal
          scrollEnabled={scrollsSideways}
          showsHorizontalScrollIndicator={scrollsSideways}
          onScroll={onHorizontalScroll}
          scrollEventThrottle={16}
          bounces={false}
        >
          <View style={{ width: contentWidth }}>
            {Array.from({ length: roundCount }, (_, roundIndex) => {
              const isLatest = roundIndex === roundCount - 1;
              const stripe = roundIndex % 2 === 1;
              return (
                <View
                  key={roundIndex}
                  style={[
                    styles.row,
                    {
                      height: rowHeight,
                      borderBottomColor: colors.hairline,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      backgroundColor: isLatest ? colors.tableLatest : stripe ? colors.tableStripe : colors.surface,
                    },
                  ]}
                >
                  {columns.map((column) => {
                    const score = scores[column.id]?.[roundIndex] || 0;
                    const positive = score > 0;
                    return (
                      <View
                        key={column.id}
                        style={[styles.cell, { width: columnWidth, height: rowHeight, borderRightColor: colors.hairline }]}
                      >
                        <View style={[styles.scorePill, positive && { backgroundColor: colors.positiveContainer }]}>
                          <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            style={[
                              styles.scoreText,
                              tabularNums,
                              { fontSize },
                              positive
                                ? { color: colors.onPositiveContainer, fontWeight: '800' }
                                : score === 0
                                  ? { color: colors.outline }
                                  : { color: colors.onSurface },
                            ]}
                          >
                            {score !== 0 ? (positive ? `+${score}` : score) : '–'}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </Animated.ScrollView>
      </View>
    );

  return (
    <View
      style={[styles.table, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
      onLayout={handleLayout}
    >
      {tableWidth > 0 ? (
        <>
          <View style={[styles.row, { backgroundColor: colors.tableHeader, borderBottomColor: colors.outlineVariant }, styles.headerRow]}>
            <View
              style={[
                styles.cell,
                { width: roundColumnWidth, height: headerHeight, borderRightColor: colors.outlineVariant },
              ]}
            >
              <Text style={[styles.cornerText, { color: colors.onSurfaceVariant }]}>RND</Text>
            </View>
            <View style={styles.clip}>
              <Animated.View style={[styles.row, { width: contentWidth }, translate]}>{headerCells}</Animated.View>
            </View>
          </View>

          <ScrollView
            ref={verticalRef}
            style={styles.flex}
            onContentSizeChange={handleContentSizeChange}
            showsVerticalScrollIndicator={roundCount > 0}
          >
            {body}
          </ScrollView>

          <View style={[styles.row, styles.totalsRow, { backgroundColor: colors.tableHeader, borderTopColor: colors.primary }]}>
            <View
              style={[styles.cell, { width: roundColumnWidth, height: totalsHeight, borderRightColor: colors.outlineVariant }]}
            >
              <Text style={[styles.cornerText, { color: colors.onSurface }]}>TOTAL</Text>
              {grandTotal !== 0 ? (
                <Text style={[styles.roundMeta, { color: colors.error }]} numberOfLines={1}>
                  {grandTotal > 0 ? `+${grandTotal}` : grandTotal}
                </Text>
              ) : null}
            </View>
            <View style={styles.clip}>
              <Animated.View style={[styles.row, { width: contentWidth }, translate]}>{totalCells}</Animated.View>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
  },
  headerRow: {
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  totalsRow: {
    borderTopWidth: 2,
  },
  clip: {
    flex: 1,
    overflow: 'hidden',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 2,
  },
  roundCell: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    maxWidth: '100%',
  },
  headerText: {
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  dealsText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 1,
  },
  seatBar: {
    width: 16,
    height: 3,
    borderRadius: 2,
    marginTop: 3,
  },
  cornerText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  roundText: {
    fontWeight: '800',
  },
  roundMeta: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: -1,
  },
  scorePill: {
    minWidth: '86%',
    paddingHorizontal: 2,
    paddingVertical: 2,
    borderRadius: radius.xs,
    alignItems: 'center',
  },
  scoreText: {
    fontWeight: '500',
    textAlign: 'center',
  },
  totalText: {
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyTable: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    textAlign: 'center',
    maxWidth: 280,
  },
});

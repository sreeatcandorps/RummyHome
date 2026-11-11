import React, { useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { radius, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { scoreTextStyle, scoreTone } from '@/utils/scoreTone';

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
  /** Full count of the game; losses of half this or more are shown in red. */
  fullCount?: number | null;
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

type ScoreRowProps = {
  columns: ScoreColumn[];
  /** The stored value per column for this round; undefined where the player had no score. */
  cells: (number | undefined)[];
  isLatest: boolean;
  stripe: boolean;
  columnWidth: number;
  rowHeight: number;
  fontSize: number;
  fullCount?: number | null;
  colors: ReturnType<typeof useAppTheme>['colors'];
};

const sameColumns = (a: ScoreColumn[], b: ScoreColumn[]) =>
  a.length === b.length && a.every((column, i) => column.id === b[i].id && column.label === b[i].label && column.color === b[i].color && column.isExpense === b[i].isExpense);
const sameCells = (a: (number | undefined)[], b: (number | undefined)[]) => a.length === b.length && a.every((value, i) => value === b[i]);

/**
 * One round of scores. Memoised by value (the screen rebuilds its columns and
 * scores objects on every render), so a reload, a menu or a realtime echo
 * redraws only the rows whose numbers changed, usually just the newest one.
 */
const ScoreRow = React.memo(function ScoreRow({ columns, cells, isLatest, stripe, columnWidth, rowHeight, fontSize, fullCount, colors }: ScoreRowProps) {
  return (
    <View
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
      {columns.map((column, index) => {
        const stored = cells[index];
        // A saved 0 is a real score; a missing cell (player not in that round) shows a dash.
        const hasScore = typeof stored === 'number';
        const score = hasScore ? stored : 0;
        const tone = scoreTone(score, fullCount);
        const positive = tone === 'positive';
        const bigLoss = tone === 'bigNegative';
        const text = scoreTextStyle(tone);
        return (
          <View
            key={column.id}
            style={[styles.cell, { width: columnWidth, height: rowHeight, borderRightColor: colors.hairline }]}
          >
            <View
              style={[
                styles.scorePill,
                positive && { backgroundColor: colors.positiveContainer },
                bigLoss && { backgroundColor: colors.errorContainer },
              ]}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[
                  styles.scoreText,
                  tabularNums,
                  { fontSize },
                  // Wins green and bold; every loss red, same size, not bold (a big loss also gets the red pill).
                  positive
                    ? { color: colors.onPositiveContainer, fontWeight: text.fontWeight }
                    : { color: colors[text.colorKey], fontWeight: text.fontWeight },
                ]}
              >
                {!hasScore ? '–' : positive ? `+${score}` : `${score}`}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}, (prev, next) =>
  prev.isLatest === next.isLatest
  && prev.stripe === next.stripe
  && prev.columnWidth === next.columnWidth
  && prev.rowHeight === next.rowHeight
  && prev.fontSize === next.fontSize
  && prev.fullCount === next.fullCount
  && prev.colors === next.colors
  && sameColumns(prev.columns, next.columns)
  && sameCells(prev.cells, next.cells));

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
  fullCount,
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
  const headerHeight = compact ? 58 : 64;

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
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[
            styles.headerTotal,
            tabularNums,
            {
              fontSize,
              color: dealsNext
                ? colors.onPrimary
                : (totals[column.id] ?? 0) > 0
                  ? colors.positive
                  : (totals[column.id] ?? 0) < 0
                    ? colors.negative
                    : colors.onSurface,
            },
          ]}
        >
          {totals[column.id] ?? 0}
        </Text>
        {dealsNext ? (
          <View style={styles.headerLabelRow}>
            {leader ? <Icon source="crown" size={10} color={colors.onPrimary} /> : null}
            <Text style={[styles.dealsText, { color: colors.onPrimary }]} numberOfLines={1}>
              DEALS
            </Text>
          </View>
        ) : leader ? (
          <Icon source="crown" size={compact ? 12 : 14} color={colors.leader} />
        ) : (
          <View style={[styles.seatBar, { backgroundColor: column.isExpense ? colors.outlineVariant : column.color }]} />
        )}
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
            {Array.from({ length: roundCount }, (_, roundIndex) => (
              <ScoreRow
                key={roundIndex}
                columns={columns}
                cells={columns.map((column) => scores[column.id]?.[roundIndex])}
                isLatest={roundIndex === roundCount - 1}
                stripe={roundIndex % 2 === 1}
                columnWidth={columnWidth}
                rowHeight={rowHeight}
                fontSize={fontSize}
                fullCount={fullCount}
                colors={colors}
              />
            ))}
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
              {grandTotal !== 0 ? (
                <Text style={[styles.roundMeta, { color: colors.error }]} numberOfLines={1}>
                  {grandTotal > 0 ? `+${grandTotal}` : grandTotal}
                </Text>
              ) : null}
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
  headerTotal: {
    fontWeight: '800',
    textAlign: 'center',
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

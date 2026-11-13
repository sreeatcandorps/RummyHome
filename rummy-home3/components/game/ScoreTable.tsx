import React, { useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { radius, seatColor, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { scoreTextStyle, scoreTone } from '@/utils/scoreTone';
import {
  cellFontSize,
  columnLayout,
  DEALER_BAR,
  dealsBadge,
  headerHeight,
  headerPadding,
  headerType,
  rowHeight as rowHeightFor,
  TABLE_MAX_FONT_SCALE,
} from '@/utils/scorecardLayout';

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
  /** Round indexes that start a new rotation (the first dealer deals again); a divider is drawn above each. */
  rotationStarts?: number[];
  leaderIds: string[];
  /** Short screens (phone landscape) trade padding for visible rows. */
  compact?: boolean;
  /** Full count of the game; losses of half this or more are shown in red. */
  fullCount?: number | null;
  emptyMessage: string;
};

/** Totals and the header read a size up from the cells; every number carries its sign. */
export const signed = (value: number) => (value > 0 ? `+${value}` : `${value}`);

type ScoreRowProps = {
  columns: ScoreColumn[];
  /** The stored value per column for this round; undefined where the player had no score. */
  cells: (number | undefined)[];
  isLatest: boolean;
  stripe: boolean;
  /** One full rotation ended above this row: draw the round-robin divider. */
  rotationStart: boolean;
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
const ScoreRow = React.memo(function ScoreRow({ columns, cells, isLatest, stripe, rotationStart, columnWidth, rowHeight, fontSize, fullCount, colors }: ScoreRowProps) {
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
        rotationStart && [styles.rotationDivider, { borderTopColor: colors.primary }],
      ]}
    >
      {columns.map((column, index) => {
        const stored = cells[index];
        // A saved 0 is a real score; a missing cell (player not in that round) shows a dash.
        const hasScore = typeof stored === 'number';
        const score = hasScore ? stored : 0;
        const tone = scoreTone(score, fullCount);
        const positive = tone === 'positive';
        const text = scoreTextStyle(tone);
        return (
          <View
            key={column.id}
            style={[styles.cell, { width: columnWidth, height: rowHeight, borderRightColor: colors.hairline }]}
          >
            <View
              style={[
                styles.scorePill,
                // The standard: only a win gets a highlight; a big penalty is red text alone, never a red background.
                text.highlight && { backgroundColor: colors.winContainer },
              ]}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                maxFontSizeMultiplier={TABLE_MAX_FONT_SCALE}
                style={[
                  styles.scoreText,
                  tabularNums,
                  { fontSize },
                  positive
                    ? { color: colors.onWinContainer, fontWeight: text.fontWeight }
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
  && prev.rotationStart === next.rotationStart
  && prev.columnWidth === next.columnWidth
  && prev.rowHeight === next.rowHeight
  && prev.fontSize === next.fontSize
  && prev.fullCount === next.fullCount
  && prev.colors === next.colors
  && sameColumns(prev.columns, next.columns)
  && sameCells(prev.cells, next.cells));

/**
 * The scorecard grid. One horizontal scroller holds the header and every row, so they can
 * never drift apart; the header is pinned by the vertical scroller's native sticky header; the
 * round column sits beside the scroller, frozen, and follows the rows through a native-driver
 * translate. Nothing runs on the JS thread while the finger moves.
 */
export function ScoreTable({
  columns,
  scores,
  roundCount,
  totals,
  roundTotals,
  grandTotal,
  dealerLabelForRound,
  nextDealerId,
  rotationStarts,
  leaderIds,
  compact = false,
  fullCount,
  emptyMessage,
}: ScoreTableProps) {
  const rotationStartSet = useMemo(() => new Set(rotationStarts ?? []), [rotationStarts]);
  const theme = useAppTheme();
  const { colors } = theme;
  const { fontScale } = useWindowDimensions();
  const [tableWidth, setTableWidth] = useState(0);
  const [bodyHeight, setBodyHeight] = useState(0);
  const verticalRef = useRef<ScrollView>(null);
  const shownRounds = useRef(0);
  const scrollY = useRef(new Animated.Value(0)).current;

  const { roundColumnWidth, columnWidth, contentWidth, scrollsSideways } = columnLayout(tableWidth, columns.length, compact);

  const fontSize = cellFontSize(columnWidth);
  const rowHeight = rowHeightFor(columnWidth, columns.length, compact, fontScale);
  const headerH = headerHeight(columnWidth, compact, fontScale);
  const type = headerType(columnWidth);
  const onDark = theme.dark;

  const onVerticalScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }),
    [scrollY],
  );
  const followRows = useMemo(() => ({ transform: [{ translateY: Animated.multiply(scrollY, -1) }] }), [scrollY]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const width = Math.floor(event.nativeEvent.layout.width);
    if (width !== tableWidth) setTableWidth(width);
  };
  // The vertical scroller sits inside the horizontal one, so it is given the measured height
  // of the grid area instead of relying on the horizontal content stretching to fill it.
  const handleBodyLayout = (event: LayoutChangeEvent) => {
    const height = Math.floor(event.nativeEvent.layout.height);
    if (height !== bodyHeight) setBodyHeight(height);
  };
  const gridHeight = roundCount > 0 ? bodyHeight : headerH;

  // Follow the newest round so the latest hand is always on screen.
  const handleContentSizeChange = () => {
    if (roundCount > shownRounds.current) {
      verticalRef.current?.scrollToEnd({ animated: shownRounds.current > 0 });
    }
    shownRounds.current = roundCount;
  };

  const isLeader = (id: string) => leaderIds.includes(id);

  // The dealer's column is tinted, not filled: the button green belongs to buttons only.
  const headerCells = columns.map((column, index) => {
    const dealsNext = column.id === nextDealerId;
    const leader = isLeader(column.id);
    const seatText = column.isExpense ? colors.onSurfaceVariant : onDark ? seatColor(index, { onDark: true }) : column.color;
    const total = totals[column.id] ?? 0;
    return (
      <View
        key={column.id}
        style={[
          styles.cell,
          styles.headerCell,
          { width: columnWidth, height: headerH, paddingVertical: headerPadding(compact), borderRightColor: colors.hairline },
          dealsNext && { backgroundColor: colors.primaryContainer, borderBottomWidth: DEALER_BAR, borderBottomColor: colors.onPrimaryContainer },
        ]}
      >
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={TABLE_MAX_FONT_SCALE}
          style={[styles.headerText, { fontSize: type.initials.fontSize, lineHeight: type.initials.lineHeight, color: seatText }]}
        >
          {column.label}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          maxFontSizeMultiplier={TABLE_MAX_FONT_SCALE}
          style={[
            styles.headerTotal,
            tabularNums,
            {
              fontSize: type.total.fontSize,
              lineHeight: type.total.lineHeight,
              // Totals are near-black, never green; a losing total is the loss red.
              color: dealsNext ? colors.onPrimaryContainer : total < 0 ? colors.loss : colors.onSurface,
            },
          ]}
        >
          {signed(total)}
        </Text>
        <View style={[styles.headerLabelRow, { height: type.deals.lineHeight }]}>
          {dealsNext ? (
            <>
              {leader ? <Icon source="crown" size={type.deals.fontSize + 1} color={colors.leader} /> : null}
              {dealsBadge(columnWidth) === 'text' ? (
                <Text
                  numberOfLines={1}
                  maxFontSizeMultiplier={TABLE_MAX_FONT_SCALE}
                  style={[styles.dealsText, { fontSize: type.deals.fontSize, lineHeight: type.deals.lineHeight, color: colors.onPrimaryContainer }]}
                  accessibilityLabel="Deals next"
                >
                  DEALS
                </Text>
              ) : (
                <Icon source="cards-playing-outline" size={type.deals.lineHeight} color={colors.onPrimaryContainer} />
              )}
            </>
          ) : leader ? (
            <Icon source="crown" size={type.deals.lineHeight} color={colors.leader} />
          ) : (
            <View style={[styles.seatBar, { backgroundColor: column.isExpense ? colors.outlineVariant : seatText }]} />
          )}
        </View>
      </View>
    );
  });

  const cornerCell = (
    <View
      style={[
        styles.cell,
        { width: roundColumnWidth, height: headerH, borderRightColor: colors.outlineVariant, backgroundColor: colors.tableHeader },
        styles.headerRow,
        { borderBottomColor: colors.outlineVariant },
      ]}
    >
      <Text style={[styles.cornerText, { color: colors.onSurfaceVariant }]} maxFontSizeMultiplier={TABLE_MAX_FONT_SCALE}>RND</Text>
      {grandTotal !== 0 ? (
        <Text style={[styles.roundMeta, { color: colors.error }]} numberOfLines={1} maxFontSizeMultiplier={TABLE_MAX_FONT_SCALE}>
          {grandTotal > 0 ? `+${grandTotal}` : grandTotal}
        </Text>
      ) : null}
    </View>
  );

  const roundCells = Array.from({ length: roundCount }, (_, roundIndex) => {
    const dealer = dealerLabelForRound(roundIndex);
    const offBy = roundTotals[roundIndex] ?? 0;
    const isLatest = roundIndex === roundCount - 1;
    const rotationStart = rotationStartSet.has(roundIndex);
    return (
      <View
        key={roundIndex}
        accessibilityLabel={rotationStart ? `Round ${roundIndex + 1}, new rotation` : undefined}
        style={[
          styles.cell,
          styles.roundCell,
          {
            width: roundColumnWidth,
            height: rowHeight,
            borderRightColor: colors.outlineVariant,
            borderBottomColor: colors.hairline,
            backgroundColor: isLatest ? colors.tableLatest : colors.tableHeader,
          },
          rotationStart && [styles.rotationDivider, { borderTopColor: colors.primary }],
        ]}
      >
        <Text style={[styles.roundText, tabularNums, { fontSize: fontSize - 1, color: colors.onSurface }]} maxFontSizeMultiplier={TABLE_MAX_FONT_SCALE}>
          {roundIndex + 1}
        </Text>
        {offBy !== 0 ? (
          <Text style={[styles.roundMeta, { color: colors.error }]} numberOfLines={1} accessibilityLabel={`Round does not add up, off by ${offBy}`}>
            {offBy > 0 ? `+${offBy}` : offBy}
          </Text>
        ) : dealer ? (
          <Text style={[styles.roundMeta, { color: colors.onSurfaceVariant }]} numberOfLines={1} maxFontSizeMultiplier={TABLE_MAX_FONT_SCALE}>
            {dealer}
          </Text>
        ) : null}
      </View>
    );
  });

  return (
    <View
      style={[styles.table, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
      onLayout={handleLayout}
    >
      {tableWidth > 0 ? (
        <>
          <View style={[styles.row, roundCount > 0 ? styles.flex : { height: headerH }]} onLayout={handleBodyLayout}>
            {/* Frozen round column: the corner stays put; the round numbers follow the rows on the UI thread. */}
            <View style={{ width: roundColumnWidth }}>
              {cornerCell}
              <View style={[styles.flex, styles.clip]}>
                <Animated.View style={followRows}>{roundCells}</Animated.View>
              </View>
            </View>

            <ScrollView
              horizontal
              style={styles.flex}
              scrollEnabled={scrollsSideways}
              showsHorizontalScrollIndicator={scrollsSideways}
              directionalLockEnabled
              bounces={false}
              testID="score-table-scroller"
            >
              <Animated.ScrollView
                ref={verticalRef}
                style={{ width: contentWidth, height: gridHeight > 0 ? gridHeight : undefined }}
                stickyHeaderIndices={[0]}
                onScroll={onVerticalScroll}
                scrollEventThrottle={16}
                onContentSizeChange={handleContentSizeChange}
                showsVerticalScrollIndicator={roundCount > 0}
                scrollEnabled={roundCount > 0}
                nestedScrollEnabled
              >
                <View style={[styles.row, styles.headerRow, { backgroundColor: colors.tableHeader, borderBottomColor: colors.outlineVariant }]}>
                  {headerCells}
                </View>
                {Array.from({ length: roundCount }, (_, roundIndex) => (
                  <ScoreRow
                    key={roundIndex}
                    columns={columns}
                    cells={columns.map((column) => scores[column.id]?.[roundIndex])}
                    isLatest={roundIndex === roundCount - 1}
                    stripe={roundIndex % 2 === 1}
                    rotationStart={rotationStartSet.has(roundIndex)}
                    columnWidth={columnWidth}
                    rowHeight={rowHeight}
                    fontSize={fontSize}
                    fullCount={fullCount}
                    colors={colors}
                  />
                ))}
              </Animated.ScrollView>
            </ScrollView>
          </View>

          {roundCount === 0 ? (
            <View style={styles.emptyTable}>
              <Icon source="cards-playing-outline" size={32} color={colors.onSurfaceVariant} />
              <Text variant="bodyMedium" style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
                {emptyMessage}
              </Text>
            </View>
          ) : null}
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
  clip: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
  },
  headerRow: {
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 2,
  },
  headerCell: {
    justifyContent: 'space-between',
  },
  roundCell: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // The round-robin line: one full rotation ended above this row.
  rotationDivider: {
    borderTopWidth: 2,
  },
  headerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    maxWidth: '100%',
  },
  headerText: {
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
    flexShrink: 1,
    includeFontPadding: false,
  },
  headerTotal: {
    fontWeight: '800',
    textAlign: 'center',
    includeFontPadding: false,
  },
  dealsText: {
    fontWeight: '800',
    letterSpacing: 0.6,
    includeFontPadding: false,
  },
  seatBar: {
    width: 16,
    height: 3,
    borderRadius: 2,
  },
  cornerText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  roundText: {
    fontWeight: '800',
  },
  roundMeta: {
    fontSize: 11,
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

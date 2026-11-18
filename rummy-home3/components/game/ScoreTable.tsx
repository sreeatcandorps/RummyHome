import React, { useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { radius, seatColor, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { scoreTextStyle, scoreTone } from '@/utils/scoreTone';
import { actual, shortNumber, spokenExact } from '@/utils/multiplier';
import {
  cellFontSize,
  columnLayout,
  DEALER_BAR,
  dealsBadge,
  headerHeight,
  headerPadding,
  headerType,
  rowHeight as rowHeightFor,
  effectiveFontScale,
  fitInitialsFontSize,
  initialsWidthIn,
  TABLE_MAX_FONT_SCALE,
} from '@/utils/scorecardLayout';

export type ScoreColumn = {
  id: string;
  label: string;
  color: string;
  isExpense?: boolean;
  /** Pool (PR 13): the player's public number, shown above the initials (D5). */
  number?: number | null;
  /** Pool: the round that put the player out; the header is struck through and reads OUT R<n>. */
  outRound?: number | null;
  /** Pool: the player re-entered (blue header, D5) before this round; the cell there shows the restart score. */
  reenteredRound?: number | null;
  reentryScore?: number | null;
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
  /**
   * Pool (PR 13): scores are plus points, 0 is the win, the corner sum and the off-by markers do not
   * apply (F13.10), totals are shown without a sign and the header carries number / initials / score.
   */
  pool?: boolean;
  /**
   * PR 14: the game's multiplier. Past ×1 every Points cell and total shows entered × multiplier in
   * the short form (−12K, 1.2M; never more than five characters) while `showActual` is on; off, the
   * grid shows the entered points as before. The multiplier never changes what is stored.
   */
  multiplier?: number;
  showActual?: boolean;
  /** PR 14: tapping a header total opens the Exact points sheet. */
  onTotalPress?: (columnId: string) => void;
  /**
   * PR 24: rendered inside the card, right under the last round row, full width (never sideways) —
   * the Creator / Admin / Unique game ID lines. Scrolls with the rounds.
   */
  footer?: React.ReactNode;
  /** PR 24: tapping a round number opens that round for editing (admins, live game) — the re-entry round included. */
  onRoundPress?: (roundNumber: number) => void;
  /**
   * PR 24 (landscape pool): rendered under the card in the same vertical scroller, so the standings
   * are reached by scrolling down past the rounds instead of squeezing the table sideways.
   */
  below?: React.ReactNode;
};

/** Pool (PR 24): the re-entry round shows the start score with this mark beside it; the typed score is saved, not shown. */
export const REENTRY_MARK = '↺';

/** Totals and the header read a size up from the cells; every number carries its sign. */
export const signed = (value: number) => (value > 0 ? `+${value}` : `${value}`);

type ScoreRowProps = {
  columns: ScoreColumn[];
  /** 1-based; part of each cell's testID so a flow can prove a column's scores sit under its header. */
  roundNumber: number;
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
  pool?: boolean;
  /** Points: the factor each shown value is multiplied by (1 = as entered). */
  factor: number;
};

const sameColumns = (a: ScoreColumn[], b: ScoreColumn[]) =>
  a.length === b.length && a.every((column, i) => column.id === b[i].id && column.label === b[i].label && column.color === b[i].color && column.isExpense === b[i].isExpense
    && column.number === b[i].number && column.outRound === b[i].outRound && column.reenteredRound === b[i].reenteredRound && column.reentryScore === b[i].reentryScore);
const sameCells = (a: (number | undefined)[], b: (number | undefined)[]) => a.length === b.length && a.every((value, i) => value === b[i]);

/**
 * One round of scores. Memoised by value (the screen rebuilds its columns and
 * scores objects on every render), so a reload, a menu or a realtime echo
 * redraws only the rows whose numbers changed, usually just the newest one.
 */
const ScoreRow = React.memo(function ScoreRow({ columns, roundNumber, cells, isLatest, stripe, rotationStart, columnWidth, rowHeight, fontSize, fullCount, colors, pool, factor }: ScoreRowProps) {
  return (
    <View
      style={[
        styles.row,
        {
          width: columnWidth * columns.length,
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
        if (pool) {
          // Pool: 0 is the win (green pill), a hand at or past the Full count is red, the rest plain.
          // The re-entry round shows the restart score; the round that put a player out carries ✕.
          const full = Math.abs(Number(fullCount) || 0);
          const win = hasScore && score === 0;
          const big = hasScore && full > 0 && score >= full;
          const reentryHere = column.reenteredRound === roundNumber && typeof column.reentryScore === 'number';
          const outHere = column.outRound === roundNumber;
          // PR 24: the rounds before a re-entry are that player's earlier life — greyed, no win pill, no red.
          const beforeReentry = column.reenteredRound != null && roundNumber < column.reenteredRound;
          return (
            <View
              key={column.id}
              testID={`score-cell-${index + 1}-${roundNumber}`}
              style={[styles.cell, { width: columnWidth, height: rowHeight, borderRightColor: colors.hairline }]}
            >
              <View style={[styles.scorePill, win && !beforeReentry && { backgroundColor: colors.winContainer }]}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  maxFontSizeMultiplier={TABLE_MAX_FONT_SCALE}
                  testID={reentryHere ? `score-reentry-${index + 1}` : undefined}
                  style={[
                    styles.scoreText,
                    tabularNums,
                    { fontSize },
                    beforeReentry ? { color: colors.onSurfaceVariant }
                      : reentryHere ? { color: colors.reentry, fontWeight: '700' }
                      : win ? { color: colors.onWinContainer, fontWeight: '800' } : big ? { color: colors.loss, fontWeight: '700' } : { color: colors.onSurface },
                    outHere && { textDecorationLine: 'line-through' },
                  ]}
                  accessibilityLabel={!hasScore ? undefined : reentryHere ? `Re-entered at ${column.reentryScore}; typed ${score}` : outHere ? `${score}, out` : beforeReentry ? `${score}, before re-entry` : undefined}
                >
                  {!hasScore ? '–' : reentryHere ? `${REENTRY_MARK}${column.reentryScore}` : `${score}${outHere ? ' ✕' : ''}`}
                </Text>
              </View>
            </View>
          );
        }
        const tone = scoreTone(score, fullCount);
        const positive = tone === 'positive';
        const text = scoreTextStyle(tone);
        // PR 14: the tone comes from the entered points; the figure shown is entered × multiplier, short form.
        const shown = factor === 1 ? (positive ? `+${score}` : `${score}`) : shortNumber(actual(score, factor), { plus: positive });
        return (
          <View
            key={column.id}
            testID={`score-cell-${index + 1}-${roundNumber}`}
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
                accessibilityLabel={hasScore && factor !== 1 ? spokenExact(actual(score, factor)) : undefined}
              >
                {!hasScore ? '–' : shown}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}, (prev, next) =>
  prev.roundNumber === next.roundNumber
  && prev.isLatest === next.isLatest
  && prev.stripe === next.stripe
  && prev.rotationStart === next.rotationStart
  && prev.columnWidth === next.columnWidth
  && prev.rowHeight === next.rowHeight
  && prev.fontSize === next.fontSize
  && prev.fullCount === next.fullCount
  && prev.pool === next.pool
  && prev.factor === next.factor
  && prev.colors === next.colors
  && sameColumns(prev.columns, next.columns)
  && sameCells(prev.cells, next.cells));

/**
 * The scorecard grid (PR 10a). The header row sits above one vertical scroller, so it is pinned
 * without a sticky-header trick; inside the vertical scroller the frozen round column stands
 * beside one sideways scroller that holds every score row at an explicit `contentWidth`. The header
 * cells follow that sideways offset through a native-driver translate, so header and rows cannot
 * drift apart and nothing runs on the JS thread while the finger moves.
 *
 * PR 4 nested the vertical scroller inside the sideways one and relied on the rows inheriting their
 * width; on Android, once the columns were wider than the screen, the header laid out one column
 * wide and its cells wrapped into a stack. Rows and header now carry `contentWidth` themselves.
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
  pool = false,
  multiplier = 1,
  showActual = true,
  onTotalPress,
  footer,
  onRoundPress,
  below,
}: ScoreTableProps) {
  // Pools never multiply; Points multiply while the view toggle is on.
  const factor = !pool && showActual && multiplier > 1 ? multiplier : 1;
  const shownTotal = (value: number) => (factor === 1 ? signed(value) : shortNumber(actual(value, factor), { plus: true }));
  const rotationStartSet = useMemo(() => new Set(rotationStarts ?? []), [rotationStarts]);
  const theme = useAppTheme();
  const { colors } = theme;
  const { fontScale } = useWindowDimensions();
  const [tableWidth, setTableWidth] = useState(0);
  const verticalRef = useRef<ScrollView>(null);
  const shownRounds = useRef(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const { roundColumnWidth, columnWidth, contentWidth, scrollsSideways } = columnLayout(tableWidth, columns.length, compact);

  const fontSize = cellFontSize(columnWidth);
  const rowHeight = rowHeightFor(columnWidth, columns.length, compact, fontScale);
  const headerH = headerHeight(columnWidth, compact, fontScale, pool);
  const type = headerType(columnWidth);
  const onDark = theme.dark;

  const onSidewaysScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true }),
    [scrollX],
  );
  const followColumns = useMemo(() => ({ transform: [{ translateX: Animated.multiply(scrollX, -1) }] }), [scrollX]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const width = Math.floor(event.nativeEvent.layout.width);
    if (width !== tableWidth) setTableWidth(width);
  };

  // Follow the newest round so the latest hand is always on screen. With `below` in the scroller
  // (landscape standings) the end is past the rounds, so stop at the bottom of the card instead.
  const cardHeight = useRef(0);
  const viewportHeight = useRef(0);
  const handleContentSizeChange = () => {
    if (roundCount > shownRounds.current) {
      const animated = shownRounds.current > 0;
      if (below) verticalRef.current?.scrollTo({ y: Math.max(0, cardHeight.current - viewportHeight.current), animated });
      else verticalRef.current?.scrollToEnd({ animated });
    }
    shownRounds.current = roundCount;
  };

  const isLeader = (id: string) => leaderIds.includes(id);

  // The dealer's column is tinted, not filled: the button green belongs to buttons only.
  const headerCells = columns.map((column, index) => {
    const dealsNext = column.id === nextDealerId;
    const leader = isLeader(column.id);
    const out = pool && Boolean(column.outRound);
    const reentered = pool && Boolean(column.reenteredRound) && !out;
    // Pool (D5): a re-entered player's header is blue; a player who is out is struck through and grey.
    const seatText = column.isExpense ? colors.onSurfaceVariant
      : out ? colors.onSurfaceVariant
      : reentered ? colors.reentry
      : onDark ? seatColor(index, { onDark: true }) : column.color;
    const total = totals[column.id] ?? 0;
    const totalColor = dealsNext ? colors.onPrimaryContainer
      : pool ? (out ? colors.onSurfaceVariant : reentered ? colors.reentry : colors.onSurface)
      : total < 0 ? colors.loss : colors.onSurface;
    return (
      <Pressable
        key={column.id}
        testID={`score-header-${index + 1}`}
        onPress={onTotalPress ? () => onTotalPress(column.id) : undefined}
        disabled={!onTotalPress}
        accessibilityRole={onTotalPress ? 'button' : undefined}
        accessibilityHint={onTotalPress ? 'Opens the exact points' : undefined}
        accessibilityLabel={pool ? `${column.number != null ? `Player ${column.number}, ` : ''}${column.label}, ${total}${out ? `, out in round ${column.outRound}` : reentered ? ', re-entered' : ''}` : factor !== 1 ? `${column.label}, total ${spokenExact(actual(total, factor))}` : undefined}
        style={[
          styles.cell,
          styles.headerCell,
          { width: columnWidth, height: headerH, paddingVertical: headerPadding(compact), borderRightColor: colors.hairline },
          dealsNext && { backgroundColor: colors.primaryContainer, borderBottomWidth: DEALER_BAR, borderBottomColor: colors.onPrimaryContainer },
          out && { backgroundColor: colors.surfaceVariant },
        ]}
      >
        {pool ? (
          <Text
            numberOfLines={1}
            maxFontSizeMultiplier={TABLE_MAX_FONT_SCALE}
            style={[styles.headerNumber, { fontSize: type.deals.fontSize, lineHeight: type.deals.lineHeight, color: out ? colors.onSurfaceVariant : colors.onSurfaceVariant }]}
          >
            {column.number != null ? `#${column.number}` : ' '}
          </Text>
        ) : null}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          maxFontSizeMultiplier={TABLE_MAX_FONT_SCALE}
          testID={`score-header-initials-${index + 1}`}
          style={[
            styles.headerText,
            {
              // F13.22: three wide letters (WWW) step the font down rather than clip; the line height stays put.
              fontSize: fitInitialsFontSize(column.label, initialsWidthIn(columnWidth), type.initials.fontSize, effectiveFontScale(fontScale)),
              lineHeight: type.initials.lineHeight,
              color: seatText,
            },
            out && styles.struck,
          ]}
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
              color: totalColor,
            },
            out && styles.struck,
          ]}
        >
          {pool ? String(total) : shownTotal(total)}
        </Text>
        <View style={[styles.headerLabelRow, { height: type.deals.lineHeight }]}>
          {out ? (
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={TABLE_MAX_FONT_SCALE}
              style={[styles.dealsText, { fontSize: type.deals.fontSize, lineHeight: type.deals.lineHeight, color: colors.loss }]}
              accessibilityLabel={`Out in round ${column.outRound}`}
            >
              {`OUT R${column.outRound}`}
            </Text>
          ) : dealsNext ? (
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
      </Pressable>
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
      {!pool && grandTotal !== 0 ? (
        <Text style={[styles.roundMeta, { color: colors.error }]} numberOfLines={1} maxFontSizeMultiplier={TABLE_MAX_FONT_SCALE}>
          {shownTotal(grandTotal)}
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
      <Pressable
        key={roundIndex}
        onPress={onRoundPress ? () => onRoundPress(roundIndex + 1) : undefined}
        disabled={!onRoundPress}
        accessibilityRole={onRoundPress ? 'button' : undefined}
        accessibilityHint={onRoundPress ? 'Edits this round' : undefined}
        accessibilityLabel={rotationStart ? `Round ${roundIndex + 1}, new rotation` : onRoundPress ? `Round ${roundIndex + 1}` : undefined}
        testID={`score-round-${roundIndex + 1}`}
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
        {!pool && offBy !== 0 ? (
          <Text style={[styles.roundMeta, { color: colors.error }]} numberOfLines={1} accessibilityLabel={`Round does not add up, off by ${offBy}`}>
            {shownTotal(offBy)}
          </Text>
        ) : dealer ? (
          <Text style={[styles.roundMeta, { color: colors.onSurfaceVariant }]} numberOfLines={1} maxFontSizeMultiplier={TABLE_MAX_FONT_SCALE}>
            {dealer}
          </Text>
        ) : null}
      </Pressable>
    );
  });

  // PR 24: the card border is split so the footer sits inside it under the last row while `below`
  // (landscape standings) rides in the same scroller outside it.
  const edge = { borderColor: colors.outlineVariant };
  return (
    <View style={styles.table} onLayout={handleLayout} testID="score-table">
      {tableWidth > 0 ? (
        <>
          {/* Pinned header: the corner stays put; the header cells follow the rows' sideways offset on the UI thread. */}
          <View style={[styles.row, styles.headerRow, styles.cardTop, edge, { backgroundColor: colors.tableHeader, borderBottomColor: colors.outlineVariant }]}>
            {cornerCell}
            <View style={[styles.flex, styles.clip]}>
              <Animated.View style={[styles.row, { width: contentWidth }, followColumns]} testID="score-table-header">
                {headerCells}
              </Animated.View>
            </View>
          </View>

          <ScrollView
            ref={verticalRef}
            style={styles.flex}
            onContentSizeChange={handleContentSizeChange}
            showsVerticalScrollIndicator={roundCount > 0}
            scrollEnabled={roundCount > 0 || Boolean(below)}
            onLayout={(e) => { viewportHeight.current = e.nativeEvent.layout.height; }}
            testID="score-table-rows"
          >
            <View style={[styles.cardBottom, edge, { backgroundColor: colors.surface }]} onLayout={(e) => { cardHeight.current = e.nativeEvent.layout.height; }}>
              <View style={styles.row}>
                {/* Frozen round column: scrolls with the rows, never sideways. */}
                <View style={{ width: roundColumnWidth }}>{roundCells}</View>

                <Animated.ScrollView
                  horizontal
                  style={styles.flex}
                  scrollEnabled={scrollsSideways}
                  showsHorizontalScrollIndicator={scrollsSideways}
                  onScroll={onSidewaysScroll}
                  scrollEventThrottle={16}
                  directionalLockEnabled
                  bounces={false}
                  nestedScrollEnabled
                  testID="score-table-scroller"
                >
                  <View style={{ width: contentWidth }}>
                    {Array.from({ length: roundCount }, (_, roundIndex) => (
                      <ScoreRow
                        key={roundIndex}
                        columns={columns}
                        roundNumber={roundIndex + 1}
                        cells={columns.map((column) => scores[column.id]?.[roundIndex])}
                        isLatest={roundIndex === roundCount - 1}
                        stripe={roundIndex % 2 === 1}
                        rotationStart={rotationStartSet.has(roundIndex)}
                        columnWidth={columnWidth}
                        rowHeight={rowHeight}
                        fontSize={fontSize}
                        fullCount={fullCount}
                        colors={colors}
                        pool={pool}
                        factor={factor}
                      />
                    ))}
                  </View>
                </Animated.ScrollView>
              </View>

              {roundCount === 0 ? (
                <View style={styles.emptyTable}>
                  <Icon source="cards-playing-outline" size={32} color={colors.onSurfaceVariant} />
                  <Text variant="bodyMedium" style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
                    {emptyMessage}
                  </Text>
                </View>
              ) : null}

              {/* PR 24: the footer is part of the card, directly under the last round row. */}
              {footer ? <View style={styles.footer} testID="score-table-footer">{footer}</View> : null}
            </View>

            {below ? <View style={styles.below}>{below}</View> : null}
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}

const EDGE = StyleSheet.hairlineWidth * 2;

const styles = StyleSheet.create({
  table: {
    flex: 1,
  },
  // The card's top: the pinned header carries the top edge and corners.
  cardTop: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: EDGE,
    borderLeftWidth: EDGE,
    borderRightWidth: EDGE,
    overflow: 'hidden',
  },
  // The card's body: rows, the empty note and the footer, closed by the bottom edge and corners.
  cardBottom: {
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    borderBottomWidth: EDGE,
    borderLeftWidth: EDGE,
    borderRightWidth: EDGE,
    overflow: 'hidden',
  },
  footer: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  below: {
    paddingTop: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  none: {
    flexGrow: 0,
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
  headerNumber: {
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
    letterSpacing: 0.2,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  dealsText: {
    fontWeight: '800',
    letterSpacing: 0.6,
    includeFontPadding: false,
  },
  seatBar: {
    width: 16,
    height: 3,
    borderRadius: radius.full,
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

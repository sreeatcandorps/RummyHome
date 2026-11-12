import React from 'react';
import { StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { brand, radius, spacing, tabularNums } from '@/constants/theme';
import { placeLabel } from '@/utils/results';
import { legendLines, ShareBreakdown } from '@/utils/resultsLayout';
import { ShareCard } from '@/utils/shareCard';

const POINTS_W = 64;
const BADGE_W = 52;
const GRID_CELL_W = 46;
const GRID_TOTAL_W = 56;
const GRID_CELL_DENSE_W = 36;

function pointsStyle(text: string) {
  if (text === '—') return styles.muted;
  return text.startsWith('-') ? styles.negative : styles.positive;
}

export function ShareCardView({ card, cardRef }: { card: ShareCard; cardRef?: React.Ref<View> }) {
  const hasBadges = card.lines.some((line) => line.place != null);
  return (
    <View ref={cardRef} collapsable={false} accessibilityLabel="EZ Score: Rummy share image" style={styles.card}>
      <Text style={styles.brand}>EZ Score: Rummy</Text>
      <Text style={styles.title}>{card.title}</Text>
      <Text style={styles.date}>{card.date}</Text>
      {card.summary ? <Text style={styles.date}>{card.summary}</Text> : null}
      {card.notes?.map((note) => (
        <Text key={note} style={styles.note} testID="share-note">{note}</Text>
      ))}
      <View style={styles.rule} />
      {card.podiumFirst ? card.places.map((place) => (
        <Text key={place.label} style={styles.podium}>
          {`${place.label}  ${place.names}  ${place.points}`}
        </Text>
      )) : null}
      {card.podiumFirst && card.lines.length > 0 ? <Text style={styles.more}>Totals</Text> : null}
      {card.lines.map((line) => (
        <View key={`${line.name}-${line.points}`} style={styles.line} testID={`share-line-${line.name}`}>
          {hasBadges ? (
            <View style={styles.badge} accessibilityLabel={line.place != null ? `${placeLabel(line.place)} place` : undefined}>
              {line.place != null ? (
                <>
                  <MaterialCommunityIcons name="crown" size={14} color={brand.gold} />
                  <Text style={styles.badgeText}>{placeLabel(line.place)}</Text>
                </>
              ) : null}
            </View>
          ) : null}
          <View style={styles.nameBlock}>
            <Text style={styles.name} numberOfLines={1}>{line.name}</Text>
            {line.sub ? <Text style={styles.sub} numberOfLines={1}>{line.sub}</Text> : null}
          </View>
          <Text style={[styles.points, tabularNums, pointsStyle(line.points)]} numberOfLines={1}>{line.points}</Text>
        </View>
      ))}
      {card.moreCount > 0 ? (
        <Text style={styles.more}>{`and ${card.moreCount} more`}</Text>
      ) : null}
      {card.breakdown ? <ShareBreakdownGrid grid={card.breakdown} /> : null}
      {card.breakdownNote ? (
        <Text style={styles.gridNote} testID="share-breakdown-note">{card.breakdownNote}</Text>
      ) : null}
      {!card.podiumFirst && card.places.length > 0 ? <View style={styles.rule} /> : null}
      {!card.podiumFirst ? card.places.map((place) => (
        <Text key={place.label} style={styles.place}>
          {`${place.label}  ${place.names}  ${place.points}`}
        </Text>
      )) : null}
      {card.footer ? (
        <>
          <View style={styles.rule} />
          <Text style={styles.footer} testID="share-footer">{card.footer}</Text>
        </>
      ) : null}
    </View>
  );
}

/**
 * Every game on the image: players down the side, up to five games across. More
 * games wrap into another header row (G6–G10 …) with its own score rows, so the
 * grid never grows wider than the card.
 */
function ShareBreakdownGrid({ grid }: { grid: ShareBreakdown }) {
  const cellStyle = grid.dense ? styles.gridCellDense : styles.gridCell;
  const textStyle = grid.dense ? styles.gridTextDense : styles.gridText;
  return (
    <View testID="share-breakdown" accessibilityLabel={`By game, ${grid.gameCount} games`}>
      <View style={styles.rule} />
      <Text style={styles.gridTitle}>By game</Text>
      {grid.bands.map((band, bandIndex) => (
        <View key={band.columns.join('|')} style={bandIndex > 0 ? styles.gridBand : undefined} testID={`share-band-${bandIndex + 1}`}>
          <View style={styles.gridRow}>
            <Text style={[styles.gridHead, styles.gridHeadCol]}>Player</Text>
            {band.columns.map((column) => (
              <Text key={column} style={[styles.gridHead, tabularNums, column === 'Total' ? styles.gridTotal : cellStyle]} numberOfLines={1}>
                {column}
              </Text>
            ))}
          </View>
          {band.rows.map((row) => (
            <View key={row.head} style={styles.gridRow} testID={`share-breakdown-${row.head}`}>
              <Text style={[textStyle, styles.gridHeadCol]}>{row.head}</Text>
              {row.cells.map((cell, index) => {
                const isTotal = band.hasTotal && index === row.cells.length - 1;
                return (
                  <Text
                    key={`${row.head}-${band.columns[index]}`}
                    style={[textStyle, tabularNums, isTotal ? styles.gridTotal : cellStyle, isTotal && styles.gridTotalText, pointsStyle(cell)]}
                    numberOfLines={1}
                  >
                    {cell}
                  </Text>
                );
              })}
            </View>
          ))}
        </View>
      ))}
      {legendLines(grid.legend, 56).map((line) => (
        <Text key={line} style={styles.gridLegend}>{line}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: brand.felt,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  brand: {
    color: brand.gold,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  title: {
    color: brand.cream,
    fontSize: 22,
    fontWeight: '800',
  },
  date: {
    color: brand.cream,
    opacity: 0.9,
  },
  rule: {
    height: 1,
    backgroundColor: brand.gold,
    opacity: 0.7,
    marginVertical: spacing.xs,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 24,
  },
  badge: {
    width: BADGE_W,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  badgeText: {
    color: brand.gold,
    fontWeight: '800',
    fontSize: 12,
  },
  nameBlock: {
    flex: 1,
  },
  name: {
    color: brand.cream,
    fontWeight: '600',
  },
  sub: {
    color: brand.cream,
    opacity: 0.75,
    fontSize: 11,
  },
  points: {
    width: POINTS_W,
    textAlign: 'right',
    fontWeight: '800',
  },
  positive: {
    color: '#B7E4C7',
  },
  negative: {
    color: '#F2B8B5',
  },
  muted: {
    color: brand.cream,
    opacity: 0.5,
  },
  more: {
    color: brand.gold,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  place: {
    color: brand.cream,
    fontWeight: '700',
  },
  podium: {
    color: brand.cream,
    fontWeight: '800',
    fontSize: 18,
  },
  gridTitle: {
    color: brand.gold,
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 2,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 22,
  },
  gridHead: {
    color: brand.cream,
    opacity: 0.8,
    fontSize: 11,
    fontWeight: '700',
  },
  gridText: {
    color: brand.cream,
    fontSize: 13,
    fontWeight: '600',
  },
  gridHeadCol: {
    flex: 1,
    minWidth: 40,
  },
  gridCell: {
    width: GRID_CELL_W,
    textAlign: 'right',
  },
  gridCellDense: {
    width: GRID_CELL_DENSE_W,
    textAlign: 'right',
  },
  gridTextDense: {
    color: brand.cream,
    fontSize: 11,
    fontWeight: '600',
  },
  gridBand: {
    borderTopWidth: 1,
    borderTopColor: brand.gold,
    marginTop: 4,
    paddingTop: 4,
  },
  gridLegend: {
    color: brand.cream,
    opacity: 0.75,
    fontSize: 10,
    marginTop: 4,
  },
  gridNote: {
    color: brand.gold,
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    color: brand.gold,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  note: {
    color: brand.felt,
    backgroundColor: brand.gold,
    fontSize: 12,
    fontWeight: '700',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  gridTotal: {
    width: GRID_TOTAL_W,
    textAlign: 'right',
  },
  gridTotalText: {
    fontWeight: '800',
  },
});

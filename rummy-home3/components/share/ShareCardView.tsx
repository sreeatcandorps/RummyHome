import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from 'react-native-paper';
import { brand, radius, spacing, tabularNums } from '@/constants/theme';
import { placeLabel } from '@/utils/results';
import { ShareCard } from '@/utils/shareCard';

const POINTS_W = 64;
const BADGE_W = 52;
const GRID_CELL_W = 46;
const GRID_TOTAL_W = 56;

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
          <Text style={styles.name} numberOfLines={1}>{line.name}</Text>
          <Text style={[styles.points, tabularNums, pointsStyle(line.points)]}>{line.points}</Text>
        </View>
      ))}
      {card.moreCount > 0 ? (
        <Text style={styles.more}>{`and ${card.moreCount} more`}</Text>
      ) : null}
      {card.breakdown ? (
        <View testID="share-breakdown">
          <View style={styles.rule} />
          <Text style={styles.gridTitle}>By game</Text>
          <View style={styles.gridRow}>
            <Text style={[styles.gridHead, styles.gridInitials]}>Player</Text>
            {card.breakdown.columns.map((column) => (
              <Text
                key={column}
                style={[styles.gridHead, tabularNums, column === 'Total' ? styles.gridTotal : styles.gridCell]}
              >
                {column}
              </Text>
            ))}
          </View>
          {card.breakdown.rows.map((row) => (
            <View key={row.initials} style={styles.gridRow} testID={`share-breakdown-${row.initials}`}>
              <Text style={[styles.gridText, styles.gridInitials]} accessibilityLabel={row.name}>{row.initials}</Text>
              {row.cells.map((cell, index) => (
                <Text key={`${row.initials}-${card.breakdown?.columns[index]}`} style={[styles.gridText, tabularNums, styles.gridCell, pointsStyle(cell)]}>
                  {cell}
                </Text>
              ))}
              <Text style={[styles.gridText, styles.gridTotalText, tabularNums, styles.gridTotal, pointsStyle(row.total)]}>{row.total}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {card.breakdownNote ? (
        <>
          <View style={styles.rule} />
          <Text style={styles.more} testID="share-breakdown-note">{card.breakdownNote}</Text>
        </>
      ) : null}
      {!card.podiumFirst && card.places.length > 0 ? <View style={styles.rule} /> : null}
      {!card.podiumFirst ? card.places.map((place) => (
        <Text key={place.label} style={styles.place}>
          {`${place.label}  ${place.names}  ${place.points}`}
        </Text>
      )) : null}
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
  name: {
    flex: 1,
    color: brand.cream,
    fontWeight: '600',
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
  gridInitials: {
    flex: 1,
    minWidth: 44,
  },
  gridCell: {
    width: GRID_CELL_W,
    textAlign: 'right',
  },
  gridTotal: {
    width: GRID_TOTAL_W,
    textAlign: 'right',
  },
  gridTotalText: {
    fontWeight: '800',
  },
});

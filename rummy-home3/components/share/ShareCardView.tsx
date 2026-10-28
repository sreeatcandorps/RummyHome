import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { brand, radius, spacing, tabularNums } from '@/constants/theme';
import { ShareCard } from '@/utils/shareCard';

export function ShareCardView({ card, cardRef }: { card: ShareCard; cardRef?: React.Ref<View> }) {
  return (
    <View ref={cardRef} collapsable={false} accessibilityLabel="Rummy Home share image" style={styles.card}>
      <Text style={styles.brand}>Rummy Home</Text>
      <Text style={styles.title}>{card.title}</Text>
      <Text style={styles.date}>{card.date}</Text>
      <View style={styles.rule} />
      {card.lines.map((line) => (
        <View key={`${line.name}-${line.points}`} style={styles.line}>
          <Text style={styles.name} numberOfLines={1}>{line.name}</Text>
          <Text style={[styles.points, tabularNums, line.points.startsWith('-') ? styles.negative : styles.positive]}>
            {line.points}
          </Text>
        </View>
      ))}
      {card.moreCount > 0 ? (
        <Text style={styles.more}>{`and ${card.moreCount} more`}</Text>
      ) : null}
      {card.places.length > 0 ? <View style={styles.rule} /> : null}
      {card.places.map((place) => (
        <Text key={place.label} style={styles.place}>
          {`${place.label}  ${place.names}  ${place.points}`}
        </Text>
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
  },
  name: {
    flex: 1,
    color: brand.cream,
    fontWeight: '600',
  },
  points: {
    fontWeight: '800',
  },
  positive: {
    color: '#B7E4C7',
  },
  negative: {
    color: '#F2B8B5',
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
});

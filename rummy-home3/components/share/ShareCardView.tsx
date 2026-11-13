import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MedalBadge } from '@/components/results/PlayerLine';
import { radius, spacing, tabularNums } from '@/constants/theme';
import { ShareCard, ShareLine } from '@/utils/shareCard';

/** The share image palette: Clubhouse green frame, white card. Fixed, not themed: it is a picture. */
export const SHARE_COLORS = {
  frame: '#15803D',
  onFrame: '#FFFFFF',
  onFrameMuted: 'rgba(255,255,255,0.85)',
  card: '#FFFFFF',
  ink: '#17201B',
  muted: '#4E5752',
  line: '#DCDDD5',
  neg: '#A8201A',
  note: '#FFE38A',
  onNote: '#3F2D00',
} as const;

function Line({ line }: { line: ShareLine }) {
  return (
    <View style={styles.line} testID={`share-line-${line.name}`}>
      <View style={styles.nameBlock}>
        <View style={styles.nameRow}>
          {line.medal ? <MedalBadge medal={line.medal} size={22} /> : null}
          <Text style={styles.name} numberOfLines={2}>{line.name}</Text>
        </View>
        {line.sub ? <Text style={styles.sub} numberOfLines={1}>{line.sub}</Text> : null}
      </View>
      <Text style={[styles.points, tabularNums, line.points.startsWith('-') && styles.negative]} numberOfLines={1}>{line.points}</Text>
    </View>
  );
}

/**
 * The one-page picture: scores split in two columns with medals, the games line, who
 * generated it (initials), and the link. Per-game detail stays behind the link / in the PDF.
 */
export function ShareCardView({ card, cardRef }: { card: ShareCard; cardRef?: React.Ref<View> }) {
  return (
    <View ref={cardRef} collapsable={false} accessibilityLabel="EZ Score: Rummy share image" style={styles.frame}>
      <View style={styles.frameHead}>
        <Text style={styles.brand}>{card.brand}</Text>
        <Text style={styles.frameDate} numberOfLines={1}>{card.date}</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{card.title}</Text>
          {card.code ? <Text style={styles.code}>{card.code}</Text> : null}
        </View>
        {card.summary ? <Text style={styles.summary}>{card.summary}</Text> : null}
        {card.notes?.map((note) => (
          <Text key={note} style={styles.note} testID="share-note">{note}</Text>
        ))}
        <View style={styles.columns}>
          <View style={styles.column} testID="share-positive">
            {card.positive.length === 0 ? <Text style={styles.none}>None</Text> : card.positive.map((line) => <Line key={line.id} line={line} />)}
          </View>
          <View style={styles.column} testID="share-negative">
            {card.negative.length === 0 ? <Text style={styles.none}>None</Text> : card.negative.map((line) => <Line key={line.id} line={line} />)}
          </View>
        </View>
        {card.evenLine ? <Text style={styles.small}>{card.evenLine}</Text> : null}
        {card.moreLine ? <Text style={[styles.small, styles.center]} testID="share-more">{card.moreLine}</Text> : null}
        {card.gamesLine ? <Text style={[styles.small, styles.center, styles.gamesLine]} testID="share-games-line">{card.gamesLine}</Text> : null}
        {card.generatedBy ? <Text style={[styles.small, styles.center]} testID="share-generated-by">{card.generatedBy}</Text> : null}
      </View>
      <Text style={styles.footer} testID="share-footer" numberOfLines={2}>
        {[card.footer, card.link ? `Full details · ${card.link}` : null].filter(Boolean).join('   ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: SHARE_COLORS.frame, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  frameHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, gap: spacing.sm },
  brand: { color: SHARE_COLORS.onFrame, fontWeight: '800', fontSize: 18, letterSpacing: 0.3 },
  frameDate: { color: SHARE_COLORS.onFrameMuted, fontWeight: '600', fontSize: 13, flexShrink: 1 },
  card: { backgroundColor: SHARE_COLORS.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { color: SHARE_COLORS.ink, fontSize: 26, fontWeight: '800' },
  code: { color: SHARE_COLORS.muted, fontWeight: '600', fontSize: 14 },
  summary: { color: SHARE_COLORS.ink, fontWeight: '700', fontSize: 16, marginBottom: spacing.xs },
  note: { backgroundColor: SHARE_COLORS.note, color: SHARE_COLORS.onNote, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 10, fontWeight: '600', fontSize: 13 },
  columns: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  column: { flex: 1, minWidth: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: SHARE_COLORS.line },
  nameBlock: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: SHARE_COLORS.ink, fontWeight: '700', fontSize: 15, flexShrink: 1 },
  sub: { color: SHARE_COLORS.muted, fontSize: 12 },
  points: { color: SHARE_COLORS.ink, fontWeight: '800', fontSize: 20 },
  negative: { color: SHARE_COLORS.neg },
  none: { color: SHARE_COLORS.muted, fontSize: 14, paddingVertical: 6 },
  small: { color: SHARE_COLORS.muted, fontSize: 13 },
  center: { textAlign: 'center' },
  gamesLine: { marginTop: spacing.sm },
  footer: { color: SHARE_COLORS.onFrame, fontWeight: '700', fontSize: 13, textAlign: 'center' },
});

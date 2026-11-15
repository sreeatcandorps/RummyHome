import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MedalBadge } from '@/components/results/PlayerLine';
import { radius, spacing, tabularNums } from '@/constants/theme';
import { ShareCard, ShareLine, ShareTone } from '@/utils/shareCard';

/**
 * The share image palettes. Fixed, not themed: it is a picture. Results shares keep the
 * Clubhouse green frame; a single game's share (Final scores) is marigold, so a game and a
 * result never look alike in a chat (PR 10b colour rule — a unit test keeps the green out of
 * the game palette).
 */
export type SharePalette = {
  frame: string;
  onFrame: string;
  onFrameMuted: string;
  card: string;
  ink: string;
  muted: string;
  line: string;
  neg: string;
  note: string;
  onNote: string;
};

export const SHARE_COLORS: SharePalette = {
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
};

export const GAME_SHARE_COLORS: SharePalette = {
  ...SHARE_COLORS,
  frame: '#E9A900',
  onFrame: '#2A1F00',
  onFrameMuted: 'rgba(42,31,0,0.8)',
  note: '#FFF3C4',
};

export function sharePalette(tone: ShareTone): SharePalette {
  return tone === 'game' ? GAME_SHARE_COLORS : SHARE_COLORS;
}

/**
 * The picture is laid out at this width (dp) wherever it is rendered, so every phone sends
 * the same image; the capture then scales it to SHARE_IMAGE_WIDTH pixels.
 */
export const SHARE_RENDER_WIDTH = 540;
export const SHARE_IMAGE_WIDTH = 1080;

/** Pixel size of the saved picture for a card laid out SHARE_RENDER_WIDTH wide and `layoutHeight` tall. */
export function shareImageSize(layoutHeight: number): { width: number; height: number } {
  return { width: SHARE_IMAGE_WIDTH, height: Math.max(1, Math.round((layoutHeight * SHARE_IMAGE_WIDTH) / SHARE_RENDER_WIDTH)) };
}

function Line({ line, palette, fixed }: { line: ShareLine; palette: SharePalette; fixed: boolean }) {
  return (
    <View style={[styles.line, { borderBottomColor: palette.line }]} testID={`share-line-${line.name}`}>
      <View style={styles.nameBlock}>
        <View style={styles.nameRow}>
          {line.medal ? <MedalBadge medal={line.medal} size={22} /> : null}
          <Text
            style={[styles.name, { color: palette.ink }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            allowFontScaling={!fixed}
          >
            {line.name}
          </Text>
        </View>
        {line.sub ? <Text style={[styles.sub, { color: palette.muted }]} numberOfLines={1} allowFontScaling={!fixed}>{line.sub}</Text> : null}
      </View>
      <Text style={[styles.points, tabularNums, { color: line.points.startsWith('-') ? palette.neg : palette.ink }]} numberOfLines={1} allowFontScaling={!fixed}>
        {line.points}
      </Text>
    </View>
  );
}

/**
 * The one-page picture: brand, title, count line, the scores in two columns with medals
 * (every player; positives left / negatives right, or half-and-half past ten a side), the
 * games line, who generated it (initials), and the ID line in the foot. Per-game detail
 * stays behind the link / in the PDF. Names never wrap: a long one shrinks a step, then ends
 * with an ellipsis. With `fixed`, the card is laid out SHARE_RENDER_WIDTH wide and ignores
 * the phone's font scale, which is how the off-screen capture renders it.
 */
export function ShareCardView({
  card,
  cardRef,
  fixed = false,
  onLayoutHeight,
  testID,
}: {
  card: ShareCard;
  cardRef?: React.Ref<View>;
  fixed?: boolean;
  onLayoutHeight?: (height: number) => void;
  testID?: string;
}) {
  const palette = sharePalette(card.tone);
  const fs = { allowFontScaling: !fixed };
  return (
    <View
      ref={cardRef}
      collapsable={false}
      accessibilityLabel={`EZ Score: Rummy ${card.tone === 'game' ? 'game' : 'results'} share image`}
      style={[styles.frame, { backgroundColor: palette.frame }, fixed && { width: SHARE_RENDER_WIDTH }]}
      onLayout={onLayoutHeight ? (event) => onLayoutHeight(event.nativeEvent.layout.height) : undefined}
      testID={testID}
    >
      <View style={styles.frameHead}>
        <Text style={[styles.brand, { color: palette.onFrame }]} {...fs}>{card.brand}</Text>
        {card.date ? <Text style={[styles.frameDate, { color: palette.onFrameMuted }]} numberOfLines={1} {...fs}>{card.date}</Text> : null}
      </View>
      <View style={[styles.card, { backgroundColor: palette.card }]}>
        <Text style={[styles.title, { color: palette.ink }]} {...fs}>{card.title}</Text>
        {card.summary ? <Text style={[styles.summary, { color: palette.ink }]} {...fs}>{card.summary}</Text> : null}
        {card.notes?.map((note) => (
          <Text key={note} style={[styles.note, { backgroundColor: palette.note, color: palette.onNote }]} testID="share-note" {...fs}>{note}</Text>
        ))}
        <View style={styles.columns} testID={`share-columns-${card.layout}`}>
          <View style={styles.column} testID="share-positive">
            {card.positive.length === 0 ? <Text style={[styles.none, { color: palette.muted }]} {...fs}>None</Text> : card.positive.map((line) => <Line key={line.id} line={line} palette={palette} fixed={fixed} />)}
          </View>
          {card.layout === 'single' ? null : (
            <View style={styles.column} testID="share-negative">
              {card.negative.length === 0 ? <Text style={[styles.none, { color: palette.muted }]} {...fs}>None</Text> : card.negative.map((line) => <Line key={line.id} line={line} palette={palette} fixed={fixed} />)}
            </View>
          )}
        </View>
        {card.evenLine ? <Text style={[styles.small, { color: palette.muted }]} {...fs}>{card.evenLine}</Text> : null}
        {card.gamesLine ? <Text style={[styles.small, styles.center, styles.gamesLine, { color: palette.muted }]} testID="share-games-line" {...fs}>{card.gamesLine}</Text> : null}
        {card.generatedBy ? <Text style={[styles.small, styles.center, { color: palette.muted }]} testID="share-generated-by" {...fs}>{card.generatedBy}</Text> : null}
      </View>
      {card.footer ? (
        <Text style={[styles.footer, { color: palette.onFrame }]} testID="share-footer" numberOfLines={1} {...fs}>
          {card.footer}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  frameHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, gap: spacing.sm },
  brand: { fontWeight: '800', fontSize: 18, letterSpacing: 0.3 },
  frameDate: { fontWeight: '600', fontSize: 13, flexShrink: 1 },
  card: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  title: { fontSize: 26, fontWeight: '800' },
  summary: { fontWeight: '700', fontSize: 16, marginBottom: spacing.xs },
  note: { borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 10, fontWeight: '600', fontSize: 13 },
  columns: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  column: { flex: 1, minWidth: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  nameBlock: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontWeight: '700', fontSize: 15, flexShrink: 1 },
  sub: { fontSize: 12 },
  points: { fontWeight: '800', fontSize: 20 },
  none: { fontSize: 14, paddingVertical: 6 },
  small: { fontSize: 13 },
  center: { textAlign: 'center' },
  gamesLine: { marginTop: spacing.sm },
  footer: { fontWeight: '700', fontSize: 13, textAlign: 'center' },
});

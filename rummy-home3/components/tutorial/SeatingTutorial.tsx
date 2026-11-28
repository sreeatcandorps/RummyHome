import React, { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { Glide, useReduceMotion } from '@/components/game/OrderOfPlayers';
import { StepsSheet } from '@/components/tutorial/StepsSheet';
import { radius, seatColor, tabularNums, useAppTheme } from '@/constants/theme';
import { CENTRE_MIN_WIDTH, dealArrow, DEALER_TAG, layoutRing } from '@/utils/seatRing';
import { dealerPill, dealsLine, displayRows, HIGHEST_CARD_TAG, orderComplete, seatNumberOf, stepsFor } from '@/utils/seating';
import { DEMO_FRAME_MS, DEMO_PLAYERS, DemoFrame, SEATING_STEPS, SEATING_TUTORIAL_TITLE, seatingDemoFrames } from '@/utils/tutorials';

/**
 * The Order of players tutorial (D61, D74): three steps over the live screen, each a loop of the real
 * circle (D138) — discs with initials, seat badges, the Dealer tag, the deal arrow, a finger that taps —
 * scripted in `utils/tutorials.ts`. Not a video: it follows the theme and the font size, weighs nothing,
 * and changes with the circle. No card pictures (Sree: "in some places even Joker is highest") and it
 * opens only from Show me / Watch how.
 */
export function SeatingTutorial({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  return (
    <StepsSheet
      visible={visible}
      title={SEATING_TUTORIAL_TITLE}
      steps={SEATING_STEPS}
      onDone={onDone}
      renderDemo={(step) => <SeatingDemo step={step} />}
      testID="seating-tutorial"
    />
  );
}

/** One step's loop: the frames advance every DEMO_FRAME_MS and start over. */
export function SeatingDemo({ step }: { step: number }) {
  const frames = seatingDemoFrames(step);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
    const timer = setInterval(() => setIndex((i) => (i + 1) % frames.length), DEMO_FRAME_MS);
    return () => clearInterval(timer);
  }, [step, frames.length]);
  return <DemoRing frame={frames[index] ?? frames[0]} />;
}

/**
 * The demo is a picture inside the steps dialog: the circle is laid out as on a phone at least DEMO_MIN_WIDTH
 * wide (narrower, the middle card covers the badges), then drawn at most DEMO_HEIGHT tall and the dialog wide.
 */
const DEMO_HEIGHT = 220;
const DEMO_MIN_WIDTH = 330;
const byId = new Map(DEMO_PLAYERS.map((player) => [player.id, player]));

function DemoRing({ frame }: { frame: DemoFrame }) {
  const { colors, gameTypes } = useAppTheme();
  const brass = gameTypes.stake;
  const { fontScale } = useWindowDimensions();
  const fs = Math.max(fontScale, 1);
  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);
  const { draft } = frame;
  const rows = displayRows(draft);
  const n = rows.length;
  const complete = orderComplete(draft);
  const dealsId = complete ? draft.numbered[0] : undefined;
  const dealerAt = dealsId ? rows.indexOf(dealsId) : -1;
  const tagAt = dealerAt >= 0 ? dealerAt : n - 1;
  const labels = rows.map((id) => byId.get(id)?.label ?? '?');
  const ring = useMemo(
    () => (width > 0 ? layoutRing({ labels, width: Math.max(width, DEMO_MIN_WIDTH), height: DEMO_HEIGHT, fontScale: fs, dealerIndex: tagAt }) : null),
    [labels.join('|'), width, fs, tagAt],
  );
  const arrow = useMemo(() => (ring ? dealArrow(ring, tagAt) : null), [ring, tagAt]);
  const onLayout = (event: LayoutChangeEvent) => {
    const w = Math.floor(event.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };
  const selected = draft.focus && draft.numbered.includes(draft.focus) ? draft.focus : null;
  const scale = ring ? Math.min(1, DEMO_HEIGHT / ring.boxHeight, width / ring.boxWidth) : 1;
  const centreWidth = ring ? Math.max(CENTRE_MIN_WIDTH, ring.centre.width) : CENTRE_MIN_WIDTH;
  const fingerAt = frame.finger && frame.finger !== 'up' ? rows.indexOf(frame.finger) : -1;

  const middle = () => {
    if (selected) {
      const steps = stepsFor(draft, selected);
      return (
        <View style={[styles.middle, { backgroundColor: colors.surface, borderColor: colors.primary, width: centreWidth }]} testID="demo-selected">
          <Text variant="titleMedium" style={[styles.name, { color: colors.onSurface }]} numberOfLines={1}>{byId.get(selected)?.name}</Text>
          <View style={styles.moves}>
            {steps.up ? (
              <View style={[styles.move, { backgroundColor: colors.primary }]}>
                <Icon source="chevron-up" size={28} color={colors.onPrimary} />
                {frame.finger === 'up' ? <View style={styles.fingerOnMove} testID="demo-finger"><Icon source="gesture-tap" size={30} color={colors.tertiary} /></View> : null}
              </View>
            ) : <View style={styles.moveSlot} />}
            {steps.down ? (
              <View style={[styles.move, { backgroundColor: colors.primary }]}>
                <Icon source="chevron-down" size={28} color={colors.onPrimary} />
              </View>
            ) : <View style={styles.moveSlot} />}
          </View>
        </View>
      );
    }
    if (frame.flash) {
      const seat = seatNumberOf(draft, frame.flash);
      const pill = seat == null ? null : frame.flash === dealsId ? 'deal' : seat === n ? 'highest' : null;
      return (
        <View style={[styles.middle, { backgroundColor: colors.surface, borderColor: colors.primary, width: centreWidth }]} testID="demo-flash">
          <Text variant="titleMedium" style={[styles.name, { color: colors.onSurface }]} numberOfLines={1}>{byId.get(frame.flash)?.name}</Text>
          {seat == null ? <Text variant="bodySmall" style={[styles.centred, { color: colors.onSurfaceVariant }]}>Number taken back</Text> : null}
          {pill ? (
            <View style={[styles.pill, { backgroundColor: pill === 'deal' ? brass.container : colors.secondaryContainer }]}>
              <Text variant="labelMedium" style={[styles.centred, styles.pillText, { color: pill === 'deal' ? brass.on : colors.onSecondaryContainer }]}>
                {pill === 'deal' ? dealerPill(1, false) : HIGHEST_CARD_TAG}
              </Text>
            </View>
          ) : null}
        </View>
      );
    }
    const dealer = dealsId ? byId.get(dealsId)?.name : undefined;
    return dealer ? (
      <Text variant="bodyMedium" style={[styles.centred, { color: colors.primary, fontWeight: '700', width: centreWidth }]} testID="demo-deals-line">{dealsLine(dealer, 1, false)}</Text>
    ) : null;
  };

  return (
    <View onLayout={onLayout} style={{ height: ring ? ring.boxHeight * scale : DEMO_HEIGHT }} pointerEvents="none" testID="seating-demo-ring">
      {ring ? (
        <View style={[styles.abs, { width: ring.boxWidth, height: ring.boxHeight, left: (width - ring.boxWidth) / 2, top: -(ring.boxHeight * (1 - scale)) / 2, transform: [{ scale }] }]}>
          <View
            style={[styles.abs, {
              left: ring.cx - ring.a - 6,
              top: ring.cy - ring.a - 6,
              width: 2 * (ring.a + 6),
              height: 2 * (ring.a + 6),
              borderRadius: radius.full,
              backgroundColor: colors.primaryContainer,
              opacity: 0.55,
              transform: [{ scaleY: (ring.b + 6) / (ring.a + 6) }],
            }]}
          />
          {arrow?.points.map((p, i) => (
            <View key={`dot-${i}`} style={[styles.abs, styles.dot, { left: p.x - 2.5, top: p.y - 2.5, backgroundColor: colors.primary }]} />
          ))}
          {arrow && arrow.points.length ? (
            <View style={[styles.abs, { left: arrow.points[arrow.points.length - 1].x - 8, top: arrow.points[arrow.points.length - 1].y - 8, transform: [{ rotate: `${arrow.angle}deg` }] }]}>
              <Icon source="navigation" size={16} color={colors.primary} />
            </View>
          ) : null}
          {rows.map((id, index) => {
            const player = byId.get(id);
            if (!player) return null;
            const p = ring.points[index];
            const w = ring.widths[index];
            const seat = seatNumberOf(draft, id);
            const numbered = seat != null;
            const deals = id === dealsId;
            return (
              <Glide key={id} x={p.x - w / 2} y={p.y - ring.disc / 2} reduceMotion={reduceMotion} style={{ zIndex: selected === id ? 3 : 2 }}>
                <View
                  style={[
                    styles.disc,
                    { width: w, height: ring.disc, borderRadius: radius.full, backgroundColor: numbered ? seatColor(seat - 1) : colors.surfaceVariant, opacity: selected && selected !== id ? 0.4 : 1 },
                    !numbered && { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.outline },
                    deals && { borderWidth: 3, borderColor: brass.accent },
                    selected === id && { borderWidth: 3, borderColor: colors.primary, transform: [{ scale: 1.08 }] },
                  ]}
                  testID={`demo-disc-${index + 1}`}
                >
                  <Text style={[styles.initials, { color: numbered ? '#FFFFFF' : colors.onSurfaceVariant, fontSize: Math.round(ring.disc / 3) }]} numberOfLines={1}>{player.label}</Text>
                </View>
              </Glide>
            );
          })}
          {rows.map((id, index) => {
            const seat = seatNumberOf(draft, id);
            if (seat == null) return null;
            const q = ring.badges[index];
            const deals = id === dealsId;
            return (
              <Glide key={`badge-${id}`} x={q.x - ring.badge / 2} y={q.y - ring.badge / 2} reduceMotion={reduceMotion} style={{ zIndex: 2 }}>
                <View
                  style={[
                    styles.badge,
                    { width: ring.badge, height: ring.badge, borderRadius: radius.full, opacity: selected && selected !== id ? 0.4 : 1 },
                    deals ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.outline },
                  ]}
                >
                  <Text style={[styles.badgeText, tabularNums, { color: deals ? colors.onPrimary : colors.onSurface }]} numberOfLines={1}>{seat}</Text>
                </View>
              </Glide>
            );
          })}
          {ring.dealerTag && dealerAt >= 0 ? (
            <Glide x={ring.dealerTag.x - ring.dealerTagWidth / 2} y={ring.dealerTag.y - ring.dealerTagHeight / 2} reduceMotion={reduceMotion} style={{ zIndex: 2 }}>
              <View style={[styles.tag, { width: ring.dealerTagWidth, height: ring.dealerTagHeight, backgroundColor: brass.accent }]}>
                <Text style={[styles.tagText, { color: colors.onPrimary }]} numberOfLines={1}>{DEALER_TAG}</Text>
              </View>
            </Glide>
          ) : null}
          <View style={[styles.abs, styles.centreBox, { left: ring.cx - centreWidth / 2, top: ring.cy - ring.centre.height / 2, width: centreWidth, height: ring.centre.height }]}>
            {middle()}
          </View>
          {fingerAt >= 0 ? (
            <View style={[styles.abs, { left: ring.points[fingerAt].x - 6, top: ring.points[fingerAt].y - 2, zIndex: 5 }]} testID="demo-finger">
              <Icon source="gesture-tap" size={34} color={colors.tertiary} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
  disc: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  initials: { fontWeight: '800', includeFontPadding: false, textAlign: 'center' },
  badge: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  badgeText: { fontSize: 12, fontWeight: '800', includeFontPadding: false },
  tag: { borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  tagText: { fontSize: 11, fontWeight: '800', includeFontPadding: false },
  dot: { width: 5, height: 5, borderRadius: radius.full, opacity: 0.7 },
  centreBox: { alignItems: 'center', justifyContent: 'center', zIndex: 4 },
  middle: { borderWidth: 1.5, borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', gap: 4 },
  name: { fontWeight: '800', textAlign: 'center' },
  centred: { textAlign: 'center' },
  pill: { borderRadius: radius.md, paddingHorizontal: 9, paddingVertical: 2, marginTop: 2 },
  pillText: { fontWeight: '700' },
  moves: { flexDirection: 'row', gap: 6, marginTop: 6 },
  move: { width: 48, height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  moveSlot: { width: 48, height: 48 },
  fingerOnMove: { position: 'absolute', left: 18, top: 20 },
});

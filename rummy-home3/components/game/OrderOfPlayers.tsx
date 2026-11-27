import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { radius, seatColor, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { CENTRE_MIN_WIDTH, dealArrow, DEALER_TAG, layoutRing } from '@/utils/seatRing';
import {
  DEAL_DIRECTION,
  dealerPill,
  dealsLine,
  deselect,
  displayRows,
  HIGHEST_CARD_TAG,
  numberedCounter,
  OrderDraft,
  orderComplete,
  RING_REST_DONE,
  SEAT_FLASH_MS,
  seatNumberOf,
  seatRowLabel,
  stepNumbered,
  stepsFor,
  tapRing,
} from '@/utils/seating';
import { ORDER_ONE_LINE, SHOW_ME } from '@/utils/tutorials';

export type SeatingPlayer = {
  id: string;
  name: string;
  /** The scorecard's column letters. */
  label: string;
  /** Visible player ID ("#42", `displayPlayerId`); shown in the middle when the player is tapped. */
  playerCode?: string | null;
  /** Pool: out of the pool (grey seat, S07). */
  out?: boolean;
  /** Pool: re-entered (blue, as on the card). */
  reentered?: boolean;
};

const GLIDE_MS = 250;
/** One line under the circle (the counter, the deal direction), in text-size units. */
const FOOTER_LINE = 20;

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (live) setReduce(value); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => { live = false; sub.remove(); };
  }, []);
  return reduce;
}

/** Something on the circle that glides to its new place when the order changes ("remove animations": it jumps). */
function Glide({ x, y, reduceMotion, style, children }: { x: number; y: number; reduceMotion: boolean; style?: object; children: React.ReactNode }) {
  const pos = useRef(new Animated.ValueXY({ x, y })).current;
  useEffect(() => {
    if (reduceMotion) { pos.setValue({ x, y }); return; }
    const run = Animated.timing(pos, { toValue: { x, y }, duration: GLIDE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [x, y, reduceMotion, pos]);
  return <Animated.View pointerEvents="box-none" style={[styles.abs, style, { transform: pos.getTranslateTransform() }]}>{children}</Animated.View>;
}

/**
 * Order of players as a circle (D138, Sree Nov 27) — the one picture used at game start (New game step) and
 * mid-game (the full page from ⋮). The highest seat sits at 12 o'clock, the seats count down anticlockwise on
 * the screen, and seat 1 — the last tap, who deals round 1 — ends one step to the right of the top. Discs carry
 * the scorecard initials only; grey and dashed until numbered. Taps count down (D56): each numbers the next
 * player, his disc glides to his seat and the middle shows his name, Player ID and seat for two seconds. Tap
 * the latest again to take his number back; tap anyone else numbered to select him — only he gets ▲ ▼ (in the
 * middle), nobody has arrows at rest; tap him again or the table to let go. The dealer's disc is ringed, his
 * badge filled and tagged "Dealer". Ring position p (counted from the top, anticlockwise) is list row p of
 * `displayRows`, so `seat-row-<p>` means what it meant on the list. The host scrolls when `fits` is false.
 */
export function OrderOfPlayers({
  players,
  draft,
  onChange,
  dealsNext,
  dealRound = 1,
  meId,
  disabled = false,
  unchanged = false,
  availableHeight,
  onShowMe,
  howToTestID = 'order-how-to',
  testIDPrefix = 'seat',
}: {
  players: SeatingPlayer[];
  draft: OrderDraft;
  onChange: (draft: OrderDraft) => void;
  /** Who deals the round being played under the order being built (undefined until there is one). */
  dealsNext?: string;
  /** The round `dealsNext` deals: 1 at game start, saved rounds + 1 mid-game. */
  dealRound?: number;
  /** The signed-in player ("you deal round 1"). */
  meId?: string | null;
  disabled?: boolean;
  /** Mid-game: the order on screen is the saved one, so the counter says Done will just close. */
  unchanged?: boolean;
  /** Height the host can give the circle and its two lines before it scrolls. */
  availableHeight: number;
  /** Show me: the three steps (D74). */
  onShowMe?: () => void;
  howToTestID?: string;
  testIDPrefix?: string;
}) {
  const { colors, gameTypes } = useAppTheme();
  // The dealer's marks are brass (D65's accent), as in the approved pictures; selection is green.
  const brass = gameTypes.stake;
  const { fontScale } = useWindowDimensions();
  const fs = Math.max(fontScale, 1);
  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);
  const [flash, setFlash] = useState<{ id: string; undone: boolean } | null>(null);
  const byId = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const rows = displayRows(draft);
  const building = !orderComplete(draft);
  const n = rows.length;
  const dealerAt = dealsNext ? rows.indexOf(dealsNext) : -1;
  // Until seat 1 exists its place (one step right of the top) is kept free for the Dealer tag, so the oval does not jump.
  const tagAt = dealerAt >= 0 ? dealerAt : n - 1;
  const labels = rows.map((id) => byId.get(id)?.label ?? '?');
  const counter = numberedCounter(draft.numbered.length, n, unchanged && !building);
  // The counter wraps on a narrow phone ("Everyone numbered · order unchanged — Done closes", D64).
  const counterLines = width > 0 ? Math.max(1, Math.ceil((counter.length * 6.6 * fs) / width)) : 1;
  const footer = Math.ceil((counterLines + 1) * FOOTER_LINE * fs + spacing.sm);
  const ring = useMemo(
    () => (width > 0 ? layoutRing({ labels, width, height: Math.max(0, availableHeight - footer), fontScale: fs, dealerIndex: tagAt }) : null),
    [labels.join('|'), width, availableHeight, footer, fs, tagAt],
  );
  const arrow = useMemo(() => (ring ? dealArrow(ring, dealerAt >= 0 ? dealerAt : n - 1) : null), [ring, dealerAt, n]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), SEAT_FLASH_MS);
    return () => clearTimeout(timer);
  }, [flash]);
  // A flash never outlives its player (Clear, a reload behind the page).
  useEffect(() => { if (flash && !draft.base.includes(flash.id)) setFlash(null); }, [draft.base, flash]);

  const tap = (id: string) => {
    const next = tapRing(draft, id);
    if (next.numbered.length !== draft.numbered.length) setFlash({ id, undone: next.numbered.length < draft.numbered.length });
    else setFlash(null);
    onChange(next);
  };
  const onLayout = (event: LayoutChangeEvent) => {
    const w = Math.floor(event.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };

  const selected = draft.focus && draft.numbered.includes(draft.focus) ? draft.focus : null;
  // A flash that no longer matches the order (Clear after a tap, a number taken back) is not shown.
  const shown = flash && (seatNumberOf(draft, flash.id) == null) === flash.undone ? flash : null;
  const centrePlayer = selected ? byId.get(selected) : shown ? byId.get(shown.id) : undefined;
  const centreWidth = ring ? Math.max(CENTRE_MIN_WIDTH, ring.centre.width) : CENTRE_MIN_WIDTH;
  const dealerName = dealsNext ? byId.get(dealsNext)?.name : undefined;

  const centre = () => {
    if (centrePlayer && selected) {
      const seat = seatNumberOf(draft, selected);
      const steps = stepsFor(draft, selected);
      const at = rows.indexOf(selected) + 1;
      return (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.primary, width: centreWidth }]} testID={`${testIDPrefix}-selected`}>
          <Text variant="titleMedium" style={[styles.cardName, { color: colors.onSurface }]} numberOfLines={2} testID={`${testIDPrefix}-selected-name`}>{centrePlayer.name}</Text>
          <Text variant="bodySmall" style={[tabularNums, styles.centred, { color: colors.onSurfaceVariant }]} testID={`${testIDPrefix}-selected-seat`}>
            {[centrePlayer.playerCode, `Seat ${seat}`, selected === dealsNext ? DEALER_TAG : null].filter(Boolean).join(' · ')}
          </Text>
          <View style={styles.moves}>
            {steps.up ? (
              <Pressable onPress={() => onChange(stepNumbered(draft, selected, 1))} disabled={disabled} style={[styles.move, { backgroundColor: colors.primary }]} accessibilityRole="button" accessibilityLabel={`Move ${centrePlayer.name} up to seat ${(seat ?? 0) + 1}`} testID={`${testIDPrefix}-up-${at}`}>
                <Icon source="chevron-up" size={28} color={colors.onPrimary} />
              </Pressable>
            ) : <View style={styles.moveSlot} />}
            {steps.down ? (
              <Pressable onPress={() => onChange(stepNumbered(draft, selected, -1))} disabled={disabled} style={[styles.move, { backgroundColor: colors.primary }]} accessibilityRole="button" accessibilityLabel={`Move ${centrePlayer.name} down to seat ${(seat ?? 0) - 1}`} testID={`${testIDPrefix}-down-${at}`}>
                <Icon source="chevron-down" size={28} color={colors.onPrimary} />
              </Pressable>
            ) : <View style={styles.moveSlot} />}
          </View>
        </View>
      );
    }
    if (centrePlayer && shown) {
      const seat = seatNumberOf(draft, shown.id);
      const pill: 'deal' | 'highest' | null = shown.undone || seat == null ? null : shown.id === dealsNext ? 'deal' : seat === n ? 'highest' : null;
      return (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.primary, width: centreWidth }]} testID={`${testIDPrefix}-flash`} accessibilityLiveRegion="polite">
          <Text variant="titleMedium" style={[styles.cardName, { color: colors.onSurface }]} numberOfLines={2} testID={`${testIDPrefix}-flash-name`}>{centrePlayer.name}</Text>
          <Text variant="bodySmall" style={[tabularNums, styles.centred, { color: colors.onSurfaceVariant }]} testID={`${testIDPrefix}-flash-seat`}>
            {shown.undone || seat == null ? 'Number taken back' : [centrePlayer.playerCode, `Seat ${seat}`].filter(Boolean).join(' · ')}
          </Text>
          {pill ? (
            <View style={[styles.pill, { backgroundColor: pill === 'deal' ? brass.container : colors.secondaryContainer }]}>
              {pill === 'deal' ? (
                <Text variant="labelMedium" style={[styles.centred, styles.pillText, { color: brass.on }]} testID={`${testIDPrefix}-flash-deals`}>{dealerPill(dealRound, shown.id === meId)}</Text>
              ) : (
                <Text variant="labelMedium" style={[styles.centred, styles.pillText, { color: colors.onSecondaryContainer }]} testID={`${testIDPrefix}-highest-card`}>{HIGHEST_CARD_TAG}</Text>
              )}
            </View>
          ) : null}
        </View>
      );
    }
    return (
      <View style={[styles.rest, { width: centreWidth }]} testID={howToTestID}>
        <Text variant="bodyMedium" style={[styles.centred, { color: colors.onSurface, fontWeight: '700' }]} testID={`${howToTestID}-line`}>{building ? ORDER_ONE_LINE : RING_REST_DONE}</Text>
        {!building && dealerName ? (
          <Text variant="bodySmall" style={[styles.centred, { color: colors.primary, fontWeight: '700' }]} testID={`${testIDPrefix}-deals-line`}>{dealsLine(dealerName, dealRound, dealsNext === meId)}</Text>
        ) : null}
        {onShowMe ? (
          <Pressable onPress={onShowMe} hitSlop={8} style={styles.showMe} accessibilityRole="button" accessibilityLabel={`${SHOW_ME}: how to seat the table`} testID={`${howToTestID}-show-me`}>
            <Icon source="play-circle-outline" size={18} color={colors.primary} />
            <Text variant="labelLarge" style={{ color: colors.primary }}>{SHOW_ME}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <View onLayout={onLayout} testID="order-of-players">
      {ring ? (
        <View style={{ height: ring.boxHeight }} testID={`${testIDPrefix}-ring`}>
          {/* The table: tapping it lets go of the selected player. */}
          <Pressable
            onPress={() => onChange(deselect(draft))}
            disabled={disabled || !selected}
            accessible={false}
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
            <View key={`dot-${i}`} pointerEvents="none" style={[styles.abs, styles.dot, { left: p.x - 2.5, top: p.y - 2.5, backgroundColor: colors.primary }]} />
          ))}
          {arrow && arrow.points.length ? (
            <View pointerEvents="none" style={[styles.abs, { left: arrow.points[arrow.points.length - 1].x - 8, top: arrow.points[arrow.points.length - 1].y - 8, transform: [{ rotate: `${arrow.angle}deg` }] }]}>
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
            const deals = numbered && id === dealsNext;
            const dim = Boolean(selected && selected !== id);
            const fill = player.out ? colors.surfaceVariant : player.reentered ? colors.tertiary : numbered ? seatColor(seat - 1) : colors.surfaceVariant;
            const ink = player.out || !numbered ? colors.onSurfaceVariant : '#FFFFFF';
            const position = index + 1;
            return (
              <Glide key={id} x={p.x - w / 2} y={p.y - ring.disc / 2} reduceMotion={reduceMotion} style={{ zIndex: selected === id ? 3 : 2 }}>
                <Pressable
                  onPress={() => tap(id)}
                  onLongPress={() => {}}
                  disabled={disabled}
                  style={[
                    styles.disc,
                    { width: w, height: ring.disc, borderRadius: radius.full, backgroundColor: fill, opacity: dim ? 0.4 : 1 },
                    !numbered && { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.outline },
                    deals && { borderWidth: 3, borderColor: brass.accent },
                    selected === id && { borderWidth: 3, borderColor: colors.primary, transform: [{ scale: 1.08 }] },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={seatRowLabel({ seat, name: player.name, dealsNext: deals, out: player.out })}
                  accessibilityHint={!numbered ? `Give seat ${draft.base.length - draft.numbered.length}` : building && draft.numbered[0] === id && selected !== id ? 'Take the number back' : selected === id ? 'Deselect' : 'Select'}
                  accessibilityState={{ selected: selected === id }}
                  testID={`${testIDPrefix}-row-${position}`}
                >
                  <Text
                    style={[styles.initials, { color: ink, fontSize: Math.round(ring.disc / 3), textDecorationLine: player.out ? 'line-through' : 'none' }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    testID={`${testIDPrefix}-label-${position}`}
                  >
                    {player.label}
                  </Text>
                </Pressable>
              </Glide>
            );
          })}
          {rows.map((id, index) => {
            const seat = seatNumberOf(draft, id);
            if (seat == null) return null;
            const q = ring.badges[index];
            const deals = id === dealsNext;
            const position = index + 1;
            return (
              <Glide key={`badge-${id}`} x={q.x - ring.badge / 2} y={q.y - ring.badge / 2} reduceMotion={reduceMotion} style={{ zIndex: 2 }}>
                <View
                  pointerEvents="none"
                  style={[
                    styles.badge,
                    { width: ring.badge, height: ring.badge, borderRadius: radius.full, opacity: selected && selected !== id ? 0.4 : 1 },
                    deals ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.outline },
                  ]}
                  testID={`${testIDPrefix}-no-${position}`}
                >
                  <Text style={[styles.badgeText, tabularNums, { color: deals ? colors.onPrimary : colors.onSurface }]} numberOfLines={1} testID={`${testIDPrefix}-number-${position}`}>{seat}</Text>
                </View>
              </Glide>
            );
          })}
          {ring.dealerTag && dealerAt >= 0 ? (
            <Glide x={ring.dealerTag.x - ring.dealerTagWidth / 2} y={ring.dealerTag.y - ring.dealerTagHeight / 2} reduceMotion={reduceMotion} style={{ zIndex: 2 }}>
              <View pointerEvents="none" style={[styles.tag, { width: ring.dealerTagWidth, height: ring.dealerTagHeight, backgroundColor: brass.accent }]}>
                <Text style={[styles.tagText, { color: colors.onPrimary }]} numberOfLines={1} testID={`${testIDPrefix}-deals-next`}>{DEALER_TAG}</Text>
              </View>
            </Glide>
          ) : null}
          <View pointerEvents="box-none" style={[styles.abs, styles.centreBox, { left: ring.cx - centreWidth / 2, top: ring.cy - ring.centre.height / 2, width: centreWidth, height: ring.centre.height }]}>
            {centre()}
          </View>
        </View>
      ) : null}
      <Text variant="labelMedium" style={[styles.centred, styles.footerLine, { color: colors.onSurfaceVariant }]} testID="order-counter">
        {counter}
      </Text>
      <View style={styles.direction} testID={`${testIDPrefix}-deal-direction`}>
        <Text variant="labelMedium" style={{ color: colors.onSurfaceVariant }}>{DEAL_DIRECTION}</Text>
        <Icon source="rotate-left" size={16} color={colors.onSurfaceVariant} />
      </View>
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
  card: { borderWidth: 1.5, borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', gap: 4, elevation: 4, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  cardName: { fontWeight: '800', textAlign: 'center' },
  centred: { textAlign: 'center' },
  pillText: { fontWeight: '700' },
  pill: { borderRadius: radius.md, paddingHorizontal: 9, paddingVertical: 2, marginTop: 2 },
  moves: { flexDirection: 'row', gap: 6, marginTop: 6 },
  move: { width: 48, height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  moveSlot: { width: 48, height: 48 },
  rest: { alignItems: 'center', gap: 6 },
  showMe: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, minHeight: 32 },
  footerLine: { paddingTop: spacing.xs },
  direction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xxs, paddingTop: spacing.xxs },
});

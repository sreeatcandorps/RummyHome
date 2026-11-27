import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { radius, seatColor, spacing, useAppTheme } from '@/constants/theme';
import type { Game } from '@/types/game';
import { playersOut, reentryScore, seatOf } from '@/utils/pool';
import { planGameReentry, reentrySeatHint, reentrySeatLine, reentrySeatWarning, seatLeftOf, shortNames } from '@/utils/reentrySeat';

const SEAT_WIDTH = 52;

type PanelGame = Pick<Game, 'players' | 'poolSeats' | 'dealerIds' | 'nextDealerOverride' | 'scores' | 'settings'>;

/**
 * The opened Re-enter row (056, D139; design-review-2 §10.6): one line naming the seat and the two players
 * beside it, the seats in order (the scorecard's column order), and Re-enter at <score>. The default is the
 * dealer's left. A tap on a name sits him on that person's left; Keep seat N is today's behaviour. Another
 * seat gets a warning that says what changes, never a refusal (D50). Used by Round saved and by Standings.
 */
export function ReentrySeatPanel({ game, playerId, nameOf, labelOf, onConfirm, idPrefix = 'after' }: {
  game: PanelGame;
  playerId: string;
  nameOf: (id: string) => string;
  labelOf: (id: string) => string;
  /** `seat` (1-based) only when the admin picked a seat other than the dealer's left. Throws to show an error. */
  onConfirm: (seat?: number) => Promise<void>;
  idPrefix?: string;
}) {
  const { colors, dark } = useAppTheme();
  const [chosen, setChosen] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const strip = useRef<ScrollView>(null);
  const [stripWidth, setStripWidth] = useState(0);

  const plan = useMemo(() => planGameReentry(game, playerId, chosen), [game, playerId, chosen]);
  const outIds = useMemo(() => new Set(playersOut(game)), [game]);
  const short = useMemo(() => shortNames(game.players, nameOf), [game.players, nameOf]);
  const score = reentryScore(game);
  const line = reentrySeatLine(plan, playerId, outIds, short);
  const hint = reentrySeatHint(plan, playerId, outIds, score, short);
  const warning = reentrySeatWarning(plan, playerId, short);
  const moved = plan.seat !== plan.from;

  useEffect(() => {
    if (!stripWidth) return;
    const x = Math.max(0, plan.seat * SEAT_WIDTH - (stripWidth - SEAT_WIDTH) / 2);
    strip.current?.scrollTo({ x, animated: true });
  }, [plan.seat, stripWidth]);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(plan.seat === plan.defaultSeat ? undefined : plan.seat + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not re-enter. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.panel} testID={`${idPrefix}-seat-panel`}>
      <Text variant="bodyMedium" style={[styles.line, { color: colors.onSurface }]} testID={`${idPrefix}-seat-line`}>{line}</Text>
      <View style={[styles.stripBox, { borderColor: colors.outlineVariant, backgroundColor: colors.surface }]} onLayout={(event) => setStripWidth(event.nativeEvent.layout.width)}>
        <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={plan.players.length * SEAT_WIDTH > stripWidth} contentContainerStyle={styles.strip}>
          {plan.players.map((id, index) => {
            const him = id === playerId;
            const dealer = id === plan.dealer;
            const out = !him && outIds.has(id);
            const note = him ? (moved ? `was ${plan.from + 1}` : '') : dealer ? 'deals' : out ? 'out' : '';
            return (
              <Pressable
                key={id}
                onPress={() => (him || busy ? undefined : setChosen(seatLeftOf(plan.players, playerId, id)))}
                style={styles.seat}
                accessibilityRole="button"
                accessibilityLabel={`Seat ${index + 1}, ${nameOf(id)}${dealer ? ', deals' : ''}${out ? ', out' : ''}${him ? '' : `. Sit ${short(playerId)} on ${short(id)}\u2019s left`}`}
                accessibilityState={{ selected: him }}
                testID={`${idPrefix}-seat-${index + 1}`}
              >
                <Text style={[styles.seatNumber, { color: colors.onSurfaceVariant }]}>{index + 1}</Text>
                <View
                  style={[
                    styles.ring,
                    him && { borderColor: colors.secondary, borderStyle: 'dashed', backgroundColor: colors.secondaryContainer },
                    dealer && { borderColor: colors.primary },
                  ]}
                >
                  <SeatAvatar name={nameOf(id)} label={labelOf(id)} size={34} muted={out || him} color={seatColor(index, { onDark: dark })} />
                </View>
                <Text numberOfLines={1} style={[styles.seatNote, { color: dealer ? colors.primary : colors.onSurfaceVariant }]}>{note}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {warning ? (
        <Text variant="bodySmall" style={[styles.warning, { color: colors.secondary }]} accessibilityRole="alert" testID={`${idPrefix}-seat-warning`}>{warning}</Text>
      ) : hint ? (
        <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }} testID={`${idPrefix}-seat-hint`}>{hint}</Text>
      ) : null}
      {error ? <Text variant="bodySmall" style={{ color: colors.error }} accessibilityRole="alert" testID={`${idPrefix}-reenter-error`}>{error}</Text> : null}
      <View style={styles.actions}>
        {plan.defaultSeat !== plan.from ? (
          <Button mode="text" onPress={() => setChosen(plan.from)} disabled={busy || plan.seat === plan.from} testID={`${idPrefix}-keep-seat`}>
            {`Keep seat ${plan.from + 1}`}
          </Button>
        ) : null}
        <Button mode="contained" onPress={confirm} loading={busy} disabled={busy} testID={`${idPrefix}-reenter-confirm`}>
          {`Re-enter at ${score}`}
        </Button>
      </View>
    </View>
  );
}

/**
 * Standings' Re-enter (the second door, §10.6): the same line and choice in a small sheet over the scorecard.
 * Cancel leaves everything as it was.
 */
export function ReentrySheet({ game, playerId, nameOf, labelOf, onConfirm, onDismiss }: {
  game: PanelGame;
  /** Null hides the sheet. */
  playerId: string | null;
  nameOf: (id: string) => string;
  labelOf: (id: string) => string;
  onConfirm: (playerId: string, seat?: number) => Promise<void>;
  onDismiss: () => void;
}) {
  const { colors } = useAppTheme();
  const [body, setBody] = useState<{ top: number; bottom: number } | null>(null);
  if (!playerId) return null;
  const out = seatOf(game, playerId).outRound;
  return (
    <BottomSheet
      visible
      onRequestClose={onDismiss}
      testID="reentry-sheet"
      reveal={body}
      header={
        <>
          <Text variant="titleLarge" style={{ color: colors.onSurface }} accessibilityRole="header">{`Re-enter ${nameOf(playerId)}`}</Text>
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{`Out in round ${out ?? '?'} · comes back at ${reentryScore(game)}`}</Text>
        </>
      }
      footer={<Button mode="outlined" onPress={onDismiss} style={styles.grow} testID="standings-reenter-cancel">Cancel</Button>}
    >
      <View
        style={styles.sheetBody}
        onLayout={(event) => {
          const { y, height } = event.nativeEvent.layout;
          setBody((was) => (was && was.top === y && was.bottom === y + height ? was : { top: y, bottom: y + height }));
        }}
      >
        <ReentrySeatPanel game={game} playerId={playerId} nameOf={nameOf} labelOf={labelOf} idPrefix="standings" onConfirm={(seat) => onConfirm(playerId, seat)} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  sheetBody: { paddingHorizontal: 20, paddingVertical: spacing.md },
  panel: { gap: spacing.sm, paddingTop: spacing.xs },
  line: { fontWeight: '700' },
  stripBox: { borderWidth: 1, borderRadius: radius.md },
  strip: { paddingHorizontal: 6, paddingVertical: 6 },
  seat: { width: SEAT_WIDTH, alignItems: 'center', gap: 2, minHeight: 48 },
  seatNumber: { fontSize: 12, lineHeight: 14, fontWeight: '700' },
  ring: { borderWidth: 2, borderColor: 'transparent', borderRadius: radius.full, padding: 1 },
  seatNote: { fontSize: 11, lineHeight: 13, fontWeight: '700' },
  warning: { fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
});

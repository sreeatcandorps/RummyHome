import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { StepsSheet } from '@/components/tutorial/StepsSheet';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { radius, seatColor, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { displayRows, orderComplete, SEAT_ROW_MIN_HEIGHT, seatNumberOf, isFirstNumbered } from '@/utils/seating';
import { DEMO_FRAME_MS, DEMO_PLAYERS, DemoFrame, SEATING_STEPS, SEATING_TUTORIAL_TITLE, seatingDemoFrames } from '@/utils/tutorials';

/**
 * The Order of players tutorial (D61): four steps over the live screen, each a loop of the real
 * rows — seat circle, avatar, name, the card drawn, a finger that taps — scripted in
 * `utils/tutorials.ts`. Not a video: it follows the theme and the font size, weighs nothing, and
 * changes with the rows. `forced` is the first-time run (no way out but through the steps).
 */
export function SeatingTutorial({ visible, forced, onDone }: { visible: boolean; forced: boolean; onDone: () => void }) {
  return (
    <StepsSheet
      visible={visible}
      title={SEATING_TUTORIAL_TITLE}
      steps={SEATING_STEPS}
      forced={forced}
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
  return <DemoRows frame={frames[index] ?? frames[0]} />;
}

const byId = new Map(DEMO_PLAYERS.map((player) => [player.id, player]));

function DemoRows({ frame }: { frame: DemoFrame }) {
  const { colors, dark } = useAppTheme();
  const rows = displayRows(frame.draft);
  const complete = orderComplete(frame.draft);
  const dealsId = complete ? frame.draft.numbered[0] : undefined;
  return (
    <View testID="seating-demo-rows">
      {rows.map((id, index) => {
        const player = byId.get(id);
        if (!player) return null;
        const seat = seatNumberOf(frame.draft, id);
        const numbered = seat != null;
        const deals = id === dealsId;
        const highest = !complete && isFirstNumbered(frame.draft, id);
        const finger = frame.finger === id;
        return (
          <View key={id} style={[styles.row, { borderColor: colors.outlineVariant }, finger && { backgroundColor: colors.primaryContainer }]} testID={`demo-row-${index + 1}`}>
            <View style={[styles.seatNo, numbered ? { backgroundColor: deals ? colors.primary : colors.surfaceVariant } : { borderWidth: 2, borderColor: colors.outline, borderStyle: 'dashed' }]}>
              {numbered ? <Text style={[styles.seatNoText, tabularNums, { color: deals ? colors.onPrimary : colors.onSurfaceVariant }]}>{seat}</Text> : null}
            </View>
            <SeatAvatar name={player.name} label={player.label} color={seatColor(numbered ? seat - 1 : index, { onDark: dark })} size={30} />
            <Text variant="bodyMedium" style={[styles.name, { color: colors.onSurface }]} numberOfLines={1}>{player.name}</Text>
            {deals ? <Text variant="labelSmall" style={{ color: colors.primary }}>deals</Text> : null}
            {highest ? <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>highest card</Text> : null}
            {frame.cards ? (
              <View style={[styles.card, { borderColor: colors.outline, backgroundColor: colors.surface }]}>
                <Text variant="labelMedium" style={{ color: player.red ? colors.error : colors.onSurface, fontWeight: '800' }}>{player.card}</Text>
              </View>
            ) : null}
            {finger ? (
              <View style={styles.finger} pointerEvents="none" testID="demo-finger">
                <Icon source="gesture-tap" size={28} color={colors.tertiary} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: SEAT_ROW_MIN_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, paddingHorizontal: spacing.xs },
  seatNo: { width: 24, height: 24, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  seatNoText: { fontWeight: '800', fontSize: 14 },
  name: { flex: 1, minWidth: 0 },
  card: { minWidth: 34, paddingHorizontal: 6, height: 28, borderRadius: radius.xs, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  finger: { position: 'absolute', left: 96, top: 8 },
});

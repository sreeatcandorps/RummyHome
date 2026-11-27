import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { ReentrySeatPanel } from '@/components/game/ReentrySeatPanel';
import { spacing, useAppTheme } from '@/constants/theme';
import type { Game } from '@/types/game';
import { nextDealer } from '@/utils/dealerRotation';
import { playedRounds } from '@/utils/editRound';
import { AfterRound, isOut, playersIn, poolTotal, reentryBlock, ReentryBlock, reentryOn, reentryScore, seatOf } from '@/utils/pool';
import { backInLine, reentryTable, roundSavedSummary, shortNames } from '@/utils/reentrySeat';

/** What a row says instead of Re-enter when the player cannot come back. */
const BLOCKED: Partial<Record<ReentryBlock, string>> = { used: 'no re-entries left', off: 're-entries off' };

/**
 * Round saved (pool), after Add round (D4; design-review-2 §8.1 and §10.6, D139). A bottom sheet: the title,
 * who deals next and one summary line pinned on top; one row per player who is out — this round's, every
 * one, then earlier ones who may come back — with Re-enter on the row; only the list scrolls; Close pinned
 * at the bottom (D34). Re-enter opens the row in place (`ReentrySeatPanel`) and the sheet stays open for
 * the next one. One player left: Complete the pool is the main button and opens the one Complete dialog (D39).
 */
export function RoundSavedSheet({ visible, game, summary, nameOf, labelOf, onReenter, onClose, onComplete }: {
  visible: boolean;
  /** The game as it is now (reloaded after each re-entry). */
  game: Game;
  /** Who was out when the round was saved: the rows, fixed for as long as the sheet is open. */
  summary: AfterRound;
  nameOf: (id: string) => string;
  labelOf: (id: string) => string;
  onReenter: (playerId: string, seat?: number) => Promise<void>;
  onClose: () => void;
  onComplete: () => void;
}) {
  const { colors } = useAppTheme();
  const [openId, setOpenId] = useState<string | null>(null);
  const short = useMemo(() => shortNames(game.players, nameOf), [game.players, nameOf]);

  const inIds = playersIn(game);
  const oneLeft = inIds.length === 1;
  const rounds = playedRounds(game.scores);
  const dealer = nextDealer(reentryTable(game), rounds);
  const outNow = summary.outThisRound.filter((id) => isOut(seatOf(game, id))).length;
  const at = reentryOn(game.settings) ? reentryScore(game) : null;

  const header = (
    <>
      <Text variant="titleLarge" style={{ color: colors.onSurface }} accessibilityRole="header" testID="after-title">{`Round ${summary.round} saved`}</Text>
      <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }} testID="after-next">
        {oneLeft
          ? `Only ${short(inIds[0])} is left. Complete the pool, or re-enter someone to keep playing.`
          : `Next: round ${rounds + 1}${dealer ? ` · ${short(dealer)} deals` : ''}`}
      </Text>
      <Text variant="bodySmall" style={{ color: colors.onSurface }} accessibilityLabel={roundSavedSummary(outNow, inIds.length, at)} testID="after-summary">
        <Text style={[styles.bold, { color: outNow ? colors.loss : colors.onSurface }]}>{outNow ? `${outNow} out` : 'Nobody out'}</Text>
        {' this round · '}
        <Text style={styles.bold}>{String(inIds.length)}</Text>
        {' still in'}
        {at === null ? null : <>{' · re-entry at '}<Text style={styles.bold}>{String(at)}</Text></>}
      </Text>
    </>
  );

  const row = (id: string, earlier: boolean) => {
    const seat = seatOf(game, id);
    const back = !isOut(seat);
    const block = back ? null : reentryBlock(game, id);
    const open = openId === id && !back && block === null;
    const sub = back
      ? backInLine(game, id, short)
      : earlier ? `Out in round ${seat.outRound}` : `Out at ${poolTotal(game.scores[id], seat)}`;
    return (
      <View
        key={id}
        style={[styles.row, { borderBottomColor: colors.hairline }, back && { backgroundColor: colors.reentryContainer }, open && { backgroundColor: colors.background }]}
        testID={`after-row-${id}`}
      >
        <View style={styles.rowHead}>
          <SeatAvatar name={nameOf(id)} label={labelOf(id)} size={36} muted={!back} color={back ? colors.reentry : undefined} />
          <View style={styles.rowText}>
            <Text variant="bodyMedium" style={[styles.bold, { color: colors.onSurface }]}>{nameOf(id)}</Text>
            <Text
              variant="bodySmall"
              style={[styles.bold, { color: back ? colors.reentry : earlier ? colors.onSurfaceVariant : colors.loss }, earlier && !back && styles.regular]}
              testID={back ? `after-back-${id}` : undefined}
            >
              {sub}
            </Text>
          </View>
          {back ? null : block === null ? (
            open ? null : (
              <Button mode="text" onPress={() => setOpenId(id)} accessibilityLabel={`Re-enter ${nameOf(id)}`} testID={`after-reenter-${id}`}>
                Re-enter
              </Button>
            )
          ) : (
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{BLOCKED[block] ?? ''}</Text>
          )}
        </View>
        {open ? (
          <ReentrySeatPanel
            game={game}
            playerId={id}
            nameOf={nameOf}
            labelOf={labelOf}
            onConfirm={async (pick) => {
              await onReenter(id, pick);
              setOpenId(null);
            }}
          />
        ) : null}
      </View>
    );
  };

  const group = (title: string, ids: string[], earlier: boolean) =>
    ids.length ? (
      <View key={title}>
        <Text variant="labelSmall" style={[styles.groupHead, { color: colors.onSurfaceVariant }]}>{title}</Text>
        {ids.map((id) => row(id, earlier))}
      </View>
    ) : null;

  const leader = oneLeft ? inIds[0] : null;
  const footer = oneLeft ? (
    <>
      <Button mode="outlined" onPress={onClose} style={styles.flex} testID="after-done">Close</Button>
      <Button mode="contained" icon="flag-checkered" onPress={onComplete} style={styles.flex2} testID="after-complete">Complete the pool</Button>
    </>
  ) : (
    <Button mode="contained" onPress={onClose} style={styles.flex} testID="after-done">Close</Button>
  );

  return (
    <BottomSheet visible={visible} header={header} footer={footer} onRequestClose={onClose} testID="round-saved-sheet">
      {leader ? (
        <View>
          <Text variant="labelSmall" style={[styles.groupHead, { color: colors.onSurfaceVariant }]}>STILL IN</Text>
          <View style={[styles.row, { borderBottomColor: colors.hairline }]} testID={`after-row-${leader}`}>
            <View style={styles.rowHead}>
              <SeatAvatar name={nameOf(leader)} label={labelOf(leader)} size={36} color={colors.leader} />
              <View style={styles.rowText}>
                <Text variant="bodyMedium" style={[styles.bold, { color: colors.onSurface }]}>{nameOf(leader)}</Text>
                <Text variant="bodySmall" style={[styles.bold, { color: colors.leader }]}>{`${poolTotal(game.scores[leader], seatOf(game, leader))} · wins if you complete now`}</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}
      {group('OUT THIS ROUND', summary.outThisRound, false)}
      {group('OUT EARLIER', summary.outEarlier, true)}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
  regular: { fontWeight: '400' },
  groupHead: { paddingHorizontal: 20, paddingTop: spacing.md, paddingBottom: spacing.xs, letterSpacing: 0.6 },
  row: { paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 },
  rowText: { flex: 1, minWidth: 0 },
  flex: { flex: 1 },
  flex2: { flex: 1.6 },
});

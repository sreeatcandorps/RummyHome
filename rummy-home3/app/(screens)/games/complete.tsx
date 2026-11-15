import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Dialog, Icon, Portal, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { radius, seatColor, spacing, tabularNums, useAppTheme } from '@/constants/theme';
import { HELP } from '@/constants/help';
import { useGameRoster } from '@/hooks/useGameRoster';
import { useLayout } from '@/hooks/useLayout';
import { gamesService } from '@/services/games';
import { BottomBar } from '@/components/ui/BottomBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { HelpButton } from '@/components/ui/HelpButton';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { Tag } from '@/components/ui/Tag';
import { formatGameDateTime, gameNumberLabel } from '@/utils/gameDisplay';
import { formatPoints } from '@/utils/results';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { completionCheck, poolCompletionCheck, sortFinalScores } from '@/utils/completeGame';
import { gameAdminLines } from '@/utils/gameAdmins';
import { pointsGameMultiplier } from '@/utils/multiplier';
import { GIVE_AWARDS_FIRST, isOut, isPoolGame, playersIn, playersOut, poolTotal, seatOf } from '@/utils/pool';

/**
 * Complete game as its own page: final totals, a balance check, one filled
 * button and a second confirmation. Once completed it offers Share final
 * scores and Results, and can no longer complete the game twice.
 */
export default function CompleteGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { insets } = useLayout();
  const { game, setGame, players, roster, canScore, loading, error, reload } = useGameRoster(typeof id === 'string' ? id : undefined);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const pool = isPoolGame(game);
  const multiplier = pool ? 1 : pointsGameMultiplier(game);
  // Points: highest total first. Pool: players still in, lowest first, then the outs (seat colours stay with the person).
  const totals = useMemo(() => {
    const rows = players.map((player, index) => ({
      player,
      color: seatColor(index),
      out: pool ? isOut(seatOf(game, player.id)) : false,
      total: pool
        ? poolTotal(game?.scores[player.id], seatOf(game, player.id))
        : (game?.scores[player.id] ?? []).reduce((sum, value) => sum + (Number(value) || 0), 0) * multiplier,
    }));
    if (!pool) return sortFinalScores(rows);
    return rows.sort((a, b) => Number(a.out) - Number(b.out) || a.total - b.total);
  }, [game, players, pool, multiplier]);
  const check = useMemo(() => {
    if (!game) return null;
    if (pool) {
      const roundCount = Math.max(0, ...players.map((p) => (game.scores[p.id] ?? []).length));
      return poolCompletionCheck(roundCount, playersIn(game).length, playersOut(game).length);
    }
    return completionCheck(game.scores, players.map((p) => p.id));
  }, [game, players, pool]);
  const admins = useMemo(() => (game ? gameAdminLines(roster, game) : []), [game, roster]);

  const complete = async () => {
    if (!game || completing || game.isComplete) return;
    setCompleting(true);
    try {
      const updated = await gamesService.completeGame(game.id);
      if (updated) setGame(updated);
      setConfirmOpen(false);
    } catch (caught) {
      setConfirmOpen(false);
      setFailure(formatSupabaseError(caught));
    } finally {
      setCompleting(false);
    }
  };

  const backToScorecard = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  if (loading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (!game || !check) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title={error ? "Couldn't load this game" : 'Game not available'}
        message={error ?? 'Try again from the scorecard.'}
        actionLabel="Retry"
        onAction={reload}
      />
    );
  }

  const number = gameNumberLabel(game);
  const title = number ? `Complete ${number}` : 'Complete game';
  const done = game.isComplete;
  const blocked = !canScore ? 'Only a game admin can complete a game.' : check.problem;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title, headerRight: () => <HelpButton text={HELP.complete} /> }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingLeft: insets.left + spacing.lg, paddingRight: insets.right + spacing.lg }]}>
        <View style={styles.headerRow}>
          <Tag label={done ? 'Completed' : 'Active'} tone={done ? 'primary' : 'positive'} icon={done ? 'flag-checkered' : 'circle-medium'} />
          <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{formatGameDateTime(game.date)}</Text>
        </View>

        <Text variant="headlineSmall" style={styles.heading}>{done ? 'Final scores' : 'Final scores so far'}</Text>
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
          {done
            ? `Completed${game.completedAt ? ` ${formatGameDateTime(game.completedAt)}` : ''}. Scores are locked. Reopen from the scorecard menu if this was a mistake.`
            : pool
              ? 'Completing locks the scores. Then give the awards; the pool can be picked for Results once awarded. Nothing is deleted.'
              : 'Completing locks the scores. The game can then be picked for Results. Nothing is deleted.'}
        </Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
          {totals.map(({ player, color, total, out }) => (
            <View key={player.id} style={[styles.row, { borderBottomColor: colors.hairline }]}>
              <SeatAvatar name={player.name} color={color} size={32} />
              <Text variant="bodyLarge" style={[styles.name, out && styles.struck]} numberOfLines={1}>{player.name}</Text>
              {pool && out ? <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>OUT</Text> : null}
              <Text variant="titleMedium" style={[tabularNums, { color: pool ? (out ? colors.onSurfaceVariant : colors.onSurface) : total > 0 ? colors.positive : total < 0 ? colors.negative : colors.onSurfaceVariant, fontWeight: '800' }]}>
                {pool ? String(total) : formatPoints(total)}
              </Text>
            </View>
          ))}
          <View style={styles.checkRow}>
            <Icon source={check.ok ? 'check-circle-outline' : 'alert-circle-outline'} size={18} color={check.ok ? colors.win : colors.error} />
            <Text variant="bodySmall" style={{ color: check.ok ? colors.onSurfaceVariant : colors.error, flex: 1 }}>{check.line}</Text>
          </View>
        </View>

        {admins.length > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]} testID="game-admins">
            <Text variant="titleSmall" style={styles.adminsTitle}>Game admins</Text>
            {admins.map((line) => (
              <View key={line.id} style={styles.adminRow}>
                <Icon source={line.role === 'Creator' ? 'crown-outline' : 'shield-account-outline'} size={18} color={colors.onSurfaceVariant} />
                <Text variant="bodyMedium" style={styles.name} numberOfLines={1}>{line.name}</Text>
                <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
                  {[line.badge, line.playing ? null : 'not playing'].filter(Boolean).join(' · ')}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {!done && blocked ? (
          <Text variant="bodyMedium" style={{ color: colors.error }}>{blocked}</Text>
        ) : null}

        {done && pool ? (
          <View style={styles.next}>
            {canScore ? (
              <Button mode="contained" icon="trophy-outline" onPress={() => router.push({ pathname: '/(screens)/games/award', params: { id: game.id } })} accessibilityLabel={game.awardedAt ? 'Change awards' : 'Give awards'} testID="complete-give-awards">
                {game.awardedAt ? 'Change awards' : 'Give awards'}
              </Button>
            ) : null}
            <Button mode="contained-tonal" icon="share-variant" onPress={() => router.push({ pathname: '/(screens)/games/final-scores', params: { id: game.id } })} accessibilityLabel="Share final scores">
              Share final scores
            </Button>
            <Button mode="outlined" icon="format-list-numbered" disabled={!game.awardedAt} onPress={() => router.push('/(screens)/results')} accessibilityLabel="Go to Results">
              {game.awardedAt ? 'Add to Results' : GIVE_AWARDS_FIRST}
            </Button>
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
              Complete, then Award, then Result: the pool joins a result once its awards are given.
            </Text>
          </View>
        ) : done ? (
          <View style={styles.next}>
            <Button mode="contained" icon="share-variant" onPress={() => router.push({ pathname: '/(screens)/games/final-scores', params: { id: game.id } })} accessibilityLabel="Share final scores">
              Share final scores
            </Button>
            <Button mode="contained-tonal" icon="trophy-outline" onPress={() => router.push('/(screens)/results')} accessibilityLabel="Go to Results">
              Add to Results
            </Button>
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
              Results combines completed games into one standings sheet and closes them.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <BottomBar>
        <Button mode="outlined" onPress={backToScorecard} disabled={completing} style={done ? styles.flex : styles.secondary}>
          {done ? 'Back to scorecard' : 'Not yet'}
        </Button>
        {!done ? (
          <Button
            mode="contained"
            icon="flag-checkered"
            onPress={() => setConfirmOpen(true)}
            disabled={Boolean(blocked) || completing}
            style={styles.flex}
            accessibilityLabel="Complete game"
          >
            Complete game
          </Button>
        ) : null}
      </BottomBar>

      <Portal>
        <Dialog visible={confirmOpen} onDismiss={() => completing || setConfirmOpen(false)} style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Dialog.Title>{pool ? 'Complete this pool?' : 'Complete this game?'}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
              {`${check.roundCount === 1 ? '1 round' : `${check.roundCount} rounds`} will be locked. ${pool ? 'Next you give the awards. ' : ''}You can reopen the ${pool ? 'pool' : 'game'} later from the scorecard menu until it is added to Results.`}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmOpen(false)} disabled={completing}>Cancel</Button>
            <Button mode="contained" onPress={complete} loading={completing} disabled={completing} accessibilityLabel="Confirm complete game">
              Complete
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={Boolean(failure)} onDismiss={() => setFailure(null)} style={[styles.dialog, { backgroundColor: colors.surface }]}>
          <Dialog.Icon icon="alert-circle-outline" />
          <Dialog.Title>Could not complete</Dialog.Title>
          <Dialog.Content><Text variant="bodyMedium">{failure}</Text></Dialog.Content>
          <Dialog.Actions><Button mode="contained" onPress={() => setFailure(null)}>Got it</Button></Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontWeight: '800' },
  adminsTitle: { fontWeight: '700', paddingTop: spacing.sm, paddingBottom: spacing.xs },
  adminRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { flex: 1 },
  struck: { textDecorationLine: 'line-through', opacity: 0.7 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  next: { gap: spacing.sm, marginTop: spacing.sm },
  dialog: { borderRadius: radius.xl },
  flex: { flex: 1 },
  // The shorter label gives the filled action the room it needs on a narrow phone.
  secondary: { flex: 0.8 },
});

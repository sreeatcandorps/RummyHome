import React, { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { radius, useAppTheme } from '@/constants/theme';
import { gamesService } from '@/services/games';
import { Game } from '@/types/game';
import { completionCheck, poolCompletionCheck } from '@/utils/completeGame';
import { formatSupabaseError } from '@/utils/supabaseErrors';
import { isPoolGame, playersIn, playersOut } from '@/utils/pool';
import { blockedDialogTitle, completeDialogBody } from '@/utils/endFlow';

/**
 * Complete is one dialog on the scorecard (Nov 18 end-flow review; back to the Oct 28 design):
 * the scorecard already shows the totals, so the page that repeated them is gone. A Points game
 * whose rounds do not add to 0 gets the "Fix round N first" dialog with an Edit round button
 * instead. Nothing here mentions Results: a finished game's next step is the Final screen (Points)
 * or the Awards page (Pool), and Done on those goes Home.
 */
type Props = {
  visible: boolean;
  game: Game;
  players: { id: string }[];
  onDismiss: () => void;
  /** Points: the first round that does not add to 0 opens in Add round. */
  onEditRound: (round: number) => void;
  /** The game as the server returned it; the caller moves on (Final screen or Awards). */
  onCompleted: (game: Game) => void;
};

export function CompleteGameDialog({ visible, game, players, onDismiss, onEditRound, onCompleted }: Props) {
  const { colors } = useAppTheme();
  const [completing, setCompleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const pool = isPoolGame(game);

  const check = useMemo(() => {
    if (pool) {
      const roundCount = Math.max(0, ...players.map((p) => (game.scores[p.id] ?? []).length));
      return poolCompletionCheck(roundCount, playersIn(game).length, playersOut(game).length);
    }
    return completionCheck(game.scores, players.map((p) => p.id));
  }, [game, players, pool]);

  const blocked = !pool && check.unbalancedRounds.length > 0;
  const body = completeDialogBody({ pool, roundCount: check.roundCount, inCount: playersIn(game).length, outCount: playersOut(game).length });

  const complete = async () => {
    if (completing || game.isComplete) return;
    setCompleting(true);
    try {
      const updated = await gamesService.completeGame(game.id);
      onDismiss();
      onCompleted(updated ?? { ...game, isComplete: true, completedAt: new Date().toISOString() });
    } catch (caught) {
      onDismiss();
      setFailure(formatSupabaseError(caught));
    } finally {
      setCompleting(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible && blocked} onDismiss={onDismiss} style={[styles.dialog, { backgroundColor: colors.surface }]}>
        <Dialog.Icon icon="alert-circle-outline" />
        <Dialog.Title style={styles.title}>{blockedDialogTitle(check.unbalancedRounds)}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }} testID="complete-blocked">{check.problem}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button mode="contained" icon="pencil-outline" onPress={() => { onDismiss(); onEditRound(check.unbalancedRounds[0]); }} accessibilityLabel={`Edit round ${check.unbalancedRounds[0]}`} testID="complete-edit-round">
            {`Edit round ${check.unbalancedRounds[0]}`}
          </Button>
        </Dialog.Actions>
      </Dialog>
      <Dialog visible={visible && !blocked} onDismiss={() => completing || onDismiss()} style={[styles.dialog, { backgroundColor: colors.surface }]}>
        <Dialog.Title>{pool ? 'Complete this pool?' : 'Complete this game?'}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }} testID="complete-body">{body}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={completing} testID="complete-cancel">Cancel</Button>
          <Button mode="contained" icon="flag-checkered" onPress={complete} loading={completing} disabled={completing} accessibilityLabel="Confirm complete game" testID="complete-confirm">
            Complete
          </Button>
        </Dialog.Actions>
      </Dialog>
      <Dialog visible={Boolean(failure)} onDismiss={() => setFailure(null)} style={[styles.dialog, { backgroundColor: colors.surface }]}>
        <Dialog.Icon icon="alert-circle-outline" />
        <Dialog.Title>Could not complete</Dialog.Title>
        <Dialog.Content><Text variant="bodyMedium">{failure}</Text></Dialog.Content>
        <Dialog.Actions><Button mode="contained" onPress={() => setFailure(null)}>OK</Button></Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: { borderRadius: radius.xl },
  title: { textAlign: 'center', fontWeight: '700' },
});

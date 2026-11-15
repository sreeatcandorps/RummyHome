import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';
import { Button } from '@/components/ui/AppButton';
import { SectionCard } from '@/components/ui/SectionCard';
import { Tag } from '@/components/ui/Tag';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { gameLabelOf } from '@/utils/gameLabel';
import { askButton, askedLine, DELETED_GAMES_SUPPORTING, DELETED_GAMES_TITLE, deletedCardLine, DeletedHomeGame, RESTORE_GAME_LABEL } from '@/utils/deletedGames';

type Props = {
  games: DeletedHomeGame[];
  viewerId?: string | null;
  busyId?: string | null;
  onOpen: (id: string) => void;
  onAsk: (game: DeletedHomeGame) => void;
  onRestore: (game: DeletedHomeGame) => void;
};

/**
 * Home › Deleted games (G03, migration 045): games deleted in the last 30 days that this person scored
 * in, greyed, with "Deleted by Harish · 2 days ago · hidden for good on Dec 14". A player gets "Ask an
 * admin to restore" (then "Asked · Nov 10"); the creator and admins get "Restore game". Tapping a card
 * opens the scorecard read-only. Hidden entirely when there is nothing to show.
 */
export function DeletedGamesCard({ games, viewerId, busyId, onOpen, onAsk, onRestore }: Props) {
  const { colors } = useAppTheme();
  if (games.length === 0) return null;
  return (
    <SectionCard
      title={`${DELETED_GAMES_TITLE} · ${games.length}`}
      icon="delete-clock-outline"
      supportingText={DELETED_GAMES_SUPPORTING}
      style={{ backgroundColor: colors.surfaceVariant }}
    >
      <View testID="home-deleted-games">
        {games.map((game) => {
          const label = gameLabelOf({ gameLabel: game.gameLabel, gameNumber: game.gameNumber, gameType: game.gameType as 'stake' | 'pool' });
          const asked = askedLine(game.deletion.requests, viewerId);
          const ask = askButton(game.deletion.myRequestAt);
          const busy = busyId === game.id;
          return (
            <TouchableRipple
              key={game.id}
              onPress={() => onOpen(game.id)}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
              accessibilityRole="button"
              accessibilityLabel={`Deleted game ${label ?? ''}, open read-only`}
              testID={`deleted-game-${game.id}`}
            >
              <View style={styles.inner}>
                <View style={styles.titleRow}>
                  <Text variant="titleMedium" style={[styles.title, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                    {label ? `Game ${label}` : 'Game'} · {game.playerCount} players
                  </Text>
                  <Tag label="Deleted" tone="danger" icon="delete-outline" />
                </View>
                <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>{deletedCardLine(game.deletion)}</Text>
                {asked ? <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant, fontWeight: '700' }}>{asked}</Text> : null}
                <View style={styles.actions}>
                  {game.deletion.canRestore ? (
                    <Button compact mode="outlined" icon="restore" onPress={() => onRestore(game)} loading={busy} disabled={busyId !== null && busyId !== undefined} testID={`deleted-game-restore-${game.id}`}>
                      {RESTORE_GAME_LABEL}
                    </Button>
                  ) : (
                    <Button compact mode="outlined" icon={ask.disabled ? 'check' : 'hand-wave-outline'} onPress={() => onAsk(game)} loading={busy} disabled={ask.disabled || (busyId !== null && busyId !== undefined)} testID={`deleted-game-ask-${game.id}`}>
                      {ask.label}
                    </Button>
                  )}
                </View>
              </View>
            </TouchableRipple>
          );
        })}
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginBottom: spacing.sm },
  inner: { padding: spacing.md, gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.xs },
});

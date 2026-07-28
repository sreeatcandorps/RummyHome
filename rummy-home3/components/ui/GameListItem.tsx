import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { Game } from '@/types/game';
import { radius, spacing } from '@/constants/theme';
import { formatGameDateTime, gameIdLabel, gameTypeLabel, gameTypeTint } from '@/utils/gameDisplay';

type GameListItemProps = {
  game: Game;
  onPress: () => void;
};

export function GameListItem({ game, onPress }: GameListItemProps) {
  const theme = useTheme();
  const isComplete = game.isComplete;
  const tint = gameTypeTint(game.gameType);

  const dateLabel = formatGameDateTime(game.date);

  return (
    <Card mode="outlined" style={styles.card}>
      <TouchableRipple
        onPress={onPress}
        borderless
        style={styles.ripple}
        accessibilityRole="button"
        accessibilityLabel={`${dateLabel}, ${isComplete ? 'completed' : 'active'}`}
      >
        <View style={styles.row}>
          <View style={[styles.accent, { backgroundColor: tint.accent }]} />

          <View style={styles.body}>
            <Text variant="titleMedium" style={styles.title} numberOfLines={1}>
              {dateLabel}
            </Text>

            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Game ID {gameIdLabel(game)}
            </Text>

            <View style={styles.metaRow}>
              <View style={[styles.typeBadge, { backgroundColor: tint.container }]}>
                <Text variant="labelSmall" style={[styles.typeBadgeText, { color: tint.on }]}>
                  {gameTypeLabel(game.gameType)}
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: isComplete
                      ? theme.colors.surfaceVariant
                      : theme.colors.primaryContainer,
                  },
                ]}
              >
                <Text
                  variant="labelSmall"
                  style={{
                    color: isComplete
                      ? theme.colors.onSurfaceVariant
                      : theme.colors.onPrimaryContainer,
                  }}
                >
                  {isComplete ? 'Completed' : 'Active'}
                </Text>
              </View>

              <View style={styles.playersMeta}>
                <Icon source="account-group-outline" size={14} color={theme.colors.onSurfaceVariant} />
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {game.players?.length ?? 0}
                </Text>
              </View>
            </View>
          </View>

          <Icon source="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
        </View>
      </TouchableRipple>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  ripple: {
    borderRadius: radius.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.md,
    minHeight: 92,
  },
  accent: {
    width: 4,
    alignSelf: 'stretch',
  },
  body: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  title: {
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  typeBadgeText: {
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  playersMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});

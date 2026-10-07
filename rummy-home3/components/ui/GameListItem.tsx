import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple } from 'react-native-paper';
import { Game } from '@/types/game';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { formatGameDateTime, gameIdLabel, gameTypeLabel, gameTypeTint } from '@/utils/gameDisplay';
import { Tag } from '@/components/ui/Tag';

type GameListItemProps = {
  game: Game;
  onPress: () => void;
};

export function GameListItem({ game, onPress }: GameListItemProps) {
  const theme = useAppTheme();
  const isComplete = game.isComplete;
  const tint = gameTypeTint(game.gameType, theme.gameTypes);
  const dateLabel = formatGameDateTime(game.date);
  const playerCount = game.players?.length ?? 0;

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
      <TouchableRipple
        onPress={onPress}
        borderless
        style={styles.ripple}
        accessibilityRole="button"
        accessibilityLabel={`${gameTypeLabel(game.gameType)} game, ${dateLabel}, ${isComplete ? 'completed' : 'active'}`}
      >
        <View style={styles.row}>
          <View style={[styles.typeIcon, { backgroundColor: tint.container }]}>
            <Icon source={game.gameType === 'pool' ? 'trophy-outline' : 'cash-multiple'} size={22} color={tint.on} />
          </View>

          <View style={styles.body}>
            <Text variant="titleMedium" style={styles.title} numberOfLines={1}>
              {dateLabel}
            </Text>
            <View style={styles.metaRow}>
              <Tag
                label={isComplete ? 'Completed' : 'Active'}
                tone={isComplete ? 'neutral' : 'positive'}
                icon={isComplete ? 'flag-checkered' : 'circle-medium'}
                style={styles.statusTag}
              />
              <Text
                variant="bodySmall"
                style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}
                numberOfLines={1}
              >
                {gameTypeLabel(game.gameType)} · ID {gameIdLabel(game)}
              </Text>
              <View style={styles.playersMeta}>
                <Icon source="account-multiple-outline" size={14} color={theme.colors.onSurfaceVariant} />
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {playerCount}
                </Text>
              </View>
            </View>
          </View>

          <Icon source="chevron-right" size={22} color={theme.colors.onSurfaceVariant} />
        </View>
      </TouchableRipple>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  ripple: {
    borderRadius: radius.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    minHeight: 76,
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  title: {
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusTag: {
    flexShrink: 0,
  },
  metaText: {
    flexShrink: 1,
  },
  playersMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});

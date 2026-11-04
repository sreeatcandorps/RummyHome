import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple } from 'react-native-paper';
import { Game } from '@/types/game';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { formatGameDateTime, gameNumberLabel, gameStatusLabel, gameTypeLabel, gameTypeTint } from '@/utils/gameDisplay';
import { Tag } from '@/components/ui/Tag';

type GameListItemProps = {
  game: Game;
  onPress: () => void;
  selected?: boolean;
};

export function GameListItem({ game, onPress, selected = false }: GameListItemProps) {
  const theme = useAppTheme();
  const tint = gameTypeTint(game.gameType, theme.gameTypes);
  const dateLabel = formatGameDateTime(game.date);
  const playerCount = game.players?.length ?? 0;
  const gNumber = gameNumberLabel(game);
  const status = gameStatusLabel(game);
  const statusTone = status === 'Active' ? 'positive' : 'neutral';
  const statusIcon = status === 'Active' ? 'circle-medium' : 'flag-checkered';

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
      <TouchableRipple
        onPress={onPress}
        borderless
        style={styles.ripple}
        accessibilityRole="button"
        accessibilityLabel={`${gameTypeLabel(game.gameType)} game${gNumber ? ` ${gNumber}` : ''}, ${dateLabel}, ${status.toLowerCase()}`}
      >
        <View style={styles.row}>
          {gNumber ? (
            <View style={[styles.numberBadge, { backgroundColor: selected ? theme.colors.primary : tint.container }]}>
              <Text style={[styles.numberText, { color: selected ? theme.colors.onPrimary : tint.on }]}>
                {gNumber}
              </Text>
            </View>
          ) : (
            <View style={[styles.typeIcon, { backgroundColor: selected ? theme.colors.primary : tint.container }]}>
              <Icon
                source={selected ? 'check' : game.gameType === 'pool' ? 'trophy-outline' : 'numeric'}
                size={22}
                color={selected ? theme.colors.onPrimary : tint.on}
              />
            </View>
          )}

          <View style={styles.body}>
            <Text variant="titleMedium" style={styles.title} numberOfLines={1}>
              {dateLabel}
            </Text>
            <View style={styles.metaRow}>
              <Tag
                label={status}
                tone={statusTone}
                icon={statusIcon}
                style={styles.statusTag}
              />
              <Text
                variant="bodySmall"
                style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}
                numberOfLines={1}
              >
                {gameTypeLabel(game.gameType)}
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
  numberBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.5,
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

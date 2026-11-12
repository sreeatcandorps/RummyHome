import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple } from 'react-native-paper';
import { Game } from '@/types/game';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { formatGameDateTime, gameNumberLabel, gameStatusLabel, gameTypeLabel, gameTypeTint, GAME_STATUS_ICON, GAME_STATUS_TONE } from '@/utils/gameDisplay';
import { Tag } from '@/components/ui/Tag';
import { ACCESS_ICON, ACCESS_TONE, gameAccessLabel, viewerManagesGame, visibleRoleTag } from '@/utils/gameAccess';

type GameListItemProps = {
  game: Game;
  onPress: () => void;
  selected?: boolean;
  /** When given, the card says what the game is to this person: Creator, Admin, Player or View only. */
  viewerId?: string | null;
  /** Results picker: a checkbox on the right instead of the chevron. */
  checked?: boolean;
  /** Results picker: listed but not pickable (the person is not an admin). Tapping still fires onPress so the screen can explain. */
  locked?: boolean;
};

export function GameListItem({ game, onPress, selected = false, viewerId, checked, locked = false }: GameListItemProps) {
  const theme = useAppTheme();
  const tint = gameTypeTint(game.gameType, theme.gameTypes);
  const dateLabel = formatGameDateTime(game.date);
  const playerCount = game.players?.length ?? 0;
  const gNumber = gameNumberLabel(game);
  const status = gameStatusLabel(game);
  const statusTone = GAME_STATUS_TONE[status];
  const statusIcon = GAME_STATUS_ICON[status];
  const access = viewerId ? gameAccessLabel(game, viewerId) : null;
  const roleTag = visibleRoleTag(access, viewerManagesGame(game, viewerId));
  const pickable = checked !== undefined;
  const on = pickable && checked && !locked;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: on ? theme.colors.primaryContainer : theme.colors.surface, borderColor: on ? theme.colors.primary : theme.colors.outlineVariant },
        locked && styles.locked,
      ]}
    >
      <TouchableRipple
        onPress={onPress}
        borderless
        style={styles.ripple}
        accessibilityRole={pickable ? 'checkbox' : 'button'}
        accessibilityState={pickable ? { checked: Boolean(on), disabled: locked } : undefined}
        accessibilityLabel={`${gameTypeLabel(game.gameType)} game${gNumber ? ` ${gNumber}` : ''}, ${dateLabel}, ${status.toLowerCase()}${access ? `, ${access.toLowerCase()}` : ''}${locked ? ', not an admin' : ''}`}
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
              {roleTag ? <Tag label={roleTag} tone={ACCESS_TONE[roleTag]} icon={ACCESS_ICON[roleTag]} /> : null}
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

          {locked ? (
            <Icon source="lock-outline" size={22} color={theme.colors.onSurfaceVariant} />
          ) : pickable ? (
            <Icon source={on ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} color={on ? theme.colors.primary : theme.colors.onSurfaceVariant} />
          ) : (
            <Icon source="chevron-right" size={22} color={theme.colors.onSurfaceVariant} />
          )}
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
  locked: { opacity: 0.6 },
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
    flexWrap: 'wrap',
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

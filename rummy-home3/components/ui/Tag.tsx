import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { radius, spacing, useAppTheme } from '@/constants/theme';

export type TagTone = 'neutral' | 'primary' | 'positive' | 'leader' | 'danger' | 'stake' | 'pool';

type TagProps = {
  label: string;
  tone?: TagTone;
  icon?: string;
  style?: ViewStyle;
};

/** Small rounded label for game type, status and metadata. */
export function Tag({ label, tone = 'neutral', icon, style }: TagProps) {
  const theme = useAppTheme();
  const { colors, gameTypes } = theme;

  const palette: Record<TagTone, { bg: string; fg: string }> = {
    neutral: { bg: colors.surfaceVariant, fg: colors.onSurfaceVariant },
    primary: { bg: colors.primaryContainer, fg: colors.onPrimaryContainer },
    positive: { bg: colors.positiveContainer, fg: colors.onPositiveContainer },
    leader: { bg: colors.leaderContainer, fg: colors.onLeaderContainer },
    danger: { bg: colors.errorContainer, fg: colors.onErrorContainer },
    stake: { bg: gameTypes.stake.container, fg: gameTypes.stake.on },
    pool: { bg: gameTypes.pool.container, fg: gameTypes.pool.on },
  };
  const { bg, fg } = palette[tone];

  return (
    <View style={[styles.tag, { backgroundColor: bg }, style]}>
      {icon ? <Icon source={icon} size={13} color={fg} /> : null}
      <Text variant="labelMedium" numberOfLines={1} style={[styles.label, { color: fg }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    flexShrink: 1,
  },
  label: {
    fontWeight: '700',
    flexShrink: 1,
  },
});

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple } from 'react-native-paper';
import { MIN_TOUCH_TARGET, radius, spacing, useAppTheme } from '@/constants/theme';

type ListRowProps = {
  title: string;
  description?: string;
  icon?: string;
  /** Replaces the icon slot, e.g. an avatar. */
  left?: React.ReactNode;
  /** Replaces the default chevron, e.g. a switch. */
  right?: React.ReactNode;
  onPress?: () => void;
  tone?: 'default' | 'danger';
  accessibilityLabel?: string;
};

/** Full-width tappable row used in settings, profile and other grouped lists. */
export function ListRow({ title, description, icon, left, right, onPress, tone = 'default', accessibilityLabel }: ListRowProps) {
  const theme = useAppTheme();
  const danger = tone === 'danger';
  const iconColor = danger ? theme.colors.error : theme.colors.onSurfaceVariant;

  const content = (
    <View style={styles.row}>
      {left ??
        (icon ? (
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: danger ? theme.colors.errorContainer : theme.colors.surfaceVariant },
            ]}
          >
            <Icon source={icon} size={20} color={iconColor} />
          </View>
        ) : null)}
      <View style={styles.text}>
        <Text variant="bodyLarge" style={[styles.title, danger && { color: theme.colors.error }]} numberOfLines={1}>
          {title}
        </Text>
        {description ? (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon source="chevron-right" size={22} color={theme.colors.onSurfaceVariant} /> : null)}
    </View>
  );

  if (!onPress) return content;

  return (
    <TouchableRipple
      onPress={onPress}
      borderless
      style={styles.ripple}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      {content}
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  ripple: {
    borderRadius: radius.md,
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH_TARGET + spacing.md,
    paddingVertical: spacing.xs,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontWeight: '500',
  },
});

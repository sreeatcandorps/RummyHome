import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { radius, useAppTheme } from '@/constants/theme';

export const nameInitials = (name: string) =>
  (name || '?')
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 2) || '?';

type SeatAvatarProps = {
  name: string;
  /** Overrides the computed initials, e.g. the scoreboard's de-duplicated labels. */
  label?: string;
  color?: string;
  size?: number;
  icon?: string;
  /** Muted treatment, e.g. an unselected player. */
  muted?: boolean;
  style?: ViewStyle;
};

export function SeatAvatar({ name, label, color, size = 40, icon, muted, style }: SeatAvatarProps) {
  const theme = useAppTheme();
  const background = muted ? theme.colors.surfaceVariant : color ?? theme.colors.primary;
  const foreground = muted ? theme.colors.onSurfaceVariant : '#FFFFFF';
  const text = label ?? nameInitials(name);
  const fontSize = Math.round(size * (text.length > 2 ? 0.32 : 0.4));

  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: radius.full, backgroundColor: background },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {icon ? (
        <Icon source={icon} size={Math.round(size * 0.5)} color={foreground} />
      ) : (
        <Text style={[styles.text, { color: foreground, fontSize, lineHeight: fontSize * 1.2 }]} numberOfLines={1}>
          {text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

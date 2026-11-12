import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { BUTTON_EDGE } from '@/components/ui/AppButton';

type Props = {
  icon: string;
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'tonal' | 'outlined';
  /** Small count shown on the icon, e.g. unregistered players waiting. */
  badge?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/**
 * A square-ish button with the icon above a two-line label, so three actions
 * fit side by side on a phone where three full-width buttons would stack.
 */
export function ActionTile({ icon, label, onPress, tone = 'tonal', badge, disabled, accessibilityLabel }: Props) {
  const { colors } = useAppTheme();
  const palette = tone === 'primary'
    ? { bg: colors.primary, fg: colors.onPrimary, border: colors.primary, edge: colors.primaryEdge }
    : tone === 'tonal'
      ? { bg: colors.primaryContainer, fg: colors.onPrimaryContainer, border: colors.primaryContainer, edge: colors.primaryContainer }
      : { bg: colors.surface, fg: colors.primary, border: colors.outline, edge: colors.outline };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: palette.bg, borderColor: palette.border, borderBottomColor: palette.edge, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        tone === 'primary' && !disabled && styles.edged,
      ]}
    >
      <View>
        <Icon source={icon} size={26} color={palette.fg} />
        {badge ? (
          <View style={[styles.badge, { backgroundColor: colors.error }]}>
            <Text variant="labelSmall" style={[styles.badgeText, { color: colors.onError }]}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text variant="labelLarge" numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.label, { color: palette.fg }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 84,
    borderWidth: 2,
    borderRadius: radius.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  edged: { borderBottomWidth: BUTTON_EDGE },
  label: { textAlign: 'center', fontWeight: '800', fontSize: 15, lineHeight: 18 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontWeight: '800', fontSize: 11, lineHeight: 13 },
});

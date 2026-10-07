import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { MAX_CONTENT_WIDTH, spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';

type BottomBarProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Let the bar's content span the full width instead of the reading column. */
  fullWidth?: boolean;
};

/** Sticky action bar that clears the gesture / navigation bar. */
export function BottomBar({ children, style, fullWidth }: BottomBarProps) {
  const theme = useAppTheme();
  const { insets, gutterLeft, gutterRight, isShort } = useLayout();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant,
          paddingLeft: gutterLeft,
          paddingRight: gutterRight,
          paddingTop: isShort ? spacing.sm : spacing.md,
          paddingBottom: insets.bottom + (isShort ? spacing.sm : spacing.md),
        },
      ]}
    >
      <View style={[styles.inner, !fullWidth && styles.column, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  column: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
});

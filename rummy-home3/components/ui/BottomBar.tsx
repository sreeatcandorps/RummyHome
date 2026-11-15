import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { MAX_CONTENT_WIDTH, spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';

type BottomBarProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Let the bar's content span the full width instead of the reading column. */
  fullWidth?: boolean;
  /** Tab screens: the tab bar already clears the gesture bar, so the action bar needs no inset of its own. */
  insetBottom?: boolean;
  testID?: string;
};

/** Sticky action bar that clears the gesture / navigation bar. */
export function BottomBar({ children, style, fullWidth, insetBottom = true, testID }: BottomBarProps) {
  const theme = useAppTheme();
  const { insets, gutterLeft, gutterRight, isShort } = useLayout();

  return (
    <View
      testID={testID}
      style={[
        styles.bar,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant,
          paddingLeft: gutterLeft,
          paddingRight: gutterRight,
          paddingTop: isShort ? spacing.sm : spacing.md,
          paddingBottom: (insetBottom ? insets.bottom : 0) + (isShort ? spacing.sm : spacing.md),
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
    gap: spacing.sm,
  },
  column: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
});

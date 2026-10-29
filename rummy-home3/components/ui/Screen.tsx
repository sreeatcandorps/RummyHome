import React from 'react';
import { RefreshControlProps, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { MAX_CONTENT_WIDTH, spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';

type ScreenProps = {
  children: React.ReactNode;
  scrollable?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentStyle?: ViewStyle;
  /** Pad for the gesture/nav bar. Off for tab screens, whose tab bar already does. */
  safeBottom?: boolean;
  /** Let content use the full width instead of the centred reading column. */
  fullWidth?: boolean;
};

/** Consistent page padding, safe areas and background across screens. */
export function Screen({
  children,
  scrollable = true,
  refreshControl,
  contentStyle,
  safeBottom = true,
  fullWidth = false,
}: ScreenProps) {
  const theme = useAppTheme();
  const { insets, gutterLeft, gutterRight, isShort } = useLayout();

  const padding: ViewStyle = {
    paddingLeft: gutterLeft,
    paddingRight: gutterRight,
    paddingTop: isShort ? spacing.md : spacing.lg,
    paddingBottom: (safeBottom ? insets.bottom : 0) + spacing.xxl,
  };

  const column: ViewStyle = fullWidth ? styles.fill : styles.column;

  if (!scrollable) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.background }, padding]}>
        <View style={[column, styles.gap, styles.flex, contentStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={padding}
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[column, styles.gap, contentStyle]}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  column: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  fill: {
    width: '100%',
  },
  gap: {
    gap: spacing.lg,
  },
});

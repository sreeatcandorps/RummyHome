import React from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, spacing, useAppTheme } from '@/constants/theme';

/** Three placeholder rows. Used instead of a spinner that covers the screen. */
export function LoadingRows() {
  const { colors } = useAppTheme();
  return (
    <View accessibilityLabel="Loading">
      {[0, 1, 2].map((row) => (
        <View
          key={row}
          style={[styles.row, { backgroundColor: colors.surfaceVariant }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 64,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    opacity: 0.7,
  },
});

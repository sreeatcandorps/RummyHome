import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useAppTheme } from '@/constants/theme';
import { FIT_MIN_FONT_SCALE } from '@/utils/fitText';

type HeaderTitleProps = { children?: string; tintColor?: string };

/**
 * Every stack header's title (`app/(screens)/_layout.tsx`): always the full title ("Scorecard · P2",
 * "Players · Admins · S3"), on one line, shrinking a little where it would not fit beside the header's buttons
 * instead of losing its end (Q64: one layout for every phone, no size switches).
 */
export function HeaderTitle({ children, tintColor }: HeaderTitleProps) {
  const { colors } = useAppTheme();
  return (
    <Text
      accessibilityRole="header"
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={FIT_MIN_FONT_SCALE}
      style={[styles.title, { color: tintColor ?? colors.onSurface }]}
      testID="header-title"
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '700' },
});

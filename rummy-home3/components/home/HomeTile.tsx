import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { FIT_MIN_FONT_SCALE } from '@/utils/fitText';

type HomeTileProps = {
  icon: string;
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
};

/**
 * Home's Results / My players pills. Paper's Button pins its label to one line and cannot shrink it, so the tile
 * draws its own: the full label on every phone, shrinking a little where it would not fit (Q64: one layout, no
 * size switches).
 */
export function HomeTile({ icon, label, onPress, accessibilityLabel, testID }: HomeTileProps) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [styles.tile, { backgroundColor: colors.secondaryContainer, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.content}>
        <Icon source={icon} size={18} color={colors.onSecondaryContainer} />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={FIT_MIN_FONT_SCALE}
          style={[styles.label, { color: colors.onSecondaryContainer }]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: radius.full, overflow: 'hidden', minHeight: 56, justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  label: { flexShrink: 1, fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: 0.2 },
});

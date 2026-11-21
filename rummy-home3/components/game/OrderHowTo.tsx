import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { spacing, useAppTheme } from '@/constants/theme';
import { ORDER_ONE_LINE, SHOW_ME } from '@/utils/tutorials';

/**
 * The how-to under "Order of players", shrunk to one line plus **Show me** (D61, Sree Nov 20): the
 * step-by-step sheet carries the teaching now, so the rows start higher — twenty of them need the
 * room. `onShowMe` opens the tutorial again (never forced).
 */
export function OrderHowTo({ onShowMe, testID }: { onShowMe: () => void; testID: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.root} testID={testID}>
      <Text variant="bodyMedium" style={[styles.line, { color: colors.onSurface }]} testID={`${testID}-line`}>{ORDER_ONE_LINE}</Text>
      <Pressable onPress={onShowMe} hitSlop={8} style={styles.showMe} accessibilityRole="button" accessibilityLabel={`${SHOW_ME}: how to seat the table`} testID={`${testID}-show-me`}>
        <Icon source="play-circle-outline" size={18} color={colors.primary} />
        <Text variant="labelLarge" style={{ color: colors.primary }}>{SHOW_ME}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.xs },
  line: { flex: 1 },
  showMe: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, minHeight: 32 },
});

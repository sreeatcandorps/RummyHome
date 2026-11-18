import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { openHelp } from '@/components/help/HelpPage';
import { HELP_WHY } from '@/constants/helpTopics';
import { MIN_TOUCH_TARGET, spacing, useAppTheme } from '@/constants/theme';

export const WHY_LABEL = 'Why?';

/**
 * "Why?" under a dialog that puzzles people (Q11.6): opens the matching Tricky case on the help
 * page. `before` lets the dialog close first so Back from the help page lands on the screen.
 */
export function WhyLink({ why, before, testID }: { why: keyof typeof HELP_WHY; before?: () => void; testID?: string }) {
  const { colors } = useAppTheme();
  const target = HELP_WHY[why];
  return (
    <Pressable
      onPress={() => { before?.(); openHelp(target.topic, target.anchor); }}
      style={styles.link}
      hitSlop={8}
      accessibilityRole="link"
      accessibilityLabel={`${WHY_LABEL} Opens help`}
      testID={testID ?? `why-${why}`}
    >
      <Text variant="labelLarge" style={{ color: colors.primary, textDecorationLine: 'underline' }}>{WHY_LABEL}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'center', minHeight: MIN_TOUCH_TARGET - 12, justifyContent: 'center', paddingHorizontal: spacing.sm, marginTop: spacing.xs },
});

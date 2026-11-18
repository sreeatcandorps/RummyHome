import React from 'react';
import { IconButton } from 'react-native-paper';
import { openHelp } from '@/components/help/HelpPage';
import { HelpTopicKey } from '@/constants/helpTopics';
import { useAppTheme } from '@/constants/theme';

type HelpButtonProps = {
  /** The screen's help page (constants/helpTopics.ts). */
  topic: HelpTopicKey;
  /** A section slug or Tricky-case id to scroll to. */
  anchor?: string;
  color?: string;
  testID?: string;
};

/** The ? in every header: same icon, same place, opens the screen's help page (PR 11, Q11.2). */
export function HelpButton({ topic, anchor, color, testID = 'help-button' }: HelpButtonProps) {
  const { colors } = useAppTheme();
  return (
    <IconButton
      icon="help-circle-outline"
      size={22}
      iconColor={color ?? colors.onSurface}
      onPress={() => openHelp(topic, anchor)}
      accessibilityLabel="Help"
      testID={testID}
    />
  );
}

import React from 'react';
import { StyleProp, TextStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { nameSegments } from '@/utils/boldName';

type Props = {
  name: string;
  /** Text after the name in the same line, e.g. " (you)". Not bolded. */
  suffix?: string;
  variant?: React.ComponentProps<typeof Text>['variant'];
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  color?: string;
};

/** A player's name with the first and last initials in bold. Replaces the avatar circle in lists. */
export function BoldName({ name, suffix, variant = 'titleSmall', numberOfLines = 2, style, color }: Props) {
  return (
    <Text variant={variant} numberOfLines={numberOfLines} style={[color ? { color } : null, style]}>
      {nameSegments(name).map((segment, index) => (
        <Text key={index} variant={variant} style={[color ? { color } : null, segment.bold ? styles.bold : styles.regular]}>
          {segment.text}
        </Text>
      ))}
      {suffix ? <Text variant={variant} style={[color ? { color } : null, styles.regular]}>{suffix}</Text> : null}
    </Text>
  );
}

const styles = { bold: { fontWeight: '900' as const }, regular: { fontWeight: '400' as const } };

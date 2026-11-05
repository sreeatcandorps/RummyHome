import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { spacing } from '@/constants/theme';

/** Help copy is one bullet per line. Render each with a hanging indent. */
export function HelpText({ text, color }: { text: string; color?: string }) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  return (
    <View style={styles.list}>
      {lines.map((line, index) => {
        const isBullet = line.startsWith('•');
        const body = isBullet ? line.slice(1).trim() : line;
        return (
          <View key={index} style={styles.row}>
            {isBullet ? <Text variant="bodyMedium" style={[styles.dot, color ? { color } : null]}>•</Text> : null}
            <Text variant="bodyMedium" style={[styles.body, color ? { color } : null]}>{body}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  dot: { width: 12, lineHeight: 20 },
  body: { flex: 1, lineHeight: 20 },
});

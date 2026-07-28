import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { radius, spacing } from '@/constants/theme';

type SectionCardProps = {
  title?: string;
  supportingText?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
  /** Use `outlined` for secondary/informational groupings. */
  mode?: 'elevated' | 'outlined';
};

export function SectionCard({
  title,
  supportingText,
  children,
  style,
  mode = 'elevated',
}: SectionCardProps) {
  const theme = useTheme();

  return (
    <Card mode={mode} style={[styles.card, style]}>
      <Card.Content style={styles.content}>
        {title ? (
          <View style={styles.header}>
            <Text variant="titleMedium" style={styles.title}>
              {title}
            </Text>
            {supportingText ? (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {supportingText}
              </Text>
            ) : null}
          </View>
        ) : null}
        {children}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
  },
  content: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    fontWeight: '600',
  },
});

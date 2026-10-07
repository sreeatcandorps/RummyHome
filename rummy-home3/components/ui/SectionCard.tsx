import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { radius, spacing, useAppTheme } from '@/constants/theme';

type SectionCardProps = {
  title?: string;
  supportingText?: string;
  icon?: string;
  /** Rendered at the right of the title row, e.g. a text button. */
  right?: React.ReactNode;
  children?: React.ReactNode;
  style?: ViewStyle;
  /** `outlined` is a quieter treatment for secondary/informational groupings. */
  mode?: 'elevated' | 'outlined';
};

export function SectionCard({
  title,
  supportingText,
  icon,
  right,
  children,
  style,
  mode = 'elevated',
}: SectionCardProps) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: mode === 'outlined' ? 'transparent' : theme.colors.surface,
          borderColor: theme.colors.outlineVariant,
        },
        style,
      ]}
    >
      {title ? (
        <View style={styles.header}>
          {icon ? (
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.primaryContainer }]}>
              <Icon source={icon} size={18} color={theme.colors.onPrimaryContainer} />
            </View>
          ) : null}
          <View style={styles.headerText}>
            <Text variant="titleMedium" style={styles.title}>
              {title}
            </Text>
            {supportingText ? (
              <Text variant="bodySmall" style={[styles.supporting, { color: theme.colors.onSurfaceVariant }]}>
                {supportingText}
              </Text>
            ) : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontWeight: '700',
  },
  supporting: {
    lineHeight: 18,
  },
});

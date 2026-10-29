import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';
import { MIN_TOUCH_TARGET, radius, spacing, useAppTheme } from '@/constants/theme';

type EmptyStateProps = {
  icon?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon = 'cards-playing-outline', title, message, actionLabel, onAction }: EmptyStateProps) {
  const theme = useAppTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Icon source={icon} size={32} color={theme.colors.onSurfaceVariant} />
      </View>
      <Text variant="titleMedium" style={styles.title}>
        {title}
      </Text>
      {message ? (
        <Text variant="bodyMedium" style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          mode="contained"
          onPress={onAction}
          style={styles.action}
          contentStyle={styles.actionContent}
          labelStyle={styles.actionLabel}
        >
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    textAlign: 'center',
    fontWeight: '700',
  },
  message: {
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 340,
  },
  action: {
    marginTop: spacing.md,
    borderRadius: radius.full,
  },
  actionContent: {
    height: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
});

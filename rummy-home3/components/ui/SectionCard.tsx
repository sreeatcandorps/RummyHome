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
  /**
   * `top` draws only the card's head (title row, open at the bottom) so a virtualised
   * list can draw the rows (SectionCardRows) and the closing edge (SectionCardEnd) itself.
   * Together the three pieces look exactly like one card.
   */
  part?: 'whole' | 'top';
};

export function SectionCard({
  title,
  supportingText,
  icon,
  right,
  children,
  style,
  mode = 'elevated',
  part = 'whole',
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
        part === 'top' && styles.top,
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

/** One row's worth of a split card: the side edges around the content. */
export function SectionCardRows({ children }: { children?: React.ReactNode }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.rows, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
      {children}
    </View>
  );
}

/** The closing edge of a split card. */
export function SectionCardEnd() {
  const theme = useAppTheme();
  return <View style={[styles.end, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]} />;
}

const BORDER = StyleSheet.hairlineWidth * 2;

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: BORDER,
    padding: spacing.lg,
    gap: spacing.md,
  },
  // The whole card is header, then (gap md, child) per child, then padding lg: the
  // pieces below add up to the same.
  top: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: 0,
  },
  rows: {
    borderLeftWidth: BORDER,
    borderRightWidth: BORDER,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  end: {
    borderLeftWidth: BORDER,
    borderRightWidth: BORDER,
    borderBottomWidth: BORDER,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    height: spacing.lg + BORDER,
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

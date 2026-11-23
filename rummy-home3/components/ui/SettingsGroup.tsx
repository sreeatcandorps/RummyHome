import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { InfoTip, InfoTipProps } from '@/components/ui/InfoTip';
import { spacing, useAppTheme } from '@/constants/theme';

type SettingsGroupProps = {
  /** Small-caps heading above the rows; omit for an unheaded group. */
  title?: string;
  /** The one ⓘ a group may have (design-review-2 B03/B16): hints live here, not under every control. */
  tip?: Omit<InfoTipProps, 'title'> & { title?: string };
  /** One grey line under the heading, e.g. "For this game only — prefilled from your defaults." */
  note?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
};

/**
 * Size-S grouped list (design-review-2 §5, D66–D69): a heading, the rows, hairlines between them,
 * no card, no icon square. Children are the rows; each child after the first gets a hairline above.
 */
export function SettingsGroup({ title, tip, note, children, style, testID }: SettingsGroupProps) {
  const { colors } = useAppTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.group, style]} testID={testID}>
      {title ? (
        <View style={styles.heading}>
          <Text variant="labelSmall" style={[styles.title, { color: colors.onSurfaceVariant }]} accessibilityRole="header">
            {title.toUpperCase()}
          </Text>
          {tip ? <InfoTip {...tip} title={tip.title ?? title} /> : null}
        </View>
      ) : null}
      {note ? <Text variant="bodySmall" style={[styles.note, { color: colors.onSurfaceVariant }]}>{note}</Text> : null}
      {rows.map((row, index) => (
        <View key={index} style={index > 0 ? [styles.hairline, { borderTopColor: colors.hairline }] : undefined}>
          {row}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: spacing.md },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  title: { letterSpacing: 0.8 },
  note: { paddingBottom: spacing.xs },
  hairline: { borderTopWidth: StyleSheet.hairlineWidth },
});

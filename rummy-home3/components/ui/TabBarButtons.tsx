import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Icon } from 'react-native-paper';
import { BUTTON_EDGE } from '@/components/ui/AppButton';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { radius, seatColor, spacing, useAppTheme } from '@/constants/theme';

export type TabPillItem =
  | { kind: 'icon'; icon: string; label: string }
  | { kind: 'avatar'; name: string; label: string };

type Props = BottomTabBarProps & {
  /** What each route shows, by route name. Routes missing here fall back to a circle with their title as the spoken label. */
  items: Record<string, TabPillItem | undefined>;
  /** Shorter buttons on short phones in landscape. */
  compact?: boolean;
};

export const TAB_PILL_HEIGHT = 52;
export const TAB_PILL_HEIGHT_COMPACT = 42;
export const TAB_ICON_SIZE = 26;
export const TAB_ICON_SIZE_COMPACT = 22;

/**
 * Bottom bar (final launch batch, design item 10): three buttons of the same size, icons only.
 * Each is a pill button like every other button in the app — the current one filled button
 * green with its pressable edge, the others outlined — so they read as tappable at a glance.
 * The profile button holds the account's initials as a plain circle (no ring, no badge).
 * Labels are spoken, not drawn: the header title names the page.
 */
export function PillTabBar({ state, descriptors, navigation, insets, items, compact = false }: Props) {
  const { colors, dark } = useAppTheme();
  const height = compact ? TAB_PILL_HEIGHT_COMPACT : TAB_PILL_HEIGHT;
  const iconSize = compact ? TAB_ICON_SIZE_COMPACT : TAB_ICON_SIZE;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.outlineVariant,
          paddingBottom: insets.bottom + (compact ? spacing.xs : spacing.sm),
          paddingTop: compact ? spacing.xs : spacing.sm,
          paddingLeft: insets.left + spacing.md,
          paddingRight: insets.right + spacing.md,
        },
      ]}
      accessibilityRole="tablist"
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const item: TabPillItem = items[route.name] ?? { kind: 'icon', icon: 'circle-outline', label: options.title ?? route.name };
        const fg = focused ? colors.onPrimary : colors.primary;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? item.label}
            testID={options.tabBarButtonTestID}
            style={({ pressed }) => [
              styles.pill,
              {
                height,
                backgroundColor: focused ? colors.primary : colors.surfaceSunken,
                borderColor: focused ? colors.primary : colors.outlineVariant,
                borderBottomColor: focused ? colors.primaryEdge : colors.outlineVariant,
                opacity: pressed ? 0.85 : 1,
              },
              focused && styles.edged,
            ]}
          >
            {item.kind === 'avatar' ? (
              <SeatAvatar name={item.name} size={iconSize + 6} color={seatColor(0, { onDark: dark })} />
            ) : (
              <Icon source={item.icon} size={iconSize} color={fg} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pill: {
    // Every button takes the same share of the row, whatever it shows.
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: radius.full,
  },
  edged: {
    borderBottomWidth: BUTTON_EDGE,
  },
});

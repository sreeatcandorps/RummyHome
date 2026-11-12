import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Icon, Text } from 'react-native-paper';
import { BUTTON_EDGE } from '@/components/ui/AppButton';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { radius, seatColor, spacing, useAppTheme } from '@/constants/theme';

export type TabPillItem =
  | { kind: 'icon'; icon: string; label: string; /** Share of the row; a longer label gets more. */ flex?: number }
  | { kind: 'avatar'; name: string; label: string };

type Props = BottomTabBarProps & {
  /** What each route shows, by route name. Routes missing here fall back to their title. */
  items: Record<string, TabPillItem | undefined>;
  /** Shorter pills on short phones in landscape. */
  compact?: boolean;
};

export const TAB_PILL_HEIGHT = 48;
export const TAB_PILL_HEIGHT_COMPACT = 40;

/**
 * Bottom tabs as pill buttons: the active one filled button green with its pressable edge,
 * the others outlined, so every tappable in the app reads the same way
 * (docs/design/02-design-system.md §0). The profile tab is the account avatar in its own pill.
 */
export function PillTabBar({ state, descriptors, navigation, insets, items, compact = false }: Props) {
  const { colors, dark } = useAppTheme();
  const height = compact ? TAB_PILL_HEIGHT_COMPACT : TAB_PILL_HEIGHT;

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
        const label = item.label;
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
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            testID={options.tabBarButtonTestID}
            style={({ pressed }) => [
              styles.pill,
              item.kind === 'avatar' ? styles.avatarPill : { flex: item.flex ?? 1 },
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
              <SeatAvatar
                name={item.name}
                size={height - 12}
                color={seatColor(0, { onDark: dark })}
                style={focused ? { borderWidth: 2, borderColor: colors.onPrimary } : undefined}
              />
            ) : (
              <>
                <Icon source={item.icon} size={compact ? 20 : 22} color={fg} />
                <Text
                  variant="labelLarge"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  style={[styles.label, compact && styles.labelCompact, { color: fg }]}
                >
                  {label}
                </Text>
              </>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 2,
    borderRadius: radius.full,
    paddingHorizontal: 6,
  },
  avatarPill: {
    width: 64,
  },
  edged: {
    borderBottomWidth: BUTTON_EDGE,
  },
  label: {
    fontWeight: '800',
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 1,
  },
  labelCompact: {
    fontSize: 14,
  },
});

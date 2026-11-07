import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Tabs, router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from 'react-native-paper';
import { HelpButton } from '@/components/ui/HelpButton';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { HELP } from '@/constants/help';
import { authService } from '@/services/auth';
import { playersService } from '@/services/players';
import { MIN_TOUCH_TARGET, radius, spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { shortVersionLabel } from '@/utils/appVersion';
import { readAppVersion } from '@/utils/appVersionRuntime';

const APP_VERSION = readAppVersion();

function TabBarIcon(props: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
}) {
  return <Ionicons size={24} {...props} />;
}

function BrandTitle() {
  const theme = useAppTheme();
  return (
    <View style={styles.brand}>
      <Image source={require('../../assets/icon.png')} style={styles.brandLogo} />
      <View style={styles.brandCopy}>
        <Text variant="titleLarge" numberOfLines={1} style={[styles.brandText, { color: theme.colors.onSurface }]}>
          EZ Score: Rummy
        </Text>
        <Text
          variant="labelSmall"
          numberOfLines={1}
          style={[styles.brandVersion, { color: theme.colors.onSurfaceVariant }]}
          accessibilityLabel={`App version ${shortVersionLabel(APP_VERSION)}`}
        >
          {shortVersionLabel(APP_VERSION)}
        </Text>
      </View>
    </View>
  );
}

/** The signed-in person's initials, refreshed on every tab change so a renamed profile shows up. */
function useMyName() {
  const path = usePathname();
  const [name, setName] = useState('?');
  useEffect(() => {
    authService.getCurrentPlayer().then((player) => setName(player?.name ?? '?')).catch(() => {});
  }, [path]);
  return name;
}

const TAB_AVATAR = 30;

/**
 * Bottom-tab avatar: the account chip lives in the tab bar only (no duplicate in the header
 * of tab pages). Sized to the other tab icons; active is the full-strength chip, inactive is
 * softened, with no ring.
 */
function ProfileTabIcon({ focused }: { focused: boolean }) {
  const theme = useAppTheme();
  const name = useMyName();
  return (
    <View style={[styles.tabAvatar, { opacity: focused ? 1 : 0.6 }]}>
      <SeatAvatar name={name} size={TAB_AVATAR} color={theme.colors.primary} />
    </View>
  );
}

function HeaderTools() {
  const path = usePathname();
  const text = path.includes('/players')
    ? HELP.players
    : path.includes('/me')
      ? HELP.me
      : HELP.home;

  // Tab pages already carry the account chip in the bottom bar; the header keeps only Help.
  return (
    <View style={styles.headerRight}>
      <HelpButton text={text} />
    </View>
  );
}

export default function TabLayout() {
  const theme = useAppTheme();
  const { insets, isShort } = useLayout();
  const path = usePathname();
  const [playerCount, setPlayerCount] = useState<number | null>(null);

  // Re-count on every tab change so "My players · N" matches the list right after adding people.
  useEffect(() => {
    const loadPlayerCount = async () => {
      try {
        const player = await authService.getCurrentPlayer();
        if (player) {
          const cached = await playersService.readMyPlayers(player.id);
          if (cached.length > 0) {
            setPlayerCount(cached.length);
          }
          const fresh = await playersService.listMyPlayers(player.id);
          setPlayerCount(fresh.length);
        }
      } catch {
        // Ignore errors, count will update when Players tab loads
      }
    };
    loadPlayerCount();
  }, [path]);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: { fontSize: 22, fontWeight: '700' },
        headerShadowVisible: false,
        headerTitleAlign: 'left',
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant,
          height: (isShort ? 52 : 64) + insets.bottom,
          paddingTop: isShort ? 0 : 4,
          paddingBottom: insets.bottom + (isShort ? 0 : 4),
        },
        tabBarLabelStyle: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
        sceneStyle: { backgroundColor: theme.colors.background },
        headerRight: () => <HeaderTools />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: () => <BrandTitle />,
          tabBarIcon: ({ color, focused }) => <TabBarIcon name={focused ? 'home' : 'home-outline'} color={color} />,
        }}
      />
      <Tabs.Screen
        name="players"
        options={{
          title: playerCount != null ? `My players · ${playerCount}` : 'My players',
          tabBarLabel: playerCount != null ? `My players · ${playerCount}` : 'My players',
          tabBarIcon: ({ color, focused }) => <TabBarIcon name={focused ? 'people' : 'people-outline'} color={color} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: 'Profile',
          tabBarLabel: () => null,
          tabBarAccessibilityLabel: 'Your profile',
          tabBarIcon: ({ focused }) => <ProfileTabIcon focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabAvatar: { alignItems: 'center', justifyContent: 'center' },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandLogo: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
  },
  brandCopy: {
    flexShrink: 1,
  },
  brandText: {
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 24,
  },
  brandVersion: {
    fontWeight: '600',
    lineHeight: 14,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

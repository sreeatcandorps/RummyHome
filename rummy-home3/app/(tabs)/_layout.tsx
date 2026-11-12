import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import { Text } from 'react-native-paper';
import { HelpButton } from '@/components/ui/HelpButton';
import { PillTabBar } from '@/components/ui/TabBarButtons';
import { HELP } from '@/constants/help';
import { authService } from '@/services/auth';
import { playersService } from '@/services/players';
import { radius, spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { shortVersionLabel } from '@/utils/appVersion';
import { readAppVersion } from '@/utils/appVersionRuntime';

const APP_VERSION = readAppVersion();
const VERSION_LABEL = shortVersionLabel(APP_VERSION);

function BrandTitle() {
  const theme = useAppTheme();
  return (
    <View style={styles.brand}>
      <View style={[styles.brandDisc, { backgroundColor: theme.colors.secondaryContainer }]}>
        <Image source={require('../../assets/icon-small.png')} style={styles.brandLogo} />
      </View>
      <View style={styles.brandCopy}>
        <Text variant="titleLarge" numberOfLines={1} style={[styles.brandText, { color: theme.colors.onSurface }]}>
          EZ Score: Rummy
        </Text>
        {VERSION_LABEL ? (
          <Text
            variant="labelSmall"
            numberOfLines={1}
            style={[styles.brandVersion, { color: theme.colors.onSurfaceVariant }]}
            accessibilityLabel={`App version ${VERSION_LABEL}`}
          >
            {VERSION_LABEL}
          </Text>
        ) : null}
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
  const { isShort } = useLayout();
  const path = usePathname();
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const myName = useMyName();
  const playersLabel = playerCount != null ? `My players · ${playerCount}` : 'My players';

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

  // The account chip lives in the tab bar only (no duplicate in the header of tab pages).
  return (
    <Tabs
      tabBar={(props) => (
        <PillTabBar
          {...props}
          compact={isShort}
          items={{
            index: { kind: 'icon', icon: 'home-variant', label: 'Home' },
            players: { kind: 'icon', icon: 'account-group', label: playersLabel, flex: 1.45 },
            me: { kind: 'avatar', name: myName, label: 'Your profile' },
          }}
        />
      )}
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: { fontSize: 22, fontWeight: '700' },
        headerShadowVisible: false,
        headerTitleAlign: 'left',
        sceneStyle: { backgroundColor: theme.colors.background },
        headerRight: () => <HeaderTools />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: () => <BrandTitle />,
        }}
      />
      <Tabs.Screen
        name="players"
        options={{
          title: playersLabel,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'Your profile',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandDisc: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogo: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
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

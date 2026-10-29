import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Tabs, router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableRipple } from 'react-native-paper';
import { HelpButton } from '@/components/ui/HelpButton';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
import { HELP } from '@/constants/help';
import { authService } from '@/services/auth';
import { playersService } from '@/services/players';
import { MIN_TOUCH_TARGET, radius, spacing, useAppTheme } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';

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
      <Text variant="titleLarge" style={[styles.brandText, { color: theme.colors.onSurface }]}>
        EZ Score: Rummy
      </Text>
    </View>
  );
}

function HeaderTools() {
  const path = usePathname();
  const theme = useAppTheme();
  const [name, setName] = useState('?');
  const text = path.includes('/players') ? HELP.players : path.includes('/me') ? HELP.me : HELP.home;

  useEffect(() => {
    authService.getCurrentPlayer().then((player) => setName(player?.name ?? '?')).catch(() => {});
  }, [path]);

  return (
    <View style={styles.headerRight}>
      <HelpButton text={text} />
      {path.includes('/players') || path.includes('/me') ? null : (
        <TouchableRipple
          onPress={() => router.push('/(tabs)/me')}
          borderless
          style={styles.avatarButton}
          accessibilityRole="button"
          accessibilityLabel="Open Me"
        >
          <SeatAvatar name={name} size={36} color={theme.colors.primary} />
        </TouchableRipple>
      )}
    </View>
  );
}

export default function TabLayout() {
  const theme = useAppTheme();
  const { insets, isShort } = useLayout();
  const [playerCount, setPlayerCount] = useState<number | null>(null);

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
  }, []);

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
          title: playerCount != null ? `Players · ${playerCount}` : 'Players',
          tabBarLabel: playerCount != null ? `Players · ${playerCount}` : 'Players',
          tabBarIcon: ({ color, focused }) => <TabBarIcon name={focused ? 'people' : 'people-outline'} color={color} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: 'Me',
          tabBarIcon: ({ color, focused }) => <TabBarIcon name={focused ? 'person' : 'person-outline'} color={color} />,
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
  brandLogo: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
  },
  brandText: {
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarButton: {
    marginRight: spacing.sm,
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

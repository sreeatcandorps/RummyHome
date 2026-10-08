import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableRipple } from 'react-native-paper';
import { authService } from '@/services/auth';
import { Player } from '@/types/player';
import { MIN_TOUCH_TARGET, radius, spacing, useAppTheme } from '@/constants/theme';
import { SeatAvatar } from '@/components/ui/SeatAvatar';
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
        Rummy Home
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const theme = useAppTheme();
  const { insets, isShort } = useLayout();
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);

  useEffect(() => {
    loadCurrentPlayer();
  }, []);

  const loadCurrentPlayer = async () => {
    const player = await authService.getCurrentPlayer();
    setCurrentPlayer(player);
  };

  const HeaderRight = () => (
    <TouchableRipple
      onPress={() => router.push('/profile')}
      borderless
      style={styles.avatarButton}
      accessibilityRole="button"
      accessibilityLabel="Open profile"
    >
      <SeatAvatar
        name={currentPlayer?.name ?? '?'}
        size={36}
        color={currentPlayer?.role === 'admin' ? theme.colors.error : theme.colors.primary}
      />
    </TouchableRipple>
  );

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
        tabBarItemStyle: { minHeight: MIN_TOUCH_TARGET },
        sceneStyle: { backgroundColor: theme.colors.background },
        headerRight: HeaderRight,
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
        name="settings"
        options={{
          title: 'Settings',
          headerTitle: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'settings' : 'settings-outline'} color={color} />
          ),
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
  avatarButton: {
    marginRight: spacing.sm,
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

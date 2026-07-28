import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, TouchableRipple } from 'react-native-paper';
import { router } from 'expo-router';
import { authService } from '@/services/auth';
import { Player } from '@/types/player';
import { MIN_TOUCH_TARGET, radius, spacing } from '@/constants/theme';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
}) {
  return <Ionicons size={24} {...props} />;
}

export default function TabLayout() {
  const theme = useTheme();
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);

  useEffect(() => {
    loadCurrentPlayer();
  }, []);

  const loadCurrentPlayer = async () => {
    const player = await authService.getCurrentPlayer();
    setCurrentPlayer(player);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const HeaderRight = () => (
    <TouchableRipple
      onPress={() => router.push('/profile')}
      borderless
      style={{
        marginRight: spacing.sm,
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityRole="button"
      accessibilityLabel="Open profile"
    >
      <Avatar.Text
        size={36}
        label={currentPlayer ? getInitials(currentPlayer.name) : '?'}
        style={{
          backgroundColor: currentPlayer?.role === 'admin'
            ? theme.colors.error
            : theme.colors.primary,
        }}
      />
    </TouchableRipple>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: { fontSize: 22, fontWeight: '600' },
        headerShadowVisible: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: theme.colors.elevation.level2,
          borderTopColor: theme.colors.outlineVariant,
          height: 64,
          paddingBottom: spacing.sm,
          paddingTop: spacing.sm,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
        tabBarItemStyle: { minHeight: MIN_TOUCH_TARGET },
        headerRight: HeaderRight,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'Rummy Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerTitle: 'Settings',
          tabBarIcon: ({ color }) => <TabBarIcon name="settings" color={color} />,
        }}
      />
    </Tabs>
  );
}

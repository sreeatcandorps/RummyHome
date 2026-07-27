import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from 'react-native-paper';
import { TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { authService } from '@/services/auth';
import { Player } from '@/types/player';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
}) {
  return <Ionicons size={24} style={{ marginBottom: -3 }} {...props} />;
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
    <TouchableOpacity 
      onPress={() => router.push('/profile')}
      style={{ marginRight: 15 }}
    >
      <Avatar.Text 
        size={32} 
        label={currentPlayer ? getInitials(currentPlayer.name) : '?'}
        style={{ 
          backgroundColor: currentPlayer?.role === 'admin' 
            ? theme.colors.error  // Red for admin
            : theme.colors.primary // Default color for players
        }}
      />
    </TouchableOpacity>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: theme.colors.primary,
        headerRight: HeaderRight
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          headerTitle: 'Dashboard',
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

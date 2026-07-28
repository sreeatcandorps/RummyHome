import { Stack } from 'expo-router';
import { useTheme } from 'react-native-paper';

export default function ScreensLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: { fontSize: 20, fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="game" options={{ title: 'Game' }} />
      <Stack.Screen
        name="score-entry"
        options={{
          title: 'Enter Scores',
          presentation: 'modal',
        }}
      />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="games/new" options={{ title: 'New Game' }} />
      <Stack.Screen name="games/history" options={{ title: 'Game History' }} />
      <Stack.Screen name="games/[id]" options={{ title: 'Game' }} />
      <Stack.Screen name="players/index" options={{ title: 'Players' }} />
      <Stack.Screen name="players/new" options={{ title: 'Find Players' }} />
      <Stack.Screen name="players/search" options={{ title: 'Search Players' }} />
      <Stack.Screen name="players/[id]" options={{ title: 'Player' }} />
      <Stack.Screen name="players/[id]/edit" options={{ title: 'Edit Profile' }} />
    </Stack>
  );
}

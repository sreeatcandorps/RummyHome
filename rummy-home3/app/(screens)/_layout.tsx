import { Stack } from 'expo-router';
import { useAppTheme } from '@/constants/theme';

export default function ScreensLayout() {
  const theme = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: { fontSize: 20, fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="game" options={{ title: 'Game' }} />
      <Stack.Screen
        name="score-entry"
        options={{
          title: 'Enter Scores',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="games/new" options={{ title: 'New game' }} />
      <Stack.Screen name="games/history" options={{ title: 'Game history' }} />
      <Stack.Screen name="games/[id]" options={{ title: 'Scoreboard' }} />
      <Stack.Screen name="players/index" options={{ title: 'Players' }} />
      <Stack.Screen name="players/new" options={{ title: 'Find players' }} />
      <Stack.Screen name="players/search" options={{ title: 'Search players' }} />
      <Stack.Screen name="players/[id]" options={{ title: 'Player' }} />
      <Stack.Screen name="players/[id]/edit" options={{ title: 'Edit profile' }} />
    </Stack>
  );
}

import { Stack } from 'expo-router';
import { HelpButton } from '@/components/ui/HelpButton';
import { HELP } from '@/constants/help';
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
      <Stack.Screen
        name="score-entry"
        options={{
          title: 'Enter Scores',
          presentation: 'modal',
          animation: 'slide_from_bottom',
          headerRight: () => <HelpButton text={HELP.scoreEntry} />,
        }}
      />
      <Stack.Screen name="profile" options={{ title: 'Me' }} />
      <Stack.Screen
        name="games/new"
        options={{ title: 'New game', headerRight: () => <HelpButton text={HELP.newGame} /> }}
      />
      <Stack.Screen name="games/history" options={{ title: 'Home' }} />
      <Stack.Screen name="games/[id]" options={{ title: 'Scorecard', headerTitleAlign: 'left' }} />
      <Stack.Screen
        name="sessions/[id]"
        options={{ title: 'Settle', headerRight: () => <HelpButton text={HELP.settle} /> }}
      />
      <Stack.Screen
        name="settle/index"
        options={{ title: 'Settle', headerRight: () => <HelpButton text={HELP.settle} /> }}
      />
      <Stack.Screen name="players/index" options={{ title: 'Players' }} />
      <Stack.Screen
        name="players/new"
        options={{ title: 'Find players', headerRight: () => <HelpButton text={HELP.find} /> }}
      />
      <Stack.Screen name="players/[id]" options={{ title: 'Players' }} />
      <Stack.Screen name="players/[id]/edit" options={{ title: 'Me' }} />
    </Stack>
  );
}

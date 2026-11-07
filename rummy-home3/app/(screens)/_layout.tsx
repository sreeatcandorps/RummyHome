import { Stack } from 'expo-router';
import { HelpButton } from '@/components/ui/HelpButton';
import { settleEnabled } from '@/constants/features';
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
      <Stack.Screen name="settings" options={{ title: 'User settings', headerRight: () => <HelpButton text={HELP.userSettings} /> }} />
      <Stack.Screen
        name="games/new"
        options={{ title: 'New game', headerRight: () => <HelpButton text={HELP.newGame} /> }}
      />
      <Stack.Screen name="games/history" options={{ title: 'Home' }} />
      <Stack.Screen name="games/[id]" options={{ title: 'Scorecard', headerTitleAlign: 'left' }} />
      <Stack.Screen name="games/complete" options={{ title: 'Complete game' }} />
      <Stack.Screen name="games/players" options={{ title: 'Players in this game' }} />
      <Stack.Screen name="games/final-scores" options={{ title: 'Final scores' }} />
      <Stack.Screen
        name="sessions/[id]"
        options={{
          title: settleEnabled ? 'Settle' : 'Home',
          headerShown: settleEnabled,
          headerRight: settleEnabled ? () => <HelpButton text={HELP.settle} /> : undefined,
        }}
      />
      <Stack.Screen
        name="results/index"
        options={{ title: 'Results', headerRight: () => <HelpButton text={HELP.results} /> }}
      />
      <Stack.Screen
        name="results/view"
        options={{ title: 'Results', headerRight: () => <HelpButton text={HELP.results} /> }}
      />
      <Stack.Screen
        name="results/[id]"
        options={{ title: 'Results', headerRight: () => <HelpButton text={HELP.results} /> }}
      />
      <Stack.Screen
        name="settle/index"
        options={{
          title: settleEnabled ? 'Settle' : 'Home',
          headerShown: settleEnabled,
          headerRight: settleEnabled ? () => <HelpButton text={HELP.settle} /> : undefined,
        }}
      />
      <Stack.Screen name="players/index" options={{ title: 'Players' }} />
      <Stack.Screen
        name="players/new"
        options={{ title: 'Find player in database', headerRight: () => <HelpButton text={HELP.find} /> }}
      />
      <Stack.Screen
        name="players/add"
        options={{
          title: 'Add New Players by Initials',
          headerBackVisible: false,
          gestureEnabled: false,
          headerRight: () => <HelpButton text={HELP.addPlayers} />,
        }}
      />
      <Stack.Screen name="players/[id]" options={{ title: 'Players' }} />
      <Stack.Screen name="players/[id]/edit" options={{ title: 'Me' }} />
    </Stack>
  );
}

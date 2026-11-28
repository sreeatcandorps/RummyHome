import { Stack } from 'expo-router';
import { HelpButton } from '@/components/ui/HelpButton';
import { HeaderTitle } from '@/components/ui/HeaderTitle';
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
        headerTitle: ({ children, tintColor }) => <HeaderTitle tintColor={tintColor}>{children}</HeaderTitle>,
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
          headerRight: () => <HelpButton topic="add-round" />,
        }}
      />
      <Stack.Screen name="profile" options={{ title: 'Me' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings', headerRight: () => <HelpButton topic="settings" /> }} />
      <Stack.Screen name="hidden-deleted" options={{ title: 'Hidden & deleted', headerRight: () => <HelpButton topic="hidden-deleted" /> }} />
      <Stack.Screen
        name="games/new"
        options={{ title: 'New game', headerRight: () => <HelpButton topic="new-game" /> }}
      />
      <Stack.Screen name="games/history" options={{ title: 'Home' }} />
      <Stack.Screen name="games/[id]" options={{ title: 'Scorecard' }} />
      <Stack.Screen name="games/award" options={{ title: 'Awards' }} />
      <Stack.Screen name="games/players" options={{ title: 'Players · Admins' }} />
      <Stack.Screen name="games/log" options={{ title: 'Log' }} />
      <Stack.Screen name="games/final-scores" options={{ title: 'Final scores', headerRight: () => <HelpButton topic="final-scores" /> }} />
      <Stack.Screen
        name="results/index"
        options={{ title: 'Results', headerRight: () => <HelpButton topic="results" /> }}
      />
      <Stack.Screen
        name="results/view"
        options={{ title: 'Results', headerRight: () => <HelpButton topic="results" anchor="the-preview" /> }}
      />
      <Stack.Screen
        name="results/[id]"
        options={{ title: 'Results', headerRight: () => <HelpButton topic="results" anchor="a-saved-result" /> }}
      />
      <Stack.Screen name="players/index" options={{ title: 'Players' }} />
      <Stack.Screen
        name="players/new"
        options={{ title: 'Find in database', headerRight: () => <HelpButton topic="add-players" anchor="find-in-database" /> }}
      />
      <Stack.Screen
        name="players/add"
        options={{
          title: 'Add by initials',
          headerBackVisible: false,
          headerRight: () => <HelpButton topic="add-players" />,
        }}
      />
      <Stack.Screen name="players/[id]" options={{ title: 'Players', headerRight: () => <HelpButton topic="my-players" anchor="initials" /> }} />
      <Stack.Screen name="players/[id]/edit" options={{ title: 'Me', headerRight: () => <HelpButton topic="my-players" anchor="initials" /> }} />
      <Stack.Screen name="help/index" options={{ title: 'Help & guide' }} />
      <Stack.Screen name="help/[topic]" options={{ title: 'Help' }} />
    </Stack>
  );
}

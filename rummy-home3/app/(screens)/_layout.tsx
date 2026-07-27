import { Stack } from 'expo-router';

export default function ScreensLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="game" 
        options={{ 
          title: 'Game',
          headerShown: true 
        }} 
      />
      <Stack.Screen 
        name="score-entry" 
        options={{ 
          title: 'Enter Scores',
          headerShown: true,
          presentation: 'modal'
        }} 
      />
      <Stack.Screen 
        name="profile" 
        options={{ 
          title: 'Profile',
          headerShown: true 
        }} 
      />
      <Stack.Screen
        name="games/new"
        options={{
          title: 'New Game',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="games/history"
        options={{
          title: 'Game History',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="games/[id]"
        options={{
          title: 'Game',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="players/index"
        options={{
          title: 'Players',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="players/new"
        options={{
          title: 'New Player',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="players/search"
        options={{
          title: 'Search Players',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="players/[id]"
        options={{
          title: 'Player',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="players/[id]/edit"
        options={{
          title: 'Edit Player',
          headerShown: true,
        }}
      />
    </Stack>
  );
}
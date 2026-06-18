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

      
    </Stack>
  );
}
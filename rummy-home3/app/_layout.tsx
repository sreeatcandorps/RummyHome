import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { LoadingProvider } from '@/contexts/LoadingContext';
// import { HeaderRight } from '@/components/SharedHeader';
import { storage } from '@/utils/storage';
import { authService } from '@/services/auth';
import { isSupabaseConfigured } from '@/services/supabase';

// Create a custom theme
const theme = {
  ...MD3LightTheme,
  // Add any custom theme properties here
};

export default function Layout() {
  const router = useRouter();
  const segments = useSegments();
  const [isLoading, setIsLoading] = useState(false); // Set to false to remove splash screen

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const currentPlayer = isSupabaseConfigured
        ? await authService.getCurrentUserId()
        : await getLocalCurrentPlayerId();
      
      // Only redirect if we're not already on an auth screen
      const inAuthGroup = segments[0] === '(auth)';
      
      if (!currentPlayer && !inAuthGroup) {
        // No local player - go to login
        router.replace('/(auth)/login');
      } else if (currentPlayer && inAuthGroup) {
        // Have local player but on auth screen - go to main app
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Auth check error:', error);
      // On error, redirect to login
      if (segments[0] !== '(auth)') {
        router.replace('/(auth)/login');
      }
    }
  };

  const getLocalCurrentPlayerId = async () => {
    const currentPlayerId = await storage.getCurrentPlayer();
    const players = await storage.getPlayers();
    const currentPlayer = currentPlayerId ? players.find(p => p.id === currentPlayerId) : null;
    return currentPlayer?.id ?? null;
  };

  // Auth state changes disabled - using local storage only
  // useEffect(() => {
  //   const { data: { subscription } } = supabase.auth.onAuthStateChange(
  //     async (event, session) => {
  //       if (event === 'SIGNED_IN' && session) {
  //         // User signed in - check if we need to create/update local player
  //         const players = await storage.getPlayers();
  //         const existingPlayer = players.find(p => p.id === session.user.id);
  //         
  //         if (!existingPlayer) {
  //           // Create a new player record for this user
  //           const newPlayer = {
  //             id: session.user.id,
  //             email: session.user.email || undefined,
  //             name: session.user.email?.split('@')[0] || 'New Player',
  //             gamesPlayed: 0,
  //             gamesWon: 0,
  //             role: 'player' as const
  //           };
  //           await storage.savePlayers([...players, newPlayer]);
  //         }
  //         
  //         await storage.setCurrentPlayer(session.user.id);
  //         router.replace('/(tabs)');
  //       } else if (event === 'SIGNED_OUT') {
  //         // User signed out - clear local session
  //         await storage.setCurrentPlayer(null);
  //         router.replace('/(auth)/login');
  //       }
  //     }
  //   );

  //   return () => subscription.unsubscribe();
  // }, []);

  return (
    <PaperProvider theme={theme}>
      <LoadingProvider>
        <Stack 
          screenOptions={{
            headerShown: false
          }}
        >
          <Stack.Screen 
            name="(auth)" 
            options={{ 
              headerShown: false 
            }} 
          />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(screens)" />
          <Stack.Screen name="index" />
        </Stack>
      </LoadingProvider>
    </PaperProvider>
  );
}
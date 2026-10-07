import '../polyfills';
import { Stack } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationLightTheme, ThemeProvider } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { LoadingProvider } from '@/contexts/LoadingContext';
import { PreferencesProvider, usePreferences } from '@/contexts/PreferencesContext';
import { authService } from '@/services/auth';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { storage } from '@/utils/storage';
import { darkTheme, lightTheme } from '@/constants/theme';
import { isClockSkewError } from '@/utils/supabaseErrors';

export default function Layout() {
  return (
    <PreferencesProvider>
      <ThemedApp />
    </PreferencesProvider>
  );
}

function ThemedApp() {
  const router = useRouter();
  const segments = useSegments();
  const { darkMode } = usePreferences();
  const theme = darkMode ? darkTheme : lightTheme;

  const navigationTheme = useMemo(() => {
    const base = darkMode ? NavigationDarkTheme : NavigationLightTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.onSurface,
        border: theme.colors.outlineVariant,
      },
    };
  }, [darkMode, theme]);

  useEffect(() => {
    checkAuth();

    if (!isSupabaseConfigured) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await storage.setCurrentPlayer(session.user.id);
        router.replace('/(tabs)');
      } else if (event === 'SIGNED_OUT') {
        await storage.setCurrentPlayer(null);
        router.replace('/(auth)/login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAuth = async () => {
    try {
      if (isSupabaseConfigured) {
        // After a paused Supabase project wakes up, refresh before routing.
        await authService.ensureFreshSession();
      }

      const currentPlayer = isSupabaseConfigured
        ? await authService.getCurrentUserId()
        : await getLocalCurrentPlayerId();
      // Only redirect if we're not already on an auth screen
      const inAuthGroup = segments[0] === '(auth)';

      if (!currentPlayer && !inAuthGroup) {
        router.replace('/(auth)/login');
      } else if (currentPlayer && inAuthGroup) {
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Auth check error:', error);
      if (isSupabaseConfigured && isClockSkewError(error)) {
        await authService.clearLocalSession();
      }
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

  return (
    <ThemeProvider value={navigationTheme}>
      <PaperProvider theme={theme}>
        <StatusBar style={darkMode ? 'light' : 'dark'} />
        <LoadingProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.background },
              animation: 'fade',
            }}
          >
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(screens)" />
            <Stack.Screen name="index" />
          </Stack>
        </LoadingProvider>
      </PaperProvider>
    </ThemeProvider>
  );
}

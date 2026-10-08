import '../polyfills';
import { SplashScreen, Stack, useRouter, useSegments, type ErrorBoundaryProps } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationLightTheme, ThemeProvider } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { LoadingProvider } from '@/contexts/LoadingContext';
import { PreferencesProvider, usePreferences } from '@/contexts/PreferencesContext';
import { authService } from '@/services/auth';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { storage } from '@/utils/storage';
import { darkTheme, lightTheme, brand, spacing } from '@/constants/theme';
import { isClockSkewError } from '@/utils/supabaseErrors';
import { setStartupNotice } from '@/utils/startupNotice';
import { withTimeout } from '@/utils/withTimeout';

const STARTUP_TIMEOUT_MS = 4000;

function hideSplash() {
  SplashScreen.hideAsync().catch(() => {});
}

// Expo Router only hides the native splash once navigation reports ready.
// On Android that signal waits on a native inset/layout callback that does
// not arrive while the splash is still up, so the two wait on each other.
// Own the splash here and always dismiss it.
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
  hideSplash();
  setTimeout(hideSplash, 1200);
}

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
    let active = true;
    withTimeout(checkAuth(), STARTUP_TIMEOUT_MS, 'Startup timed out').catch((error) => {
      console.error('Auth check error:', error);
      const message = error instanceof Error ? error.message : 'Could not finish startup';
      setStartupNotice(message);
      if (active && segments[0] !== '(auth)') {
        router.replace('/(auth)/login');
      }
    }).finally(() => {
      hideSplash();
    });

    if (!isSupabaseConfigured) return () => {
      active = false;
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await storage.setCurrentPlayer(session.user.id);
        router.replace('/(tabs)');
      } else if (event === 'SIGNED_OUT') {
        await storage.setCurrentPlayer(null);
        router.replace('/(auth)/login');
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
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
      setStartupNotice(error instanceof Error ? error.message : 'Could not finish startup');
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

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error(error);
    hideSplash();
  }, [error]);

  return (
    <View style={styles.errorScreen}>
      <Text style={styles.errorTitle}>Rummy Home could not start</Text>
      <Text style={styles.errorBody}>{error.message}</Text>
      <Pressable onPress={retry} style={styles.retry}>
        <Text style={styles.retryLabel}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  errorScreen: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: brand.cream,
    gap: spacing.md,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: brand.felt,
  },
  errorBody: {
    fontSize: 16,
    color: '#1B1F1C',
  },
  retry: {
    alignSelf: 'flex-start',
    backgroundColor: brand.felt,
    borderRadius: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  retryLabel: {
    color: brand.cream,
    fontSize: 16,
    fontWeight: '700',
  },
});

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { Redirect, SplashScreen } from 'expo-router';
import { authService } from '@/services/auth';
import { isSupabaseConfigured } from '@/services/supabase';
import { storage } from '@/utils/storage';
import { brand, spacing } from '@/constants/theme';
import { setStartupNotice } from '@/utils/startupNotice';
import { withTimeout } from '@/utils/withTimeout';

const STARTUP_TIMEOUT_MS = 4000;

/** Signed-in players go straight to Home; everyone else to login. */
async function hasSignedInPlayer() {
  if (isSupabaseConfigured) {
    await authService.ensureFreshSession();
    return Boolean(await authService.getCurrentUserId());
  }

  const [currentPlayerId, players] = await Promise.all([storage.getCurrentPlayer(), storage.getPlayers()]);
  return Boolean(currentPlayerId && players.some((player) => player.id === currentPlayerId));
}

export default function Index() {
  const [href, setHref] = useState<'/(tabs)' | '/(auth)/login' | null>(null);

  useEffect(() => {
    let active = true;
    withTimeout(hasSignedInPlayer(), STARTUP_TIMEOUT_MS, 'Startup timed out before sign-in could be checked')
      .then((signedIn) => {
        if (active) setHref(signedIn ? '/(tabs)' : '/(auth)/login');
      })
      .catch((error: unknown) => {
        console.error(error);
        const message = error instanceof Error ? error.message : 'Could not finish startup';
        setStartupNotice(message);
        if (active) setHref('/(auth)/login');
      })
      .finally(() => {
        SplashScreen.hideAsync().catch(() => {});
      });
    return () => {
      active = false;
    };
  }, []);

  if (href) return <Redirect href={href} />;

  // Matches the native splash so cold start has no flash.
  return (
    <View style={styles.splash}>
      <Image source={require('../assets/icon.png')} style={styles.logo} />
      <ActivityIndicator color={brand.felt} />
      <Text style={styles.hint}>Opening Rummy Home…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    backgroundColor: brand.cream,
  },
  logo: {
    width: 160,
    height: 160,
  },
  hint: {
    color: brand.felt,
    fontSize: 14,
  },
});

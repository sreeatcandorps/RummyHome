import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { authService } from '@/services/auth';
import { isSupabaseConfigured } from '@/services/supabase';
import { storage } from '@/utils/storage';
import { brand, spacing } from '@/constants/theme';

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
    hasSignedInPlayer()
      .then((signedIn) => active && setHref(signedIn ? '/(tabs)' : '/(auth)/login'))
      .catch(() => active && setHref('/(auth)/login'));
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
});

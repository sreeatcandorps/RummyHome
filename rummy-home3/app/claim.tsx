import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { authService } from '@/services/auth';
import { playerIdentityService } from '@/services/playerIdentity';

/** Opened from a claim link: remember the token, then sign up (or go Home if signed in). */
export default function ClaimRoute() {
  const params = useLocalSearchParams<{ t?: string; claim?: string }>();
  useEffect(() => {
    (async () => {
      const token = String(params.t ?? params.claim ?? '');
      if (token) await playerIdentityService.rememberClaimToken(token);
      const me = await authService.getCurrentPlayer().catch(() => null);
      router.replace(me ? '/(tabs)' : '/(auth)/register');
    })();
  }, [params.t, params.claim]);
  return null;
}

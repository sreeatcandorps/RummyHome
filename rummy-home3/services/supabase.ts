import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

// The staging app (eas.json `staging`, app.config.js APP_VARIANT) reads its own pair of variables, so the
// live names are never overridden by mistake. Expo inlines EXPO_PUBLIC_* only as literal member reads.
const isStaging = process.env.EXPO_PUBLIC_APP_VARIANT === 'staging';
const supabaseUrl = isStaging ? process.env.EXPO_PUBLIC_STAGING_SUPABASE_URL : process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = isStaging ? process.env.EXPO_PUBLIC_STAGING_SUPABASE_ANON_KEY : process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn('Supabase environment variables are missing. Server-backed features will be unavailable.');
}

/**
 * The default auth lock uses `navigator.locks` when the runtime looks like a
 * browser. That API does not settle on React Native, so `getSession()` never
 * returns and the splash stays up. Run the critical section directly.
 */
async function authLock<T>(_name: string, _acquireTimeout: number, fn: () => Promise<T>): Promise<T> {
  return fn();
}

export const supabase = createClient<Database>(
  supabaseUrl || 'https://missing-supabase-url.supabase.co',
  supabaseAnonKey || 'missing-supabase-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: authLock,
    },
  },
);
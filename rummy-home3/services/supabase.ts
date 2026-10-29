import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

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
import { supabase } from '@/services/supabase';
import { ProfileDefaults } from '@/types/database';
import { DEFAULT_PROFILE_SETTINGS } from '@/utils/scoring';
import { storage } from '@/utils/storage';

export type Profile = {
  id: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  defaultSettings: ProfileDefaults;
  role: 'app_admin' | 'player';
};

const toProfile = (row: any): Profile => ({
  id: row.id,
  email: row.email ?? undefined,
  phone: row.phone ?? undefined,
  firstName: row.first_name ?? undefined,
  lastName: row.last_name ?? undefined,
  displayName: row.display_name,
  defaultSettings: row.default_settings ?? DEFAULT_PROFILE_SETTINGS,
  role: row.role ?? 'player',
});

export const authService = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) throw error;
    if (data.user) {
      await storage.setCurrentPlayer(data.user.id);
    }
    return data;
  },

  async signUp(email: string, password: string, displayName?: string) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: displayName || email.split('@')[0],
        },
      },
    });

    if (error) throw error;
    if (data.user) {
      await storage.setCurrentPlayer(data.user.id);
    }
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    await storage.setCurrentPlayer(null);
    if (error) throw error;
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async getCurrentUserId() {
    const session = await this.getSession();
    return session?.user.id ?? null;
  },

  async getCurrentProfile(): Promise<Profile | null> {
    const userId = await this.getCurrentUserId();
    if (!userId) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data ? toProfile(data) : null;
  },

  async updateProfile(profile: Partial<Profile>) {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('You must be signed in to update your profile.');

    const { data, error } = await supabase
      .from('profiles')
      .update({
        email: profile.email,
        phone: profile.phone,
        first_name: profile.firstName,
        last_name: profile.lastName,
        display_name: profile.displayName,
        default_settings: profile.defaultSettings,
      })
      .eq('id', userId)
      .select('*')
      .single();

    if (error) throw error;
    return toProfile(data);
  },
};

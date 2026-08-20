import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { ProfileDefaults } from '@/types/database';
import { Player } from '@/types/player';
import { DEFAULT_PROFILE_SETTINGS } from '@/utils/scoring';
import { isClockSkewError } from '@/utils/supabaseErrors';
import { storage } from '@/utils/storage';

export type Profile = {
  id: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  playerCode?: string;
  defaultSettings: ProfileDefaults;
  role: 'app_admin' | 'player';
};

export const profileToPlayer = (profile: Profile): Player => ({
  id: profile.id,
  name: profile.displayName,
  playerCode: profile.playerCode,
  email: profile.email,
  phone: profile.phone,
  role: profile.role === 'app_admin' ? 'admin' : 'player',
});

const toProfile = (row: any): Profile => ({
  id: row.id,
  email: row.email ?? undefined,
  phone: row.phone ?? undefined,
  firstName: row.first_name ?? undefined,
  lastName: row.last_name ?? undefined,
  displayName: row.display_name,
  playerCode: row.player_code ?? undefined,
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
    if (data.session?.user) {
      await storage.setCurrentPlayer(data.session.user.id);
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
    if (data.session?.user) {
      await storage.setCurrentPlayer(data.session.user.id);
    }
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    await storage.setCurrentPlayer(null);
    if (error) throw error;
  },

  /** Drop local session without requiring a network round-trip. */
  async clearLocalSession() {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Ignore — storage clear below is what unblocks the UI.
    }
    await storage.setCurrentPlayer(null);
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async refreshSession() {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    if (data.session?.user) {
      await storage.setCurrentPlayer(data.session.user.id);
    }
    return data.session;
  },

  /** Refresh when possible so slightly skewed / stale tokens recover. */
  async ensureFreshSession() {
    const session = await this.getSession();
    if (!session) return null;

    try {
      return (await this.refreshSession()) ?? session;
    } catch {
      return session;
    }
  },

  /**
   * After Supabase pause/wake, access tokens can be rejected with PGRST303.
   * Try one refresh; if that still fails, clear the local session so login works.
   */
  async recoverFromStaleSession(): Promise<boolean> {
    try {
      const refreshed = await this.refreshSession();
      return Boolean(refreshed);
    } catch {
      await this.clearLocalSession();
      return false;
    }
  },

  async getCurrentUserId() {
    const session = await this.getSession();
    return session?.user.id ?? null;
  },

  async getCurrentProfile(): Promise<Profile | null> {
    const fetchProfile = async () => {
      const userId = await this.getCurrentUserId();
      if (!userId) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      return data ? toProfile(data) : null;
    };

    try {
      return await fetchProfile();
    } catch (error) {
      if (!isClockSkewError(error)) throw error;

      const recovered = await this.recoverFromStaleSession();
      if (!recovered) return null;
      return await fetchProfile();
    }
  },

  async getCurrentPlayer(): Promise<Player | null> {
    if (isSupabaseConfigured) {
      const profile = await this.getCurrentProfile();
      return profile ? profileToPlayer(profile) : null;
    }

    const playerId = await storage.getCurrentPlayer();
    if (!playerId) return null;

    const players = await storage.getPlayers();
    return players.find((player) => player.id === playerId) ?? null;
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

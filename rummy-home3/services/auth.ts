import { displayPlayerId } from '@/utils/playerIdentity';
import { normalizeEmail } from '@/utils/playerIdentity';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { authRedirectUrl } from '@/utils/authRedirect';
import type { PasscodeAuthClient } from '@/utils/passcodeFlow';
import { ProfileDefaults } from '@/types/database';
import { Player } from '@/types/player';
import { DEFAULT_PROFILE_SETTINGS } from '@/utils/scoring';
import { isClockSkewError } from '@/utils/supabaseErrors';
import { storage } from '@/utils/storage';
import { gameCache } from '@/utils/gameCache';

export type Profile = {
  id: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  playerCode?: string;
  playerNo?: number;
  defaultSettings: ProfileDefaults;
  role: 'app_admin' | 'player';
};

export const profileToPlayer = (profile: Profile): Player => ({
  id: profile.id,
  name: profile.displayName,
  playerCode: profile.playerCode,
  playerNo: profile.playerNo,
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
  playerCode: displayPlayerId(row),
  playerNo: row.public_player_no ?? undefined,
  defaultSettings: row.default_settings ?? DEFAULT_PROFILE_SETTINGS,
  role: row.role ?? 'player',
});

/** PostgREST: the relation is not in the schema cache (migration 019's view not applied yet). */
const missingRelation = (error: { code?: string; message?: string } | null | undefined) => {
  const code = error?.code ?? '';
  const message = (error?.message ?? '').toLowerCase();
  return code === 'PGRST205' || code === '42P01' || (message.includes('my_profile') && message.includes('schema cache'));
};

/**
 * The signed-in account's own row, every column. Since migration 019 the contact
 * columns (email, phone, zip) are readable only through the `my_profile` view;
 * `select *` on profiles is refused. Before 019 the view does not exist, so the
 * table is read directly as before.
 */
async function readOwnProfile(userId: string): Promise<Profile | null> {
  const own = await supabase.from('my_profile').select('*').eq('id', userId).maybeSingle();
  if (!own.error) return own.data ? toProfile(own.data) : null;
  if (!missingRelation(own.error)) throw own.error;

  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data ? toProfile(data) : null;
}

const errorText = (error: { message?: string } | null | undefined) => (error ? error.message || 'Something went wrong.' : null);

/** The passcode flows (utils/passcodeFlow.ts) talk to Supabase through this adapter. */
export const passcodeClient: PasscodeAuthClient = {
  async requestCode(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), { redirectTo: authRedirectUrl() });
    return { error: errorText(error) };
  },
  async verifyCode(email, code) {
    const { error } = await supabase.auth.verifyOtp({ email: normalizeEmail(email), token: code, type: 'recovery' });
    return { error: errorText(error) };
  },
  async setPasscode(next, nonce) {
    const { error } = await supabase.auth.updateUser(nonce ? { password: next, nonce } : { password: next });
    return { error: errorText(error) };
  },
  async checkCurrent(email, current) {
    const { error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password: current });
    return { error: errorText(error) };
  },
  async requestReauthentication() {
    const { error } = await supabase.auth.reauthenticate();
    return { error: errorText(error) };
  },
  async signOut() {
    await supabase.auth.signOut();
    await storage.setCurrentPlayer(null);
  },
};

export const authService = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });

    if (error) throw error;
    if (data.session?.user) {
      await storage.setCurrentPlayer(data.session.user.id);
    }
    return data;
  },

  async signUp(email: string, password: string, displayName?: string, extra: { phone?: string | null; zip_code?: string | null } = {}) {
    const { data, error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: {
        emailRedirectTo: authRedirectUrl(),
        data: {
          display_name: displayName || email.split('@')[0],
          ...(extra.phone ? { phone: extra.phone } : {}),
          ...(extra.zip_code ? { zip_code: extra.zip_code } : {}),
        },
      },
    });

    if (error) throw error;
    if (data.session?.user) {
      await storage.setCurrentPlayer(data.session.user.id);
    }
    return data;
  },

  /** Sends the sign-up confirmation link again (Supabase email confirmation). */
  async resendConfirmation(email: string) {
    const { error } = await supabase.auth.resend({ type: 'signup', email: normalizeEmail(email), options: { emailRedirectTo: authRedirectUrl() } });
    if (error) throw error;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    await storage.setCurrentPlayer(null);
    gameCache.clear();
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
    gameCache.clear();
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
      return readOwnProfile(userId);
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
      .select('id')
      .single();

    if (error) throw error;
    const fresh = await readOwnProfile(data.id as string);
    if (!fresh) throw new Error('Your profile could not be read back. Sign out and back in, then try again.');
    return fresh;
  },

  /**
   * Phone only. Sends exactly one column, so nothing else about the profile can
   * be clobbered, and null really clears the number. A zero-row update (RLS or a
   * missing profile row) is reported instead of silently "succeeding".
   */
  async updatePhone(phone: string | null): Promise<string | null> {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('You must be signed in to update your profile.');

    const { data, error } = await supabase
      .from('profiles')
      .update({ phone })
      .eq('id', userId)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Your profile could not be updated. Sign out and back in, then try again.');
    // `phone` is readable only through my_profile since 019 (RETURNING phone is refused), so read it back.
    const fresh = await readOwnProfile(userId);
    return fresh?.phone ?? phone;
  },
};

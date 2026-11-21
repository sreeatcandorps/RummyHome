import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '@/services/auth';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { TutorialKey } from '@/utils/tutorials';
import { queryCache } from '@/utils/queryCache';

const LOCAL_KEY = 'tutorialsSeen';

/** What the tutorials remember about one person. */
export type TutorialFlag = `${TutorialKey}TutorialSeen` | `${TutorialKey}ToastSeen`;

/** The key under profiles.default_settings (jsonb, no migration): `{ "seatingTutorialSeen": true }`. */
export const flagKey = (key: TutorialKey, what: 'tutorial' | 'toast'): TutorialFlag => (what === 'tutorial' ? `${key}TutorialSeen` : `${key}ToastSeen`);

type LocalFlags = Record<string, Record<string, boolean>>;

/** Per person on this phone (`anon` when signed out), so a shared phone still shows each new player the steps. */
async function readLocal(): Promise<LocalFlags> {
  return AsyncStorage.getItem(LOCAL_KEY).then((raw) => (raw ? (JSON.parse(raw) as LocalFlags) : {})).catch(() => ({}));
}

async function who(): Promise<string> {
  if (!isSupabaseConfigured) return 'anon';
  return (await authService.getCurrentUserId().catch(() => null)) ?? 'anon';
}

async function readServer(userId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.from('profiles').select('default_settings').eq('id', userId).maybeSingle();
  if (error || !data) return null;
  return (data.default_settings as Record<string, unknown> | null) ?? null;
}

/**
 * Seen-flags for the step-by-step tutorials (D61). The server copy on the person's profile wins
 * (one phone or three, they see the forced run once); the device copy covers signed-out, offline and
 * the time before the server answers. Any error reads as "not seen" — one extra showing beats a
 * tutorial that never appears.
 */
export const tutorialsService = {
  async seen(flag: TutorialFlag): Promise<boolean> {
    const userId = await who();
    const local = await readLocal();
    if (local[userId]?.[flag]) return true;
    if (userId === 'anon') return false;
    try {
      const server = await readServer(userId);
      return server?.[flag] === true;
    } catch {
      return false;
    }
  },

  async markSeen(flag: TutorialFlag): Promise<void> {
    const userId = await who();
    const local = await readLocal();
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify({ ...local, [userId]: { ...(local[userId] ?? {}), [flag]: true } })).catch(() => undefined);
    if (userId === 'anon') return;
    try {
      const server = (await readServer(userId)) ?? {};
      if (server[flag] === true) return;
      await supabase.from('profiles').update({ default_settings: { ...server, [flag]: true } } as any).eq('id', userId);
      queryCache.invalidate('profile:');
    } catch {
      // The device copy is set; the next markSeen (or the next phone) writes the server one.
    }
  },
};

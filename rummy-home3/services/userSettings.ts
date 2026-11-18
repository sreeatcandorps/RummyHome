import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { allRulesFromProfileDefaults, DEFAULT_POINTS_RULES, DEFAULT_POOL_RULES, GameKind, PointsRules, rulesFromProfileDefaults, rulesToProfileDefaults } from '@/utils/gameSettings';
import { queryCache } from '@/utils/queryCache';

const KEY = 'userGameDefaults';

export type UserDefaults = { startsAs: GameKind; points: PointsRules; pool: PointsRules };

const FALLBACK: UserDefaults = { startsAs: 'points', points: DEFAULT_POINTS_RULES, pool: DEFAULT_POOL_RULES };

async function readLocal(): Promise<Record<string, unknown> | null> {
  return AsyncStorage.getItem(KEY).then((raw) => (raw ? JSON.parse(raw) as Record<string, unknown> : null)).catch(() => null);
}

async function readServer(userId: string | null): Promise<Record<string, unknown> | null> {
  if (!isSupabaseConfigured || !userId) return null;
  const { data, error } = await supabase.from('profiles').select('default_settings').eq('id', userId).maybeSingle();
  if (error || !data) return null;
  return (data.default_settings as Record<string, unknown> | null) ?? null;
}

/**
 * User settings: which kind a new game starts as, and the Points and Pool defaults every new game
 * is prefilled with (D1). The server copy (profiles.default_settings) wins; the device copy covers
 * signed-out and offline.
 */
export const userSettingsService = {
  /** Both kinds' defaults and which one New game starts as. */
  async getAll(userId: string | null): Promise<UserDefaults> {
    const server = await readServer(userId);
    const local = await readLocal();
    const source = server ?? local;
    if (!source) return FALLBACK;
    return allRulesFromProfileDefaults(source);
  },

  /** The defaults for one kind (New game, Game type screen). */
  async getFor(userId: string | null, kind: GameKind): Promise<PointsRules> {
    const all = await this.getAll(userId);
    return kind === 'pool' ? all.pool : all.points;
  },

  /** The kind New game starts as, with its defaults. */
  async get(userId: string | null): Promise<PointsRules> {
    const all = await this.getAll(userId);
    return all.startsAs === 'pool' ? all.pool : all.points;
  },

  /** Saves one kind's defaults (the other kind's keys stay) and, when given, which kind New game starts as. */
  async save(userId: string | null, rules: PointsRules, startsAs?: GameKind): Promise<void> {
    const patch = { ...rulesToProfileDefaults(rules), ...(startsAs ? { gameKind: startsAs } : {}) };
    const local = (await readLocal()) ?? {};
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...local, ...patch }));
    if (!isSupabaseConfigured || !userId) return;
    const server = (await readServer(userId)) ?? {};
    const merged = { ...server, ...patch };
    const { error } = await supabase.from('profiles').update({ default_settings: merged } as any).eq('id', userId);
    if (error) throw error;
    // The memoised own-profile row (authService) carries default_settings; drop it.
    queryCache.invalidate('profile:');
  },

  /** Saves both blocks and the starting kind in one write (Settings screen). */
  async saveAll(userId: string | null, defaults: UserDefaults): Promise<void> {
    const patch = { ...rulesToProfileDefaults(defaults.points), ...rulesToProfileDefaults(defaults.pool), gameKind: defaults.startsAs };
    const local = (await readLocal()) ?? {};
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...local, ...patch }));
    if (!isSupabaseConfigured || !userId) return;
    const server = (await readServer(userId)) ?? {};
    const { error } = await supabase.from('profiles').update({ default_settings: { ...server, ...patch } } as any).eq('id', userId);
    if (error) throw error;
    queryCache.invalidate('profile:');
  },
};

export { rulesFromProfileDefaults };

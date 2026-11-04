import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { DEFAULT_POINTS_RULES, PointsRules, rulesFromProfileDefaults, rulesToProfileDefaults } from '@/utils/gameSettings';

const KEY = 'userGameDefaults';

/** User settings: the game type and the Drop / Middle drop every new game starts with. */
export const userSettingsService = {
  async get(userId: string | null): Promise<PointsRules> {
    const local = await AsyncStorage.getItem(KEY).then((raw) => (raw ? JSON.parse(raw) as PointsRules : null)).catch(() => null);
    if (!isSupabaseConfigured || !userId) return local ?? DEFAULT_POINTS_RULES;
    const { data, error } = await supabase.from('profiles').select('default_settings').eq('id', userId).maybeSingle();
    if (error || !data) return local ?? DEFAULT_POINTS_RULES;
    return rulesFromProfileDefaults(data.default_settings as any);
  },

  async save(userId: string | null, rules: PointsRules): Promise<void> {
    await AsyncStorage.setItem(KEY, JSON.stringify(rules));
    if (!isSupabaseConfigured || !userId) return;
    const { data } = await supabase.from('profiles').select('default_settings').eq('id', userId).maybeSingle();
    const merged = { ...((data?.default_settings as any) ?? {}), ...rulesToProfileDefaults(rules) };
    const { error } = await supabase.from('profiles').update({ default_settings: merged } as any).eq('id', userId);
    if (error) throw error;
  },
};

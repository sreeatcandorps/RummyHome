import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Which saved results were shared from this phone (picture or PDF sent, link included).
 * Nothing on the server records a share, so this is the one signal Delete has for "ask
 * first" (D9.2). A share sheet that was opened counts as shared even if it was then
 * dismissed: better one extra question than a silent delete of something already sent.
 */
const KEY = 'sharedResults';
/** Enough for years of results; the oldest ids fall off first. */
export const SHARED_RESULTS_CAP = 200;

/** Pure: the id moves to the front; the list never grows past the cap. */
export function addShared(ids: string[], id: string, cap: number = SHARED_RESULTS_CAP): string[] {
  return [id, ...ids.filter((item) => item !== id)].slice(0, cap);
}

async function read(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export const sharedResults = {
  async mark(resultId: string): Promise<void> {
    await AsyncStorage.setItem(KEY, JSON.stringify(addShared(await read(), resultId)));
  },
  async was(resultId: string): Promise<boolean> {
    return (await read()).includes(resultId);
  },
  async clear(): Promise<void> {
    await AsyncStorage.removeItem(KEY);
  },
};

/**
 * A small read cache for the service layer: one in-flight request per key, a
 * memory copy with a staleness window, and (opt-in) a persisted copy so a cold
 * start can show the last answer while the fresh one loads.
 *
 * Reads never change what a screen eventually shows: `read()` returns the memory
 * copy only while it is younger than `staleTime`, and every successful fetch
 * replaces it. Writes in the services call `invalidate()` for the keys they touch.
 */
type Entry = { value: unknown; at: number };

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const memory = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const persisted = new Set<string>();
const PERSIST_PREFIX = 'qc:';

let storage: Storage | null | undefined;
async function store(): Promise<Storage | null> {
  if (storage !== undefined) return storage;
  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    storage = AsyncStorage as unknown as Storage;
  } catch {
    storage = null;
  }
  return storage;
}

export type ReadOptions = {
  /** Serve the memory copy without fetching while it is younger than this (ms). Default 0: always fetch, but dedupe. */
  staleTime?: number;
  /** Also keep the value in AsyncStorage so `restore()` can seed the next cold start. */
  persist?: boolean;
};

export const queryCache = {
  /** The memory copy, however old, or null. */
  peek<T>(key: string): T | null {
    const hit = memory.get(key);
    return hit ? (hit.value as T) : null;
  },

  /** How old the memory copy is in ms, or null when there is none. */
  ageOf(key: string, now = Date.now()): number | null {
    const hit = memory.get(key);
    return hit ? now - hit.at : null;
  },

  /** Fetch through the cache: fresh memory copy, else the one request already in flight, else a new one. */
  async read<T>(key: string, fetcher: () => Promise<T>, options: ReadOptions = {}): Promise<T> {
    const { staleTime = 0, persist = false } = options;
    const hit = memory.get(key);
    if (hit && staleTime > 0 && Date.now() - hit.at < staleTime) return hit.value as T;
    const pending = inflight.get(key);
    if (pending) return pending as Promise<T>;
    const request = (async () => {
      try {
        const value = await fetcher();
        this.set(key, value, persist);
        return value;
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, request);
    return request;
  },

  /** Put a value that arrived some other way (for example inside a bundle). */
  set<T>(key: string, value: T, persist = false): T {
    memory.set(key, { value, at: Date.now() });
    if (persist) {
      persisted.add(key);
      store().then((s) => s?.setItem(PERSIST_PREFIX + key, JSON.stringify(value))).catch(() => {});
    }
    return value;
  },

  /** The persisted copy from an earlier run (also placed in memory), or null. */
  async restore<T>(key: string): Promise<T | null> {
    const hit = memory.get(key);
    if (hit) return hit.value as T;
    try {
      const s = await store();
      const raw = s ? await s.getItem(PERSIST_PREFIX + key) : null;
      if (!raw) return null;
      const value = JSON.parse(raw) as T;
      // Restored copies are stale by definition: `at: 0` makes read() fetch again.
      memory.set(key, { value, at: 0 });
      persisted.add(key);
      return value;
    } catch {
      return null;
    }
  },

  /** Drop every key that starts with `prefix` (memory and persisted). */
  invalidate(prefix: string) {
    [...memory.keys()].filter((key) => key.startsWith(prefix)).forEach((key) => memory.delete(key));
    [...persisted].filter((key) => key.startsWith(prefix)).forEach((key) => {
      persisted.delete(key);
      store().then((s) => s?.removeItem(PERSIST_PREFIX + key)).catch(() => {});
    });
  },

  /** Sign-out: forget everything, including persisted copies. */
  clear() {
    const keys = [...persisted];
    memory.clear();
    inflight.clear();
    persisted.clear();
    keys.forEach((key) => { store().then((s) => s?.removeItem(PERSIST_PREFIX + key)).catch(() => {}); });
  },

  /** For tests and diagnostics. */
  size: () => memory.size,
  inflightCount: () => inflight.size,
};

export type Appearance = 'system' | 'light' | 'dark';

/**
 * PR 5: the app opens Light until the person chooses otherwise in Profile (a first launch on a
 * phone in dark mode used to come up dark). "Phone" stays available as a choice, which is why
 * app.json keeps userInterfaceStyle "automatic": the OS scheme must still be readable. One
 * constant, read by the context and the settings reader.
 */
export const DEFAULT_APPEARANCE: Appearance = 'light';

export const APPEARANCE_OPTIONS: { value: Appearance; label: string; icon: string }[] = [
  { value: 'system', label: 'Phone', icon: 'cellphone' },
  { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
  { value: 'dark', label: 'Dark', icon: 'weather-night' },
];

/**
 * Settings written before the appearance choice existed only had `darkMode`. Someone who
 * had switched dark mode on keeps it; everyone else gets the default (Light).
 */
export function appearanceFromSettings(saved: unknown): Appearance {
  const settings = (saved && typeof saved === 'object' ? saved : {}) as { appearance?: unknown; darkMode?: unknown };
  if (settings.appearance === 'system' || settings.appearance === 'light' || settings.appearance === 'dark') return settings.appearance;
  return settings.darkMode === true ? 'dark' : DEFAULT_APPEARANCE;
}

/** `system` reads the phone's scheme; an unknown scheme (web without a preference) is light. */
export function resolveDarkMode(appearance: Appearance, scheme: 'light' | 'dark' | null | undefined): boolean {
  if (appearance === 'dark') return true;
  if (appearance === 'light') return false;
  return scheme === 'dark';
}

export type Appearance = 'system' | 'light' | 'dark';

export const APPEARANCE_OPTIONS: { value: Appearance; label: string; icon: string }[] = [
  { value: 'system', label: 'Phone', icon: 'cellphone' },
  { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
  { value: 'dark', label: 'Dark', icon: 'weather-night' },
];

/**
 * Settings written before the appearance choice existed only had `darkMode`. Someone who
 * had switched dark mode on keeps it; everyone else follows the phone from now on.
 */
export function appearanceFromSettings(saved: unknown): Appearance {
  const settings = (saved && typeof saved === 'object' ? saved : {}) as { appearance?: unknown; darkMode?: unknown };
  if (settings.appearance === 'system' || settings.appearance === 'light' || settings.appearance === 'dark') return settings.appearance;
  return settings.darkMode === true ? 'dark' : 'system';
}

/** `system` reads the phone's scheme; an unknown scheme (web without a preference) is light. */
export function resolveDarkMode(appearance: Appearance, scheme: 'light' | 'dark' | null | undefined): boolean {
  if (appearance === 'dark') return true;
  if (appearance === 'light') return false;
  return scheme === 'dark';
}

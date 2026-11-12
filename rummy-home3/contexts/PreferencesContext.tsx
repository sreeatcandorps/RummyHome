import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, appearanceFromSettings, resolveDarkMode } from '@/utils/appearance';

/** Same key the Settings screen has always written its preferences to. */
export const SETTINGS_KEY = 'rummy_settings';

type PreferencesContextValue = {
  /** System / Light / Dark as chosen in Profile; `system` follows the phone. */
  appearance: Appearance;
  /** The theme in force right now, after resolving `system` against the phone setting. */
  darkMode: boolean;
  ready: boolean;
  setAppearance: (value: Appearance) => void;
  /** Kept for callers that still think in on/off; `true` is Dark, `false` is Light. */
  setDarkMode: (value: boolean) => void;
};

const PreferencesContext = createContext<PreferencesContextValue>({
  appearance: 'system',
  darkMode: false,
  ready: false,
  setAppearance: () => {},
  setDarkMode: () => {},
});

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearanceState] = useState<Appearance>('system');
  const [ready, setReady] = useState(false);
  const scheme = useColorScheme();

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((saved) => {
        if (saved) setAppearanceState(appearanceFromSettings(JSON.parse(saved)));
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setAppearance = useCallback((value: Appearance) => {
    setAppearanceState(value);
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((saved) => {
        const current = saved ? JSON.parse(saved) : {};
        // darkMode stays written for anything older that still reads it.
        return AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, appearance: value, darkMode: value === 'dark' }));
      })
      .catch(() => {});
  }, []);

  const setDarkMode = useCallback((value: boolean) => setAppearance(value ? 'dark' : 'light'), [setAppearance]);

  const darkMode = resolveDarkMode(appearance, scheme);
  const value = useMemo(
    () => ({ appearance, darkMode, ready, setAppearance, setDarkMode }),
    [appearance, darkMode, ready, setAppearance, setDarkMode],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export const usePreferences = () => useContext(PreferencesContext);

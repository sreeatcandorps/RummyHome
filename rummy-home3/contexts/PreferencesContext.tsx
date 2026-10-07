import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Same key the Settings screen has always written its preferences to. */
export const SETTINGS_KEY = 'rummy_settings';

type PreferencesContextValue = {
  darkMode: boolean;
  ready: boolean;
  setDarkMode: (value: boolean) => void;
};

const PreferencesContext = createContext<PreferencesContextValue>({
  darkMode: false,
  ready: false,
  setDarkMode: () => {},
});

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkModeState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((saved) => {
        if (saved) setDarkModeState(Boolean(JSON.parse(saved)?.darkMode));
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setDarkMode = useCallback((value: boolean) => setDarkModeState(value), []);

  const value = useMemo(() => ({ darkMode, ready, setDarkMode }), [darkMode, ready, setDarkMode]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export const usePreferences = () => useContext(PreferencesContext);

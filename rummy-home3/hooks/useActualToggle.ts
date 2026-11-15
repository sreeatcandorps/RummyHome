import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACTUAL_TOGGLE_DEFAULT, ACTUAL_TOGGLE_KEY, readActualToggle, writeActualToggle } from '@/utils/multiplier';

/**
 * PR 14 (Q14.7): the scorecard's Actual / Entered view, remembered on this phone (not per game).
 * ON by default. It only changes what the grid displays; nothing saved or shared follows it.
 */
export function useActualToggle(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(ACTUAL_TOGGLE_DEFAULT);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(ACTUAL_TOGGLE_KEY)
      .then((raw) => { if (alive) setOn(readActualToggle(raw)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const set = useCallback((next: boolean) => {
    setOn(next);
    AsyncStorage.setItem(ACTUAL_TOGGLE_KEY, writeActualToggle(next)).catch(() => {});
  }, []);
  return [on, set];
}

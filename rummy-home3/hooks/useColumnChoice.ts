import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLUMN_CHOICE_DEFAULT, COLUMN_CHOICE_KEY, ColumnChoice, readColumnChoice, writeColumnChoice } from '@/utils/scorecardLayout';

/**
 * D90: the portrait scorecard's 5 · 7 · Max, remembered on this phone for every game. The ⋮ › Columns row
 * and a pinch on the table both write it.
 */
export function useColumnChoice(): [ColumnChoice, (choice: ColumnChoice) => void] {
  const [choice, setChoice] = useState<ColumnChoice>(COLUMN_CHOICE_DEFAULT);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(COLUMN_CHOICE_KEY)
      .then((raw) => { if (alive) setChoice(readColumnChoice(raw)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const set = useCallback((next: ColumnChoice) => {
    setChoice(next);
    AsyncStorage.setItem(COLUMN_CHOICE_KEY, writeColumnChoice(next)).catch(() => {});
  }, []);
  return [choice, set];
}

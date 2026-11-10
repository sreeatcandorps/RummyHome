import { useCallback, useEffect, useReducer, useRef } from 'react';
import { AppState } from 'react-native';
import { headerMenuReducer } from '@/utils/headerMenu';

/** Paper's Menu needs its close animation to finish before another overlay (a share sheet) opens. */
export const MENU_CLOSE_MS = 260;

/**
 * Drives a header ⋮ menu that launches native share sheets.
 *
 * Why: tapping a menu item closed the menu and opened the Android share Activity in the same
 * tick. Coming back, the menu was sometimes left half-dismissed (invisible backdrop eating
 * taps) so ⋮ "stopped working". This hook (1) waits for the menu to finish closing before the
 * action runs, (2) remounts the menu (new `menuKey`) after every close, after every action and
 * whenever the app returns to the foreground during one, and (3) lets only one action run at a time.
 */
export function useMenuThenShare() {
  const [state, dispatch] = useReducer(headerMenuReducer, { open: false, key: 0 });
  const running = useRef(false);

  const reset = useCallback(() => dispatch('reset'), []);
  const setOpen = useCallback((next: boolean) => dispatch(next ? 'open' : 'close'), []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (appState) => {
      if (appState === 'active' && running.current) reset();
    });
    return () => sub.remove();
  }, [reset]);

  const run = useCallback((action: () => Promise<void> | void) => {
    if (running.current) return;
    running.current = true;
    dispatch('close');
    setTimeout(async () => {
      try {
        await action();
      } finally {
        running.current = false;
        reset();
      }
    }, MENU_CLOSE_MS);
  }, [reset]);

  return { open: state.open, setOpen, menuKey: state.key, run };
}

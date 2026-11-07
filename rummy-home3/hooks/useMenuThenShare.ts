import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

/** Paper's Menu needs its close animation to finish before another overlay (a share sheet) opens. */
export const MENU_CLOSE_MS = 260;

/**
 * Drives a header ⋮ menu that launches native share sheets.
 *
 * Why: tapping a menu item closed the menu and opened the Android share Activity in the same
 * tick. Coming back, the menu was sometimes left half-dismissed (invisible backdrop eating
 * taps) so ⋮ "stopped working". This hook (1) waits for the menu to finish closing before the
 * action runs, (2) remounts the menu (new `menuKey`) after every action and whenever the app
 * returns to the foreground during one, and (3) lets only one action run at a time.
 */
export function useMenuThenShare() {
  const [open, setOpen] = useState(false);
  const [menuKey, setMenuKey] = useState(0);
  const running = useRef(false);

  const reset = useCallback(() => {
    setOpen(false);
    setMenuKey((key) => key + 1);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && running.current) reset();
    });
    return () => sub.remove();
  }, [reset]);

  const run = useCallback((action: () => Promise<void> | void) => {
    if (running.current) return;
    running.current = true;
    setOpen(false);
    setTimeout(async () => {
      try {
        await action();
      } finally {
        running.current = false;
        reset();
      }
    }, MENU_CLOSE_MS);
  }, [reset]);

  return { open, setOpen, menuKey, run };
}

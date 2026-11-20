import { useCallback, useEffect, useState } from 'react';
import { flagKey, tutorialsService } from '@/services/tutorials';
import { TutorialKey } from '@/utils/tutorials';

/**
 * One tutorial's showing (D61). On the first visit to the screen (`active` true, flag not seen) it
 * opens forced; `show()` opens it again on request (Show me, Help › Watch how), dismissable.
 * `done()` closes it and remembers the person has seen it.
 */
export function useTutorial(key: TutorialKey, active = true) {
  const [visible, setVisible] = useState(false);
  const [forced, setForced] = useState(false);
  const [checked, setChecked] = useState(false);
  const flag = flagKey(key, 'tutorial');

  useEffect(() => {
    if (!active || checked) return;
    let cancelled = false;
    tutorialsService.seen(flag).then((seen) => {
      if (cancelled) return;
      setChecked(true);
      if (!seen) { setForced(true); setVisible(true); }
    });
    return () => { cancelled = true; };
  }, [active, checked, flag]);

  const show = useCallback(() => { setForced(false); setVisible(true); }, []);
  const done = useCallback(() => {
    setVisible(false);
    setForced(false);
    setChecked(true);
    void tutorialsService.markSeen(flag);
  }, [flag]);

  return { visible, forced, show, done };
}

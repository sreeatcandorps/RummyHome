import { useCallback, useState } from 'react';
import { TutorialKey } from '@/utils/tutorials';

/**
 * One tutorial's showing. It opens only on request — Show me on the screen, Watch how in Help — and
 * closes on Got it or a tap outside. D74 (Sree, Nov 23: "I don't want it to pop up as a default
 * anymore") replaced D61's forced first-time run; the `seen` flag on the profile is no longer read.
 */
export function useTutorial(_key: TutorialKey) {
  const [visible, setVisible] = useState(false);
  const show = useCallback(() => setVisible(true), []);
  const done = useCallback(() => setVisible(false), []);
  return { visible, show, done };
}

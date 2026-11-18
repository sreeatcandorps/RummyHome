export type HeaderMenuState = { open: boolean; key: number };
export type HeaderMenuAction = 'open' | 'close' | 'reset';

/**
 * Every close hands the next tap a brand-new Menu instance (`key` changes).
 *
 * Paper's Menu tracks "shown" in a ref that is only set when its open animation
 * finishes. Dismiss it before that (a quick tap outside, or a re-render from a
 * live update on a view-only scorecard while it is opening) and the instance is
 * left believing it is still shown: the next `visible` does nothing and ⋮ looks
 * dead until the screen is left and reopened. A fresh instance cannot be stale.
 */
export function headerMenuReducer(state: HeaderMenuState, action: HeaderMenuAction): HeaderMenuState {
  switch (action) {
    case 'open':
      return state.open ? state : { ...state, open: true };
    case 'close':
      return { open: false, key: state.key + 1 };
    case 'reset':
      return { open: false, key: state.key + 1 };
  }
}

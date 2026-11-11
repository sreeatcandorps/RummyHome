/**
 * Trailing-edge debounce: a burst of calls runs `fn` once, `waitMs` after the last
 * call. `cancel()` drops a pending run (on unmount).
 */
export function debounceTrailing(fn: () => void, waitMs: number): (() => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, waitMs);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}

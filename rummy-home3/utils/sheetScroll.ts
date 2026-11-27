/**
 * Where to scroll so [top, bottom] is in a list `listHeight` tall now scrolled to `offset`; null when it already is.
 * Taller than the list: its bottom (where the buttons are) wins.
 */
export function revealOffset(range: { top: number; bottom: number }, offset: number, listHeight: number): number | null {
  if (range.bottom - range.top > listHeight) return Math.max(0, range.bottom - listHeight);
  if (range.top < offset) return Math.max(0, range.top);
  if (range.bottom > offset + listHeight) return range.bottom - listHeight;
  return null;
}

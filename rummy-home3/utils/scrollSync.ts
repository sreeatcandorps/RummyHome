/**
 * Keeps two horizontal scroll views at the same offset (the scorecard header and
 * its rows). Whichever one the finger moves drives the other through `scrollTo`.
 *
 * A programmatic scrollTo fires the target's own scroll event; without a guard
 * that echo would scroll the source again and the two would chase each other.
 * The guard is the last known offset of each side: an event that only confirms
 * the offset the other side already has is ignored, so one gesture costs one
 * scrollTo per frame and never loops.
 */
export type ScrollSide = 'header' | 'body';

const other = (side: ScrollSide): ScrollSide => (side === 'header' ? 'body' : 'header');

export function createScrollSync(scrollTo: (side: ScrollSide, x: number) => void) {
  const offsets: Record<ScrollSide, number> = { header: 0, body: 0 };
  return {
    offsets,
    /** Feed every scroll event here. Returns true when the other side was moved. */
    onScroll(side: ScrollSide, x: number): boolean {
      offsets[side] = x;
      const target = other(side);
      if (Math.abs(offsets[target] - x) < 0.5) return false;
      offsets[target] = x;
      scrollTo(target, x);
      return true;
    },
  };
}

/**
 * How far `AuthShell` scrolls so the bottom of the form card sits `gap` above the keyboard, plus `room` for a strip
 * the keyboard adds after it reported its height. The room never scrolls the card's top off screen; when the card
 * alone does not fit, its bottom wins, as before. 0 means no scroll.
 */
export function cardScrollY({ cardTop, cardBottom, viewport, gap, room }: {
  /** The card's top in the scroll content. */
  cardTop: number;
  /** The card's bottom, measured from `cardTop`. */
  cardBottom: number;
  /** The ScrollView's height above the keyboard. */
  viewport: number;
  gap: number;
  room: number;
}): number {
  const overflow = cardTop + cardBottom + gap - viewport;
  return Math.max(0, overflow, Math.min(overflow + room, cardTop));
}

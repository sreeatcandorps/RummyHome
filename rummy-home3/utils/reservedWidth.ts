/**
 * D89 (Sree, Nov 24): a list-row value that must never be cut ("ST", "SREE") reserves room for `chars` letters at
 * the current font scale. W is the widest Roboto capital (about 0.9 em), so `chars` of it is a safe reservation.
 */
export function reservedValueWidth(chars: number, fontSize: number, fontScale: number): number {
  return Math.ceil(chars * fontSize * fontScale * 0.9);
}

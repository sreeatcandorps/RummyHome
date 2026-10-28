/** A person just added from Find, to check on New game when that screen returns. */
let pendingId: string | null = null;

export function markPlayerToCheck(playerId: string) {
  pendingId = playerId;
}

export function takePlayerToCheck(): string | null {
  const id = pendingId;
  pendingId = null;
  return id;
}

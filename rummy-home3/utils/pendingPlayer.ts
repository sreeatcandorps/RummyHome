/**
 * People added from "Add player to new game" while New game is behind it.
 * New game takes them when it comes back and seats them straight away.
 */
export type PendingPick = { id: string; name: string; playerCode?: string };

let pending: PendingPick[] = [];

export function queuePlayersForNewGame(current: PendingPick[], pick: PendingPick): PendingPick[] {
  if (current.some((row) => row.id === pick.id)) return current;
  return [...current, pick];
}

export function markPlayerToCheck(pick: PendingPick | string) {
  const row = typeof pick === 'string' ? { id: pick, name: 'Player' } : pick;
  pending = queuePlayersForNewGame(pending, row);
}

/** Everyone queued since the last call, in the order they were added. */
export function takePlayersToCheck(): PendingPick[] {
  const list = pending;
  pending = [];
  return list;
}

/** Kept for callers that only wanted one id. */
export function takePlayerToCheck(): string | null {
  const list = takePlayersToCheck();
  return list[0]?.id ?? null;
}

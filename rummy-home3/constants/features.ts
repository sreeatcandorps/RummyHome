/**
 * Settle, prize sessions, and stake/coin labels.
 * Off until that feature is picked back up. The screens, services, and
 * database tables stay in the repo.
 *
 * Set EXPO_PUBLIC_SETTLE_ENABLED=true to show them again.
 */
export const settleEnabled = process.env.EXPO_PUBLIC_SETTLE_ENABLED === 'true';

/** What a points game is called on screen: always "Points" (PR 13 D12: the held feature's old word is gone from the UI). */
export function pointsGameLabel(): 'Points' {
  return 'Points';
}

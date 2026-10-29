/**
 * Settle, prize sessions, and stake/coin labels.
 * Off until that feature is picked back up. The screens, services, and
 * database tables stay in the repo.
 *
 * Set EXPO_PUBLIC_SETTLE_ENABLED=true to show them again.
 */
export const settleEnabled = process.env.EXPO_PUBLIC_SETTLE_ENABLED === 'true';

/** What a points game is called on screen. Stake is the held feature's word. */
export function pointsGameLabel(): 'Stake' | 'Points' {
  return settleEnabled ? 'Stake' : 'Points';
}

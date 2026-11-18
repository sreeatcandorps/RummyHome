/**
 * Does this session need a token refresh before we rely on it?
 *
 * Supabase sessions carry `expires_at` in epoch seconds. Refreshing on every Home
 * focus costs an auth round-trip; a token with more than REFRESH_MARGIN_S of life
 * left can be used as is. Sessions with no expiry are refreshed, as before.
 */
export const REFRESH_MARGIN_S = 5 * 60;

export function sessionNeedsRefresh(
  session: { expires_at?: number | null } | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!session) return false;
  const expiresAt = session.expires_at;
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return true;
  return expiresAt - nowMs / 1000 < REFRESH_MARGIN_S;
}

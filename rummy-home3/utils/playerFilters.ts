/** Hide automated smoke/rls accounts from normal UI lists. */
export function isEphemeralTestEmail(email?: string | null): boolean {
  if (!email) return false;
  const local = email.split('@')[0] ?? '';
  return /^(smoke(\+|\.)|rls\d*\.)/i.test(local);
}

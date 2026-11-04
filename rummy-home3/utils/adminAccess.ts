/** Default matches the seed row in supabase/migrations/005_demo_data.sql. */
export const DEFAULT_ADMIN_EMAILS = 'koneru2k@gmail.com';

/** Comma-separated allowlist. Empty or unset uses the default admin. */
export function adminAllowlist(): string[] {
  const raw = process.env.EXPO_PUBLIC_ADMIN_EMAILS?.trim() || DEFAULT_ADMIN_EMAILS;
  return raw.split(',').map((email: string) => email.trim().toLowerCase()).filter((email: string) => email.length > 0);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminAllowlist().includes(email.trim().toLowerCase());
}

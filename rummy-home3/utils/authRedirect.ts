/**
 * Where Supabase sends someone after they tap the passcode-reset email.
 * This must be listed under Authentication → URL Configuration → Redirect URLs,
 * and it should also be the Site URL. If it is not allow-listed, Supabase
 * ignores it and the email falls back to the Site URL (often http://localhost:3000).
 */
export const DEFAULT_AUTH_REDIRECT_URL = 'https://sreeatcandorps.github.io/Games/';

export function authRedirectUrl(): string {
  const configured = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL?.trim();
  return configured || DEFAULT_AUTH_REDIRECT_URL;
}

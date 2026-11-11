/**
 * Telling a real sign-up from a repeated one.
 *
 * Supabase Auth keeps one user per email (auth.users has a unique index on email and
 * GoTrue stores and compares addresses lower-cased). What it does NOT do, when
 * "Confirm email" is on, is say so: a sign-up for an address that already has a
 * confirmed account answers HTTP 200 with a sanitised placeholder user — a fresh random
 * id, `identities: []`, no session, `confirmation_sent_at` = now — so the response does
 * not reveal who has an account (GoTrue internal/api/signup.go, sanitizeUser). No email
 * is sent. A brand-new user always comes back with one identity.
 *
 * Until Nov 11 the app took any answer without an error as "account created, check
 * your email" and even sent the welcome email, so a second sign-up with an existing
 * address looked like it had made a second account. Nothing was created; the phone's
 * passcode simply never worked because the original account's passcode was unchanged.
 *
 * With "Confirm email" off GoTrue instead returns 422 `user_already_exists`
 * ("User already registered"); that is mapped to the same sentence here.
 */
export const EMAIL_IN_USE_MESSAGE = 'An account with this email already exists. Sign in or reset your password.';

export const EMAIL_IN_USE_CODE = 'email_in_use';

export class EmailInUseError extends Error {
  readonly code = EMAIL_IN_USE_CODE;

  constructor(message: string = EMAIL_IN_USE_MESSAGE) {
    super(message);
    this.name = 'EmailInUseError';
  }
}

type SignUpAnswer = {
  user?: { id?: string; identities?: unknown[] | null } | null;
  session?: unknown;
} | null | undefined;

/** True for GoTrue's sanitised "this email already has an account" answer. */
export function isRepeatedSignUp(data: SignUpAnswer): boolean {
  const user = data?.user;
  if (!user) return false;
  if (data?.session) return false;
  return Array.isArray(user.identities) && user.identities.length === 0;
}

type ErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

/** True for the explicit "already registered" error (autoconfirm on) or an already mapped EmailInUseError. */
export function isEmailInUseError(error: unknown): boolean {
  if (error instanceof EmailInUseError) return true;
  const err = error as ErrorLike;
  if (!err) return false;
  if (err.code === EMAIL_IN_USE_CODE || err.code === 'user_already_exists' || err.code === 'email_exists') return true;
  const message = (err.message ?? '').toLowerCase();
  return message.includes('user already registered') || message.includes('email address is already registered');
}

import { digitsOnly, EMAIL_CODE_LENGTH, emailProblem, OTP_PATTERN, passcodeErrorMessage } from '@/utils/passcode';

/**
 * Create account confirms the email with the 6-digit code from the email, typed into the app (D101): no link, no
 * web page to land on. The Supabase "Confirm signup" template shows `{{ .Token }}`; `verifyOtp` type `signup`
 * confirms the address and returns a session, so the person is signed in at once.
 */

/** GoTrue allows one sign-up email per address per 60 s; the button waits as long. */
export const SIGNUP_RESEND_COOLDOWN_S = 60;

export const SIGNUP_CODE_TEXT = {
  title: 'Check your email',
  subtitle: (email: string) => `We sent a 6-digit code to ${email}`,
  fieldLabel: 'Code from the email',
  placeholder: '6-digit code',
  verify: 'Confirm and sign in',
  resend: 'Send a new code',
  resendIn: (seconds: number) => `Send a new code (${seconds}s)`,
  sent: (email: string) => `A new code is on its way to ${email}. Use the newest one.`,
  wrongAddress: 'Wrong address?',
  goBack: 'Go back',
  inviteNote: 'Opened an invite from a friend? Once you are in, Home asks \u201cIs this you?\u201d so your past scores move to you.',
  /** Sign in with an address that was never confirmed: the way to the code step. */
  enterCode: 'Enter the code',
} as const;

export const SIGNUP_CODE_ERRORS = {
  empty: 'Enter the 6-digit code from the email.',
  notDigits: 'The code is numbers only.',
  length: `The code is ${EMAIL_CODE_LENGTH} digits.`,
  wrongOrExpired: 'That code is wrong or has expired. Check the newest email, or tap Send a new code.',
  wait: 'Please wait a minute before asking for another code.',
  offline: 'No connection. Check your internet and try again.',
} as const;

/** What the person typed or pasted, reduced to at most six digits ("482 913" → "482913"). */
export function cleanSignUpCode(text: string): string {
  return digitsOnly(text, EMAIL_CODE_LENGTH);
}

/** Null when the code is six digits; otherwise what to fix. Checked before the server, so a typo never spends the code. */
export function signUpCodeProblem(code: string): string | null {
  if (!code) return SIGNUP_CODE_ERRORS.empty;
  if (/\D/.test(code)) return SIGNUP_CODE_ERRORS.notDigits;
  if (!OTP_PATTERN.test(code)) return SIGNUP_CODE_ERRORS.length;
  return null;
}

/**
 * A Supabase error from verifying or resending, in one plain sentence. GoTrue answers a wrong and an expired code
 * the same way ("Token has expired or is invalid", `otp_expired`), so one sentence covers both and points at
 * Send a new code.
 */
export function signUpCodeErrorMessage(raw: unknown): string {
  const message = typeof raw === 'string' ? raw : ((raw as { message?: string })?.message ?? '');
  const lower = message.toLowerCase();
  if (/otp_expired|token has expired|expired or is invalid|invalid otp|invalid token|token.*(invalid|expired)/.test(lower)) {
    return SIGNUP_CODE_ERRORS.wrongOrExpired;
  }
  if (/rate limit|only request this after|too many requests|over_email_send/.test(lower)) return SIGNUP_CODE_ERRORS.wait;
  if (/network|fetch|timeout|timed out/.test(lower)) return SIGNUP_CODE_ERRORS.offline;
  return passcodeErrorMessage(message);
}

/** True for the sign-in error of an account whose email was never confirmed. */
export function isEmailNotConfirmed(raw: unknown): boolean {
  const message = typeof raw === 'string' ? raw : ((raw as { message?: string; code?: string })?.message ?? '');
  const code = typeof raw === 'object' && raw ? (raw as { code?: string }).code : undefined;
  return code === 'email_not_confirmed' || /email not confirmed|not confirmed yet/i.test(message);
}

/** The slice of Supabase auth the code step uses; services/auth.ts adapts the real client. */
export type SignUpCodeClient = {
  /** verifyOtp type signup: confirms the email and signs in. */
  verify(email: string, code: string): Promise<{ error: string | null }>;
  /** resend type signup: a new email with a new code. */
  resend(email: string): Promise<{ error: string | null }>;
};

export type SignUpCodeOutcome = { ok: true } | { ok: false; message: string };

export async function verifySignUpCode(client: SignUpCodeClient, email: string, code: string): Promise<SignUpCodeOutcome> {
  const problem = signUpCodeProblem(code);
  if (problem) return { ok: false, message: problem };
  const { error } = await client.verify(email.trim().toLowerCase(), code);
  if (error) return { ok: false, message: signUpCodeErrorMessage(error) };
  return { ok: true };
}

export async function resendSignUpCode(client: SignUpCodeClient, email: string): Promise<SignUpCodeOutcome> {
  const problem = emailProblem(email);
  if (problem) return { ok: false, message: problem };
  const { error } = await client.resend(email.trim().toLowerCase());
  if (error) return { ok: false, message: signUpCodeErrorMessage(error) };
  return { ok: true };
}

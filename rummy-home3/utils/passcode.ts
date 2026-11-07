/**
 * Passcode rules and wording. The app's sign-in secret is a 6-digit numeric passcode.
 * Supabase stores it as the account password, but no user-facing text may say "password".
 */
export const PASSCODE_LENGTH = 6;
/** Supabase email codes are 6 digits by default and can be configured up to 10. */
export const EMAIL_CODE_MIN = 6;
export const EMAIL_CODE_MAX = 10;
/** Seconds before "Send a new code" is offered again. */
export const RESEND_COOLDOWN_S = 30;

export function digitsOnly(text: string, max = PASSCODE_LENGTH): string {
  return text.replace(/\D/g, '').slice(0, max);
}

export function isPasscode(code: string): boolean {
  return new RegExp(`^\\d{${PASSCODE_LENGTH}}$`).test(code);
}

/** Null when the passcode is exactly six digits; otherwise what to fix. */
export function passcodeProblem(code: string, label = 'Passcode'): string | null {
  if (!code) return `${label} is required.`;
  if (/\D/.test(code)) return `${label} is numbers only.`;
  if (code.length !== PASSCODE_LENGTH) return `${label} must be exactly ${PASSCODE_LENGTH} digits.`;
  return null;
}

/** Checks the new passcode and its confirmation together. */
export function newPasscodeProblem(next: string, confirm: string, current?: string): string | null {
  const problem = passcodeProblem(next, 'New passcode');
  if (problem) return problem;
  if (confirm !== next) return 'The two entries don’t match.';
  if (current !== undefined && current === next) return 'Choose a passcode different from your current one.';
  return null;
}

/** The code typed back from the email. */
export function emailCodeProblem(code: string): string | null {
  if (!code) return 'Enter the code from the email.';
  if (/\D/.test(code)) return 'The code is numbers only.';
  if (code.length < EMAIL_CODE_MIN || code.length > EMAIL_CODE_MAX) return `The code is ${EMAIL_CODE_MIN} digits.`;
  return null;
}

export function emailProblem(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return 'Enter your email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'That doesn’t look like an email address.';
  return null;
}

/** Supabase says "reauthentication" when Secure password change is on; the app then asks for an emailed code. */
export function needsReauthentication(message: string): boolean {
  return /reauthenticat|nonce/i.test(message);
}

/** Supabase "User not found" must read like success so emails can't be probed. */
export function hidesAccountExistence(message: string): boolean {
  return /user not found|no user found|does not exist|signups? not allowed for this instance/i.test(message);
}

/**
 * Turns a Supabase auth error into one short sentence in the app's words.
 * Never contains "password".
 */
export function passcodeErrorMessage(raw: unknown): string {
  const message = typeof raw === 'string' ? raw : ((raw as { message?: string })?.message ?? '');
  const lower = message.toLowerCase();
  if (!message) return 'Something went wrong. Try again.';
  if (/expired|invalid|otp_expired|token has/.test(lower) && /token|otp|code/.test(lower)) {
    return 'That code is wrong or has expired. Send a new code and try again.';
  }
  if (/different from the old|same_password|same password/.test(lower)) {
    return 'Choose a passcode different from your current one.';
  }
  if (/invalid login credentials|invalid_credentials/.test(lower)) {
    return 'That current passcode is wrong.';
  }
  if (/rate limit|only request this after|too many requests|over_email_send/.test(lower)) {
    return 'Please wait a minute before asking for another code.';
  }
  if (/at least \d+ characters|too short|weak/.test(lower)) {
    return `Passcode must be exactly ${PASSCODE_LENGTH} digits.`;
  }
  if (/should contain at least one|lowercase|uppercase|symbols/.test(lower)) {
    return 'The server is set to require letters. The app owner needs to allow 6-digit passcodes.';
  }
  if (/session missing|not authenticated|no session|jwt|not logged in/.test(lower)) {
    return 'Your verification ran out. Send a new code and try again.';
  }
  if (/network|fetch|timeout|timed out/.test(lower)) {
    return 'No connection. Check your internet and try again.';
  }
  if (/email not confirmed/.test(lower)) {
    return 'Confirm your email first using the link we sent when you signed up.';
  }
  return message.replace(/passwords?/gi, (word) => (word.toLowerCase().endsWith('s') ? 'passcodes' : 'passcode'));
}

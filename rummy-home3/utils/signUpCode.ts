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

/** Where the code went. The code step is one screen for both (D101, WhatsApp spec §8(b)); only these words differ. */
export type CodeChannel = 'email' | 'whatsapp';

/** The D101 step with WhatsApp words: the icon, the title, the label and "Wrong number?". */
export const WHATSAPP_CODE_TEXT = {
  title: 'Check WhatsApp',
  /** `number` is already masked: "+91 98xxx xx210". */
  subtitle: (number: string) => `We sent a 6-digit code to WhatsApp ${number}`,
  fieldLabel: 'Code from WhatsApp',
  placeholder: SIGNUP_CODE_TEXT.placeholder,
  verify: SIGNUP_CODE_TEXT.verify,
  resend: SIGNUP_CODE_TEXT.resend,
  resendIn: SIGNUP_CODE_TEXT.resendIn,
  sent: (number: string) => `A new code is on its way to WhatsApp ${number}. Use the newest one.`,
  wrongAddress: 'Wrong number?',
  goBack: SIGNUP_CODE_TEXT.goBack,
} as const;

export type CodeStepWords = {
  title: string;
  subtitle: (to: string) => string;
  fieldLabel: string;
  placeholder: string;
  verify: string;
  resend: string;
  resendIn: (seconds: number) => string;
  sent: (to: string) => string;
  wrongAddress: string;
  goBack: string;
};

export function codeStepText(channel: CodeChannel): CodeStepWords {
  return channel === 'whatsapp' ? WHATSAPP_CODE_TEXT : SIGNUP_CODE_TEXT;
}

/** The icon at the top of the code step. */
export function codeStepIcon(channel: CodeChannel): string {
  return channel === 'whatsapp' ? 'whatsapp' : 'email-check-outline';
}

export const WHATSAPP_CODE_ERRORS = {
  empty: 'Enter the 6-digit code from WhatsApp.',
  wrongOrExpired: 'That code is wrong or has expired. Check the newest message, or tap Send a new code.',
  /** Forgot passcode, when Twilio cannot deliver to the number (WhatsApp spec §5a). */
  notOnWhatsApp: 'That number is not on WhatsApp any more. Sign in with your passcode, then change it in Profile.',
  couldNotSend: 'We could not send a WhatsApp code to that number. Check it is the number you use on WhatsApp.',
  notConfirmed: 'This number is not confirmed yet. Tap Enter the code and type the 6-digit code from WhatsApp.',
} as const;

/**
 * A Supabase error from sending or checking a WhatsApp code (or an email-change code), in one plain sentence.
 * `sms_send_failed` is Supabase's word for "Twilio could not send it"; the person never sees "SMS".
 */
export function whatsAppCodeErrorMessage(raw: unknown, stage: 'send' | 'verify', purpose?: 'sign-up' | 'recovery' | 'change', channel: CodeChannel = 'whatsapp'): string {
  const message = typeof raw === 'string' ? raw : ((raw as { message?: string })?.message ?? '');
  const code = typeof raw === 'object' && raw ? ((raw as { code?: string }).code ?? '') : '';
  const lower = `${code} ${message}`.toLowerCase();
  if (stage === 'send' && /sms_send_failed|error sending .*otp|provider/.test(lower)) {
    return purpose === 'recovery' ? WHATSAPP_CODE_ERRORS.notOnWhatsApp : WHATSAPP_CODE_ERRORS.couldNotSend;
  }
  const plain = signUpCodeErrorMessage(raw);
  if (plain === SIGNUP_CODE_ERRORS.wrongOrExpired && channel === 'whatsapp') return WHATSAPP_CODE_ERRORS.wrongOrExpired;
  return plain;
}

/** What the person typed or pasted, reduced to at most six digits ("482 913" → "482913"). */
export function cleanSignUpCode(text: string): string {
  return digitsOnly(text, EMAIL_CODE_LENGTH);
}

/** Null when the code is six digits; otherwise what to fix. Checked before the server, so a typo never spends the code. */
export function signUpCodeProblem(code: string, channel: CodeChannel = 'email'): string | null {
  if (!code) return channel === 'whatsapp' ? WHATSAPP_CODE_ERRORS.empty : SIGNUP_CODE_ERRORS.empty;
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

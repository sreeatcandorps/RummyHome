/**
 * WhatsApp sign-in (D116, D124) through Supabase Auth's phone provider, set to Twilio Verify with the WhatsApp
 * channel. Pure: it is handed the `supabase.auth` object (services/auth.ts) or a fake (tests).
 *
 * Three Supabase rules this file exists for (WhatsApp spec §1):
 * 1. Every request that sends a code carries `channel: 'whatsapp'`. Without it Supabase sends an SMS.
 * 2. "Send a new code" repeats the request that sent the first code (signUp, signInWithOtp or updateUser).
 *    It never calls `auth.resend`: for a phone number that always sends an SMS, whatever the first channel was.
 * 3. `updateUser` has no `channel` in its TypeScript type but passes it to the server, so it is added here.
 *
 * A passcode sign-in sends nothing (D76): the number is a username, like an email.
 */
import { cleanSignUpCode, SignUpCodeOutcome, signUpCodeProblem, WHATSAPP_CODE_ERRORS, whatsAppCodeErrorMessage } from '@/utils/signUpCode';
import { isRepeatedSignUp } from '@/utils/signUpOutcome';
import { passcodeErrorMessage } from '@/utils/passcode';

export const WHATSAPP_CHANNEL = 'whatsapp' as const;

export const NUMBER_IN_USE_MESSAGE = 'That number already has an account.';
export const NUMBER_PASSCODE_MISMATCH = 'That number and passcode do not match.';

/** The WhatsApp words on Create account and Sign in (`wa-create-account.png`). */
export const WHATSAPP_SIGNUP_TEXT = {
  numberHint: 'We send a 6-digit code to this number on WhatsApp to confirm it.',
  passcodeHint: 'Numbers only. You sign in with your number and this passcode.',
  notReady: 'WhatsApp sign-in needs the online account service. It isn\u2019t set up in this build.',
} as const;

type AuthError = { message?: string; code?: string; status?: number } | null;
type AuthAnswer = { data?: any; error: AuthError };

/** The slice of `supabase.auth` used here. `resend` is listed only so a test can prove it is never called. */
export type PhoneAuthLike = {
  signUp(args: any): Promise<AuthAnswer>;
  signInWithPassword(args: any): Promise<AuthAnswer>;
  signInWithOtp(args: any): Promise<AuthAnswer>;
  verifyOtp(args: any): Promise<AuthAnswer>;
  updateUser(args: any, options?: any): Promise<AuthAnswer>;
  resend?(args: any): Promise<AuthAnswer>;
};

/**
 * Why a code is sent, which decides the request that sends it and the verify type:
 * - `sign-up`: Create account. signUp with phone + passcode; verify type `sms`.
 * - `recovery`: Forgot passcode. signInWithOtp, never creating an account; verify type `sms`.
 * - `change`: Profile › Sign-in methods › WhatsApp, or the backup step. updateUser; verify type `phone_change`.
 */
export type PhoneCodePurpose = 'sign-up' | 'recovery' | 'change';

export type PhoneSignUpInput = {
  phone: string;
  passcode: string;
  /** The name only. Never the number: the new-user trigger would copy a `phone` here into profiles.phone. */
  data: { display_name: string; first_name?: string; last_name?: string };
};

export type PhoneSignUpResult =
  | { ok: true; session: boolean; userId: string | null }
  | { ok: false; message: string; numberInUse?: boolean };

export function isNumberInUseError(error: AuthError | unknown): boolean {
  const err = error as AuthError;
  if (!err) return false;
  if (err.code === 'user_already_exists' || err.code === 'phone_exists') return true;
  return /user already registered|phone.*already (registered|exists)/i.test(err.message ?? '');
}

export function isWrongPasscodeError(error: AuthError | unknown): boolean {
  const err = error as AuthError;
  return Boolean(err) && (err!.code === 'invalid_credentials' || /invalid login credentials/i.test(err!.message ?? ''));
}

/** A sign-in with a number that never typed its code. */
export function isPhoneNotConfirmed(error: AuthError | unknown): boolean {
  const err = error as AuthError;
  return Boolean(err) && (err!.code === 'phone_not_confirmed' || /phone not confirmed/i.test(err!.message ?? ''));
}

export function makeWhatsAppAuth(auth: PhoneAuthLike) {
  const send = async (purpose: PhoneCodePurpose, phone: string, passcode?: string, data?: PhoneSignUpInput['data']): Promise<AuthAnswer> => {
    switch (purpose) {
      case 'sign-up':
        return auth.signUp({ phone, password: passcode ?? '', options: { channel: WHATSAPP_CHANNEL, ...(data ? { data } : {}) } });
      case 'recovery':
        return auth.signInWithOtp({ phone, options: { channel: WHATSAPP_CHANNEL, shouldCreateUser: false } });
      case 'change':
        return auth.updateUser({ phone, channel: WHATSAPP_CHANNEL });
    }
  };

  return {
    /** Create account by WhatsApp: one code to the number, unless Supabase confirms numbers on its own. */
    async signUp(input: PhoneSignUpInput): Promise<PhoneSignUpResult> {
      const { data, error } = await send('sign-up', input.phone, input.passcode, input.data);
      if (error) {
        if (isNumberInUseError(error)) return { ok: false, message: NUMBER_IN_USE_MESSAGE, numberInUse: true };
        return { ok: false, message: whatsAppCodeErrorMessage(error, 'send') };
      }
      // With confirmations on, Supabase answers a number that already has an account with a placeholder user.
      if (isRepeatedSignUp(data)) return { ok: false, message: NUMBER_IN_USE_MESSAGE, numberInUse: true };
      return { ok: true, session: Boolean(data?.session), userId: data?.user?.id ?? null };
    },

    /** Number + passcode. Sends nothing and costs nothing (D76). */
    async signIn(phone: string, passcode: string): Promise<{ ok: true; userId: string | null } | { ok: false; message: string; notConfirmed?: boolean }> {
      const { data, error } = await auth.signInWithPassword({ phone, password: passcode });
      if (error) {
        if (isWrongPasscodeError(error)) return { ok: false, message: NUMBER_PASSCODE_MISMATCH };
        if (isPhoneNotConfirmed(error)) return { ok: false, message: WHATSAPP_CODE_ERRORS.notConfirmed, notConfirmed: true };
        return { ok: false, message: whatsAppCodeErrorMessage(error, 'send') };
      }
      return { ok: true, userId: data?.session?.user?.id ?? data?.user?.id ?? null };
    },

    /**
     * The first code for Forgot passcode or a number change, and "Send a new code" for every purpose: the same
     * request again, so WhatsApp stays WhatsApp. Sign-up needs the passcode to repeat its request.
     */
    async sendCode(purpose: PhoneCodePurpose, phone: string, passcode?: string, data?: PhoneSignUpInput['data']): Promise<SignUpCodeOutcome> {
      const { error } = await send(purpose, phone, passcode, data);
      if (error) {
        if (purpose === 'change' && isNumberInUseError(error)) return { ok: false, message: NUMBER_IN_USE_MESSAGE };
        // Forgot passcode for a number with no account reads like success, so the form cannot find who has one.
        if (purpose === 'recovery' && /signups? not allowed|user not found|otp_disabled/i.test(`${error.code ?? ''} ${error.message ?? ''}`)) return { ok: true };
        return { ok: false, message: whatsAppCodeErrorMessage(error, 'send', purpose) };
      }
      return { ok: true };
    },

    /** The code typed back. Checked on the phone first, so a typo never spends it. */
    async verifyCode(purpose: PhoneCodePurpose, phone: string, code: string): Promise<SignUpCodeOutcome> {
      const clean = cleanSignUpCode(code);
      const problem = signUpCodeProblem(clean, 'whatsapp');
      if (problem) return { ok: false, message: problem };
      const { error } = await auth.verifyOtp({ phone, token: clean, type: purpose === 'change' ? 'phone_change' : 'sms' });
      if (error) return { ok: false, message: whatsAppCodeErrorMessage(error, 'verify') };
      return { ok: true };
    },
  };
}

export type WhatsAppAuth = ReturnType<typeof makeWhatsAppAuth>;

/**
 * Adding a backup email or changing the email (Profile › Sign-in methods, the backup step): a code to the new
 * address, typed back with verifyOtp type `email_change`. "Send a new code" repeats updateUser too.
 */
export function makeEmailChange(auth: PhoneAuthLike, redirectTo?: string) {
  return {
    /** `done`: a project with email confirmations off (the local test stack) changes the address at once, no code. */
    async sendCode(email: string): Promise<SignUpCodeOutcome & { done?: boolean }> {
      const { data, error } = await auth.updateUser({ email }, redirectTo ? { emailRedirectTo: redirectTo } : undefined);
      if (error) {
        if (/email_exists|already been registered|already registered/i.test(`${error.code ?? ''} ${error.message ?? ''}`)) {
          return { ok: false, message: 'That email already has an account.' };
        }
        return { ok: false, message: passcodeErrorMessage(error) };
      }
      return data?.user?.email === email ? { ok: true, done: true } : { ok: true };
    },
    async verifyCode(email: string, code: string): Promise<SignUpCodeOutcome> {
      const clean = cleanSignUpCode(code);
      const problem = signUpCodeProblem(clean, 'email');
      if (problem) return { ok: false, message: problem };
      const { error } = await auth.verifyOtp({ email, token: clean, type: 'email_change' });
      if (error) return { ok: false, message: whatsAppCodeErrorMessage(error, 'verify', undefined, 'email') };
      return { ok: true };
    },
  };
}

export type EmailChange = ReturnType<typeof makeEmailChange>;

/** The ways in of the signed-in account, as Supabase Auth holds them (the WhatsApp number lives only there, D113). */
export type SignInMethods = { email: string | null; phone: string | null; backupReminder: 'dismissed' | null };

type AuthUserLike = { email?: string | null; phone?: string | null; user_metadata?: { backup_reminder?: string } | null } | null | undefined;

/** The slice of `supabase.auth` that reads the signed-in user. */
export type UserAuthLike = {
  getUser(): Promise<{ data: { user: AuthUserLike } | null; error?: unknown }>;
  getSession(): Promise<{ data: { session: { user: AuthUserLike } | null } | null; error?: unknown }>;
};

/**
 * getUser asks the server. When that request fails (offline, a slow network), the user held in this phone's
 * session answers instead, so Profile still lists the ways in rather than dropping Sign-in methods.
 */
export async function readSignInMethodsFrom(auth: UserAuthLike): Promise<SignInMethods | null> {
  const fresh = await auth.getUser().catch(() => null);
  const held = fresh?.data?.user ? null : await auth.getSession().catch(() => null);
  const user = fresh?.data?.user ?? held?.data?.session?.user ?? null;
  if (!user) return null;
  return {
    email: user.email || null,
    phone: user.phone || null,
    backupReminder: user.user_metadata?.backup_reminder === 'dismissed' ? 'dismissed' : null,
  };
}

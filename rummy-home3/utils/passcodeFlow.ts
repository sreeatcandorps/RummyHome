import {
  emailCodeProblem,
  emailProblem,
  hidesAccountExistence,
  needsReauthentication,
  newPasscodeProblem,
  passcodeErrorMessage,
  passcodeProblem,
} from '@/utils/passcode';

/**
 * The slice of Supabase auth the passcode flows use, so the flows can run against a fake.
 * services/auth.ts adapts the real client to this shape.
 */
export type PasscodeAuthClient = {
  /** Sends the recovery email (the template shows the 6-digit code). */
  requestCode(email: string): Promise<{ error: string | null }>;
  /** Exchanges the emailed code for a session. Single use; expires on the server. */
  verifyCode(email: string, code: string): Promise<{ error: string | null }>;
  /** Sets the account passcode for the current session. */
  setPasscode(next: string, nonce?: string): Promise<{ error: string | null }>;
  /** Checks the current passcode without changing anything. */
  checkCurrent(email: string, current: string): Promise<{ error: string | null }>;
  /** Emails a nonce when the project requires a fresh check before changing the passcode. */
  requestReauthentication(): Promise<{ error: string | null }>;
  signOut(): Promise<void>;
};

export type FlowOutcome =
  | { ok: true }
  | { ok: false; message: string; field?: 'email' | 'code' | 'current' | 'passcode'; reauthentication?: boolean };

/**
 * Step 1 of "Forgot passcode": ask for a code. A missing account is reported as success so
 * the form cannot be used to find out who has an account.
 */
export async function requestPasscodeCode(client: PasscodeAuthClient, email: string): Promise<FlowOutcome> {
  const problem = emailProblem(email);
  if (problem) return { ok: false, message: problem, field: 'email' };
  const { error } = await client.requestCode(email.trim().toLowerCase());
  if (error && !hidesAccountExistence(error)) return { ok: false, message: passcodeErrorMessage(error) };
  return { ok: true };
}

export type ResetInput = {
  email: string;
  code: string;
  next: string;
  confirm: string;
  /** True once a code was accepted; a retry after a failed set skips the single-use code. */
  verified: boolean;
};

/**
 * Step 2 of "Forgot passcode": code + new passcode. Everything is validated locally first so
 * a wrong-length or non-numeric entry never reaches the server and never consumes the code.
 * The passcode is only changed after the code is accepted and both entries match. Ends signed
 * out, so the person proves the new passcode by signing in with it.
 */
export async function completePasscodeReset(
  client: PasscodeAuthClient,
  input: ResetInput,
): Promise<FlowOutcome & { verified?: boolean }> {
  const codeProblem = input.verified ? null : emailCodeProblem(input.code);
  if (codeProblem) return { ok: false, message: codeProblem, field: 'code', verified: false };
  const passcodeIssue = newPasscodeProblem(input.next, input.confirm);
  if (passcodeIssue) return { ok: false, message: passcodeIssue, field: 'passcode', verified: input.verified };

  if (!input.verified) {
    const { error } = await client.verifyCode(input.email.trim().toLowerCase(), input.code);
    if (error) return { ok: false, message: passcodeErrorMessage(error), field: 'code', verified: false };
  }
  const { error } = await client.setPasscode(input.next);
  if (error) {
    const message = passcodeErrorMessage(error);
    if (/verification ran out/.test(message)) return { ok: false, message, field: 'code', verified: false };
    return { ok: false, message, field: 'passcode', verified: true };
  }
  await client.signOut();
  return { ok: true };
}

export type ChangeInput = {
  email: string;
  current: string;
  next: string;
  confirm: string;
  /** Emailed nonce, only when the project asks for reauthentication. */
  nonce?: string;
};

/**
 * Signed-in "Change passcode": current passcode is checked first, then the new one is set.
 * If the project has Secure password change on, Supabase asks for a fresh emailed code; the
 * flow reports that so the screen can ask for the nonce and call again with it.
 */
export async function changePasscode(client: PasscodeAuthClient, input: ChangeInput): Promise<FlowOutcome> {
  const currentProblem = passcodeProblem(input.current, 'Current passcode');
  if (currentProblem) return { ok: false, message: currentProblem, field: 'current' };
  const nextProblem = newPasscodeProblem(input.next, input.confirm, input.current);
  if (nextProblem) return { ok: false, message: nextProblem, field: 'passcode' };
  if (input.nonce !== undefined) {
    const nonceProblem = emailCodeProblem(input.nonce);
    if (nonceProblem) return { ok: false, message: nonceProblem, field: 'code', reauthentication: true };
  }

  if (!input.nonce) {
    const check = await client.checkCurrent(input.email.trim().toLowerCase(), input.current);
    if (check.error) return { ok: false, message: passcodeErrorMessage(check.error), field: 'current' };
  }
  const { error } = await client.setPasscode(input.next, input.nonce);
  if (error) {
    if (needsReauthentication(error) && !input.nonce) {
      const sent = await client.requestReauthentication();
      if (sent.error) return { ok: false, message: passcodeErrorMessage(sent.error) };
      return { ok: false, message: 'We emailed you a code. Enter it to finish changing your passcode.', field: 'code', reauthentication: true };
    }
    return { ok: false, message: passcodeErrorMessage(error), field: input.nonce ? 'code' : 'passcode' };
  }
  return { ok: true };
}

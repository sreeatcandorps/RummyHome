import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  digitsOnly,
  emailCodeProblem,
  emailProblem,
  isPasscode,
  newPasscodeProblem,
  passcodeErrorMessage,
  passcodeProblem,
} from '../utils/passcode';
import { changePasscode, completePasscodeReset, PasscodeAuthClient, requestPasscodeCode } from '../utils/passcodeFlow';
import { HELP } from '../constants/help';

test('P1-B: a passcode is exactly six digits, nothing else', () => {
  assert.equal(isPasscode('123456'), true);
  assert.equal(passcodeProblem('123456'), null);
  assert.equal(passcodeProblem(''), 'Passcode is required.');
  assert.equal(passcodeProblem('12345'), 'Passcode must be exactly 6 digits.');
  assert.equal(passcodeProblem('1234567'), 'Passcode must be exactly 6 digits.');
  assert.equal(passcodeProblem('12a456'), 'Passcode is numbers only.');
  assert.equal(digitsOnly('1 2-3a4b5c6789'), '123456');
  assert.equal(newPasscodeProblem('123456', '123457'), 'The two entries don’t match.');
  assert.equal(newPasscodeProblem('123456', '123456', '123456'), 'Choose a passcode different from your current one.');
  assert.equal(newPasscodeProblem('123456', '123456', '654321'), null);
  assert.equal(emailCodeProblem(''), 'Enter the OTP from the email.');
  assert.equal(emailCodeProblem('12ab56'), 'The OTP is numbers only.');
  assert.equal(emailCodeProblem('1234'), 'The OTP is 6 digits.');
  assert.equal(emailCodeProblem('123456'), null);
  assert.equal(emailCodeProblem('1234567'), 'The OTP is 6 digits.', 'issue #8 item 5: exactly six digits');
  assert.equal(emailCodeProblem('1234567890'), 'The OTP is 6 digits.');
  assert.equal(emailProblem('not-an-email'), 'That doesn’t look like an email address.');
});

test('issue #8: OTP entry is one obvious numeric box with autofill, paste, clear and autofocus', () => {
  const otp = readFileSync(path.join(process.cwd(), 'components/ui/OtpField.tsx'), 'utf8');
  assert.match(otp, /label = 'OTP'/, 'item 2: labelled OTP');
  assert.match(otp, /keyboardType="number-pad"/);
  assert.match(otp, /textContentType="oneTimeCode"/);
  assert.match(otp, /autoComplete="sms-otp"/);
  assert.match(otp, /maxLength=\{EMAIL_CODE_LENGTH\}/);
  assert.match(otp, /digitsOnly\(text, EMAIL_CODE_LENGTH\)/, 'pasted text is reduced to six digits');
  assert.match(otp, /icon="close-circle"[\s\S]*onPress=\{\(\) => onChangeText\(''\)\}/, 'item 3: clear button');
  assert.match(otp, /inputRef\.current\?\.focus\(\)/, 'autofocus once laid out');
  assert.doesNotMatch(otp, /passcode code|Code from the email/i);

  const forgot = readFileSync(path.join(process.cwd(), 'app/(auth)/forgot-password.tsx'), 'utf8');
  assert.match(forgot, /<OtpField value=\{code\}[^>]*autoFocus/, 'item 1: the OTP box is the first thing on the code step and takes focus');
  assert.doesNotMatch(forgot, /passcode code|Code from the email/i, 'item 2');
  const change = readFileSync(path.join(process.cwd(), 'components/auth/ChangePasscodeDialog.tsx'), 'utf8');
  assert.match(change, /<OtpField value=\{nonce\}[^>]*autoFocus/);
  assert.doesNotMatch(change, /passcode code|Code from the email/i);
});

test('issue #8 item 4: the passcode cells put the real input on top, so the first tap opens the keyboard', () => {
  const field = readFileSync(path.join(process.cwd(), 'components/ui/PasscodeField.tsx'), 'utf8');
  assert.doesNotMatch(field, /<Pressable[\s\S]*onPress=\{\(\) => inputRef\.current\?\.focus\(\)\}/, 'no tap-to-programmatic-focus');
  assert.match(field, /StyleSheet\.absoluteFillObject/, 'input covers the cells');
  assert.doesNotMatch(field, /opacity:\s*0/, 'no opacity:0 input (Android may not focus it)');
  assert.match(field, /keyboardType="number-pad"/);
  assert.match(field, /maxLength=\{6\}/);
  assert.match(field, /icon="close-circle"/, 'clear button on passcode cells too');
});

test('issue #8 item 5: Change passcode refuses a non-6-digit OTP locally', async () => {
  const { client, state } = fakeClient({ requireNonce: true });
  const short = await changePasscode(client, { email: 'a@b.co', current: '111111', next: '246810', confirm: '246810', nonce: '77' });
  assert.deepEqual(short, { ok: false, message: 'The OTP is 6 digits.', field: 'code', reauthentication: true });
  const letters = await changePasscode(client, { email: 'a@b.co', current: '111111', next: '246810', confirm: '246810', nonce: '77a777' });
  assert.equal(letters.ok ? '' : letters.message, 'The OTP is numbers only.');
  assert.equal(state.passcode, '111111');
});

test('issue #8 item 6: reset works with an app-only email (code only, no browser link)', async () => {
  const template = readFileSync(path.join(process.cwd(), 'supabase/templates/recovery-passcode.html'), 'utf8');
  assert.match(template, /\{\{ \.Token \}\}/);
  assert.doesNotMatch(template, /ConfirmationURL|href=/, 'no link in the email');
  assert.match(template, /OTP/);
  // The flow itself never consumes a URL: email + OTP + new passcode is all it needs.
  const { client, state } = fakeClient();
  await requestPasscodeCode(client, 'sree@example.com');
  const done = await completePasscodeReset(client, { email: 'sree@example.com', code: '482913', next: '246810', confirm: '246810', verified: false });
  assert.deepEqual(done, { ok: true });
  assert.equal(state.passcode, '246810');
});

test('P1-B: server messages become passcode wording and never say password', () => {
  const cases: [string, RegExp][] = [
    ['Token has expired or is invalid', /wrong or has expired/],
    ['otp_expired', /wrong or has expired/],
    ['New password should be different from the old password.', /different from your current/],
    ['Invalid login credentials', /current passcode is wrong/],
    ['For security purposes, you can only request this after 52 seconds.', /wait a minute/],
    ['Password should be at least 6 characters', /exactly 6 digits/],
    ['Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ.', /require letters/],
    ['Auth session missing!', /verification ran out/],
    ['Network request failed', /No connection/],
    ['Some unknown password thing about passwords', /passcode thing about passcodes/],
  ];
  for (const [raw, expected] of cases) {
    const text = passcodeErrorMessage(raw);
    assert.match(text, expected, raw);
    assert.doesNotMatch(text, /password/i, `"${raw}" leaked the word password`);
  }
  assert.doesNotMatch(passcodeErrorMessage({ message: 'Password is weak' }), /password/i);
});

/** A fake of the Supabase auth slice with one valid single-use code and a known current passcode. */
function fakeClient(options: { code?: string; current?: string; failSet?: string | null; requireNonce?: boolean; expired?: boolean } = {}) {
  const state = {
    code: options.code ?? '482913',
    used: false,
    passcode: options.current ?? '111111',
    session: false,
    sentCodes: 0,
    reauthSent: 0,
    signedOut: 0,
  };
  const client: PasscodeAuthClient = {
    async requestCode(email) {
      if (email === 'nobody@example.com') return { error: 'User not found' };
      state.sentCodes += 1;
      return { error: null };
    },
    async verifyCode(_email, code) {
      if (options.expired || state.used || code !== state.code) return { error: 'Token has expired or is invalid' };
      state.used = true;
      state.session = true;
      return { error: null };
    },
    async setPasscode(next, nonce) {
      if (!state.session) return { error: 'Auth session missing!' };
      if (options.requireNonce && !nonce) return { error: 'Password update requires reauthentication' };
      if (options.requireNonce && nonce !== '777777') return { error: 'Token has expired or is invalid' };
      if (options.failSet) return { error: options.failSet };
      if (next === state.passcode) return { error: 'New password should be different from the old password.' };
      state.passcode = next;
      return { error: null };
    },
    async checkCurrent(_email, current) {
      if (current !== state.passcode) return { error: 'Invalid login credentials' };
      state.session = true;
      return { error: null };
    },
    async requestReauthentication() {
      state.reauthSent += 1;
      return { error: null };
    },
    async signOut() {
      state.session = false;
      state.signedOut += 1;
    },
  };
  return { client, state };
}

test('P1-B: request step validates the email and hides whether an account exists', async () => {
  const { client, state } = fakeClient();
  assert.deepEqual(await requestPasscodeCode(client, 'bad'), { ok: false, message: 'That doesn’t look like an email address.', field: 'email' });
  assert.deepEqual(await requestPasscodeCode(client, ' Sree@Example.com '), { ok: true });
  assert.equal(state.sentCodes, 1);
  assert.deepEqual(await requestPasscodeCode(client, 'nobody@example.com'), { ok: true }, 'unknown email reads as success');
});

test('P1-B: happy path — code accepted, new passcode saved, signed out to prove it at Sign in', async () => {
  const { client, state } = fakeClient();
  const outcome = await completePasscodeReset(client, { email: 'sree@example.com', code: '482913', next: '246810', confirm: '246810', verified: false });
  assert.deepEqual(outcome, { ok: true });
  assert.equal(state.passcode, '246810');
  assert.equal(state.signedOut, 1);
  assert.equal(state.session, false);
});

test('P1-B: bad local input never reaches the server and never consumes the code', async () => {
  const { client, state } = fakeClient();
  const base = { email: 'sree@example.com', code: '482913', verified: false };
  let out = await completePasscodeReset(client, { ...base, code: '48', next: '246810', confirm: '246810' });
  assert.equal(out.ok, false); assert.equal(out.ok ? '' : out.field, 'code');
  out = await completePasscodeReset(client, { ...base, next: '24681', confirm: '24681' });
  assert.equal(out.ok ? '' : out.message, 'New passcode must be exactly 6 digits.');
  out = await completePasscodeReset(client, { ...base, next: '24a810', confirm: '24a810' });
  assert.equal(out.ok ? '' : out.message, 'New passcode is numbers only.');
  out = await completePasscodeReset(client, { ...base, next: '246810', confirm: '246811' });
  assert.equal(out.ok ? '' : out.message, 'The two entries don’t match.');
  assert.equal(state.used, false, 'code still unused');
  assert.equal(state.passcode, '111111', 'passcode untouched');
});

test('P1-B: wrong, expired and reused codes are refused and the passcode stays', async () => {
  const wrong = fakeClient();
  let out = await completePasscodeReset(wrong.client, { email: 'a@b.co', code: '000000', next: '246810', confirm: '246810', verified: false });
  assert.equal(out.ok, false);
  assert.match(out.ok ? '' : out.message, /wrong or has expired/);
  assert.equal(wrong.state.passcode, '111111');

  const expired = fakeClient({ expired: true });
  out = await completePasscodeReset(expired.client, { email: 'a@b.co', code: '482913', next: '246810', confirm: '246810', verified: false });
  assert.match(out.ok ? '' : out.message, /wrong or has expired/);

  const reused = fakeClient();
  await completePasscodeReset(reused.client, { email: 'a@b.co', code: '482913', next: '246810', confirm: '246810', verified: false });
  out = await completePasscodeReset(reused.client, { email: 'a@b.co', code: '482913', next: '135791', confirm: '135791', verified: false });
  assert.match(out.ok ? '' : out.message, /wrong or has expired/);
  assert.equal(reused.state.passcode, '246810', 'second use changed nothing');
});

test('P1-B: a server failure after the code was accepted leaves the passcode alone and allows a retry without a new code', async () => {
  const failing = fakeClient({ failSet: 'Password should be at least 6 characters' });
  const first = await completePasscodeReset(failing.client, { email: 'a@b.co', code: '482913', next: '246810', confirm: '246810', verified: false });
  assert.equal(first.ok, false);
  assert.equal(first.ok ? undefined : first.verified, true, 'code is spent but the session stands');
  assert.equal(failing.state.passcode, '111111');
  assert.equal(failing.state.signedOut, 0);
  // Same session, no code needed, different choice.
  const { client: ok, state } = fakeClient();
  await ok.verifyCode('a@b.co', '482913');
  const retry = await completePasscodeReset(ok, { email: 'a@b.co', code: '', next: '135791', confirm: '135791', verified: true });
  assert.deepEqual(retry, { ok: true });
  assert.equal(state.passcode, '135791');
});

test('P1-B: Change passcode checks the current one first and sets the new one without email', async () => {
  const { client, state } = fakeClient({ current: '111111' });
  let out = await changePasscode(client, { email: 'a@b.co', current: '999999', next: '246810', confirm: '246810' });
  assert.deepEqual(out, { ok: false, message: 'That current passcode is wrong.', field: 'current' });
  assert.equal(state.passcode, '111111');
  out = await changePasscode(client, { email: 'a@b.co', current: '111111', next: '111111', confirm: '111111' });
  assert.equal(out.ok ? '' : out.message, 'Choose a passcode different from your current one.');
  out = await changePasscode(client, { email: 'a@b.co', current: '111111', next: '246810', confirm: '246810' });
  assert.deepEqual(out, { ok: true });
  assert.equal(state.passcode, '246810');
});

test('P1-B: when the project demands reauthentication, the flow asks for the emailed code and finishes with it', async () => {
  const { client, state } = fakeClient({ requireNonce: true });
  const first = await changePasscode(client, { email: 'a@b.co', current: '111111', next: '246810', confirm: '246810' });
  assert.equal(first.ok, false);
  assert.equal(first.ok ? false : first.reauthentication, true);
  assert.equal(state.reauthSent, 1);
  assert.equal(state.passcode, '111111');
  const bad = await changePasscode(client, { email: 'a@b.co', current: '111111', next: '246810', confirm: '246810', nonce: '000000' });
  assert.match(bad.ok ? '' : bad.message, /wrong or has expired/);
  const done = await changePasscode(client, { email: 'a@b.co', current: '111111', next: '246810', confirm: '246810', nonce: '777777' });
  assert.deepEqual(done, { ok: true });
  assert.equal(state.passcode, '246810');
});

test('P1-B: no user-facing "password" on the sign-in, recovery or profile screens; help says code not link', () => {
  const files = ['app/(auth)/login.tsx', 'app/(auth)/forgot-password.tsx', 'app/(auth)/register.tsx', 'app/(tabs)/me.tsx', 'components/auth/ChangePasscodeDialog.tsx'];
  for (const file of files) {
    const source = readFileSync(path.join(process.cwd(), file), 'utf8');
    const userFacing = source
      .split('\n')
      .filter((line) => !/supabase\.auth\.|password:|signInWithPassword|resetPasswordForEmail|^import|forgot-password|ForgotPassword/.test(line))
      .join('\n');
    assert.doesNotMatch(userFacing, /password/i, `${file} shows "password" to the user`);
  }
  assert.match(HELP.reset, /6-digit code/);
  assert.doesNotMatch(HELP.reset, /link/);
  assert.doesNotMatch(HELP.signIn, /link/);
  const template = readFileSync(path.join(process.cwd(), 'supabase/templates/recovery-passcode.html'), 'utf8');
  assert.match(template, /\{\{ \.Token \}\}/);
  assert.doesNotMatch(template.replace(/<!--[\s\S]*?-->/, ''), /password/i);
});

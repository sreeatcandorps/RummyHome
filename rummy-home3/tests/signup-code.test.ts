import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  cleanSignUpCode,
  isEmailNotConfirmed,
  resendSignUpCode,
  SIGNUP_CODE_ERRORS,
  SIGNUP_CODE_TEXT,
  SIGNUP_RESEND_COOLDOWN_S,
  signUpCodeErrorMessage,
  signUpCodeProblem,
  SignUpCodeClient,
  verifySignUpCode,
} from '../utils/signUpCode';
import { formatAuthError } from '../utils/authErrors';
import { cardScrollY } from '../utils/cardScroll';
import { HELP } from './_helpLegacy';

const src = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

function fakeClient(answers: { verify?: string | null; resend?: string | null } = {}) {
  const calls: { verify: [string, string][]; resend: string[] } = { verify: [], resend: [] };
  const client: SignUpCodeClient = {
    async verify(email, code) {
      calls.verify.push([email, code]);
      return { error: answers.verify ?? null };
    },
    async resend(email) {
      calls.resend.push(email);
      return { error: answers.resend ?? null };
    },
  };
  return { client, calls };
}

// ---------------------------------------------------------------------------
// D101: the code typed into the app
// ---------------------------------------------------------------------------

test('D101: a typed or pasted code keeps its six digits and nothing else', () => {
  assert.equal(cleanSignUpCode('482913'), '482913');
  assert.equal(cleanSignUpCode('482 913'), '482913', 'the email shows the code with a space');
  assert.equal(cleanSignUpCode(' 48-29-13 '), '482913');
  assert.equal(cleanSignUpCode('4829131'), '482913', 'a seventh digit is dropped');
  assert.equal(cleanSignUpCode('Code: 48a2'), '482');
  assert.equal(cleanSignUpCode(''), '');
});

test('D101: the code is checked before the server — empty, letters, short', () => {
  assert.equal(signUpCodeProblem(''), SIGNUP_CODE_ERRORS.empty);
  assert.equal(signUpCodeProblem('12a456'), SIGNUP_CODE_ERRORS.notDigits);
  assert.equal(signUpCodeProblem('12345'), SIGNUP_CODE_ERRORS.length);
  assert.equal(signUpCodeProblem('1234567'), SIGNUP_CODE_ERRORS.length);
  assert.equal(signUpCodeProblem('000000'), null);
  assert.equal(signUpCodeProblem('482913'), null);
});

test('D101: Supabase errors read as plain sentences; wrong and expired codes offer Send a new code', () => {
  for (const raw of ['Token has expired or is invalid', { message: 'Token has expired or is invalid', code: 'otp_expired' }, 'otp_expired', 'Invalid OTP']) {
    const message = signUpCodeErrorMessage(raw);
    assert.equal(message, SIGNUP_CODE_ERRORS.wrongOrExpired, JSON.stringify(raw));
    assert.match(message, new RegExp(SIGNUP_CODE_TEXT.resend), 'names the button to tap');
  }
  assert.equal(signUpCodeErrorMessage('For security purposes, you can only request this after 42 seconds.'), SIGNUP_CODE_ERRORS.wait);
  assert.equal(signUpCodeErrorMessage({ message: 'Email rate limit exceeded' }), SIGNUP_CODE_ERRORS.wait);
  assert.equal(signUpCodeErrorMessage(new Error('Failed to fetch')), SIGNUP_CODE_ERRORS.offline);
  assert.doesNotMatch(signUpCodeErrorMessage('Password should be at least 6 characters'), /password/i);
  assert.equal(signUpCodeErrorMessage(''), 'Something went wrong. Try again.');
});

test('D101: verify sends the trimmed lower-case email and the code as type signup; a bad code never reaches the server', async () => {
  const short = fakeClient();
  assert.deepEqual(await verifySignUpCode(short.client, 'a@b.co', '123'), { ok: false, message: SIGNUP_CODE_ERRORS.length });
  assert.equal(short.calls.verify.length, 0, 'a typo does not spend the code');

  const good = fakeClient();
  assert.deepEqual(await verifySignUpCode(good.client, '  Kavya@Example.COM ', '482913'), { ok: true });
  assert.deepEqual(good.calls.verify, [['kavya@example.com', '482913']]);

  const expired = fakeClient({ verify: 'Token has expired or is invalid' });
  assert.deepEqual(await verifySignUpCode(expired.client, 'a@b.co', '482913'), { ok: false, message: SIGNUP_CODE_ERRORS.wrongOrExpired });
});

test('D101: Send a new code — bad email refused locally, rate limit in words, success', async () => {
  const none = fakeClient();
  const bad = await resendSignUpCode(none.client, 'not-an-email');
  assert.equal(bad.ok, false);
  assert.equal(none.calls.resend.length, 0);

  const limited = fakeClient({ resend: 'For security purposes, you can only request this after 30 seconds.' });
  assert.deepEqual(await resendSignUpCode(limited.client, 'a@b.co'), { ok: false, message: SIGNUP_CODE_ERRORS.wait });

  const ok = fakeClient();
  assert.deepEqual(await resendSignUpCode(ok.client, ' A@B.co '), { ok: true });
  assert.deepEqual(ok.calls.resend, ['a@b.co']);
});

test('D101: the words on the code step (b2-signup-code.png), a 60 s resend wait, no "link" and no "password"', () => {
  assert.equal(SIGNUP_RESEND_COOLDOWN_S, 60);
  assert.equal(SIGNUP_CODE_TEXT.title, 'Check your email');
  assert.equal(SIGNUP_CODE_TEXT.subtitle('kavya@example.com'), 'We sent a 6-digit code to kavya@example.com');
  assert.equal(SIGNUP_CODE_TEXT.fieldLabel, 'Code from the email');
  assert.equal(SIGNUP_CODE_TEXT.verify, 'Confirm and sign in');
  assert.equal(SIGNUP_CODE_TEXT.resend, 'Send a new code');
  assert.equal(SIGNUP_CODE_TEXT.resendIn(42), 'Send a new code (42s)');
  assert.equal(`${SIGNUP_CODE_TEXT.wrongAddress} ${SIGNUP_CODE_TEXT.goBack}`, 'Wrong address? Go back');
  assert.match(SIGNUP_CODE_TEXT.inviteNote, /Is this you\?/);
  const words = [
    ...Object.values(SIGNUP_CODE_TEXT).map((v) => (typeof v === 'function' ? (v as (x: never) => string)('x@y.co' as never) : v)),
    ...Object.values(SIGNUP_CODE_ERRORS),
  ];
  for (const word of words) {
    assert.doesNotMatch(word, /\blink\b/i, word);
    assert.doesNotMatch(word, /password/i, word);
  }
});

test('D101: signing in before the code is typed leads to the code step', () => {
  assert.equal(isEmailNotConfirmed({ message: 'Email not confirmed' }), true);
  assert.equal(isEmailNotConfirmed({ message: 'whatever', code: 'email_not_confirmed' }), true);
  assert.equal(isEmailNotConfirmed({ message: 'Invalid login credentials' }), false);
  assert.equal(isEmailNotConfirmed(null), false);
  const message = formatAuthError({ message: 'Email not confirmed' });
  assert.match(message, new RegExp(SIGNUP_CODE_TEXT.enterCode));
  assert.doesNotMatch(message, /link/i);

  const login = src('app/(auth)/login.tsx');
  assert.match(login, /setUnconfirmed\(isEmailNotConfirmed\(err\)\)/);
  assert.match(login, /pathname: '\/\(auth\)\/register', params: \{ confirm: email\.trim\(\) \}/);
  const register = src('app/(auth)/register.tsx');
  assert.match(register, /useLocalSearchParams<\{ confirm\?: string \}>/);
  assert.match(register, /useState<string \| null>\(confirmParam\)/, 'confirm=<email> opens the code step');
});

test('D101: Create account shows the code step after sign-up and verifies in the app', () => {
  const register = src('app/(auth)/register.tsx');
  assert.match(register, /setCodeFor\(cleanEmail\)/, 'no session after sign-up → the code step');
  assert.match(register, /verifySignUpCode\(signUpCodeClient, codeFor, code\)/);
  assert.match(register, /resendSignUpCode\(signUpCodeClient, codeFor\)/);
  assert.match(register, /disabled=\{loading \|\| cooldown > 0\}/);
  assert.match(register, /<OtpField[\s\S]*?testID="register-code"/);
  assert.doesNotMatch(register, /confirmation link|Resend the link|Open the link/);

  const otp = src('components/ui/OtpField.tsx');
  assert.match(otp, /keyboardType="number-pad"/);
  assert.match(otp, /textContentType="oneTimeCode"/, 'iOS offers the code from Mail');
  assert.match(otp, /autoComplete="sms-otp"/, 'Android autofill');

  const auth = src('services/auth.ts');
  assert.match(auth, /verifyOtp\(\{ email: normalizeEmail\(email\), token: code, type: 'signup' \}\)/);
  assert.match(auth, /resend\(\{ type: 'signup', email: normalizeEmail\(email\)/);
  assert.match(auth, /emailRedirectTo: authRedirectUrl\(\)/, 'a link email sent before the template switch still lands');
});

test('D101: the Confirm signup template shows the code large, with no link', () => {
  const template = src('supabase/templates/confirm-code.html');
  assert.match(template, /\{\{ \.Token \}\}/);
  assert.match(template, /Subject: "Your EZ Score: Rummy code is \{\{ \.Token \}\}"/);
  const body = template.replace(/<!--[\s\S]*?-->/, '');
  assert.doesNotMatch(body, /ConfirmationURL|TokenHash|SiteURL|RedirectTo|href=/);
  assert.doesNotMatch(body, /password/i);
  assert.match(body, /font-size:34px[^"]*">\{\{ \.Token \}\}</, 'the code is the big line');
  const doc = src('docs/signup-code-template.md');
  assert.ok(doc.includes(body.trim()), 'the doc Build Bot pastes from carries the same body as the file');
});

test('D101: help says code, not link, for Create account', () => {
  assert.match(HELP.createAccount, /We email a 6-digit code\. Type it in the app/);
  assert.match(HELP.createAccount, /Enter the code/);
  assert.doesNotMatch(HELP.createAccount, /link/i);
});

// ---------------------------------------------------------------------------
// D105: no Player ID box on Create account
// ---------------------------------------------------------------------------

test('D105: Create account asks for name, email and passcode only — no Player ID box, label, helper or check', () => {
  const register = src('app/(auth)/register.tsx');
  assert.doesNotMatch(register, /Player ID|player ID|playerIdText|parsePlayerNo|register-player-id/);
  assert.doesNotMatch(register, /PENDING_PLAYER_NO_KEY|AsyncStorage/, 'sign-up saves no pending player number');
  assert.doesNotMatch(HELP.createAccount, /Enter it and the friend who added you approves it/);
});

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full) : /\.tsx?$/.test(name) ? [full] : [];
  });
}

test('D105: nothing writes the pending player number any more; the reader stays for values an older build saved', () => {
  const writers = ['app', 'components', 'services', 'utils']
    .flatMap((dir) => filesUnder(path.join(process.cwd(), dir)))
    .filter((file) => /setItem\(\s*PENDING_PLAYER_NO_KEY/.test(readFileSync(file, 'utf8')));
  assert.deepEqual(writers, []);
  const identity = src('services/playerIdentity.ts');
  assert.match(identity, /async flushPendingPlayerNo\(me: Player\)[\s\S]*?if \(!raw\) return null;/, 'nothing stored → nothing sent');
});

test('the code step keeps Go back above the number pad: inside the card, and the shell scrolls the card into view', () => {
  const register = src('app/(auth)/register.tsx');
  const step = register.slice(register.indexOf('if (codeFor) {'), register.indexOf('</AuthShell>', register.indexOf('if (codeFor) {')));
  assert.match(step, /keepCardInView/);
  const footer = step.slice(step.indexOf('footer={'), step.indexOf('>\n        <OtpField'));
  assert.doesNotMatch(footer, /register-go-back/, 'not in the footer under the card, where the pad covers it');
  assert.ok(step.indexOf('register-go-back') > step.indexOf('register-resend'), 'right under Send a new code, in the card');
  const shell = src('components/ui/AuthShell.tsx');
  assert.match(shell, /keepCardInView\?: boolean/);
  assert.match(shell, /Keyboard\.addListener\(ios \? 'keyboardWillShow' : 'keyboardDidShow'/);
  assert.match(shell, /const y = cardScrollY\(/);
  assert.match(shell, /if \(y > 0\) scrollRef\.current\?\.scrollTo\(\{ y, animated: true \}\)/);
});

test('12i (a): the empty code box shows its hint at a normal size, so "6-digit code" fits at 360 dp × font 1.3', () => {
  const otp = src('components/ui/OtpField.tsx');
  assert.match(otp, /style=\{value \? styles\.input : styles\.hint\}/);
  assert.match(otp, /contentStyle=\{value \? styles\.content : undefined\}/, 'no letter spacing on the hint');
  const size = (name: string) => Number(otp.match(new RegExp(`${name}: \\{ fontSize: (\\d+)`))?.[1]);
  assert.equal(size('input'), 26, 'the typed digits stay large');
  assert.ok(size('hint') <= 18, `the hint is ${size('hint')}`);
  assert.equal(SIGNUP_CODE_TEXT.placeholder, '6-digit code');
});

test('12i (b): typing or pasting a code clears the error from an empty Confirm tap', () => {
  const register = src('app/(auth)/register.tsx');
  assert.match(register, /onChangeText=\{\(text\) => \{\s*setCode\(cleanSignUpCode\(text\)\);\s*setError\(''\);\s*\}\}/);
  const flow = src('e2e/smoke/27-create-account-code.yaml');
  const typed = flow.indexOf('- takeScreenshot: 27b-create-account-code-typed');
  assert.ok(flow.lastIndexOf(`- assertNotVisible: "${SIGNUP_CODE_ERRORS.empty}"`, typed) > flow.indexOf('- inputText: "482 913"'), 'flow 27 checks the error is gone before 27b');
});

test('12i (c): the card keeps room above the keyboard for the suggestion strip Android adds after reporting its height', () => {
  const shell = src('components/ui/AuthShell.tsx');
  assert.match(shell, /export const KEYBOARD_STRIP_ROOM = Platform\.OS === 'android' \? 48 : 0;/);
  assert.match(shell, /room: KEYBOARD_STRIP_ROOM/);
  const gap = 16;
  const room = 48;
  // 360 × 780 dp at font 1.3 (run 45844832254, frame 27): the card's bottom 16 dp above the reported keypad, under the banner.
  const small = { cardTop: 228, cardBottom: 270, viewport: 470, gap, room };
  const y = cardScrollY(small);
  assert.equal(y, 92);
  assert.ok(small.viewport - (small.cardTop + small.cardBottom - y) >= gap + room, 'Go back clears the strip');
  // The room never pushes the card's top off screen.
  assert.equal(cardScrollY({ cardTop: 60, cardBottom: 450, viewport: 480, gap, room }), 60);
  // A card taller than the space keeps its bottom in view, as before (landscape).
  assert.equal(cardScrollY({ cardTop: 228, cardBottom: 270, viewport: 130, gap, room }), 384);
  // Plenty of room (Pixel 6): no scroll.
  assert.equal(cardScrollY({ cardTop: 200, cardBottom: 270, viewport: 700, gap, room }), 0);
  // iOS reports every height change, so no room there: the old rule.
  assert.equal(cardScrollY({ ...small, room: 0 }), 44);
});

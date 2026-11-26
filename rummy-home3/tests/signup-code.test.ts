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
  assert.match(register, /useLocalSearchParams<\{ confirm\?: string; whatsapp\?: string \}>/);
  assert.match(register, /useState<CodeFor \| null>\(confirmParam \? \{ channel: 'email', email: confirmParam \} : null\)/, 'confirm=<email> opens the code step');
});

test('D101: Create account shows the code step after sign-up and verifies in the app', () => {
  const register = src('app/(auth)/register.tsx');
  assert.match(register, /setCodeFor\(\{ channel: 'email', email: cleanEmail \}\)/, 'no session after sign-up → the code step');
  assert.match(register, /verifySignUpCode\(signUpCodeClient, codeFor\.email, code\)/);
  assert.match(register, /resendSignUpCode\(signUpCodeClient, codeFor\.email\)/);
  assert.match(register, /<CodeStep[\s\S]*?testIDPrefix="register"/, 'the shared code step (components/ui/CodeStep.tsx)');
  assert.doesNotMatch(register, /confirmation link|Resend the link|Open the link/);
  const step = src('components/ui/CodeStep.tsx');
  assert.match(step, /disabled=\{loading \|\| cooldown > 0\}/);
  assert.match(step, /<OtpField[\s\S]*?testID=\{`\$\{testIDPrefix\}-code`\}/);

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
  assert.match(HELP.createAccount, /We send a 6-digit code to your WhatsApp or your email\. Type it in the app/);
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
  assert.match(register, /<CodeStep[\s\S]*?testIDPrefix="register"/);
  const step = src('components/ui/CodeStep.tsx');
  assert.match(step, /<AuthShell[^>]*keepCardInView/);
  assert.doesNotMatch(step, /footer=\{/, 'nothing under the card, where the pad covers it');
  assert.ok(step.indexOf('-go-back`') > step.indexOf('-resend`'), 'right under Send a new code, in the card');
  assert.ok(step.indexOf('-go-back`') < step.indexOf('</AuthShell>'));
  const shell = src('components/ui/AuthShell.tsx');
  assert.match(shell, /keepCardInView\?: boolean/);
  assert.match(shell, /Keyboard\.addListener\(ios \? 'keyboardWillShow' : 'keyboardDidShow'/);
  assert.match(shell, /const overflow = cardTop\.current \+ bottom \+ spacing\.md - viewportHeight\.current/);
  assert.match(shell, /scrollTo\(Math\.min\(overflow, cardTop\.current \+ y - spacing\.md - topInset\.current\)\)/, 'never past the field being typed in');
});

test('the field being typed in stops below the status bar, where a tap still reaches it', () => {
  const shell = src('components/ui/AuthShell.tsx');
  assert.match(shell, /const topInset = useRef\(insets\.top\);\s+topInset\.current = insets\.top;/);
  assert.match(shell, /cardTop\.current \+ y - spacing\.md - topInset\.current/);
});

test('Sign in keeps Sign in and Create account above the keypad, also after the error line pushes them down', () => {
  const login = src('app/(auth)/login.tsx');
  assert.match(login, /<AuthShell[^>]*keepCardInView\s+keepFooterInView/);
  assert.match(login, /footer=\{[\s\S]*testID="login-create-account"/, 'Create account is in the footer, outside the card');
  const shell = src('components/ui/AuthShell.tsx');
  assert.match(shell, /keepFooterInView \? footerBottom\.current : 0/);
  assert.match(shell, /footerBottom\.current = e\.nativeEvent\.layout\.y \+ e\.nativeEvent\.layout\.height;\s+followCard\(\);/);
  assert.match(shell, /<View\s+ref=\{columnRef\}[\s\S]*?\{card\}\s+\{footerNode\}/);
  assert.match(shell, /cardBottom\.current = e\.nativeEvent\.layout\.y \+ e\.nativeEvent\.layout\.height;\s+followCard\(\);/);
});

test('Create account follows the passcode: focusing it with the keypad up scrolls Create account into view', () => {
  assert.match(src('app/(auth)/register.tsx'), /<AuthShell[^>]*keepCardInView/);
  const field = src('components/ui/PasscodeField.tsx');
  assert.match(field, /const revealCard = useRevealCard\(\);/);
  assert.match(field, /onFocus=\{\(\) => \{ setFocused\(true\); revealCard\(\); \}\}/);
  assert.match(src('components/ui/AuthShell.tsx'), /<RevealCardContext\.Provider value=\{revealCard\}>/);
});

test('Send a new code counts down 60 s only after a code went out; from Sign in › Enter the code it is offered at once', () => {
  const step = src('components/ui/CodeStep.tsx');
  assert.match(step, /sentJustNow = true,/);
  assert.match(step, /useState\(sentJustNow \? SIGNUP_RESEND_COOLDOWN_S : 0\)/);
  const register = src('app/(auth)/register.tsx');
  assert.match(register, /const \[codeJustSent, setCodeJustSent\] = useState\(!confirmParam\);/);
  assert.match(register, /setCodeJustSent\(true\);\s+setCodeFor\(\{ channel: 'email', email: cleanEmail \}\);/);
  assert.match(register, /sentJustNow=\{codeJustSent\}/);
  assert.match(src('e2e/smoke/27-create-account-code.yaml'), /register\?confirm=[\s\S]*- assertVisible: "Send a new code"\n/);
});

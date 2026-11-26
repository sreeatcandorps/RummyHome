import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { cleanCountryCode, phoneCountry, signInDefaults } from '../utils/signInDefaults';
import {
  DEFAULT_WHATSAPP_COUNTRY,
  formatWhatsAppNumber,
  maskWhatsAppNumber,
  parseStoredPhone,
  splitPlusNumber,
  WHATSAPP_COUNTRIES,
  whatsAppCountry,
  whatsAppE164,
  whatsAppNumberProblem,
} from '../utils/countries';
import {
  isNumberInUseError,
  makeEmailChange,
  makeWhatsAppAuth,
  NUMBER_IN_USE_MESSAGE,
  NUMBER_PASSCODE_MISMATCH,
  PhoneAuthLike,
  readSignInMethodsFrom,
} from '../utils/whatsappAuth';
import {
  codeStepIcon,
  codeStepText,
  SIGNUP_CODE_TEXT,
  WHATSAPP_CODE_ERRORS,
  WHATSAPP_CODE_TEXT,
  whatsAppCodeErrorMessage,
} from '../utils/signUpCode';
import { BACKUP_REMINDER_TITLE, backupReminderFor } from '../utils/backupReminder';
import { HELP_TOPICS } from '../constants/helpTopics';

const src = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');
const IN = whatsAppCountry('IN')!;
const US = whatsAppCountry('US')!;
const CA = whatsAppCountry('CA')!;

// ---------------------------------------------------------------------------
// D125: which way and which country code come first
// ---------------------------------------------------------------------------

test('D125: India SIM on a phone left on English (United States) starts Create account on WhatsApp +91', () => {
  assert.deepEqual(signInDefaults('in', 'US', null), { method: 'whatsapp', country: 'IN', dialCode: '+91' });
});

test('D125: US region, no SIM → Email, +1', () => {
  assert.deepEqual(signInDefaults(null, 'US', null), { method: 'email', country: 'US', dialCode: '+1' });
});

test('D125: UAE → Email, +971', () => {
  assert.deepEqual(signInDefaults('ae', 'AE', null), { method: 'email', country: 'AE', dialCode: '+971' });
});

test('D125: France (not one of the six) → Email, +91', () => {
  assert.deepEqual(signInDefaults('fr', 'FR', null), { method: 'email', country: 'IN', dialCode: '+91' });
});

test('D125: unknown country → Email, +91', () => {
  assert.deepEqual(signInDefaults(null, null, null), { method: 'email', country: 'IN', dialCode: '+91' });
  assert.deepEqual(signInDefaults('--', '', undefined), { method: 'email', country: 'IN', dialCode: '+91' }, 'an iPhone with no readable SIM says "--"');
});

test('D125: Sign in and Forgot passcode start on the way last used on this phone, whatever the country', () => {
  assert.equal(signInDefaults('us', 'US', 'whatsapp').method, 'whatsapp');
  assert.equal(signInDefaults('in', 'IN', 'email').method, 'email');
  assert.equal(signInDefaults('us', 'US', 'whatsapp').dialCode, '+1', 'the code still follows the country');
  assert.equal(signInDefaults('in', 'IN', 'sms' as never).method, 'whatsapp', 'a stored value that is not a way in is ignored');
});

test('D125: the SIM wins over the region; Canada, the UK and Australia get their own code', () => {
  assert.equal(phoneCountry('ca', 'US'), 'CA');
  assert.equal(phoneCountry(null, 'gb'), 'GB');
  assert.equal(cleanCountryCode(' au '), 'AU');
  assert.equal(cleanCountryCode('USA'), null);
  assert.equal(signInDefaults('ca', 'US', null).dialCode, '+1');
  assert.equal(signInDefaults('ca', 'US', null).country, 'CA');
  assert.equal(signInDefaults(null, 'GB', null).dialCode, '+44');
  assert.equal(signInDefaults(null, 'AU', null).dialCode, '+61');
});

test('D125: the country is read without a permission and never stored', () => {
  const device = src('services/deviceCountry.ts');
  assert.match(device, /getIsoCountryCodeAsync/, 'the SIM country (expo-cellular)');
  assert.match(device, /getLocales\(\)/, 'the region setting (expo-localization)');
  assert.doesNotMatch(device, /expo-location|requestPermissions|getCurrentPosition/, 'never GPS, never a permission');
  assert.doesNotMatch(device, /setItem\([^)]*[Cc]ountry/, 'nothing about the country is stored');
  assert.match(device, /setItem\(LAST_SIGN_IN_METHOD_KEY/, 'only the last way used is remembered');
  const pkg = JSON.parse(src('package.json'));
  assert.ok(pkg.dependencies['expo-cellular'] && pkg.dependencies['expo-localization'], 'both modules are dependencies');
  assert.match(src('app/(auth)/register.tsx'), /loadSignInDefaults\(false\)/, 'Create account follows the country');
  assert.match(src('app/(auth)/login.tsx'), /loadSignInDefaults\(true\)/, 'Sign in follows the last way used');
});

// ---------------------------------------------------------------------------
// The number box: six countries, the pasted + code wins
// ---------------------------------------------------------------------------

test('WhatsApp numbers: the six countries, India first', () => {
  assert.deepEqual(WHATSAPP_COUNTRIES.map((c) => `${c.code}+${c.callingCode}`), ['IN+91', 'US+1', 'CA+1', 'GB+44', 'AE+971', 'AU+61']);
  assert.equal(DEFAULT_WHATSAPP_COUNTRY.code, 'IN');
});

test('WhatsApp numbers: a pasted + code wins over the picker', () => {
  assert.equal(whatsAppE164(US, '+91 98765 43210'), '+919876543210');
  assert.equal(splitPlusNumber('+91 98765 43210', US)?.country.code, 'IN');
  assert.equal(splitPlusNumber('+971 50 123 4567', IN)?.country.code, 'AE', '+971 is not read as +9…');
  assert.equal(splitPlusNumber('+1 416 555 0123', CA)?.country.code, 'CA', '+1 keeps Canada when Canada is picked');
  assert.equal(splitPlusNumber('+1 415 555 0123', IN)?.country.code, 'US');
  assert.equal(splitPlusNumber('98765 43210', US), null, 'no + → the picker decides');
});

test('WhatsApp numbers: what is typed beside the picker', () => {
  assert.equal(whatsAppE164(IN, '98765 43210'), '+919876543210');
  assert.equal(whatsAppE164(IN, '098765 43210'), '+919876543210', 'a leading 0 is dropped');
  assert.equal(whatsAppE164(IN, '91 98765 43210'), '+919876543210', 'a repeated code is dropped');
  assert.equal(whatsAppE164(IN, ''), null);
  assert.equal(whatsAppNumberProblem(IN, ''), 'Enter your WhatsApp number.');
  assert.equal(whatsAppNumberProblem(IN, '12345 67890'), 'An Indian WhatsApp number is 10 digits starting 6–9.');
  assert.equal(whatsAppNumberProblem(IN, '98765 43210'), null);
  assert.equal(whatsAppNumberProblem(US, '415 555 012'), 'A WhatsApp number in the US or Canada is 10 digits after +1.');
  assert.match(whatsAppNumberProblem(IN, '+33 6 12 34 56 78') ?? '', /India, the US, Canada, the UK, the UAE and Australia/);
  assert.equal(whatsAppNumberProblem(IN, '+91 90000 00001'), null, 'the Maestro test number is a valid Indian number');
});

test('WhatsApp numbers: shown with the country code, masked on the code step', () => {
  assert.equal(formatWhatsAppNumber('919876543210'), '+91 98765 43210');
  assert.equal(formatWhatsAppNumber('+14155550123'), '+1 415 555 0123');
  assert.equal(formatWhatsAppNumber('971501234567'), '+971 50 123 4567');
  assert.equal(maskWhatsAppNumber('+919876543210'), '+91 98xxx xx210');
  assert.equal(maskWhatsAppNumber('+919000000001'), '+91 90xxx xx001');
  assert.equal(parseStoredPhone('447700900123')?.country.code, 'GB');
});

// ---------------------------------------------------------------------------
// Supabase: WhatsApp always, resend never
// ---------------------------------------------------------------------------

type Call = { method: string; args: any; options?: any };

function fakeAuth(answers: Partial<Record<'signUp' | 'signInWithPassword' | 'signInWithOtp' | 'verifyOtp' | 'updateUser', { data?: any; error: any }>> = {}) {
  const calls: Call[] = [];
  const answer = (method: keyof typeof answers) => async (args: any, options?: any) => {
    calls.push({ method, args, options });
    return answers[method] ?? { data: { user: { id: 'u1', identities: [{ id: 'i1' }] }, session: { user: { id: 'u1' } } }, error: null };
  };
  const auth: PhoneAuthLike = {
    signUp: answer('signUp'),
    signInWithPassword: answer('signInWithPassword'),
    signInWithOtp: answer('signInWithOtp'),
    verifyOtp: answer('verifyOtp'),
    updateUser: answer('updateUser'),
    async resend(args: any) {
      calls.push({ method: 'resend', args });
      return { error: null };
    },
  };
  return { auth, calls };
}

const NUMBER = '+919000000001';
const NAME = { display_name: 'Asha Rao', first_name: 'Asha', last_name: 'Rao' };

test('WhatsApp: every request that sends a code carries channel whatsapp, and Send a new code never calls resend', async () => {
  const { auth, calls } = fakeAuth();
  const wa = makeWhatsAppAuth(auth);
  await wa.signUp({ phone: NUMBER, passcode: '482913', data: NAME });
  await wa.sendCode('sign-up', NUMBER, '482913', NAME);
  await wa.sendCode('recovery', NUMBER);
  await wa.sendCode('recovery', NUMBER);
  await wa.sendCode('change', NUMBER);
  await wa.sendCode('change', NUMBER);

  assert.equal(calls.filter((c) => c.method === 'resend').length, 0, 'Supabase resend sends an SMS for a phone; never used');
  const sends = calls.filter((c) => c.method !== 'verifyOtp');
  assert.equal(sends.length, 6);
  for (const call of sends) {
    const channel = call.method === 'updateUser' ? call.args.channel : call.args.options?.channel;
    assert.equal(channel, 'whatsapp', `${call.method} asks for WhatsApp`);
  }
  assert.deepEqual(calls[0].args, { phone: NUMBER, password: '482913', options: { channel: 'whatsapp', data: NAME } });
  assert.equal(calls[1].method, 'signUp', 'a new sign-up code repeats the sign-up request');
  assert.deepEqual(calls[2].args, { phone: NUMBER, options: { channel: 'whatsapp', shouldCreateUser: false } }, 'Forgot passcode never creates an account');
  assert.deepEqual(calls[4].args, { phone: NUMBER, channel: 'whatsapp' });
});

test('WhatsApp: sign-up sends the name but never the number in its data (the new-user trigger would copy it to profiles.phone)', async () => {
  const { auth, calls } = fakeAuth();
  await makeWhatsAppAuth(auth).signUp({ phone: NUMBER, passcode: '482913', data: NAME });
  assert.equal(calls[0].args.options.data.phone, undefined);
  assert.equal(calls[0].args.options.data.display_name, 'Asha Rao');
  assert.doesNotMatch(src('app/(auth)/register.tsx'), /whatsAppData[\s\S]{0,200}phone:/, 'register builds the data without a phone');
});

test('WhatsApp: the code is checked with type sms, or phone_change for a number change; a typo never reaches Supabase', async () => {
  const { auth, calls } = fakeAuth();
  const wa = makeWhatsAppAuth(auth);
  assert.deepEqual(await wa.verifyCode('sign-up', NUMBER, '123 456'), { ok: true });
  await wa.verifyCode('recovery', NUMBER, '123456');
  await wa.verifyCode('change', NUMBER, '123456');
  assert.deepEqual(calls.map((c) => c.args.type), ['sms', 'sms', 'phone_change']);
  assert.equal(calls[0].args.token, '123456', 'a pasted "123 456" is cleaned');
  const before = calls.length;
  assert.deepEqual(await wa.verifyCode('sign-up', NUMBER, ''), { ok: false, message: 'Enter the 6-digit code from WhatsApp.' });
  assert.equal((await wa.verifyCode('sign-up', NUMBER, '1234')).ok, false);
  assert.equal(calls.length, before);
});

test('WhatsApp: a wrong or expired code, and a number Twilio cannot reach, in plain words', async () => {
  const { auth } = fakeAuth({ verifyOtp: { error: { code: 'otp_expired', message: 'Token has expired or is invalid' } } });
  assert.deepEqual(await makeWhatsAppAuth(auth).verifyCode('sign-up', NUMBER, '000000'), { ok: false, message: WHATSAPP_CODE_ERRORS.wrongOrExpired });
  assert.equal(whatsAppCodeErrorMessage({ code: 'sms_send_failed', message: 'Error sending sms OTP' }, 'send', 'recovery'), WHATSAPP_CODE_ERRORS.notOnWhatsApp);
  assert.equal(whatsAppCodeErrorMessage({ code: 'sms_send_failed', message: 'x' }, 'send', 'sign-up'), WHATSAPP_CODE_ERRORS.couldNotSend);
  for (const words of Object.values(WHATSAPP_CODE_ERRORS)) {
    assert.doesNotMatch(words, /\bOTP\b|\bSMS\b|mobile/i, words);
  }
});

test('WhatsApp: a number that already has an account says so, both ways Supabase answers it', async () => {
  const already = fakeAuth({ signUp: { data: null, error: { code: 'user_already_exists', message: 'User already registered' } } });
  assert.deepEqual(await makeWhatsAppAuth(already.auth).signUp({ phone: NUMBER, passcode: '482913', data: NAME }), { ok: false, message: NUMBER_IN_USE_MESSAGE, numberInUse: true });
  const obfuscated = fakeAuth({ signUp: { data: { user: { id: 'fake', identities: [] }, session: null }, error: null } });
  assert.deepEqual(await makeWhatsAppAuth(obfuscated.auth).signUp({ phone: NUMBER, passcode: '482913', data: NAME }), { ok: false, message: NUMBER_IN_USE_MESSAGE, numberInUse: true });
  assert.equal(isNumberInUseError({ code: 'phone_exists', message: '' }), true);
  const fresh = fakeAuth({ signUp: { data: { user: { id: 'u9', identities: [{ id: 'i' }] }, session: null }, error: null } });
  assert.deepEqual(await makeWhatsAppAuth(fresh.auth).signUp({ phone: NUMBER, passcode: '482913', data: NAME }), { ok: true, session: false, userId: 'u9' }, 'no session → the code step');
});

test('WhatsApp: number + passcode sends nothing; a wrong passcode and an unconfirmed number are told apart', async () => {
  const ok = fakeAuth();
  assert.deepEqual(await makeWhatsAppAuth(ok.auth).signIn(NUMBER, '123456'), { ok: true, userId: 'u1' });
  assert.deepEqual(ok.calls.map((c) => c.method), ['signInWithPassword']);
  assert.deepEqual(ok.calls[0].args, { phone: NUMBER, password: '123456' });
  const wrong = fakeAuth({ signInWithPassword: { error: { code: 'invalid_credentials', message: 'Invalid login credentials' } } });
  assert.deepEqual(await makeWhatsAppAuth(wrong.auth).signIn(NUMBER, '000000'), { ok: false, message: NUMBER_PASSCODE_MISMATCH });
  const unconfirmed = fakeAuth({ signInWithPassword: { error: { code: 'phone_not_confirmed', message: 'Phone not confirmed' } } });
  const answer = await makeWhatsAppAuth(unconfirmed.auth).signIn(NUMBER, '123456');
  assert.equal(answer.ok, false);
  assert.equal(!answer.ok && answer.notConfirmed, true);
});

test('WhatsApp: Forgot passcode for a number with no account reads like success (the form finds no one)', async () => {
  const { auth } = fakeAuth({ signInWithOtp: { error: { code: 'otp_disabled', message: 'Signups not allowed for otp' } } });
  assert.deepEqual(await makeWhatsAppAuth(auth).sendCode('recovery', NUMBER), { ok: true });
});

test('Email change: a code to the new address, verify type email_change; changed at once when the project needs no code', async () => {
  const pending = fakeAuth({ updateUser: { data: { user: { email: 'old@x.co', new_email: 'new@x.co' } }, error: null } });
  const change = makeEmailChange(pending.auth, 'ezscore://auth/callback');
  assert.deepEqual(await change.sendCode('new@x.co'), { ok: true });
  assert.deepEqual(pending.calls[0].args, { email: 'new@x.co' });
  await change.verifyCode('new@x.co', '123456');
  assert.equal(pending.calls[1].args.type, 'email_change');
  const instant = fakeAuth({ updateUser: { data: { user: { email: 'new@x.co' } }, error: null } });
  assert.deepEqual(await makeEmailChange(instant.auth).sendCode('new@x.co'), { ok: true, done: true });
  const taken = fakeAuth({ updateUser: { error: { code: 'email_exists', message: 'A user with this email address has already been registered' } } });
  assert.deepEqual(await makeEmailChange(taken.auth).sendCode('new@x.co'), { ok: false, message: 'That email already has an account.' });
});

// ---------------------------------------------------------------------------
// The code step: one screen, two sets of words (D101, spec §8(b))
// ---------------------------------------------------------------------------

test('Code step: WhatsApp words and icon; the rest is the D101 step', () => {
  const wa = codeStepText('whatsapp');
  assert.equal(wa.title, 'Check WhatsApp');
  assert.equal(wa.subtitle('+91 90xxx xx001'), 'We sent a 6-digit code to WhatsApp +91 90xxx xx001');
  assert.equal(wa.fieldLabel, 'Code from WhatsApp');
  assert.equal(wa.wrongAddress, 'Wrong number?');
  assert.equal(wa.verify, SIGNUP_CODE_TEXT.verify);
  assert.equal(wa.resend, 'Send a new code');
  assert.equal(codeStepText('email'), SIGNUP_CODE_TEXT);
  assert.equal(codeStepIcon('whatsapp'), 'whatsapp');
  assert.equal(codeStepIcon('email'), 'email-check-outline');
  for (const v of Object.values(WHATSAPP_CODE_TEXT)) {
    const words = typeof v === 'function' ? (v as (x: never) => string)('x' as never) : v;
    assert.doesNotMatch(words, /\bOTP\b|mobile|\bSMS\b/i, words);
  }
  const step = src('components/ui/CodeStep.tsx');
  assert.match(step, /SIGNUP_RESEND_COOLDOWN_S/, 'Send a new code waits a minute');
  assert.match(step, /keepCardInView|<AuthShell/, 'inside the auth card');
  assert.match(step, /words\.wrongAddress/);
});

test('Code step: the root layout is held while a code signs the session in, so the step can finish first', () => {
  const layout = src('app/_layout.tsx');
  assert.match(layout, /authNavigationHold\.active\(\)/);
  assert.match(src('app/(screens)/confirm-code.tsx'), /authNavigationHold\.begin\(\)/);
  assert.match(src('app/(auth)/register.tsx'), /authNavigationHold\.begin\(\)/);
});

// ---------------------------------------------------------------------------
// Profile, the backup step, Home's one reminder, help
// ---------------------------------------------------------------------------

test('Home reminder (D75): once, after the first saved game, for an account with one way in, until Not now', () => {
  const waOnly = { email: null, phone: '919000000001', backupReminder: null } as const;
  const emailOnly = { email: 'a@b.co', phone: null, backupReminder: null } as const;
  assert.equal(backupReminderFor(waOnly, 0), null, 'not before a game is saved');
  assert.deepEqual(backupReminderFor(waOnly, 1), {
    add: 'email', title: BACKUP_REMINDER_TITLE, action: 'Add email',
    text: 'You sign in with WhatsApp only. If you lose that number, an email is the way back to your games.',
  });
  assert.equal(backupReminderFor(emailOnly, 3)?.add, 'whatsapp');
  assert.equal(backupReminderFor(emailOnly, 3)?.action, 'Add WhatsApp');
  assert.equal(backupReminderFor({ ...emailOnly, phone: '919000000001' }, 3), null, 'both ways in → nothing');
  assert.equal(backupReminderFor({ ...waOnly, backupReminder: 'dismissed' }, 3), null, 'Not now hides it for good');
  assert.equal(backupReminderFor(null, 3), null);
  assert.match(src('app/(tabs)/index.tsx'), /dismissBackupReminder\(\)/);
  assert.match(src('services/auth.ts'), /updateUser\(\{ data: \{ backup_reminder: 'dismissed' \} \}\)/, 'kept on the account, every phone');
});

test('Backup step after sign-up: the other way in, Skip for now', () => {
  const step = src('components/auth/BackupStep.tsx');
  assert.match(step, /title: 'Add a backup'/);
  assert.match(step, /skip: 'Skip for now'/);
  assert.match(step, /testID="backup-skip"/);
  assert.match(src('app/(auth)/register.tsx'), /<BackupStep/);
});

test('Profile › Sign-in methods: Email, WhatsApp, Passcode; Change passcode moves there; no Remove', () => {
  const me = src('app/(tabs)/me.tsx');
  assert.match(me, /PROFILE_GROUPS = \['Sign-in methods', 'Your table'/);
  assert.match(me, /'Either one signs you in with the same passcode\. Only you see these\.'/);
  assert.match(me, /'If you lose this number, a backup email is the way back in\.'/);
  assert.match(me, /value=\{value \?\? 'Add a backup'\}/);
  assert.match(me, /<ListRow title="Passcode" value="Change" onPress=\{changePasscode\} testID="me-change-passcode" \/>/);
  assert.doesNotMatch(me, /title="Remove/);
  const sheet = src('components/account/SignInMethodDialog.tsx');
  assert.match(sheet, /'Change WhatsApp number'/);
  assert.match(sheet, /We send a code on WhatsApp to the new number\. Your account, Player ID, passcode and games stay the same\./);
  assert.match(sheet, /KeyboardAvoidingView/, 'the sheet stays above the keypad');
  assert.match(src('app/(screens)/_layout.tsx'), /name="confirm-code" options=\{\{ headerShown: false \}\}/);
});

test('Sign-in methods: read from the server, or from the session on the phone when that request fails', async () => {
  const held = { email: 'sree@test.local', phone: '', user_metadata: { backup_reminder: 'dismissed' } };
  const session = async () => ({ data: { session: { user: held } } });
  const fromServer = await readSignInMethodsFrom({
    getUser: async () => ({ data: { user: { email: null, phone: '919000000002', user_metadata: {} } } }),
    getSession: async () => { throw new Error('not asked when the server answers'); },
  });
  assert.deepEqual(fromServer, { email: null, phone: '919000000002', backupReminder: null });
  const expected = { email: 'sree@test.local', phone: null, backupReminder: 'dismissed' };
  assert.deepEqual(await readSignInMethodsFrom({ getUser: async () => ({ data: { user: null }, error: { message: 'Network request failed' } }), getSession: session }), expected);
  assert.deepEqual(await readSignInMethodsFrom({ getUser: async () => { throw new Error('Network request failed'); }, getSession: session }), expected);
  assert.equal(await readSignInMethodsFrom({ getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }) }), null);
  assert.match(src('services/auth.ts'), /readSignInMethodsFrom\(supabase\.auth/);
});

test('WhatsApp number field: focusing it scrolls the auth card up, so the passcode under it clears the keypad', () => {
  const field = src('components/ui/WhatsAppNumberField.tsx');
  assert.match(field, /const revealCard = useRevealCard\(\);/);
  assert.match(field, /onFocus=\{revealCard\}/);
});

test('Forgot passcode by WhatsApp: the code, then Set a new passcode with whose account it is, and Not you?', () => {
  const forgot = src('app/(auth)/forgot-password.tsx');
  assert.match(forgot, /This is the account of \$\{who\}\./);
  assert.match(forgot, /notYou: 'Not you\?'/);
  assert.match(forgot, /whatsAppAuth\.sendCode\('recovery'/);
  assert.match(forgot, /releaseMyWhatsAppNumber\(\)/);
  assert.match(src('services/auth.ts'), /rpc as any\)\('release_my_whatsapp_number'\)/);
});

test('Help: Sign in with WhatsApp, I changed my number, Add a backup; Can I change my email points to Profile', () => {
  const signIn = HELP_TOPICS['sign-in'];
  const sectionTitles = signIn.sections.map((s) => s.title);
  assert.ok(sectionTitles.includes('Sign in with WhatsApp'));
  assert.ok(sectionTitles.includes('Add a backup'));
  assert.ok(signIn.tricky.some((t) => t.q === 'I changed my number.'));
  const changeEmail = HELP_TOPICS.me.tricky.find((t) => t.id === 'change-email');
  assert.match(changeEmail?.a ?? '', /Profile › Sign-in methods › Email/);
  assert.doesNotMatch(changeEmail?.a ?? '', /Not yet/);
});

// ---------------------------------------------------------------------------
// The mock path: local Supabase test numbers, no sender
// ---------------------------------------------------------------------------

test('Local Supabase: phone sign-up with codes, Twilio Verify placeholders, the three test numbers', () => {
  const config = src('supabase/config.toml');
  const sms = config.slice(config.indexOf('[auth.sms]'));
  assert.match(sms, /\[auth\.sms\]\nenable_signup = true\nenable_confirmations = true/);
  assert.match(sms, /\[auth\.sms\.twilio_verify\]\nenabled = true/, 'a Twilio provider is on, so channel whatsapp is accepted');
  assert.match(sms, /account_sid = "local-test-only"/, 'placeholders, not keys');
  for (const n of ['919000000001', '919000000002', '919000000003']) assert.match(sms, new RegExp(`${n} = "123456"`));
  const seed = src('supabase/seed-e2e.sql');
  assert.match(seed, /'919000000002', crypt\('123456'/);
  assert.match(seed, /'919000000003', crypt\('123456'/);
  assert.doesNotMatch(seed, /'919000000001'/, 'smoke/32 creates that account');
});

test('Maestro: create account, sign in and Forgot passcode by WhatsApp, with the keypad open', () => {
  for (const [file, number] of [
    ['e2e/smoke/32-whatsapp-create-account.yaml', '9000000001'],
    ['e2e/smoke/33-whatsapp-sign-in.yaml', '9000000002'],
    ['e2e/smoke/34-whatsapp-forgot-passcode.yaml', '9000000003'],
  ] as const) {
    assert.ok(existsSync(path.join(process.cwd(), file)), file);
    const flow = src(file);
    assert.match(flow, new RegExp(number), `${file} uses its test number`);
    assert.doesNotMatch(flow, /hideKeyboard/, `${file}: taps happen with the keypad open`);
  }
  assert.match(src('e2e/smoke/32-whatsapp-create-account.yaml'), /Check WhatsApp/);
  assert.match(src('e2e/smoke/34-whatsapp-forgot-passcode.yaml'), /This is the account of Farah Forgot/);
});

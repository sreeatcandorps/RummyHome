import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { formatAuthError } from '../utils/authErrors';
import { normalizeEmail } from '../utils/playerIdentity';
import {
  EMAIL_IN_USE_CODE,
  EMAIL_IN_USE_MESSAGE,
  EmailInUseError,
  isEmailInUseError,
  isRepeatedSignUp,
} from '../utils/signUpOutcome';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

// ---------------------------------------------------------------------------
// The GoTrue answer that looked like a second account
// ---------------------------------------------------------------------------

const sanitisedUser = {
  user: { id: 'e7c1…random', email: 'sree@example.com', identities: [], confirmation_sent_at: '2026-11-11T20:00:00Z' },
  session: null,
};

test('a sign-up answer with no identities and no session is a repeated sign-up (Confirm email on)', () => {
  assert.equal(isRepeatedSignUp(sanitisedUser), true);
});

test('a real new account has one identity (and no session until the email is confirmed)', () => {
  const fresh = { user: { id: 'u1', identities: [{ id: 'u1', provider: 'email' }] }, session: null };
  assert.equal(isRepeatedSignUp(fresh), false);
});

test('a new account with autoconfirm has a session and is never treated as repeated', () => {
  const autoconfirmed = { user: { id: 'u1', identities: [] }, session: { access_token: 't' } };
  assert.equal(isRepeatedSignUp(autoconfirmed), false);
});

test('no user at all is not a repeated sign-up (that is an error path)', () => {
  assert.equal(isRepeatedSignUp({ user: null, session: null }), false);
  assert.equal(isRepeatedSignUp(null), false);
  assert.equal(isRepeatedSignUp({ user: { id: 'u', identities: null }, session: null }), false);
});

test('the explicit 422 from autoconfirm is also "email in use"', () => {
  assert.equal(isEmailInUseError({ code: 'user_already_exists', message: 'User already registered', status: 422 }), true);
  assert.equal(isEmailInUseError({ message: 'User already registered' }), true);
  assert.equal(isEmailInUseError(new EmailInUseError()), true);
  assert.equal(isEmailInUseError({ code: 'invalid_credentials', message: 'Invalid login credentials' }), false);
  assert.equal(isEmailInUseError(null), false);
});

test('the user sees the exact sentence Sree asked for', () => {
  assert.equal(EMAIL_IN_USE_MESSAGE, 'An account with this email already exists. Sign in or reset your password.');
  const error = new EmailInUseError();
  assert.equal(error.code, EMAIL_IN_USE_CODE);
  assert.equal(error.message, EMAIL_IN_USE_MESSAGE);
  assert.equal(formatAuthError(error), EMAIL_IN_USE_MESSAGE);
  assert.equal(formatAuthError({ message: 'User already registered' }), EMAIL_IN_USE_MESSAGE);
});

// ---------------------------------------------------------------------------
// Normalisation: trim + lower-case, and everything goes through it
// ---------------------------------------------------------------------------

test('normalizeEmail trims, removes inner whitespace and lower-cases', () => {
  assert.equal(normalizeEmail('  Sree.K@Example.COM '), 'sree.k@example.com');
  assert.equal(normalizeEmail('sree @ example.com'), 'sree@example.com');
  assert.equal(normalizeEmail(null), '');
});

test('authService refuses the sanitised answer before anything else happens', () => {
  const src = read('services/auth.ts');
  assert.match(src, /isRepeatedSignUp\(data\)\) throw new EmailInUseError\(\)/, 'signUp checks the identities list');
  assert.match(src, /isEmailInUseError\(error\) \? new EmailInUseError\(\) : error/, 'the 422 is mapped to the same error');
  const signUpBody = src.slice(src.indexOf('async signUp('), src.indexOf('async resendConfirmation('));
  assert.ok(signUpBody.indexOf('isRepeatedSignUp(data)') < signUpBody.indexOf('forgetProfile()'), 'the check runs before the profile cache is dropped');
  for (const call of ['signInWithPassword({\n      email: normalizeEmail(email)', 'signUp({\n      email: normalizeEmail(email)', 'resetPasswordForEmail(normalizeEmail(email)', 'verifyOtp({ email: normalizeEmail(email)']) {
    assert.ok(src.includes(call), `${call.split('(')[0]} normalises the email`);
  }
});

test('the register screen sends the welcome mail to the normalised address and only after a real sign-up', () => {
  const src = read('app/(auth)/register.tsx');
  assert.match(src, /sendWelcomeEmail\(cleanEmail, displayName\)/);
  assert.ok(src.indexOf('authService.signUp(cleanEmail') < src.indexOf('sendWelcomeEmail(cleanEmail'), 'sign-up (which throws on a repeat) comes first');
  assert.match(src, /setError\(formatAuthError\(err\)\)/, 'the error is shown through formatAuthError');
});

// ---------------------------------------------------------------------------
// Migration 021: guarantee in the database, report instead of delete
// ---------------------------------------------------------------------------

test('021 normalises on write, adds the case-insensitive unique index, and reports duplicates', () => {
  const sql = read('supabase/migrations/021_email_uniqueness.sql');
  assert.match(sql, /create or replace function public\.normalize_profile_email\(\)/);
  assert.match(sql, /new\.email := nullif\(lower\(btrim\(new\.email\)\), ''\)/);
  assert.match(sql, /create trigger profiles_normalize_email\s+before insert or update of email on public\.profiles/);
  assert.match(sql, /create unique index if not exists profiles_email_ci_key\s+on public\.profiles \(lower\(btrim\(email\)\)\) where email is not null/);
  assert.match(sql, /create or replace function public\.duplicate_profile_emails\(\)/);
  assert.match(sql, /revoke all on function public\.duplicate_profile_emails\(\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.duplicate_profile_emails\(\) to service_role/);
});

test('021 never deletes, merges or edits profile rows, and never touches the auth schema', () => {
  const sql = read('supabase/migrations/021_email_uniqueness.sql').toLowerCase();
  const statements = sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
  assert.doesNotMatch(statements, /delete from/);
  assert.doesNotMatch(statements, /update public\.profiles/);
  assert.doesNotMatch(statements, /insert into public\.profiles/);
  assert.doesNotMatch(statements, /alter table auth\.|create .* on auth\.|drop .* auth\./);
  assert.match(statements, /raise notice '021: the unique index profiles_email_ci_key was not created/);
});

test('rollback 021 removes exactly what 021 added', () => {
  const sql = read('supabase/rollback/rollback_021_email_uniqueness.sql');
  assert.match(sql, /drop trigger if exists profiles_normalize_email on public\.profiles/);
  assert.match(sql, /drop function if exists public\.normalize_profile_email\(\)/);
  assert.match(sql, /drop index if exists public\.profiles_email_ci_key/);
  assert.match(sql, /drop function if exists public\.duplicate_profile_emails\(\)/);
  const statements = sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
  assert.doesNotMatch(statements, /profiles_email_normalized_key|profiles_email_key|lock_profile_role/, 'leaves 001, 011 and 019 alone');
});

test('the pgTAP file for 021 covers normalisation, uniqueness, permissions and the report', () => {
  const sql = read('supabase/tests/11_email_uniqueness_021.sql');
  assert.match(sql, /select plan\(20\)/);
  for (const needle of ['has_trigger', "'23505'", 'duplicate_profile_emails', 'has_function_privilege', "'mixed.case@test.local'", 'Sree@Test.Local']) {
    assert.ok(sql.includes(needle), `pgTAP checks ${needle}`);
  }
});

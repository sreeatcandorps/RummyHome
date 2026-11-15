import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isNetworkError, formatSupabaseError } from '../utils/supabaseErrors';

// PR 19: the first bugs the break-the-app suite (PR 17) found, F1–F3 on #45.
const src = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('F1 (chaos c12): signOut never throws — a dead server session still clears the phone', () => {
  const auth = src('services/auth.ts');
  const body = auth.slice(auth.lastIndexOf('async signOut()'), auth.indexOf('async deleteAccount('));
  assert.match(body, /supabase\.auth\.signOut\(\)\.catch\(/, 'a rejected global sign-out is caught');
  assert.match(body, /signOut\(\{ scope: 'local' \}\)\.catch\(\(\) => \{\}\)/, 'falls back to forgetting this device only');
  assert.match(body, /storage\.setCurrentPlayer\(null\)/);
  assert.doesNotMatch(body, /throw error/, 'nothing in signOut throws');
  const me = src('app/(tabs)/me.tsx');
  assert.match(me, /await authService\.signOut\(\);\s*else await storage\.setCurrentPlayer\(null\);\s*router\.replace\('\/\(auth\)\/login'\)/s, 'Log out always ends on the login screen');
});

test('F2 (chaos c11): a network failure is told apart from being signed out', () => {
  assert.equal(isNetworkError(new TypeError('Network request failed')), true);
  assert.equal(isNetworkError({ message: 'Failed to fetch' }), true);
  assert.equal(isNetworkError({ message: 'Auth session missing!' }), false);
  assert.equal(isNetworkError(null), false);
  assert.match(formatSupabaseError(new TypeError('Network request failed')), /Network error/);
  const home = src('app/(tabs)/index.tsx');
  assert.match(home, /setSignedOut\(true\)/, 'signed out only when the server said there is no session');
  assert.match(home, /title="Couldn't reach the server"/);
  assert.match(home, /You're still signed in\./);
  assert.match(home, /actionLabel="Try again"/);
  const signedOutBlock = home.slice(home.indexOf('title="You\'re signed out"'));
  assert.match(signedOutBlock.slice(0, 200), /message="Sign in to see your games\."/, 'the signed-out screen no longer carries the network error text');
});

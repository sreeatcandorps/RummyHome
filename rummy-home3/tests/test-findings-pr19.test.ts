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

test('F6 (smoke 17): a 20-player Standings card never squeezes the grid — its own pane under the five-row card in portrait; landscape has no standings (Nov 18)', () => {
  const standings = src('components/game/PoolStandings.tsx');
  assert.match(standings, /maxHeight\?: number/);
  assert.match(standings, /scroll && maxHeight != null && \{ maxHeight \}/, 'the card itself is capped when it scrolls inside');
  assert.match(standings, /scroll\?: boolean/, 'PR 24: a non-scrolling mode for a pane that scrolls on its own');
  assert.match(standings, /rows: \{ flexGrow: 0, flexShrink: 1 \}/, 'the scroller shrinks instead of pushing the card past the cap');
  const scorecard = src('app/(screens)/games/[id].tsx');
  assert.match(scorecard, /scroll=\{false\}/, 'the scorecard screen lets the pane scroll');
  assert.match(scorecard, /poolTablePane: \{\s*flexGrow: 0,\s*flexShrink: 1,/, 'portrait: the card takes only what its rows need');
  assert.match(scorecard, /<ScrollView style=\{styles\.flex\} contentContainerStyle=\{styles\.portraitStandingsContent\}[^>]*testID="pool-standings-pane"/, '… the standings fill the rest');
  assert.doesNotMatch(scorecard, /below=\{/, 'landscape: no standings (Nov 18)');
  assert.doesNotMatch(scorecard, /windowHeight \* \(isShort/, 'no window-share cap: each region has its own scroller');
});

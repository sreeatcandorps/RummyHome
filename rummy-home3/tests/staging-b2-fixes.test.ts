import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import * as plannerModule from '../../ci/select-tests.mjs';

type Job = { device: string; suite: string };
const { DEVICES, select } = plannerModule as unknown as {
  DEVICES: Record<string, { profile: string; density?: number; font: string; label: string }>;
  select: (input: { event?: string; files?: string[] }) => { jobs: Job[] };
};

// Staging build 2 (Sree, Nov 23 — docs/staging-b2-feedback.md). Each test here fails on the parent commit
// (D83: a bug is fixed only when a test that failed before proves it).

const ROOT = path.join(__dirname, '..');
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');

test('bug 4: the Delete account dialog scrolls at font 1.3 — its body is a ScrollView inside Dialog.ScrollArea', () => {
  const src = read('components/account/DeleteAccountDialog.tsx');
  assert.match(src, /<Dialog\.ScrollArea style=\{styles\.area\}>\s*<ScrollView/, 'ScrollView inside ScrollArea');
  assert.match(src, /testID="delete-account-scroll"/);
  assert.match(src, /area:\s*\{[^}]*flexShrink:\s*1/, 'the scroll area shrinks so the buttons stay on screen');
});

test('bug 8: the Create account form pads for the keyboard on Android too (edge-to-edge window never resizes)', () => {
  const src = read('components/ui/AuthShell.tsx');
  assert.match(src, /export const KEYBOARD_BEHAVIOR = 'padding' as const;/);
  assert.doesNotMatch(src, /Platform\.OS === 'ios' \? 'padding'/, 'no iOS-only behavior');
  assert.equal((src.match(/behavior=\{KEYBOARD_BEHAVIOR\}/g) ?? []).length, 2, 'both KeyboardAvoidingViews use it');
});

test('bug 8 proof flow: Create account focuses every field with the keyboard up (smoke 26)', () => {
  assert.ok(existsSync(path.join(ROOT, 'e2e/smoke/26-create-account-keyboard.yaml')));
  const flow = read('e2e/smoke/26-create-account-keyboard.yaml');
  for (const id of ['register-first-name', 'register-email', 'register-passcode', 'register-player-id']) {
    assert.match(flow, new RegExp(`tapOn:\\s*\\n\\s*id: "${id}"`), `${id} is focused`);
  }
  const screen = read('app/(auth)/register.tsx');
  for (const id of ['register-first-name', 'register-last-name', 'register-email', 'register-passcode', 'register-player-id']) {
    assert.match(screen, new RegExp(`testID="${id}"`), `${id} on the screen`);
  }
});

test('CI: the small phone (Pixel 4a at 360 dp, font 1.3) runs the smoke set on every app PR and the full set nightly', () => {
  assert.equal(DEVICES.small.profile, 'pixel_4a');
  assert.equal(DEVICES.small.density, 480);
  assert.equal(DEVICES.small.font, '1.3');
  assert.match(DEVICES.tablet.label, /upright/, 'the tablet job is not landscape (rotation 1 of a landscape-natural device)');
  const pr = select({ event: 'pull_request', files: ['rummy-home3/components/ui/AuthShell.tsx'] });
  assert.ok(pr.jobs.some((j) => j.device === 'small' && j.suite === 'smoke'));
  const nightly = select({ event: 'schedule', files: [] });
  assert.ok(nightly.jobs.some((j) => j.device === 'small' && j.suite === 'smoke'));
  const suite = read('../ci/ui/run-suite.sh');
  assert.match(suite, /adb shell wm density "\$DEVICE_DENSITY"/);
  assert.match(read('../.github/workflows/ci.yml'), /DEVICE_DENSITY: \$\{\{ matrix\.density \}\}/);
  assert.match(read('../ci/ui/build-dashboard.mjs'), /pixel7pro\|tablet\|small/);
});

test('nightly reds (Nov 23): flows 07 / 20 / 21 / 51 take the small phone, font 1.3 and the upright tablet into account', () => {
  assert.match(read('e2e/smoke/07-profile.yaml'), /scrollUntilVisible:\s*\n\s*element:\s*\n\s*id: "settings-pool-late-entry-score-highest"/);
  const f20 = read('e2e/smoke/20-pool-13p-reentry.yaml');
  assert.ok(f20.indexOf('id: "score-round-3"') < f20.indexOf('id: "game-id-footer"'), 'round 3 is tapped before the footer scroll');
  assert.doesNotMatch(f20, /assertNotVisible:\s*\n\s*id: "pool-standings(-pane)?"/, 'the tablet job is upright');
  assert.match(read('e2e/smoke/21-help-frames.yaml'), /id: "login-email"\s*\n- waitForAnimationToEnd\s*\n- hideKeyboard/);
  assert.match(read('e2e/full/51-seating-20p.yaml'), /text: "Everyone numbered\.\*"/);
});

test('Q17 (default, Nov 24): Load / Clear demo data left the Profile; the generator and its service are gone', () => {
  const me = read('app/(tabs)/me.tsx');
  assert.doesNotMatch(me, /Demo data|demoSeed|runDemo|isAdminEmail/);
  for (const gone of ['services/demoSeed.ts', 'utils/demoData.ts']) assert.ok(!existsSync(path.join(ROOT, gone)), `${gone} deleted`);
  // The RPCs stay in the database until a later migration drops them (Q17's note); nothing in the app calls them.
  assert.ok(existsSync(path.join(ROOT, 'supabase/migrations/005_demo_data.sql')));
});

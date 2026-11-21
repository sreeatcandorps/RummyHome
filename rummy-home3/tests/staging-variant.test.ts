import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const appJson = require('../app.json');
const easJson = require('../eas.json');
const appConfig = require('../app.config.js');
const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

function withVariant<T>(variant: string | undefined, fn: () => T): T {
  const previous = process.env.APP_VARIANT;
  if (variant === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = variant;
  try { return fn(); } finally {
    if (previous === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = previous;
  }
}

test('Q12 staging: APP_VARIANT=staging is a second app beside the real one', () => {
  const staging = withVariant('staging', () => appConfig({ config: appJson.expo }));
  assert.equal(staging.name, 'EZ Score · Staging');
  assert.equal(staging.android.package, `${appJson.expo.android.package}.staging`);
  assert.equal(staging.ios.bundleIdentifier, `${appJson.expo.ios.bundleIdentifier}.staging`);
  assert.notEqual(staging.scheme, appJson.expo.scheme, 'its own URL scheme so links open the right app');
  assert.equal(staging.extra.variant, 'staging');
  assert.equal(staging.extra.eas.projectId, appJson.expo.extra.eas.projectId, 'same EAS project');
});

test('Q12 staging: without APP_VARIANT the config is exactly what it was', () => {
  const plain = withVariant(undefined, () => appConfig({ config: appJson.expo }));
  assert.equal(plain.name, appJson.expo.name);
  assert.equal(plain.android.package, appJson.expo.android.package);
  assert.equal(plain.scheme, appJson.expo.scheme);
  assert.equal(plain.extra.variant, undefined);
  const other = withVariant('production', () => appConfig({ config: appJson.expo }));
  assert.equal(other.android.package, appJson.expo.android.package);
});

test('Q12 staging: the eas.json profile points at ezscore-staging and holds no key', () => {
  const p = easJson.build.staging;
  assert.equal(p.extends, 'preview', 'an APK, internal distribution');
  assert.equal(p.env.APP_VARIANT, 'staging');
  assert.equal(p.env.EXPO_PUBLIC_APP_VARIANT, 'staging');
  assert.equal(p.env.EXPO_PUBLIC_STAGING_SUPABASE_URL, 'https://erurahfybkxemgtkfzkn.supabase.co');
  assert.equal(p.env.EXPO_UPDATES_ENABLED, 'false');
  assert.equal(p.env.EXPO_PUBLIC_SUPABASE_URL, undefined, 'the live names are not touched');
  const text = src('eas.json');
  assert.doesNotMatch(text, /ANON_KEY|eyJ[A-Za-z0-9_-]{20,}|sb_publishable|sb_secret/, 'the anon key is an EAS secret, never in the repo');
});

test('Q12 staging: the client reads the staging pair only on the staging variant, as literal env reads', () => {
  const s = src('services/supabase.ts');
  assert.match(s, /process\.env\.EXPO_PUBLIC_APP_VARIANT === 'staging'/);
  assert.match(s, /process\.env\.EXPO_PUBLIC_STAGING_SUPABASE_URL/);
  assert.match(s, /process\.env\.EXPO_PUBLIC_STAGING_SUPABASE_ANON_KEY/);
  assert.match(s, /process\.env\.EXPO_PUBLIC_SUPABASE_URL/);
  assert.match(s, /process\.env\.EXPO_PUBLIC_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(s, /process\.env\[/, 'Expo inlines EXPO_PUBLIC_* only as literal member reads');
  assert.match(src('utils/appVersionRuntime.ts'), /variant === 'staging' \? 'Staging'/);
  assert.match(src('app/(tabs)/me.tsx'), /appVariantLabel\(\)/, 'the Profile footer says Staging on the staging app');
});

test('Q12 staging: the population generator refuses every host but local and ezscore-staging', async () => {
  const seed = await import('../../ci/volume/seed-staging.mjs');
  assert.equal(seed.allowedTarget('postgresql://postgres:postgres@127.0.0.1:5432/ezscore_test'), true);
  assert.equal(seed.allowedTarget('postgresql://postgres.erurahfybkxemgtkfzkn:x@aws-0-ca-central-1.pooler.supabase.com:6543/postgres'), true);
  assert.equal(seed.allowedTarget('postgresql://postgres:x@db.someotherref.supabase.co:5432/postgres'), false, 'live is never a target');
  assert.equal(seed.allowedTarget('not a url'), false);
  for (const [k, v] of Object.entries(seed.SIZES)) assert.ok(Number.isInteger(v) && v > 0, `${k} is a positive count`);
  const sql = src('../ci/volume/seed-staging.sql');
  assert.match(sql, /crypt\('123456', gen_salt\('bf'\)\)/, 'seeded people can sign in');
  assert.doesNotMatch(sql + src('../ci/volume/seed-staging.mjs'), /eyJ[A-Za-z0-9_-]{20,}|sb_publishable|sb_secret/, 'no keys in the generator');
});

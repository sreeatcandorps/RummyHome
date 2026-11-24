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
  const seed = await import('../../ci/volume/seed-staging-config.mjs');
  assert.equal(seed.allowedTarget('postgresql://postgres:postgres@127.0.0.1:5432/ezscore_test'), true);
  assert.equal(seed.allowedTarget('postgresql://postgres.erurahfybkxemgtkfzkn:x@aws-0-ca-central-1.pooler.supabase.com:6543/postgres'), true);
  assert.equal(seed.allowedTarget('postgresql://postgres:x@db.someotherref.supabase.co:5432/postgres'), false, 'live is never a target');
  assert.equal(seed.allowedTarget('not a url'), false);
  for (const [k, v] of Object.entries(seed.SIZES)) assert.ok(Number.isInteger(v) && v > 0, `${k} is a positive count`);
  const sql = src('../ci/volume/seed-staging.sql');
  assert.match(sql, /crypt\('123456', gen_salt\('bf'\)\)/, 'seeded people can sign in');
  assert.doesNotMatch(sql + src('../ci/volume/seed-staging.mjs') + src('../ci/volume/seed-staging-config.mjs'), /eyJ[A-Za-z0-9_-]{20,}|sb_publishable|sb_secret/, 'no keys in the generator');
});

test('Seed staging workflow: manual, secret-driven, URL never echoed; the refuse message can be printed', () => {
  const wf = src('../.github/workflows/seed-staging.yml');
  assert.match(wf, /^on:\n\s+workflow_dispatch:/m, 'manual only');
  assert.match(wf, /DB_URL: \$\{\{ secrets\.STAGING_DB_URL \}\}/);
  assert.match(wf, /WIPE: \$\{\{ inputs\.wipe && '1' \|\| '' \}\}/);
  assert.match(wf, /run: node ci\/volume\/seed-staging\.mjs/);
  assert.match(wf, /path: ci\/out\/staging-seed\/summary\.json/);
  assert.doesNotMatch(wf, /echo[^\n]*(\$DB_URL|\$\{DB_URL|\$\{\{ secrets)/, 'the URL value is never echoed');
  assert.match(src('../ci/volume/seed-staging-config.mjs'), /export const STAGING_REF/);
  assert.match(src('../ci/volume/seed-staging.mjs'), /import \{[^}]*STAGING_REF[^}]*\} from '\.\/seed-staging-config\.mjs'/, 'the refusal line names the ref without a ReferenceError');
});

test('Seed staging generator: cannot hang silently (keepalive, client-side query timeout, chunked big inserts with progress)', () => {
  const gen = src('../ci/volume/seed-staging.mjs');
  const sql = src('../ci/volume/seed-staging.sql');
  assert.match(gen, /keepAlive:\s*true/);
  assert.match(gen, /query_timeout:\s*\d/);
  assert.match(gen, /know_each_other_from/);
  assert.match(gen, /… know each other/);
  assert.match(gen, /… games/);
  assert.match(sql, /function staging\.know_each_other_from\(p_owners uuid\[\], p_members uuid\[\]\)/);
});

test('Seed staging generator: a result never exceeds the app cap of 50 players; the job has time for the full set', () => {
  const gen = src('../ci/volume/seed-staging.mjs');
  assert.match(gen, /RESULT_PLAYER_CAP = 50/);
  assert.match(gen, /fitResultPlayers\(client, gameIds\.slice\(0, maxGames\)\)/);
  const wf = src('../.github/workflows/seed-staging.yml');
  const minutes = Number(/timeout-minutes:\s*(\d+)/.exec(wf)?.[1]);
  assert.ok(minutes >= 120, `timeout-minutes ${minutes} is too short for scale 1 (~1 h)`);
});

test('Seed staging generator: fits the plan before it starts (Free 500 MB; run 45295537304 went read-only at 14,000 games)', async () => {
  const cfg = await import('../../ci/volume/seed-staging-config.mjs');
  assert.equal(cfg.FREE_PLAN_MB, 500);
  const sizes = (scale: number) => Object.fromEntries(Object.entries(cfg.SIZES).map(([k, v]) => [k, Math.max(1, Math.round((v as number) * scale))]));
  // SIZES is read at import with SCALE=1 (no env in the test), so scaling it here is the same shape the driver sees.
  const full = cfg.sizeVerdict({ currentBytes: 40 * cfg.MB, S: cfg.SIZES, limitMb: 500 });
  assert.equal(full.fits, false, 'scale 1 is refused on Free');
  assert.ok(full.addMb >= 600 && full.addMb <= 800, `scale 1 ≈ 700 MB, got ${full.addMb} (run 3: 500 MB at ~16k of 21.5k games)`);
  const half = cfg.sizeVerdict({ currentBytes: 40 * cfg.MB, S: sizes(0.5), limitMb: 500 });
  assert.equal(half.fits, true, `scale 0.5 fits Free: ${half.message}`);
  assert.ok(half.finalMb <= 420, `scale 0.5 leaves headroom, got ${half.finalMb} MB`);
  assert.equal(cfg.sizeVerdict({ currentBytes: 480 * cfg.MB, S: sizes(0.02), limitMb: 500 }).fits, false, 'a nearly full project is refused even for a tiny seed');
  assert.equal(cfg.sizeVerdict({ currentBytes: 900 * cfg.MB, S: cfg.SIZES, limitMb: 0 }).fits, true, 'limit 0 turns the check off (Pro, local)');
  assert.equal(cfg.sizeVerdict({ currentBytes: 40 * cfg.MB, S: cfg.SIZES, limitMb: 8000 }).fits, true, 'Pro (8 GB) takes the full set');
  assert.match(half.message, /fits 500 MB/);

  const gen = src('../ci/volume/seed-staging.mjs');
  assert.match(gen, /set default_transaction_read_only = 'off'/, 'the wipe can run on a project Supabase has made read-only');
  assert.match(gen, /vacuum \(full, analyze\)/, 'the disk is given back after a wipe');
  assert.match(gen, /process\.exit\(3\)/, 'refuses before seeding when the estimate does not fit');
  assert.match(gen, /sizeGuard\(client, `\$\{ids\.length\.toLocaleString\(\)\} games`\)/, 'stops while games are written, before the limit');
  assert.match(gen, /SIZE_LIMIT_MB \* MB \* 0\.95/);
  const wf = src('../.github/workflows/seed-staging.yml');
  assert.match(wf, /SIZE_LIMIT_MB: \$\{\{ inputs\.size_limit_mb \}\}/);
  assert.match(wf, /size_limit_mb:\n[^\n]*\n[^\n]*\n\s+default: '500'/);
  assert.match(wf, /scale:\n[^\n]*\n[^\n]*\n\s+default: '0\.5'/, 'the default scale is the one that fits Free');
});

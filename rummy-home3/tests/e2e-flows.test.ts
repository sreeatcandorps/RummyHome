import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// The Maestro flows in e2e/ run on the emulator in CI, not here. These checks catch the mistakes
// that would make a flow fail for a reason that has nothing to do with the app: the wrong package
// name (the nine original flows targeted com.rummyhome.app and were never run), a flow with no
// screenshot (the gallery is the point), or an `id:` that no component carries as a testID.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(root, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const walk = (dir: string, ext: string): string[] =>
  readdirSync(join(root, dir)).flatMap((name) => {
    const rel = join(dir, name);
    if (statSync(join(root, rel)).isDirectory()) return walk(rel, ext);
    return rel.endsWith(ext) ? [rel] : [];
  });

const SETS = ['e2e/smoke', 'e2e/full', 'e2e/known-bugs'] as const;
const flows = SETS.flatMap((set) => walk(set, '.yaml'));
const libs = walk('e2e/lib', '.yaml');
const appPackage: string = JSON.parse(read('app.json')).expo.android.package;

test('e2e: there are flows in every set and the sets are what the runner expects', () => {
  // known-bugs may be empty: every flow there moves into smoke/ or full/ when its PR lands (PR 6 moved the last one).
  for (const set of SETS.filter((s) => s !== 'e2e/known-bugs')) assert.ok(flows.some((f) => f.startsWith(set)), `${set} has flows`);
  assert.ok(existsSync(join(root, 'e2e/known-bugs')), 'the known-bugs set directory stays (the runner lists it)');
  assert.ok(flows.filter((f) => f.startsWith('e2e/smoke')).length >= 9, 'smoke set has at least 9 flows');
  assert.ok(libs.includes(join('e2e/lib', 'ensure-signed-in.yaml')));
  assert.ok(libs.includes(join('e2e/lib', 'sign-in.yaml')));
});

test('e2e: every flow targets the real package and every runnable flow takes a screenshot', () => {
  for (const f of [...flows, ...libs]) {
    const text = read(f);
    assert.match(text, new RegExp(`^appId: ${appPackage.replace(/\./g, '\\.')}$`, 'm'), `${f} appId`);
    assert.doesNotMatch(text, /com\.rummyhome\.app/, `${f} still names the old package`);
  }
  for (const f of flows) {
    assert.match(read(f), /^- takeScreenshot: /m, `${f} has no screenshot`);
    assert.match(read(f), /^- runFlow: \.\.\/lib\/ensure-signed-in\.yaml$/m, `${f} does not start signed in`);
  }
});

test('e2e: every id: a flow taps or asserts exists as a testID in the app', () => {
  const sources = [...walk('app', '.tsx'), ...walk('components', '.tsx')].map((p) => read(p)).join('\n');
  const ids = new Set<string>();
  for (const f of [...flows, ...libs]) {
    for (const m of read(f).matchAll(/^\s+id: "([^"]+)"\s*$/gm)) ids.add(m[1]);
  }
  assert.ok(ids.size >= 6, `flows reference testIDs (${ids.size})`);
  for (const id of ids) {
    // Flows may name a row by its game code, a uuid, or `-.*` when the id is only known at run time.
    const prefix = id.replace(/-(GAME[A-Z0-9]+|[0-9a-f-]{36}|\.\*)$/, '-');
    const literal = sources.includes(`testID="${id}"`);
    const templated = prefix !== id && sources.includes(`testID={\`${prefix}\${`);
    assert.ok(literal || templated, `no testID for ${id} in app/ or components/`);
  }
});

test('e2e: the fixtures the flows name are seeded, and the seed is CI-only', () => {
  const seed = read('supabase/seed-e2e.sql');
  for (const code of ['GAMEE1', 'GAMEF1', 'GAMEG1', 'GAMEH1']) assert.match(seed, new RegExp(code), code);
  for (const f of flows) {
    for (const m of read(f).matchAll(/game-card-(GAME[A-Z0-9]+)/g)) {
      const code = m[1];
      assert.ok(code === 'GAMEA1' || seed.includes(code), `${f} uses ${code} but seed-e2e.sql does not seed it`);
    }
  }
  // Never part of `supabase db reset` (seed.sql is what pgTAP counts against); applied by the UI job only.
  assert.doesNotMatch(read('supabase/config.toml'), /seed-e2e/);
});

test('e2e: known-bug flows say which PR fixes them, and smoke flows are tagged smoke', () => {
  for (const f of flows.filter((p) => p.startsWith('e2e/known-bugs'))) {
    assert.match(f, /\/pr\d+-/, `${f} is named after its PR`);
    assert.match(read(f), /^tags: \[known-bug, pr\d+\]$/m, `${f} tags`);
    assert.match(read(f), /Expected (to be )?RED until PR \d+ lands/, `${f} says it is red on purpose`);
  }
  for (const f of flows.filter((p) => p.startsWith('e2e/smoke'))) {
    assert.match(read(f), /^tags: \[smoke(, landscape)?\]$/m, `${f} tags`);
    if (f.includes('landscape')) assert.match(read(f), /landscape\]$/m, `${f} is tagged landscape`);
  }
});

test('e2e: the workflow runs ui-smoke on pull requests and ui-full nightly, with the runner scripts', () => {
  const wf = readFileSync(join(repo, '.github/workflows/ci.yml'), 'utf8');
  assert.match(wf, /name: ui-\$\{\{ matrix\.suite \}\}/);
  assert.match(wf, /fromJSON\('\["full"\]'\) \|\| fromJSON\('\["smoke"\]'\)/);
  assert.match(wf, /reactivecircus\/android-emulator-runner@v2/);
  assert.match(wf, /EXPO_PUBLIC_SUPABASE_URL: http:\/\/10\.0\.2\.2:54321/, 'the APK talks to the local Supabase');
  assert.match(wf, /seed-e2e\.sql/);
  assert.match(wf, /ci\/ui\/run-suite\.sh/);
  assert.doesNotMatch(wf, /eas (build|submit)/, 'no EAS build in CI');
  for (const script of ['ci/ui/run-flows.sh', 'ci/ui/run-suite.sh', 'ci/ui/build-gallery.mjs']) {
    assert.ok(existsSync(join(repo, script)), script);
  }
  const runFlows = readFileSync(join(repo, 'ci/ui/run-flows.sh'), 'utf8');
  assert.match(runFlows, /\*landscape\*\) rotate 1/, 'landscape flows rotate the emulator');
  assert.match(runFlows, /--quarantine/, 'known-bugs never fail the job');
});

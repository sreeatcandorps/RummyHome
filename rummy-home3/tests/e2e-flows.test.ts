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
    // smoke/22 (Play listing frames) signs in as the listing account instead, and puts Sree back at the end.
    const signedIn = /^- runFlow: \.\.\/lib\/ensure-signed-in\.yaml$/m.test(read(f)) || /file: \.\.\/lib\/sign-in-as\.yaml/.test(read(f));
    assert.ok(signedIn, `${f} does not start signed in`);
  }
});

test('e2e: every id: a flow taps or asserts exists as a testID in the app', () => {
  const sources = [...walk('app', '.tsx'), ...walk('components', '.tsx')].map((p) => read(p)).join('\n');
  const ids = new Set<string>();
  for (const f of [...flows, ...libs]) {
    for (const m of read(f).matchAll(/^\s+id: "([^"]+)"\s*$/gm)) ids.add(m[1]);
  }
  assert.ok(ids.size >= 6, `flows reference testIDs (${ids.size})`);
  // PR 13: a form used on several screens builds its ids from a prefix prop (`${testIDPrefix}-limit-${limit}`);
  // such a template matches an id when the id ends with the template's literal tail (segments for the holes).
  // A segmented option carries it as `testID: \`${testIDPrefix}-way-whatsapp\`` (SignInMethodSwitch).
  const prefixed = [...sources.matchAll(/testID(?:=\{|: )`\$\{[A-Za-z]+\}-([^`]+)`/g)].map((m) => new RegExp(
    '-' + m[1].replace(/[.*+?^()|[\]\\]/g, '\\$&').replace(/\$\{[^}]+\}/g, '[^-]+') + '$',
  ));
  for (const id of ids) {
    // Flows may name a row by its game code, a uuid, a 1-based index, or `-.*` when the id is only
    // known at run time; any run of such segments at the end maps back to the template's literal prefix.
    const prefix = id.replace(/(-(GAME[A-Z0-9]+|[0-9a-f-]{36}|\.\*|\d+))+$/, '-');
    // A SegmentedButtons entry carries its id as `testID: 'x'` in the buttons array.
    const literal = sources.includes(`testID="${id}"`) || sources.includes(`testID: '${id}'`);
    // PR 24: a cell that carries its id only in one state (`reentryHere ? \`score-reentry-${index + 1}\` : undefined`).
    const conditional = prefix !== id && sources.includes(`? \`${prefix}\${`);
    // D90: an options array may build its ids too (`testID: \`columns-choice-${choice}\``).
    const templated = prefix !== id && (sources.includes(`testID={\`${prefix}\${`) || sources.includes(`testID: \`${prefix}\${`));
    // PR 13: a word segment may also be the hole (`award-preset-${p.key}` ↔ award-preset-left).
    const wordHole = [...id.matchAll(/-/g)].some((m) => sources.includes(`testID={\`${id.slice(0, m.index! + 1)}\${`) || sources.includes(`testID: \`${id.slice(0, m.index! + 1)}\${`));
    const viaPrefixProp = prefixed.some((re) => re.test(id));
    assert.ok(literal || templated || wordHole || viaPrefixProp || conditional, `no testID for ${id} in app/ or components/`);
  }
});

test('e2e: the fixtures the flows name are seeded, and the seed is CI-only', () => {
  const seed = read('supabase/seed-e2e.sql') + read('supabase/seed-listing.sql');
  for (const code of ['GAMEE1', 'GAMEF1', 'GAMEG1', 'GAMEH1', 'GAMEL1', 'GAMEM1']) assert.match(seed, new RegExp(code), code);
  for (const f of flows) {
    for (const m of read(f).matchAll(/game-card-(GAME[A-Z0-9]+)/g)) {
      const code = m[1];
      assert.ok(code === 'GAMEA1' || seed.includes(code), `${f} uses ${code} but seed-e2e.sql / seed-listing.sql does not seed it`);
    }
  }
  // Never part of `supabase db reset` (seed.sql is what pgTAP counts against); applied by the UI job only.
  assert.doesNotMatch(read('supabase/config.toml'), /seed-e2e|seed-listing/);
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

test('e2e: the workflow runs the device plan (PR 17: select → apk → ui matrix) with the runner scripts', () => {
  const wf = readFileSync(join(repo, '.github/workflows/ci.yml'), 'utf8');
  assert.match(wf, /name: ui-\$\{\{ matrix\.device \}\}-\$\{\{ matrix\.suite \}\}/);
  assert.match(wf, /matrix: \$\{\{ fromJSON\(needs\.select\.outputs\.matrix\) \}\}/);
  assert.match(wf, /seed-break\.sql/, 'the break-the-app roster is seeded for the device jobs');
  assert.match(wf, /seed-listing\.sql/, 'the Play listing fixtures are seeded for the device jobs');
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

// Small phone (360 dp, font 1.3) flakes of Nov 26: the sign-in wait, a long scroll on a slow runner, and a Home
// that comes back from a game still scrolled down. These pin the fixes so a later edit does not undo them.
test('e2e: ensure-signed-in recognises the Sign in screen with the keypad covering its button', () => {
  const lib = read('e2e/lib/ensure-signed-in.yaml');
  const wait = /text: "([^"]+)"/.exec(lib)?.[1] ?? '';
  const matches = (text: string) => new RegExp(`^(?:${wait})$`).test(text);
  assert.ok(matches('New game'), 'Home');
  assert.ok(matches('Sign in'), 'the button');
  assert.ok(matches('Sign in to keep score with your table'), 'the subtitle, which stays above the keypad');
  assert.ok(matches('Email'), "the field's own label, which is always above the keypad");
  assert.ok(!matches('Recent'), 'not a Home-only word that other screens also show');
  // The keypad opens by itself 350 ms after Sign in appears: a hideKeyboard before the email field is a Back press.
  assert.doesNotMatch(lib.split('sign-in.yaml')[0], /hideKeyboard/);
  const signIn = read('e2e/lib/sign-in.yaml');
  assert.ok(signIn.indexOf('tapOn:\n    id: "login-email"') < signIn.indexOf('hideKeyboard'), 'tap the email field before any hideKeyboard');
  for (const id of ['login-passcode', 'login-submit']) {
    assert.match(signIn, new RegExp(`scrollUntilVisible:\\n    element:\\n      id: "${id}"`), `${id} is scrolled into view before the tap`);
  }
});

test('e2e: smoke flows scroll long enough on a slow runner, and Home is scrolled back to its top after a game', () => {
  const smoke = flows.filter((f) => f.startsWith('e2e/smoke'));
  for (const f of smoke) {
    const text = read(f);
    for (const m of text.matchAll(/^- scrollUntilVisible:\n((?:[ ]+.*\n?)+)/gm)) {
      const block = m[1];
      if (/optional:|centerElement:/.test(block)) continue;
      const timeout = Number(/timeout: (\d+)/.exec(block)?.[1] ?? 0);
      assert.ok(timeout >= 30000, `${f}: a scroll with a ${timeout} ms timeout (the slowest passing scroll took 14 s on CI; 15 s lost the race on #150)`);
    }
  }
  for (const f of ['e2e/smoke/03-scorecard-landscape.yaml', 'e2e/smoke/11-scorecard-20-players-landscape.yaml']) {
    const card = /id: "game-card-GAME[A-Z0-9]+"\n    direction: DOWN\n    timeout: (\d+)/.exec(read(f));
    assert.ok(card && Number(card[1]) >= 60000, `${f}: the sideways Home list is two cards tall, give the card 60 s`);
  }
  const top = read('e2e/lib/home-top.yaml');
  assert.match(top, /element: "New game"\n    direction: UP/);
  assert.match(read('e2e/smoke/03-scorecard-landscape.yaml'), /- back\n(?:#.*\n)*- runFlow: \.\.\/lib\/home-top\.yaml/, 'flow 03 scrolls Home to the top after Back');
  assert.equal([...read('e2e/smoke/22-play-listing-frames.yaml').matchAll(/lib\/home-top\.yaml/g)].length, 2, 'flow 22 does after each Back');
});

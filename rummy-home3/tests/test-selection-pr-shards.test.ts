import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
// Nov 26 "optimize testing" (Sree: efficiency, speed, thoroughness): one smoke pass per PR split over two emulators,
// chaos / roles / two-device only when the diff is in what they test, no device run for a docs-only push.
import * as plannerModule from '../../ci/select-tests.mjs';
import * as sinceGreenModule from '../../ci/since-green.mjs';

type Job = { device: string; suite: string; shard: string; smokeFlows: string; flows: string; monkeyEvents?: number };
type Plan = { tier: string; ui: boolean; jobs: Job[]; reason: string; publish: boolean };
type Input = { event?: string; tier?: string; files?: string[]; message?: string; sinceGreenFiles?: string[] | null };
const { SMOKE_SHARDS, DEEP_AREAS, select, toMatrix, shardOfFull } = plannerModule as unknown as {
  SMOKE_SHARDS: Record<string, { smoke: string[]; full: string[] }>;
  DEEP_AREAS: { area: string; chaos?: string[] | 'all'; roles?: string[] | 'all' }[];
  select: (input: Input) => Plan;
  toMatrix: (plan: Plan) => { include: (Job & { id: string })[] };
  shardOfFull: (name: string) => string;
};
const { isGreenDeviceRun, lastGreenHead } = sinceGreenModule as unknown as {
  isGreenDeviceRun: (jobs: { name: string; conclusion: string }[]) => boolean;
  lastGreenHead: (runs: { id: number; head_sha: string }[], jobsFor: (id: number) => { name: string; conclusion: string }[], current?: number | null) => string | null;
};

const ROOT = path.join(__dirname, '..', '..');
const E2E = path.join(__dirname, '..', 'e2e');
const names = (set: string) => (existsSync(path.join(E2E, set)) ? readdirSync(path.join(E2E, set)).filter((f) => f.endsWith('.yaml')).map((f) => f.replace(/\.yaml$/, '')).sort() : []);
const read = (...p: string[]) => readFileSync(path.join(ROOT, ...p), 'utf8');
const suiteOf = (j: Job) => (j.shard ? `${j.suite}-${j.shard}` : j.suite);
// The small phone (#131) runs the same two smoke shards on every app PR; the reference phone is what these plans vary.
const ref = (jobs: Job[]) => jobs.filter((j) => j.device === 'pixel6');
const SMALL = ['small:smoke-a', 'small:smoke-b'];
const smallOf = (jobs: Job[]) => jobs.filter((j) => j.device === 'small').map((j) => `small:${suiteOf(j)}`);

const SMOKE_FLOWS = ['smoke'].flatMap(names);
const shards = Object.keys(SMOKE_SHARDS);
const where = (set: 'smoke' | 'full', flow: string) => shards.filter((id) => SMOKE_SHARDS[id][set].includes(flow));

test('shards: every smoke flow on disk is in exactly one shard, and no shard names a flow that does not exist', () => {
  assert.equal(shards.length, 2, 'two emulators');
  const smoke = names('smoke');
  assert.ok(smoke.length >= 25);
  for (const flow of smoke) assert.equal(where('smoke', flow).length, 1, `smoke/${flow} is in exactly one shard`);
  for (const id of shards) for (const flow of SMOKE_SHARDS[id].smoke) assert.ok(smoke.includes(flow), `shard ${id} names smoke/${flow}, which does not exist`);
  assert.equal(shards.flatMap((id) => SMOKE_SHARDS[id].smoke).length, smoke.length, 'no flow twice');
});

test('shards: every full flow on disk is in exactly one shard (so a selected full flow always has a home)', () => {
  const full = names('full');
  for (const flow of full) assert.equal(where('full', flow).length, 1, `full/${flow} is in exactly one shard`);
  for (const id of shards) for (const flow of SMOKE_SHARDS[id].full) assert.ok(full.includes(flow), `shard ${id} names full/${flow}, which does not exist`);
});

test('shards: each list is in file-name order, the order run-flows.sh runs them in', () => {
  for (const id of shards) {
    for (const set of ['smoke', 'full'] as const) {
      const list = SMOKE_SHARDS[id][set];
      assert.deepEqual(list, [...list].sort(), `shard ${id} ${set} list is sorted`);
    }
  }
});

test('shards: flows that build on an earlier flow stay together, and in order (the dependencies the flows document)', () => {
  // [earlier, later]: the later flow needs the state the earlier one leaves (comments in the flows, e2e/README "Fixtures and state").
  const smokeNeeds: [string, string][] = [
    ['01-home', '05-complete-game'], ['02-scorecard', '04-add-round'], ['04-add-round', '05-complete-game'], ['05-complete-game', '06-results'],
    ['05-complete-game', '12-results-zero-players'], ['12-results-zero-players', '15-delete-shared-result-confirm'],
    ['08-my-players', '09-new-game'], ['09-new-game', '16-pool-game'], ['16-pool-game', '19-seating-order'],
    ['13-undo-then-add-round', '14-rummy-positive-pot'], ['13-undo-then-add-round', '18-multiplier-change'], ['13-undo-then-add-round', '23-dealer'],
    ['14-rummy-positive-pot', '21-help-frames'], ['18-multiplier-change', '23-dealer'], ['22-play-listing-frames', '24-seating-tutorial'],
    ['10-scorecard-20-players', '11-scorecard-20-players-landscape'], ['11-scorecard-20-players-landscape', '25-scorecard-fast-fling'],
  ];
  for (const [first, second] of smokeNeeds) {
    const a = where('smoke', first)[0];
    assert.equal(a, where('smoke', second)[0], `smoke/${first} and smoke/${second} share a shard`);
    const list = SMOKE_SHARDS[a].smoke;
    assert.ok(list.indexOf(first) < list.indexOf(second), `smoke/${first} runs before smoke/${second}`);
  }
  // A full flow runs after its shard's smoke; it must sit with the smoke flows whose state it needs.
  const fullNeeds: Record<string, string[]> = {
    '40-results-save-and-past': ['05-complete-game'], '41-share-images': ['12-results-zero-players'], '42-reopen-closed-game': ['12-results-zero-players'],
    '70-game-log': ['13-undo-then-add-round'], '32-add-players-to-game': ['14-rummy-positive-pot'], '80-add-round-count-warnings': ['14-rummy-positive-pot'],
    '30-players-admins-and-settings': ['13-undo-then-add-round'], '31-edit-initials-mid-game': ['13-undo-then-add-round'], '21-scorecard-font-scale': ['13-undo-then-add-round', '10-scorecard-20-players'],
    '20-scorecard-20-players-swipe': ['10-scorecard-20-players'], '50-multiplier-20p': ['10-scorecard-20-players'], '51-seating-20p': ['10-scorecard-20-players'],
  };
  for (const [full, needs] of Object.entries(fullNeeds)) for (const smoke of needs) assert.equal(where('full', full)[0], where('smoke', smoke)[0], `full/${full} runs on the shard of smoke/${smoke}`);
});

test('shards: the two are about the same size (measured smoke seconds of run 45912691807, #156, one Pixel 6)', () => {
  const secs: Record<string, number> = {
    '01': 57, '02': 31, '03': 62, '04': 62, '05': 46, '06': 38, '07': 58, '08': 30, '09': 49, '10': 49, '11': 55, '12': 114, '13': 57, '14': 55, '15': 51,
    '16': 212, '17': 38, '18': 83, '19': 152, '20': 51, '21': 108, '22': 93, '23': 54, '24': 187, '25': 48, '26': 78, '27': 74, '28': 71, '29': 39, '30': 81,
    '31': 43,
    // 344 s on the Pixel 6 in run 46065162206, plus ~3 s a pick since for closing the keyboard and the scroll.
    '32': 380,
  };
  const total = (id: string) => SMOKE_SHARDS[id].smoke.reduce((n, f) => n + secs[f.slice(0, 2)], 0);
  const [a, b] = shards.map(total);
  assert.ok(Math.abs(a - b) / (a + b) < 0.1, `shards are within 10 % of each other (${a} s vs ${b} s)`);
  assert.ok(Math.max(a, b) < 1400, 'the longer shard is under 24 min of smoke');
});

test('PR plan (a): a docs-only PR runs no device job', () => {
  const plan = select({ event: 'pull_request', files: ['rummy-home3/docs/next-up.md', 'AGENTS.md'] });
  assert.equal(plan.ui, false);
  assert.deepEqual(plan.jobs, []);
});

test('PR plan (b): a scorecard UI PR is two smoke shards with the scorecard full flows inside them, nothing else', () => {
  const plan = select({ event: 'pull_request', files: ['rummy-home3/app/(screens)/games/[id].tsx', 'rummy-home3/components/game/ScoreTable.tsx'] });
  assert.deepEqual(ref(plan.jobs).map(suiteOf), ['smoke-a', 'smoke-b']);
  assert.deepEqual(smallOf(plan.jobs), SMALL);
  const flows = ref(plan.jobs).flatMap((j) => j.flows.split(',').filter(Boolean)).sort();
  assert.deepEqual(flows, ['20-scorecard-20-players-swipe', '21-scorecard-font-scale', '42-reopen-closed-game']);
  for (const j of plan.jobs) for (const f of j.flows.split(',').filter(Boolean)) assert.equal(shardOfFull(f), j.shard, `${f} runs in the shard that owns it`);
  assert.equal(plan.jobs.some((j) => ['full', 'chaos', 'roles', 'two-device', 'monkey'].includes(j.suite)), false, 'no separate full job; chaos / roles / two-device wait for the nightly');
  assert.match(plan.reason, /smoke on 2 emulators/);
});

test('PR plan (c): a migration PR adds roles, chaos and two-device (whole sets) to the two smoke shards', () => {
  const plan = select({ event: 'pull_request', files: ['rummy-home3/supabase/migrations/053_something.sql', 'rummy-home3/supabase/tests/053.sql'] });
  assert.deepEqual(ref(plan.jobs).map(suiteOf), ['smoke-a', 'smoke-b', 'chaos', 'roles', 'two-device']);
  assert.deepEqual(smallOf(plan.jobs), SMALL);
  for (const j of plan.jobs.filter((x) => ['chaos', 'roles', 'two-device'].includes(x.suite))) assert.equal(j.flows, '', `${j.suite} runs whole`);
});

test('deep suites: only sign-in, the database, sync and services that write bring chaos / roles / two-device to a PR', () => {
  const suites = (files: string[]) => select({ event: 'pull_request', files }).jobs.map((j) => j.suite).filter((s) => s !== 'smoke');
  assert.deepEqual(suites(['rummy-home3/app/(screens)/games/complete.tsx', 'rummy-home3/components/game/ScoreHeader.tsx', 'rummy-home3/app/(tabs)/index.tsx']), [], 'screens and components alone: nightly');
  assert.deepEqual(suites(['rummy-home3/app/(auth)/login.tsx']), ['chaos', 'roles'], 'sign-in');
  assert.deepEqual(suites(['rummy-home3/services/realtime.ts']), ['chaos', 'two-device'], 'sync / realtime');
  assert.deepEqual(suites(['rummy-home3/services/games.ts']), ['chaos', 'two-device'], 'a service that writes rounds');
  assert.deepEqual(suites(['rummy-home3/services/archive.ts']), ['roles'], 'a service that archives / deletes');
  assert.deepEqual(suites(['rummy-home3/services/players.ts']), ['chaos', 'roles'], 'a service that writes players');
  assert.deepEqual(suites(['rummy-home3/supabase/migrations/053_x.sql']), ['chaos', 'roles', 'two-device'], 'the database');
  const auth = select({ event: 'pull_request', files: ['rummy-home3/services/auth.ts'] }).jobs;
  assert.equal(auth.find((j) => j.suite === 'chaos')!.flows, 'c11-launch-offline--net-off,c12-logout-dead-session--revoke-session');
});

test('deep suites: every flow DEEP_AREAS names exists on disk', () => {
  for (const rule of DEEP_AREAS) {
    for (const set of ['chaos', 'roles'] as const) {
      const list = rule[set];
      if (list === undefined || list === 'all') continue;
      for (const flow of list) assert.ok(names(set).includes(flow), `${rule.area}: e2e/${set}/${flow}.yaml exists`);
    }
  }
});

test('nightly and pre-release are untouched: the whole smoke set on the other devices, the full set whole on the reference phone', () => {
  for (const tier of ['nightly', 'prerelease']) {
    const plan = select({ event: 'workflow_dispatch', tier });
    assert.equal(plan.jobs.some((j) => j.shard), false, `${tier} has no shards`);
    assert.ok(plan.jobs.every((j) => j.flows === '' && j.smokeFlows === ''), `${tier} runs whole sets`);
    for (const suite of ['full', 'chaos', 'roles', 'two-device', 'monkey']) assert.ok(plan.jobs.some((j) => j.device === 'pixel6' && j.suite === suite), `${tier}: pixel6 ${suite}`);
  }
  const night = select({ event: 'schedule' });
  for (const d of ['pixel4a', 'pixel7pro', 'tablet']) assert.ok(night.jobs.some((j) => j.device === d && j.suite === 'smoke'), `${d} smoke`);
});

test('the matrix gives each job its own id and carries the shard lists the runner reads', () => {
  const rows = toMatrix(select({ event: 'pull_request', files: ['rummy-home3/app.json'] })).include;
  assert.deepEqual(rows.map((r) => `${r.device}:${r.id}`), ['pixel6:smoke-a', 'pixel6:smoke-b', ...SMALL]);
  assert.equal(new Set(rows.map((r) => `${r.device}-${r.id}`)).size, rows.length, 'job and artifact names are unique');
  for (const r of rows) assert.deepEqual(r.smokeFlows.split(','), SMOKE_SHARDS[r.shard].smoke);
  const night = toMatrix(select({ event: 'schedule' })).include;
  assert.equal(new Set(night.map((r) => `${r.device}-${r.id}`)).size, night.length);
});

test('docs since the last green device run: a push that only adds docs runs nothing; anything else runs the plan', () => {
  const base = { event: 'pull_request', files: ['rummy-home3/app/(screens)/games/[id].tsx', 'rummy-home3/docs/x.md'] };
  const skipped = select({ ...base, sinceGreenFiles: ['rummy-home3/docs/next-up.md', 'README.md'] });
  assert.equal(skipped.ui, false);
  assert.equal(skipped.publish, false);
  assert.match(skipped.reason, /last green device run/);
  assert.equal(select({ ...base, sinceGreenFiles: [] }).ui, false, 'the same tree again (a re-run, an empty push)');
  assert.equal(select({ ...base, sinceGreenFiles: ['rummy-home3/docs/next-up.md', 'rummy-home3/app/(tabs)/me.tsx'] }).ui, true, 'one app file brings the devices back');
  assert.equal(select({ ...base, sinceGreenFiles: ['rummy-home3/assets/icon.png'] }).ui, true, 'an image under assets/ is not docs here');
  assert.equal(select({ ...base, sinceGreenFiles: ['ci/ui/run-suite.sh'] }).ui, true);
  assert.equal(select({ ...base, sinceGreenFiles: null }).ui, true, 'no earlier green run, or it could not be compared: run as usual');
  assert.equal(select({ ...base, sinceGreenFiles: ['rummy-home3/docs/a.md'], message: 'x [ui-all]' }).ui, true, '[ui-all] always runs');
  assert.equal(select({ event: 'schedule', sinceGreenFiles: ['x.md'] }).ui, true, 'the nightly never skips');
});

test('since-green: the last green device run is the newest earlier run whose smoke and every other ui job passed', () => {
  const ok = [{ name: 'ui-pixel6-smoke-a', conclusion: 'success' }, { name: 'ui-pixel6-smoke-b', conclusion: 'success' }, { name: 'Pick the device plan', conclusion: 'success' }];
  const red = [{ name: 'ui-pixel6-smoke-a', conclusion: 'success' }, { name: 'ui-pixel6-smoke-b', conclusion: 'failure' }];
  const docsOnly = [{ name: 'Pick the device plan', conclusion: 'success' }, { name: 'ui-pixel6-smoke-a', conclusion: 'skipped' }];
  assert.equal(isGreenDeviceRun(ok), true);
  assert.equal(isGreenDeviceRun(red), false);
  assert.equal(isGreenDeviceRun(docsOnly), false, 'a run that skipped its device jobs proves nothing');
  assert.equal(isGreenDeviceRun([]), false);
  const jobs: Record<number, typeof ok> = { 5: docsOnly, 4: red, 3: ok, 2: ok };
  const runs = [5, 4, 3, 2].map((id) => ({ id, head_sha: `sha${id}` }));
  assert.equal(lastGreenHead(runs, (id) => jobs[id]), 'sha3', 'skips the docs-only run and the red one');
  assert.equal(lastGreenHead(runs, (id) => jobs[id], 3), 'sha2', 'never the run being planned');
  assert.equal(lastGreenHead(runs.slice(0, 2), (id) => jobs[id]), null);
});

test('the workflow wires it all: since-green, shard env, job names, permissions', () => {
  const ci = read('.github', 'workflows', 'ci.yml');
  assert.match(ci, /node ci\/since-green\.mjs/);
  assert.match(ci, /SELECT_SINCE_FILES="\$\(cat ci\/out\/since-files\.txt\)"/);
  assert.match(ci, /actions: read/);
  assert.match(ci, /SMOKE_FLOWS: \$\{\{ matrix\.smokeFlows \}\}/);
  assert.match(ci, /SHARD: \$\{\{ matrix\.shard \}\}/);
  assert.match(ci, /name: ui-\$\{\{ matrix\.device \}\}-\$\{\{ matrix\.id \}\}/);
  assert.match(ci, /ui-\$\{\{ needs\.select\.outputs\.slug \}\}-\$\{\{ matrix\.device \}\}-\$\{\{ matrix\.id \}\}/);
});

test('run-suite.sh: smoke runs the shard, then the selected full flows on the same emulator; known-bugs once', () => {
  const sh = read('ci', 'ui', 'run-suite.sh');
  assert.match(sh, /VIDEO_FLOWS= FLOW_FILTER="\$\{SMOKE_FLOWS:-\}" run_set smoke/);
  assert.match(sh, /if \[ -n "\$\{FLOW_FILTER:-\}" \]; then run_set full; fi/);
  assert.match(sh, /\[ "\$\{SHARD:-a\}" = a \]; then run_set known-bugs/);
  assert.match(sh, /full\)\s+FLOW_FILTER= run_set smoke; run_set full;/, 'the nightly / pre-release full job is unchanged');
  assert.match(read('ci', 'ui', 'run-flows.sh'), /VIDEO_FLOWS-\$\{FLOW_FILTER:-\}/);
});

test('ensure-signed-in: makes sure Sree is signed in, signing another account out; the fast path is one check', () => {
  const lib = read('rummy-home3', 'e2e', 'lib', 'ensure-signed-in.yaml');
  const fix = read('rummy-home3', 'e2e', 'lib', 'fix-account.yaml');
  assert.match(lib, /Hi \(\?!Sree\$\)\.\+/, 'any other greeting on Home triggers the fix');
  assert.match(lib, /Sign in\.\*\|Hi/, 'the login screen triggers it too, in the same single check, by its subtitle when the keypad hides the button');
  assert.equal((lib.match(/^\s+when:/gm) ?? []).length, 1, 'one `when` on the fast path (they cost a wait when the element is absent)');
  assert.match(lib, /file: fix-account\.yaml/);
  assert.match(fix, /tapOn: "Log out"/);
  assert.match(fix, /runFlow: sign-in\.yaml/);
  assert.doesNotMatch(lib + fix, /^env:/m, 'a sub-flow env block beats the caller (e2e README)');
  assert.ok(SMOKE_FLOWS.length > 0);
});

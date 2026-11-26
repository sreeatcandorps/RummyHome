import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
// The planner lives with the CI tooling (ci/select-tests.mjs); this test keeps its map honest (T16-8).
import * as plannerModule from '../../ci/select-tests.mjs';

type Job = { device: string; suite: string; shard?: string; smokeFlows?: string; id?: string; flows: string; monkeyEvents?: number; api?: number; arch?: string; target?: string; profile?: string };
type Plan = { tier: string; ui: boolean; jobs: Job[]; volume: boolean; fileBugs: boolean; publish: boolean; reason: string };
const { AREA_FLOWS, DEVICES, select, toMatrix } = plannerModule as unknown as {
  AREA_FLOWS: { area: string; flows: Record<string, string[]> }[];
  DEVICES: Record<string, unknown>;
  select: (input: { event?: string; tier?: string; files?: string[]; message?: string }) => Plan;
  toMatrix: (plan: Plan) => { include: (Job & { monkeyEvents: number })[] };
};

const E2E = path.join(__dirname, '..', 'e2e');
const flowsIn = (set: string) => (existsSync(path.join(E2E, set)) ? readdirSync(path.join(E2E, set)).filter((f) => f.endsWith('.yaml')).map((f) => f.replace(/\.yaml$/, '')) : []);

test('PR 17 T16-8: a docs-only change runs nothing on a device', () => {
  const plan = select({ event: 'pull_request', files: ['rummy-home3/docs/test-plan/README.md', 'README.md'] });
  assert.equal(plan.ui, false);
  assert.equal(plan.jobs.length, 0);
});

test('PR 17 T16-8: a plain push runs no device job (the PR run counts)', () => {
  const plan = select({ event: 'push', files: ['rummy-home3/app/index.tsx'] });
  assert.equal(plan.ui, false);
  assert.equal(plan.publish, false);
});

test('PR 17 T16-8: an app change runs the smoke gate (two shards) plus the full flows for its area, by name', () => {
  const plan = select({ event: 'pull_request', files: ['rummy-home3/app/(screens)/score-entry.tsx'] });
  assert.equal(plan.ui, true);
  const suites = plan.jobs.map((j) => `${j.device}:${j.suite}${j.shard ? `-${j.shard}` : ''}`);
  // Nov 26: the full flows ride in the smoke job that owns their prerequisites; UI-only changes add no chaos job (nightly).
  assert.deepEqual(suites, ['pixel6:smoke-a', 'pixel6:smoke-b']);
  assert.equal(plan.jobs[0].flows, '');
  assert.equal(plan.jobs[1].flows, '80-add-round-count-warnings');
  assert.equal(plan.fileBugs, false, 'a PR run files no issues unless asked');
});

test('PR 17 T16-8: a save-round change adds the offline / kill / two-device checks', () => {
  const plan = select({ event: 'pull_request', files: ['rummy-home3/services/games.ts'] });
  const suites = plan.jobs.map((j) => j.suite);
  assert.ok(suites.includes('chaos'));
  assert.ok(suites.includes('two-device'));
  assert.ok(plan.jobs.find((j) => j.suite === 'chaos')!.flows.includes('c05-offline-save--net-off'));
});

test('PR 17 T16-8: an unmapped app change runs smoke only', () => {
  const plan = select({ event: 'pull_request', files: ['rummy-home3/app.json'] });
  assert.deepEqual(plan.jobs.map((j) => j.suite), ['smoke', 'smoke'], 'the two smoke shards');
});

test('PR 17 T16-8: a test-infrastructure change runs every suite once on the reference phone', () => {
  const plan = select({ event: 'pull_request', files: ['ci/ui/run-flows.sh', 'rummy-home3/docs/x.md'] });
  assert.deepEqual(plan.jobs.map((j) => j.suite), ['smoke', 'smoke', 'chaos', 'roles', 'two-device', 'monkey']);
  assert.ok(plan.jobs.every((j) => j.device === 'pixel6'));
  assert.equal(plan.jobs.find((j) => j.suite === 'monkey')!.monkeyEvents, 1500);
});

test('Nov 19: an infra change that edits full flows also runs those flows by name (the full set stays nightly)', () => {
  const plan = select({ event: 'pull_request', files: ['rummy-home3/e2e/lib/sign-in.yaml', 'rummy-home3/e2e/full/51-seating-20p.yaml', 'rummy-home3/e2e/full/70-game-log.yaml', 'rummy-home3/e2e/smoke/12-results-zero-players.yaml'] });
  assert.deepEqual(plan.jobs.map((j) => j.suite), ['smoke', 'smoke', 'chaos', 'roles', 'two-device', 'monkey'], 'no separate full job: the edited flows ride in the smoke shard that owns them');
  assert.equal(plan.jobs.find((j) => j.suite === 'smoke' && j.shard === 'b')!.flows, '51-seating-20p,70-game-log');
  assert.equal(plan.jobs.find((j) => j.suite === 'smoke' && j.shard === 'a')!.flows, '');
  assert.match(plan.reason, /2 edited full flow/);
});

test('PR 17 T16-8: commit-message tags — [ui-all] widens a PR, [file-bugs] lets it open issues', () => {
  const plan = select({ event: 'pull_request', files: ['rummy-home3/app.json'], message: 'fix thing [ui-all] [file-bugs]' });
  assert.equal(plan.jobs.length, 6, 'two smoke shards + chaos + roles + two-device + monkey');
  assert.equal(plan.fileBugs, true);
});

test('PR 17 T16-8: nightly = every suite on the reference phone, smoke on the other devices, 5k monkey; issues filed', () => {
  const plan = select({ event: 'schedule' });
  assert.equal(plan.tier, 'nightly');
  const byDevice = new Map<string, string[]>();
  for (const j of plan.jobs) byDevice.set(j.device, [...(byDevice.get(j.device) ?? []), j.suite]);
  assert.deepEqual(byDevice.get('pixel6'), ['full', 'chaos', 'roles', 'two-device', 'monkey']);
  assert.deepEqual(byDevice.get('pixel4a'), ['smoke']);
  assert.deepEqual(byDevice.get('pixel7pro'), ['smoke']);
  assert.deepEqual(byDevice.get('tablet'), ['smoke']);
  assert.equal(plan.jobs.find((j) => j.suite === 'monkey')!.monkeyEvents, 5000);
  assert.equal(plan.volume, true, 'the volume job is nightly since Nov 21 (test-environment-plan V1)');
  assert.equal(plan.fileBugs, true);
});

test('PR 17 T16-8: pre-release = full everywhere, 20k monkey, volume', () => {
  const plan = select({ event: 'workflow_dispatch', tier: 'prerelease' });
  assert.equal(plan.tier, 'prerelease');
  for (const d of ['pixel4a', 'pixel7pro', 'tablet']) assert.ok(plan.jobs.some((j) => j.device === d && j.suite === 'full'), `${d} runs full`);
  assert.equal(plan.jobs.find((j) => j.suite === 'monkey')!.monkeyEvents, 20000);
  assert.equal(plan.volume, true);
});

test('PR 17 T16-8: every flow the map names exists on disk, and the matrix carries the emulator fields', () => {
  for (const rule of AREA_FLOWS) {
    for (const [set, flows] of Object.entries(rule.flows)) {
      for (const flow of flows as string[]) assert.ok(flowsIn(set).includes(flow), `${rule.area}: e2e/${set}/${flow}.yaml exists`);
    }
  }
  const matrix = toMatrix(select({ event: 'schedule' }));
  for (const row of matrix.include) {
    assert.ok(row.api && row.arch && row.target && row.profile, `${row.device} has emulator fields`);
    assert.ok(Object.keys(DEVICES).includes(row.device));
    assert.equal(typeof row.flows, 'string');
    assert.equal(typeof row.monkeyEvents, 'number');
    assert.equal(typeof row.id, 'string');
  }
});

test('PR 17: the device matrix in the workflow comes from the planner, and the runner knows every suite', () => {
  const ci = readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'ci.yml'), 'utf8');
  assert.ok(ci.includes('node ci/select-tests.mjs'));
  assert.ok(ci.includes('matrix: ${{ fromJSON(needs.select.outputs.matrix) }}'));
  const suite = readFileSync(path.join(__dirname, '..', '..', 'ci', 'ui', 'run-suite.sh'), 'utf8');
  for (const s of ['smoke', 'full', 'chaos', 'roles', 'two-device', 'monkey']) assert.ok(new RegExp(`\\b${s}\\)`).test(suite), `run-suite.sh handles ${s}`);
  const flows = readFileSync(path.join(__dirname, '..', '..', 'ci', 'ui', 'run-flows.sh'), 'utf8');
  assert.ok(ci.includes('${{ matrix.id }}'), 'two shards of one device get their own job and artifact names');
  for (const hook of ['--net-off', '--kill-after', 'FLOW_FILTER', 'crashes.csv', 'screenrecord']) assert.ok(flows.includes(hook), `run-flows.sh has ${hook}`);
});

test('PR 17: the break-the-app seed has the roster and every game the chaos / roles flows open', () => {
  const seed = readFileSync(path.join(__dirname, '..', 'supabase', 'seed-break.sql'), 'utf8');
  for (const code of ['BREAKP1', 'BREAKP2', 'BREAKP4', 'BREAKP5', 'BREAKP6', 'BREAKP7', 'BREAKQ1', 'BREAKQ2', 'BREAKQ3']) assert.ok(seed.includes(`'${code}'`) || seed.includes(`${code}'`), `${code} seeded`);
  for (const email of ['c1@test.local', 'a1@test.local', 'a2@test.local', 'p01@test.local', 's1@test.local', 'o1@test.local']) {
    assert.ok(seed.includes(email) || /lpad|format\(/.test(seed), `${email} (or a generator for it) in the seed`);
  }
  // Every game a flow opens is in the seed.
  const opened = new Set<string>();
  for (const set of ['chaos', 'roles', 'two-device']) {
    for (const flow of flowsIn(set)) {
      const text = readFileSync(path.join(E2E, set, `${flow}.yaml`), 'utf8');
      for (const m of text.matchAll(/CODE: (BREAK[A-Z0-9]+)|game-card-(BREAK[A-Z0-9]+)/g)) opened.add(m[1] ?? m[2]);
    }
  }
  assert.ok(opened.size >= 5);
  for (const code of opened) assert.ok(seed.includes(code), `flow opens ${code}, which the seed creates`);
});

test('Nov 18 two-device: the T2 flow accepts the "Scorecard · S1" title and the Close button; the probe mirrors the scorecard channel; the filer heals green flows', () => {
  const save = readFileSync(path.join(E2E, 'two-device', 'b-save-now.yaml'), 'utf8');
  assert.match(save, /Scorecard\( · \.\*\)\?\|Round saved\|Round already saved/, 'the scorecard title carries the game number since PR 24');
  assert.match(save, /visible: "Close"/, 'the Round saved sheet closes with Close (D34)');
  const probe = readFileSync(path.join(__dirname, '..', 'scripts', 'realtime-probe.mjs'), 'utf8');
  for (const table of ['games', 'game_players', 'rounds']) assert.match(probe, new RegExp(`table: '${table}'`), `probe subscribes to ${table} like services/realtime.ts`);
  assert.match(probe, /rpc\('save_round'/, 'stage 2 saves a round the way device B does');
  const realtime = readFileSync(path.join(__dirname, '..', 'services', 'realtime.ts'), 'utf8');
  assert.match(realtime, /console\.log\(`\[realtime\] game \$\{gameId\}: \$\{status\}/, 'the channel status reaches logcat');
  const runner = readFileSync(path.join(__dirname, '..', '..', 'ci', 'ui', 'run-two-device.sh'), 'utf8');
  assert.match(runner, /debug\/t1-a-open\/\*\/\*\/logs\/device-logcat\.txt[\s\S]*grep -F '\[realtime\]' > "\$ABS_OUT\/realtime-device-a\.txt"/, 'the runner keeps device A\'s channel lines from the per-flow logcat Maestro saved');
  const scorecard = readFileSync(path.join(__dirname, '..', 'app', '(screens)', 'games', '[id].tsx'), 'utf8');
  assert.match(scorecard, /AppState\.addEventListener\('change', \(state\) => \{ if \(state === 'active'\) loadGameData\(\); \}\)/, 'reload when the app comes back to the front');
  assert.match(scorecard, /setInterval\(\(\) => \{ if \(AppState\.currentState === 'active'\) loadGameData\(\); \}, LIVE_POLL_MS\)/, 'poll an active game while it is on screen');
  // A reload behind an open dialog must not wipe what is being typed (smoke 18 caught the poll doing exactly that).
  const settings = readFileSync(path.join(__dirname, '..', 'components', 'game', 'GameSettingsDialog.tsx'), 'utf8');
  assert.match(settings, /\}, \[visible, rulesKey\]\);/, 'Game settings resets its draft on open or when the stored rules change, not on every render');
  const seating = readFileSync(path.join(__dirname, '..', 'components', 'game', 'SeatingSheet.tsx'), 'utf8');
  assert.match(seating, /\}, \[visible, baseKey\]\);/, 'Order of players keeps its taps across a reload');
  const filer = readFileSync(path.join(__dirname, '..', '..', 'ci', 'report', 'file-bugs.mjs'), 'utf8');
  assert.match(filer, /state: 'closed', state_reason: 'completed'/, 'a green flow closes its open issue');
  assert.match(filer, /if \(!ACT\) \{ console\.log\(`would close/, 'never on a dry run');
});

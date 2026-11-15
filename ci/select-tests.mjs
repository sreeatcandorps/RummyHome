/**
 * Change-based test selection (PR 17, T16-8): which device suites run, on which emulators, for this event.
 *
 *   node ci/select-tests.mjs            reads the environment below, prints the plan, writes $GITHUB_OUTPUT
 *
 * Environment (all optional; the CLI falls back to a pull-request plan with no file list):
 *   SELECT_EVENT     pull_request | push | schedule | workflow_dispatch
 *   SELECT_TIER      pr | nightly | prerelease   (workflow_dispatch input; schedule = nightly)
 *   SELECT_FILES     newline-separated changed paths (PR: base...head)
 *   SELECT_MESSAGE   head commit message ("[file-bugs]" opts a PR run into issue filing; "[ui-all]" runs everything)
 *
 * Outputs (GITHUB_OUTPUT): tier, ui (true|false), matrix (JSON {include:[{device,suite,flows,...}]}),
 * file_bugs (true|false), publish (true|false), reason (one line for the log).
 *
 * The tiers (docs/test-plan/automation.md):
 *   pr          unit + db always; smoke on the reference phone when app code changed; the full / chaos
 *               flows that cover the touched area are added by name (FLOW_FILTER); infra changes
 *               (ci/, e2e/, seeds, workflow) run every suite on the reference phone.
 *   nightly     full + chaos + roles + two-device + monkey(5k) on the reference phone, smoke on the
 *               small / large-font / tablet devices.
 *   prerelease  nightly + full on every device + monkey(20k) + volume.
 * Docs-only changes run nothing on a device.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const DEVICES = {
  pixel6: { api: 34, arch: 'x86_64', target: 'default', profile: 'pixel_6', rotation: 0, font: '1.0', label: 'Pixel 6 · API 34 (reference)' },
  pixel4a: { api: 30, arch: 'x86_64', target: 'default', profile: 'pixel_4a', rotation: 0, font: '1.0', label: 'Pixel 4a · API 30 (small, old)' },
  pixel7pro: { api: 34, arch: 'x86_64', target: 'default', profile: 'pixel_7_pro', rotation: 0, font: '1.3', label: 'Pixel 7 Pro · API 34 · font 1.3' },
  tablet: { api: 34, arch: 'x86_64', target: 'default', profile: 'pixel_tablet', rotation: 1, font: '1.0', label: 'Pixel Tablet · API 34 · landscape' },
};

/** Paths that never need a device. */
const DOCS_ONLY = [/\.md$/i, /^rummy-home3\/docs\//, /^docs\//, /\.png$/i, /\.svg$/i, /^LICENSE/];

/** Paths that are the test infrastructure itself: a change here runs every suite once (PR 17 proves itself). */
const INFRA = [/^ci\//, /^\.github\//, /^rummy-home3\/e2e\//, /^rummy-home3\/supabase\/seed/, /^rummy-home3\/supabase\/config\.toml$/];

/**
 * App area → extra flows (set/flow) beyond the smoke gate. The smoke set always runs whole on a PR
 * (it is the gate); these add the deeper flows for the touched area without paying for the full set.
 */
export const AREA_FLOWS = [
  { area: 'add-round', match: [/score-entry\.tsx$/, /ScoreKeypad/, /ScoreCell/, /roundEntry/, /rummyDistribution/, /roundConfirms/, /scoreAfter/],
    flows: { full: ['80-add-round-count-warnings'], chaos: ['c01-rapid-save-taps', 'c04-huge-numbers'] } },
  { area: 'scorecard', match: [/games\/\[id\]\.tsx$/, /components\/game\/Score(Header|Table|Grid|Column|card)/, /scorecardLayout/, /components\/game\/(Pool)?Standings/],
    flows: { full: ['20-scorecard-20-players-swipe', '21-scorecard-font-scale'], chaos: ['c09-big-scorecard-20x60'], roles: ['r01-player-view-only', 'r04-nonplaying-admin'] } },
  { area: 'save-round', match: [/services\/games\.ts$/, /migrations\/.*save_round/, /migrations\/.*undo/, /utils\/saveRound/],
    flows: { chaos: ['c01-rapid-save-taps', 'c05-offline-save--net-off', 'c06-reconnect-retry', 'c07-kill-mid-save--kill-after', 'c08-after-kill-consistent'] }, twoDevice: true },
  { area: 'players', match: [/\(screens\)\/players\//, /components\/players\//, /utils\/(addPlayers|initials|myPlayers)/, /services\/players/],
    flows: { full: ['30-players-admins-and-settings', '31-edit-initials-mid-game', '32-add-players-to-game'], chaos: ['c03-bad-input'] } },
  { area: 'results', match: [/\(screens\)\/results/, /components\/results\//, /utils\/results/, /services\/results/],
    flows: { full: ['40-results-save-and-past', '41-share-images'] } },
  { area: 'complete-awards', match: [/games\/complete\.tsx$/, /games\/award\.tsx$/, /utils\/pool/, /PoolAwards/],
    flows: { chaos: ['c02-double-complete', 'c10-pool-everyone-out'] } },
  { area: 'help', match: [/\(screens\)\/help/, /utils\/help/, /components\/help\//],
    flows: { full: ['50-help-notes'] } },
  { area: 'theme', match: [/theme\//, /utils\/theme/, /app\/_layout\.tsx$/],
    flows: { full: ['60-dark-mode', '61-first-launch-light-night-phone', '21-scorecard-font-scale'] } },
  { area: 'log', match: [/eventLog/, /games\/log\.tsx$/, /migrations\/.*event_log/],
    flows: { full: ['70-game-log'] } },
  { area: 'auth', match: [/\(auth\)\//, /services\/auth/, /utils\/authErrors/, /login/i, /\(tabs\)\/(index|me)\.tsx$/, /utils\/supabaseErrors/],
    flows: { full: ['10-sign-out-bad-passcode'], chaos: ['c11-launch-offline--net-off', 'c12-logout-dead-session--revoke-session'] }, roles: true },
  { area: 'new-game', match: [/games\/new\.tsx$/, /components\/game\/(GameTypeStep|RulesForm)/, /utils\/rulesDraft/, /utils\/gameSettings/],
    flows: { chaos: ['c03-bad-input'] } },
  { area: 'seating', match: [/utils\/seating/, /components\/game\/SeatingSheet/, /migrations\/.*seating/, /utils\/dealerRotation/],
    flows: { full: ['51-seating-20p', '70-game-log'], roles: ['r01-player-view-only', 'r04-nonplaying-admin'] } },
  { area: 'deleted-games', match: [/utils\/deletedGames/, /components\/home\/DeletedGames/, /components\/game\/DeletedGameBanner/, /hidden-deleted\.tsx$/, /utils\/archive/, /services\/archive/, /migrations\/.*going_rogue/, /migrations\/.*no_permanent_delete/, /tests\/no-permanent-delete/],
    flows: { roles: ['r05-deleted-game-ask-restore'], full: ['70-game-log'] } },
  { area: 'rls', match: [/migrations\/.*(policy|rls|grant)/i],
    flows: {}, roles: true },
];

const isDocsOnly = (f) => DOCS_ONLY.some((re) => re.test(f));
const isInfra = (f) => INFRA.some((re) => re.test(f));
const isApp = (f) => /^rummy-home3\//.test(f) && !isDocsOnly(f) && !/^rummy-home3\/e2e\//.test(f);

function uniq(list) {
  return [...new Set(list)];
}

/**
 * Pure planner. `files` is the changed path list (PR); `tier` overrides the event's default.
 * Returns { tier, ui, jobs: [{device, suite, flows, monkeyEvents?}], volume, fileBugs, publish, reason }.
 */
export function select({ event = 'pull_request', tier, files = [], message = '' } = {}) {
  const msg = message || '';
  const forceAll = /\[ui-all\]/i.test(msg);
  const fileBugsTag = /\[file-bugs\]/i.test(msg);
  const effectiveTier = tier || (event === 'schedule' ? 'nightly' : event === 'workflow_dispatch' ? 'nightly' : 'pr');

  const job = (device, suite, flows = [], extra = {}) => ({ device, suite, flows: flows.join(','), ...DEVICES[device], ...extra });
  const plan = { tier: effectiveTier, ui: true, jobs: [], volume: false, fileBugs: false, publish: true, reason: '' };

  if (event === 'push') {
    // Every branch here has a pull request; the PR run is the one that counts (no double emulator minutes).
    return { ...plan, ui: false, publish: false, reason: 'push: unit + db only; the pull_request run drives the devices' };
  }

  if (effectiveTier === 'nightly' || effectiveTier === 'prerelease') {
    const pre = effectiveTier === 'prerelease';
    plan.jobs.push(
      job('pixel6', 'full'),
      job('pixel6', 'chaos'),
      job('pixel6', 'roles'),
      job('pixel6', 'two-device'),
      job('pixel6', 'monkey', [], { monkeyEvents: pre ? 20000 : 5000 }),
      job('pixel4a', pre ? 'full' : 'smoke'),
      job('pixel7pro', pre ? 'full' : 'smoke'),
      job('tablet', pre ? 'full' : 'smoke'),
    );
    if (pre) plan.jobs.push(job('pixel4a', 'chaos'), job('tablet', 'chaos'));
    plan.volume = pre;
    plan.fileBugs = true;
    plan.reason = `${effectiveTier}: every suite on the reference phone, ${pre ? 'full' : 'smoke'} on the other devices${pre ? ', monkey 20k, volume' : ', monkey 5k'}`;
    return plan;
  }

  // ---- pull request -------------------------------------------------------------------------
  const changed = files.filter(Boolean);
  const appChanged = changed.some(isApp);
  const infraChanged = changed.some(isInfra);
  plan.fileBugs = fileBugsTag;

  if (changed.length > 0 && !appChanged && !infraChanged && !forceAll) {
    return { ...plan, ui: false, publish: false, reason: 'docs-only change: no device run' };
  }

  if (infraChanged || forceAll || changed.length === 0) {
    plan.jobs.push(
      job('pixel6', 'smoke'),
      job('pixel6', 'chaos'),
      job('pixel6', 'roles'),
      job('pixel6', 'two-device'),
      job('pixel6', 'monkey', [], { monkeyEvents: 1500 }),
    );
    plan.reason = forceAll ? '[ui-all] in the commit message: every suite on the reference phone'
      : changed.length === 0 ? 'no file list: every suite on the reference phone'
      : 'test infrastructure changed: every suite on the reference phone';
    return plan;
  }

  const extra = { full: [], chaos: [], roles: [] };
  let twoDevice = false;
  const areas = [];
  for (const rule of AREA_FLOWS) {
    if (!changed.some((f) => rule.match.some((re) => re.test(f)))) continue;
    areas.push(rule.area);
    for (const [set, flows] of Object.entries(rule.flows)) extra[set].push(...flows);
    if (rule.twoDevice) twoDevice = true;
    if (rule.roles) extra.roles.push('r01-player-view-only', 'r02-spectator-pool', 'r03-outsider-no-break-games', 'r04-nonplaying-admin');
  }
  plan.jobs.push(job('pixel6', 'smoke'));
  // The full/chaos/roles flows for the touched areas ride in ONE extra job per set (FLOW_FILTER).
  if (extra.full.length) plan.jobs.push(job('pixel6', 'full', uniq(extra.full)));
  if (extra.chaos.length) plan.jobs.push(job('pixel6', 'chaos', uniq(extra.chaos)));
  if (extra.roles.length) plan.jobs.push(job('pixel6', 'roles', uniq(extra.roles)));
  if (twoDevice) plan.jobs.push(job('pixel6', 'two-device'));
  plan.reason = areas.length
    ? `app change in: ${areas.join(', ')} → smoke + ${plan.jobs.length - 1} targeted job(s)`
    : 'app change outside the mapped areas → smoke only';
  return plan;
}

/** The job matrix GitHub expects. "full" with a FLOW_FILTER still runs the smoke set whole (it is the gate). */
export function toMatrix(plan) {
  return { include: plan.jobs.map((j) => ({ ...j, monkeyEvents: j.monkeyEvents ?? 0 })) };
}

function main() {
  const files = (process.env.SELECT_FILES ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  const plan = select({
    event: process.env.SELECT_EVENT || 'pull_request',
    tier: process.env.SELECT_TIER || undefined,
    files,
    message: process.env.SELECT_MESSAGE || '',
  });
  const matrix = toMatrix(plan);
  console.log(`tier=${plan.tier}  ui=${plan.ui}  ${plan.reason}`);
  for (const j of plan.jobs) console.log(`  ${j.device.padEnd(9)} ${j.suite.padEnd(10)} ${j.flows || '(whole set)'}${j.monkeyEvents ? ` ${j.monkeyEvents} events` : ''}`);
  if (plan.volume) console.log('  volume      (local Supabase load run)');
  const out = [
    `tier=${plan.tier}`,
    `ui=${plan.ui && plan.jobs.length > 0}`,
    `matrix=${JSON.stringify(matrix)}`,
    `volume=${plan.volume}`,
    `file_bugs=${plan.fileBugs}`,
    `publish=${plan.publish}`,
    `reason=${plan.reason}`,
  ];
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, out.join('\n') + '\n');
  else console.log(out.join('\n'));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main();

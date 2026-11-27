/**
 * Change-based test selection (PR 17, T16-8): which device suites run, on which emulators, for this event.
 *
 *   node ci/select-tests.mjs            reads the environment below, prints the plan, writes $GITHUB_OUTPUT
 *
 * Environment (all optional; the CLI falls back to a pull-request plan with no file list):
 *   SELECT_EVENT     pull_request | push | schedule | workflow_dispatch
 *   SELECT_TIER      pr | nightly | prerelease   (workflow_dispatch input; schedule = nightly)
 *   SELECT_FILES     newline-separated changed paths (PR: base...head)
 *   SELECT_MESSAGE   head commit message ("[file-bugs]" opts a PR run into issue filing; "[ui-all]" runs everything;
 *                    "[ui-devices]" adds the smoke shards on the Pixel 4a (API 30) and the Pixel Tablet and the volume job,
 *                    the rows only the nightly has)
 *   SELECT_SINCE_FILES  newline-separated paths changed between this PR's last green device run and now
 *                       (unset = there is no such run or it could not be compared: never skips)
 *
 * Outputs (GITHUB_OUTPUT): tier, ui (true|false), matrix (JSON {include:[{device,suite,shard,id,flows,smokeFlows,...}]}),
 * file_bugs (true|false), publish (true|false), reason (one line for the log).
 *
 * The tiers (docs/test-plan/automation.md):
 *   pr          unit + db always. App code changed: the smoke gate on the reference phone, split over TWO
 *               emulators (SMOKE_SHARDS; flows that build on each other share a shard), with the full flows of
 *               the touched area run on the same emulator right after the shard's smoke (one pass of smoke, not
 *               two). chaos / roles / two-device ride along only when the diff touches what they test (DEEP_AREAS:
 *               auth, the database, sync / realtime, services that write); otherwise they are the nightly's.
 *               Infra changes (ci/, e2e/, seeds, workflow) run every suite on the reference phone.
 *               Nothing runs on a device when the diff vs base is docs only, or when everything changed since
 *               this PR's last green device run is docs only (sinceGreenFiles, ci/since-green.mjs).
 *   nightly     full + chaos + roles + two-device + monkey(5k) on the reference phone, smoke on the
 *               small / large-font / tablet devices + the 360-dp font-1.3 phone, the volume job (database ladder + stress).
 *   prerelease  nightly + full on every device + monkey(20k).
 * Docs-only changes run nothing on a device. Selection only ever makes a PR faster: every flow it leaves out
 * still runs in the nightly and before an APK, so a failure is hidden for one night at most.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const DEVICES = {
  pixel6: { api: 34, arch: 'x86_64', target: 'default', profile: 'pixel_6', rotation: 0, font: '1.0', label: 'Pixel 6 · API 34 (reference)' },
  pixel4a: { api: 30, arch: 'x86_64', target: 'default', profile: 'pixel_4a', rotation: 0, font: '1.0', label: 'Pixel 4a · API 30 (small, old)' },
  pixel7pro: { api: 34, arch: 'x86_64', target: 'default', profile: 'pixel_7_pro', rotation: 0, font: '1.3', label: 'Pixel 7 Pro · API 34 · font 1.3' },
  tablet: { api: 34, arch: 'x86_64', target: 'default', profile: 'pixel_tablet', rotation: 1, font: '1.0', label: 'Pixel Tablet · API 34 · upright (rotation 1 of a landscape-natural device)' },
  // Staging build 2 (Sree, Nov 23): five of eight bugs were a narrow phone or a big font. The Pixel 4a profile
  // at density 480 is a 360 × 780 dp window (run-suite.sh sets it), and the font at 1.3 on top. On the API 34
  // image like the reference rows: the API 30 snapshot came back "booted" with no input / settings service in
  // three of four PR runs and the job hung to its 90-min timeout (next-up 12h); `pixel4a` keeps API 30 nightly.
  small: { api: 34, arch: 'x86_64', target: 'default', profile: 'pixel_4a', rotation: 0, font: '1.3', density: 480, label: 'Pixel 4a at 360 dp · API 34 · font 1.3 (small)' },
};

/** Paths that never need a device. */
const DOCS_ONLY = [/\.md$/i, /^rummy-home3\/docs\//, /^docs\//, /\.png$/i, /\.svg$/i, /^LICENSE/];

/** Paths that are the test infrastructure itself: a change here runs every suite once (PR 17 proves itself). */
const INFRA = [/^ci\//, /^\.github\//, /^rummy-home3\/e2e\//, /^rummy-home3\/supabase\/seed/, /^rummy-home3\/supabase\/config\.toml$/];

/**
 * The two PR smoke shards (Nov 26, "optimize testing": ~40 min on one emulator → ~20 min on each of two).
 * Every shard starts from the same seeded database, so a flow may only rely on state that an EARLIER flow of the
 * SAME shard leaves. The chains (found by reading the flows; the e2e README "Fixtures and state" lists the games):
 *
 *   A → G results   smoke/01–06 (game A gains round 3, is completed, shows in Results), smoke/12 (saves G's result,
 *                   needs A completed to untick it), smoke/15 (shares that result), full/40 (A's result), full/41 + 42 (G's)
 *   new game        smoke/07 → 08 → 09 (09 leaves HT2 in My players) → 16 → 19 (both start a game and delete it;
 *                   19 "runs after 16"); full/10 and full/61 (sign out / first launch) need nothing
 *   E and H         smoke/13 (E back to round 1) → 14 (H round 1) → 18 (E ×10 then ×1) → 21 (E Players frame, H hidden) →
 *                   23 (Dealer, "runs after 13"); full/30, 31, 70 (E, "runs after smoke/13"), 32, 80 (H, round 1 from 14)
 *   F               smoke/10, 11, 25 (read only); full/20, 21, 50, 51 (F ×10,000 and Order of players, both put back)
 *   independent     smoke/17 (W), 20 (V), 22 (Ravi's games), 24 (Ravi, tutorial), 30 (adds QX, ZQ, VK to My players;
 *                   no game), 31 (looks up #5), 32 (New game to Order of players with 13, numbers and selects, never
 *                   starts: leaving New game forgets the draft); full/60 (dark mode, back to Phone)
 *   clearState      smoke/26 and 27 wipe the phone and sign back in; what follows them in shard b reads only F or
 *                   is independent (30, 31: they sign in first and use the server's My players)
 *
 * Lists are in run order. The sizes are the measured times of run 45912691807 (#156, Nov 26, all 31 flows on one
 * Pixel 6): a = 1132 s, b = 1094 s of smoke;
 * Nov 27 smoke/32 (~380 s) joined a and the independent 17, 20, 30 moved to b: a = 1342 s, b = 1264 s. `full` lists the full flows that follow the shard's smoke on the same emulator; every full flow on disk is in
 * exactly one list (tests/test-selection-pr-shards.test.ts), a full flow that is not falls to shard b.
 */
export const SMOKE_SHARDS = {
  a: {
    smoke: ['01-home', '02-scorecard', '03-scorecard-landscape', '04-add-round', '05-complete-game', '06-results', '07-profile', '08-my-players', '09-new-game',
      '12-results-zero-players', '15-delete-shared-result-confirm', '16-pool-game', '19-seating-order', '32-seating-13p'],
    full: ['10-sign-out-bad-passcode', '40-results-save-and-past', '41-share-images', '42-reopen-closed-game', '61-first-launch-light-night-phone'],
  },
  b: {
    smoke: ['10-scorecard-20-players', '11-scorecard-20-players-landscape', '13-undo-then-add-round', '14-rummy-positive-pot', '17-pool-wide-initials-20p',
      '18-multiplier-change', '20-pool-13p-reentry', '21-help-frames', '22-play-listing-frames', '23-dealer', '24-seating-tutorial', '25-scorecard-fast-fling',
      '26-create-account-keyboard', '27-create-account-code', '28-scorecard-columns', '29-scorecard-names-swipe', '30-add-by-initials-save',
      '31-player-id-search'],
    full: ['20-scorecard-20-players-swipe', '21-scorecard-font-scale', '30-players-admins-and-settings', '31-edit-initials-mid-game', '32-add-players-to-game',
      '50-help-notes', '50-multiplier-20p', '51-seating-20p', '60-dark-mode', '70-game-log', '80-add-round-count-warnings'],
  },
};
const SHARD_IDS = Object.keys(SMOKE_SHARDS);

/** Which shard a full flow belongs to (the one that holds the smoke flows it builds on). */
export function shardOfFull(name) {
  return SHARD_IDS.find((id) => SMOKE_SHARDS[id].full.includes(name)) ?? 'b';
}

/**
 * App area → the full flows that cover it. On a PR they ride in the smoke job of the shard that owns them, right after
 * that shard's smoke flows (the nightly runs the whole full set).
 */
export const AREA_FLOWS = [
  { area: 'add-round', match: [/score-entry\.tsx$/, /ScoreKeypad/, /ScoreCell/, /roundEntry/, /rummyDistribution/, /roundConfirms/, /scoreAfter/],
    flows: { full: ['80-add-round-count-warnings'] } },
  { area: 'scorecard', match: [/games\/\[id\]\.tsx$/, /components\/game\/Score(Header|Table|Grid|Column|card)/, /scorecardLayout/, /components\/game\/(Pool)?Standings/],
    flows: { full: ['20-scorecard-20-players-swipe', '21-scorecard-font-scale', '42-reopen-closed-game'] } },
  { area: 'save-round', match: [/services\/games\.ts$/, /migrations\/.*save_round/, /migrations\/.*undo/, /utils\/saveRound/],
    flows: {} },
  { area: 'players', match: [/\(screens\)\/players\//, /components\/players\//, /utils\/(addPlayers|initials|myPlayers)/, /services\/players/],
    flows: { full: ['30-players-admins-and-settings', '31-edit-initials-mid-game', '32-add-players-to-game'] } },
  { area: 'results', match: [/\(screens\)\/results/, /components\/results\//, /utils\/results/, /services\/results/],
    flows: { full: ['40-results-save-and-past', '41-share-images', '42-reopen-closed-game'] } },
  { area: 'help', match: [/\(screens\)\/help/, /utils\/help/, /components\/help\//],
    flows: { full: ['50-help-notes'] } },
  { area: 'theme', match: [/theme\//, /utils\/theme/, /app\/_layout\.tsx$/],
    flows: { full: ['60-dark-mode', '61-first-launch-light-night-phone', '21-scorecard-font-scale'] } },
  { area: 'log', match: [/eventLog/, /games\/log\.tsx$/, /migrations\/.*event_log/],
    flows: { full: ['70-game-log'] } },
  { area: 'auth', match: [/\(auth\)\//, /services\/auth/, /utils\/authErrors/, /login/i, /\(tabs\)\/me\.tsx$/, /utils\/supabaseErrors/],
    flows: { full: ['10-sign-out-bad-passcode'] } },
  { area: 'seating', match: [/utils\/seating/, /components\/game\/(SeatingSheet|OrderOfPlayers|OrderStep)/, /migrations\/.*seating/, /utils\/dealerRotation/],
    flows: { full: ['51-seating-20p', '70-game-log'] } },
  { area: 'deleted-games', match: [/utils\/deletedGames/, /components\/home\/DeletedGames/, /components\/game\/DeletedGameBanner/, /hidden-deleted\.tsx$/, /utils\/archive/, /services\/archive/, /migrations\/.*going_rogue/, /migrations\/.*no_permanent_delete/, /tests\/no-permanent-delete/],
    flows: { full: ['70-game-log'] } },
];

/**
 * What makes chaos / roles / two-device worth their emulators on a PR (Sree, Nov 25: "optimized for efficiency, speed,
 * but then also thoroughness"). A change that only moves pixels cannot break "who may see this game" or "kill the app
 * mid-save"; a change to sign-in, the database, sync or a service that writes can. Each rule names the flows it adds
 * (`chaos` / `roles`: a list, or 'all' for the whole set) and whether the two-phone run is needed. Anything not listed
 * waits for the nightly. Order of players, Dealer, scorecard layout and the like are covered by smoke and full.
 */
export const DEEP_AREAS = [
  { area: 'auth', match: [/\(auth\)\//, /services\/auth/, /utils\/(authErrors|authFlow|authRedirect|supabaseErrors)/, /services\/(supabase|playerIdentity)\.ts$/, /login/i, /\(tabs\)\/me\.tsx$/],
    chaos: ['c11-launch-offline--net-off', 'c12-logout-dead-session--revoke-session'], roles: ['r01-player-view-only', 'r02-spectator-pool', 'r03-outsider-no-break-games', 'r04-nonplaying-admin'] },
  { area: 'database', match: [/supabase\/(migrations|functions|rollback)\//],
    chaos: 'all', roles: 'all', twoDevice: true },
  { area: 'sync', match: [/services\/realtime/, /utils\/(gameCache|sync|offline|retry)/],
    chaos: ['c05-offline-save--net-off', 'c06-reconnect-retry', 'c07-kill-mid-save--kill-after', 'c08-after-kill-consistent', 'c11-launch-offline--net-off'], twoDevice: true },
  { area: 'writes-rounds', match: [/services\/games\.ts$/, /utils\/saveRound/],
    chaos: ['c01-rapid-save-taps', 'c02-double-complete', 'c05-offline-save--net-off', 'c06-reconnect-retry', 'c07-kill-mid-save--kill-after', 'c08-after-kill-consistent', 'c10-pool-everyone-out'], twoDevice: true },
  { area: 'writes-people', match: [/services\/players\.ts$/, /services\/playerIdentity\.ts$/, /utils\/addPlayers/],
    chaos: ['c03-bad-input'], roles: ['r01-player-view-only', 'r03-outsider-no-break-games'] },
  { area: 'writes-archive', match: [/services\/archive\.ts$/, /utils\/(archive|deletedGames)/, /services\/results\.ts$/],
    roles: ['r05-deleted-game-ask-restore'] },
];

const isDocsOnly = (f) => DOCS_ONLY.some((re) => re.test(f));
/** Stricter than DOCS_ONLY, for "nothing but docs since the last green run": an image under assets/ is app code there. */
const isPlainDocs = (f) => /\.md$/i.test(f) || /^rummy-home3\/docs\//.test(f) || /^docs\//.test(f);
const isInfra = (f) => INFRA.some((re) => re.test(f));
const isApp = (f) => /^rummy-home3\//.test(f) && !isDocsOnly(f) && !/^rummy-home3\/e2e\//.test(f);

function uniq(list) {
  return [...new Set(list)];
}

/** `rummy-home3/e2e/full/51-seating-20p.yaml` → `51-seating-20p`; anything else → null. */
function fullFlowName(file) {
  const m = /^rummy-home3\/e2e\/full\/([^/]+)\.ya?ml$/.exec(file);
  return m ? m[1] : null;
}

/**
 * Pure planner. `files` is the changed path list (PR); `tier` overrides the event's default.
 * Returns { tier, ui, jobs: [{device, suite, flows, monkeyEvents?}], volume, fileBugs, publish, reason }.
 */
export function select({ event = 'pull_request', tier, files = [], message = '', sinceGreenFiles = null } = {}) {
  const msg = message || '';
  const forceAll = /\[ui-all\]/i.test(msg);
  const fileBugsTag = /\[file-bugs\]/i.test(msg);
  const devicesTag = /\[ui-devices\]/i.test(msg);
  const effectiveTier = tier || (event === 'schedule' ? 'nightly' : event === 'workflow_dispatch' ? 'nightly' : 'pr');

  const job = (device, suite, flows = [], extra = {}) => ({ device, suite, shard: '', smokeFlows: '', flows: flows.join(','), ...DEVICES[device], ...extra });
  /**
   * The PR smoke gate on one device: one job per shard. `fullFlows` (the selected full flows) are split by the shard that
   * owns them and run on the same emulator right after the shard's smoke flows, so the PR needs one smoke pass, not two.
   * A device that gets its own smoke row later (the small phone, #131) should use this too: unsharded it would be the
   * critical path again.
   */
  const smokeShards = (device, fullFlows = []) => SHARD_IDS.map((id) => job(device, 'smoke', fullFlows.filter((f) => shardOfFull(f) === id), {
    shard: id, smokeFlows: SMOKE_SHARDS[id].smoke.join(','),
  }));
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
      job('small', pre ? 'full' : 'smoke'),
    );
    if (pre) plan.jobs.push(job('pixel4a', 'chaos'), job('tablet', 'chaos'));
    // Volume (the database ladder + stress budgets, ~5 min on a plain runner) runs every night since
    // Nov 21 (docs/test-environment-plan.md V1): six migrations of new RPCs had never been under load.
    plan.volume = true;
    plan.fileBugs = true;
    plan.reason = `${effectiveTier}: every suite on the reference phone, ${pre ? 'full' : 'smoke'} on the other devices${pre ? ', monkey 20k' : ', monkey 5k'}, volume`;
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

  // A push that only pulls docs into a PR that already had a green device run (a rebase onto a main with new docs, a
  // note in the PR's own docs): the code under test is the code that was green. The caller computes the file list.
  if (Array.isArray(sinceGreenFiles) && !forceAll && sinceGreenFiles.every(isPlainDocs)) {
    return { ...plan, ui: false, publish: false, reason: `nothing but docs changed since this PR's last green device run (${sinceGreenFiles.length} file(s)): no device run` };
  }

  if (infraChanged || forceAll || changed.length === 0) {
    // The full set is the nightly's; on a PR only the full flows that were edited run (by name, inside the smoke
    // job of the shard that owns them), so a flow fix is checked before it merges instead of at 09:00 the next day.
    const touchedFull = uniq(changed.map(fullFlowName).filter(Boolean));
    plan.jobs.push(...smokeShards('pixel6', touchedFull));
    plan.jobs.push(
      job('pixel6', 'chaos'),
      job('pixel6', 'roles'),
      job('pixel6', 'two-device'),
      job('pixel6', 'monkey', [], { monkeyEvents: 1500 }),
    );
    if (appChanged) plan.jobs.push(...smokeShards('small'));
    if (devicesTag) { plan.jobs.push(...smokeShards('pixel4a'), ...smokeShards('tablet')); plan.volume = true; }
    const fullNote = touchedFull.length ? ` + the ${touchedFull.length} edited full flow(s)` : '';
    plan.reason = forceAll ? `[ui-all] in the commit message: every suite on the reference phone${fullNote}`
      : changed.length === 0 ? 'no file list: every suite on the reference phone'
      : `test infrastructure changed: every suite on the reference phone${fullNote}`;
    if (devicesTag) plan.reason += ' + smoke on the Pixel 4a (API 30) and the Pixel Tablet + the volume job ([ui-devices])';
    return plan;
  }

  const full = [];
  const areas = [];
  for (const rule of AREA_FLOWS) {
    if (!changed.some((f) => rule.match.some((re) => re.test(f)))) continue;
    areas.push(rule.area);
    full.push(...(rule.flows.full ?? []));
  }
  const deep = { chaos: [], roles: [], twoDevice: false, allChaos: false, allRoles: false };
  const deepAreas = [];
  for (const rule of DEEP_AREAS) {
    if (!changed.some((f) => rule.match.some((re) => re.test(f)))) continue;
    deepAreas.push(rule.area);
    if (rule.chaos === 'all') deep.allChaos = true; else deep.chaos.push(...(rule.chaos ?? []));
    if (rule.roles === 'all') deep.allRoles = true; else deep.roles.push(...(rule.roles ?? []));
    if (rule.twoDevice) deep.twoDevice = true;
  }
  plan.jobs.push(...smokeShards('pixel6', uniq(full)));
  // chaos / roles / two-device: only when the diff is in what they test (DEEP_AREAS); whole set when a rule says 'all'.
  if (deep.allChaos || deep.chaos.length) plan.jobs.push(job('pixel6', 'chaos', deep.allChaos ? [] : uniq(deep.chaos)));
  if (deep.allRoles || deep.roles.length) plan.jobs.push(job('pixel6', 'roles', deep.allRoles ? [] : uniq(deep.roles)));
  if (deep.twoDevice) plan.jobs.push(job('pixel6', 'two-device'));
  const extras = plan.jobs.length - SHARD_IDS.length;
  // Every app change also runs the smoke set once on the small phone at font 1.3 (staging build 2's lesson), in the
  // same shards, so it is not the critical path.
  plan.jobs.push(...smokeShards('small'));
  if (devicesTag) { plan.jobs.push(...smokeShards('pixel4a'), ...smokeShards('tablet')); plan.volume = true; }
  plan.reason = `app change${areas.length ? ` in ${areas.join(', ')}` : ' outside the mapped areas'} → smoke on ${SHARD_IDS.length} emulators${full.length ? ` + ${uniq(full).length} full flow(s)` : ''}`
    + (extras ? ` + ${extras} deep job(s) (${deepAreas.join(', ')})` : ' (chaos / roles / two-device wait for the nightly)')
    + `, and on the small phone`;
  return plan;
}

/** The job matrix GitHub expects. `id` names the job and its artifact (smoke-a, smoke-b, chaos, …) so two shards of one device do not collide. */
export function toMatrix(plan) {
  return { include: plan.jobs.map((j) => ({ ...j, id: j.shard ? `${j.suite}-${j.shard}` : j.suite, monkeyEvents: j.monkeyEvents ?? 0 })) };
}

function main() {
  const files = (process.env.SELECT_FILES ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  const plan = select({
    event: process.env.SELECT_EVENT || 'pull_request',
    tier: process.env.SELECT_TIER || undefined,
    files,
    message: process.env.SELECT_MESSAGE || '',
    sinceGreenFiles: process.env.SELECT_SINCE_FILES === undefined ? null : process.env.SELECT_SINCE_FILES.split('\n').map((s) => s.trim()).filter(Boolean),
  });
  const matrix = toMatrix(plan);
  console.log(`tier=${plan.tier}  ui=${plan.ui}  ${plan.reason}`);
  for (const j of plan.jobs) console.log(`  ${j.device.padEnd(9)} ${(j.shard ? `${j.suite}-${j.shard}` : j.suite).padEnd(10)} ${j.suite === 'smoke' && j.shard ? `${j.smokeFlows.split(',').length} smoke flows + ${j.flows ? j.flows : 'no full flows'}` : j.flows || '(whole set)'}${j.monkeyEvents ? ` ${j.monkeyEvents} events` : ''}`);
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

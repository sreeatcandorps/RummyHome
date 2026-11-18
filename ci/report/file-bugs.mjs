/**
 * Auto-file what the device runs found (PR 17, B16-10): one GitHub issue per failing flow or crash,
 * labelled `bug` + `found-by-tests`, de-duplicated by title so a flake that fails every night is one
 * issue with one comment per run, not a pile. Tries to add each new issue to Sree's project board;
 * the workflow token cannot (user projects need a PAT with `project` scope), so it logs and moves on
 * and he drags them in from the label.
 *
 *   node ci/report/file-bugs.mjs <dir-with-downloaded-ui-artifacts>
 *
 * Reads every  <dir>/** /<set>/results.csv and crashes.csv  (the layout run-flows.sh writes; the
 * artifact folder name carries device + suite: ui-<slug>-<device>-<suite>). The known-bugs set is
 * skipped: it is quarantined on purpose. Nothing is filed unless FILE_BUGS=true. An open found-by-tests
 * issue whose flow passed on every device in this run is closed again (and reopened by the next failure).
 *
 * Env: GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_SERVER_URL, GITHUB_SHA, GITHUB_REF_NAME,
 *      FILE_BUGS (true to act; anything else = dry run that prints what it would file),
 *      PROJECT_URL (default https://github.com/users/sreeatcandorps/projects/1), PAGES_URL (dashboard base).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] ?? 'ci/out/ui-all');
const ACT = process.env.FILE_BUGS === 'true';
const REPO = process.env.GITHUB_REPOSITORY ?? 'sreeatcandorps/RummyHome';
const [OWNER, NAME] = REPO.split('/');
const TOKEN = process.env.GITHUB_TOKEN ?? '';
const RUN_URL = `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${REPO}/actions/runs/${process.env.GITHUB_RUN_ID ?? '0'}`;
const PROJECT_URL = process.env.PROJECT_URL ?? 'https://github.com/users/sreeatcandorps/projects/1';
const PAGES_URL = process.env.PAGES_URL ?? '';
const RUN_ID = process.env.GITHUB_RUN_ID ?? '0';
const LABELS = ['bug', 'found-by-tests'];
const SKIP_SETS = new Set(['known-bugs']);

// ---------- collect ------------------------------------------------------------------------------
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'results.csv' || e.name === 'crashes.csv') out.push(p);
  }
  return out;
}

/** "ui-<slug>-<device>-<suite>/<set>/results.csv" → { device, suite, set } (best effort). */
function context(file) {
  const rel = path.relative(ROOT, file).split(path.sep);
  const set = rel[rel.length - 2];
  const art = rel[0] ?? '';
  const m = art.match(/-(pixel6|pixel4a|pixel7pro|tablet)-([a-z-]+)$/);
  return { set, device: m?.[1] ?? 'device', suite: m?.[2] ?? set, artifact: art };
}

const findings = [];
/** "<set>/<flow>" of every flow that passed somewhere in this run (a green flow heals its open issue). */
const passed = new Set();
for (const file of walk(ROOT)) {
  const { set, device, suite, artifact } = context(file);
  if (SKIP_SETS.has(set)) continue;
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  if (file.endsWith('results.csv')) {
    for (const l of lines) {
      const [flow, result, secs] = l.split(',');
      if (result === 'pass') passed.add(`${set}/${flow}`);
      if (result !== 'fail') continue;
      const screensDir = path.join(path.dirname(file), 'screens');
      const shots = fs.existsSync(screensDir) ? fs.readdirSync(screensDir).filter((s) => s.startsWith(flow) || s.includes('FAILED')) : [];
      findings.push({ kind: 'flow', flow, set, device, suite, artifact, secs, shots });
    }
  } else {
    for (const l of lines) {
      const parts = l.split(',');
      const [flow, kind] = parts;
      if (!flow) continue;
      findings.push({ kind: kind === 'anr' ? 'anr' : 'crash', flow, set, device, suite, artifact, detail: parts.slice(2).join(',') });
    }
  }
}

// One finding per (flow, kind): a crash during a flow already fails the flow; keep the crash row (richer).
const byKey = new Map();
for (const f of findings) {
  const key = `${f.set}/${f.flow}`;
  const prev = byKey.get(key);
  if (!prev || (prev.kind === 'flow' && f.kind !== 'flow')) byKey.set(key, { ...f, devices: new Set([...(prev?.devices ?? []), f.device]) });
  else prev.devices.add(f.device);
}
const unique = [...byKey.values()];
for (const f of unique) passed.delete(`${f.set}/${f.flow}`);

console.log(`file-bugs: ${unique.length} finding(s), ${passed.size} flow(s) green${ACT ? '' : ' (dry run: FILE_BUGS is not true)'}`);

// ---------- GitHub ---------------------------------------------------------------------------------
async function gh(method, url, body) {
  const res = await fetch(url.startsWith('http') ? url : `https://api.github.com${url}`, {
    method,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}: ${typeof json === 'string' ? json : json?.message ?? text}`);
  return json;
}

async function ensureLabel(name) {
  try {
    await gh('GET', `/repos/${REPO}/labels/${encodeURIComponent(name)}`);
  } catch {
    await gh('POST', `/repos/${REPO}/labels`, { name, color: name === 'found-by-tests' ? '5319e7' : 'd73a4a', description: name === 'found-by-tests' ? 'Opened automatically by the device test runs' : '' });
    console.log(`created label ${name}`);
  }
}

function title(f) {
  const what = f.kind === 'crash' ? 'crashed' : f.kind === 'anr' ? 'froze (ANR)' : 'failed';
  return `[found-by-tests] ${f.set}/${f.flow} ${what}`;
}

function body(f) {
  const devices = [...f.devices].join(', ');
  const dash = PAGES_URL ? `${PAGES_URL.replace(/\/$/, '')}/runs/${RUN_ID}/` : '';
  const lines = [
    `**What the test saw:** \`${f.set}/${f.flow}\` ${f.kind === 'flow' ? 'failed' : f.kind === 'anr' ? 'hit an ANR (app not responding)' : 'crashed the app'} on ${devices}.`,
    '',
    f.detail ? `**First line from logcat:** \`${f.detail.replace(/`/g, "'").slice(0, 300)}\`` : '',
    '',
    '**Where to look:**',
    `- Run: ${RUN_URL}`,
    dash ? `- Dashboard (screens, video): ${dash}` : '',
    `- Artifact: \`${f.artifact}\` → \`${f.set}/screens/\`${f.shots?.length ? ` (${f.shots.slice(0, 4).map((s) => `\`${s}\``).join(', ')})` : ''}, \`${f.set}/debug/${f.flow}/\` (Maestro log)`,
    f.kind !== 'flow' ? `- Crash log: \`${f.set}/crashes/${f.flow}.*.txt\`` : '',
    '',
    '**Reproduce locally** (local Supabase + the seeds, see `rummy-home3/e2e/README.md`):',
    '```',
    `maestro test rummy-home3/e2e/${f.set}/${f.flow}.yaml`,
    '```',
    '',
    `Commit: \`${(process.env.GITHUB_SHA ?? '').slice(0, 7)}\` on \`${process.env.GITHUB_REF_NAME ?? ''}\`. Filed automatically by CI; board: ${PROJECT_URL}`,
    '',
    '<!-- found-by-tests -->',
  ];
  return lines.filter((l) => l !== '').join('\n').replace(/\n{3,}/g, '\n\n');
}

async function findExisting(t) {
  const q = `repo:${REPO} is:issue label:found-by-tests in:title "${t.replace(/"/g, '')}"`;
  const res = await gh('GET', `/search/issues?q=${encodeURIComponent(q)}&per_page=5`);
  return (res.items ?? []).find((i) => i.title === t) ?? null;
}

async function addToProject(issueNodeId) {
  // Needs a token with `project` scope on a user project; GITHUB_TOKEN has none → caught and logged.
  const m = PROJECT_URL.match(/users\/([^/]+)\/projects\/(\d+)/);
  if (!m) return false;
  const [, login, num] = m;
  const q1 = `query($login:String!,$num:Int!){ user(login:$login){ projectV2(number:$num){ id } } }`;
  const r1 = await gh('POST', '/graphql', { query: q1, variables: { login, num: Number(num) } });
  const pid = r1?.data?.user?.projectV2?.id;
  if (!pid) throw new Error(r1?.errors?.[0]?.message ?? 'project not visible to this token');
  const q2 = `mutation($p:ID!,$c:ID!){ addProjectV2ItemById(input:{projectId:$p, contentId:$c}){ item { id } } }`;
  const r2 = await gh('POST', '/graphql', { query: q2, variables: { p: pid, c: issueNodeId } });
  if (r2?.errors?.length) throw new Error(r2.errors[0].message);
  return true;
}

const summary = [];
let projectOk = null;

// Heal: an open found-by-tests issue whose flow passed in this run (and failed nowhere) is closed with the
// run link, so the bug list only carries what is red today. The filer reopens it if it fails again.
async function healFixed() {
  if (passed.size === 0) return;
  if (!ACT) { console.log(`would close the open found-by-tests issue of any of ${passed.size} green flow(s)`); return; }
  let page = 1;
  const open = [];
  for (;;) {
    const batch = await gh('GET', `/repos/${REPO}/issues?state=open&labels=found-by-tests&per_page=100&page=${page}`);
    open.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }
  for (const issue of open) {
    const m = issue.title.match(/^\[found-by-tests\] (\S+\/\S+) (failed|crashed|froze \(ANR\))$/);
    if (!m || !passed.has(m[1])) continue;
    await gh('POST', `/repos/${REPO}/issues/${issue.number}/comments`, { body: `Passed again: \`${m[1]}\` was green on every device in ${RUN_URL}. Closing; the filer reopens this if it fails again.` });
    await gh('PATCH', `/repos/${REPO}/issues/${issue.number}`, { state: 'closed', state_reason: 'completed' });
    console.log(`closed #${issue.number}: ${issue.title}`);
    summary.push(`- #${issue.number} closed (green again): ${m[1]}`);
  }
}

try {
  await healFixed();
} catch (e) {
  console.log(`file-bugs: could not close healed issues: ${e.message}`);
  summary.push(`- could not close healed issues (${e.message})`);
}

for (const f of unique) {
  const t = title(f);
  if (!ACT) { console.log(`would file: ${t} (${[...f.devices].join(', ')})`); summary.push(`- (dry run) ${t}`); continue; }
  try {
    const existing = await findExisting(t);
    if (existing) {
      const already = existing.body?.includes(RUN_URL);
      if (existing.state === 'open' && !already) {
        await gh('POST', `/repos/${REPO}/issues/${existing.number}/comments`, { body: `Seen again on ${[...f.devices].join(', ')}: ${RUN_URL}${f.detail ? `\n\n\`${f.detail.slice(0, 300)}\`` : ''}` });
        console.log(`commented on #${existing.number}: ${t}`);
        summary.push(`- #${existing.number} seen again: ${t}`);
      } else if (existing.state === 'closed') {
        await gh('PATCH', `/repos/${REPO}/issues/${existing.number}`, { state: 'open' });
        await gh('POST', `/repos/${REPO}/issues/${existing.number}/comments`, { body: `Reopened: it failed again on ${[...f.devices].join(', ')}. ${RUN_URL}` });
        console.log(`reopened #${existing.number}: ${t}`);
        summary.push(`- #${existing.number} reopened: ${t}`);
      } else {
        summary.push(`- #${existing.number} already has this run: ${t}`);
      }
      continue;
    }
    for (const l of LABELS) await ensureLabel(l);
    const issue = await gh('POST', `/repos/${REPO}/issues`, { title: t, body: body(f), labels: LABELS });
    console.log(`opened #${issue.number}: ${t}`);
    summary.push(`- #${issue.number} opened: ${t}`);
    if (projectOk !== false) {
      try {
        await addToProject(issue.node_id);
        projectOk = true;
        console.log(`  added #${issue.number} to ${PROJECT_URL}`);
      } catch (e) {
        projectOk = false;
        console.log(`  project board: skipped (${String(e.message).split('\n')[0]}) — labelled instead; add from the found-by-tests label`);
      }
    }
  } catch (e) {
    console.log(`file-bugs: could not handle "${t}": ${e.message}`);
    summary.push(`- could not file: ${t} (${e.message})`);
  }
}

const md = ['### Bugs filed from this run', '', ...(summary.length ? summary : ['- nothing failed outside the quarantined set — no issues to file']), '', projectOk === false ? `_The workflow token cannot add items to ${PROJECT_URL}; issues carry the \`found-by-tests\` label instead._` : ''].join('\n');
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
fs.mkdirSync(path.dirname(path.join(ROOT, 'bugs.md')), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'bugs.md'), md);
console.log(md);

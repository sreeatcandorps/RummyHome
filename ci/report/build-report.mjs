/**
 * Builds the readable test report from the raw results the CI jobs leave under ci/out/:
 *
 *   out/unit/tests.jsonl       one line per node:test test (ci/report/node-test-json-reporter.mjs)
 *   out/unit/tsc.txt|.status   tsc --noEmit output and exit code
 *   out/db/migrations.txt|.status   supabase db reset (migrations 001..017 + seed)
 *   out/db/rollbacks.tap|.status    ci/db/replay-rollbacks.sh
 *   out/db/pgtap/*.tap, pgtap.status   ci/db/run-pgtap.sh
 *   out/db/concurrency.tap|.status     ci/db/concurrency-save-round.mjs
 *
 * Writes out/report.md and out/report.json, appends the markdown to $GITHUB_STEP_SUMMARY when set,
 * and exits 1 if anything failed (known failures marked TODO do not count).
 *
 *   node ci/report/build-report.mjs [outDir]      (default ci/out)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(process.argv[2] ?? path.join(here, '..', 'out'));
const map = JSON.parse(fs.readFileSync(path.join(here, 'workflow-map.json'), 'utf8')).workflows;

const read = (p) => (fs.existsSync(path.join(OUT, p)) ? fs.readFileSync(path.join(OUT, p), 'utf8') : null);
const status = (p) => { const s = read(p); return s == null ? null : Number.parseInt(s.trim(), 10); };

// ---------- TAP ------------------------------------------------------------------------------
function parseTap(text) {
  const tests = [];
  let planned = null;
  let last = null;
  for (const raw of (text ?? '').split('\n')) {
    const line = raw.trimEnd();
    let m;
    if ((m = /^1\.\.(\d+)/.exec(line))) { planned = Number(m[1]); continue; }
    if ((m = /^(ok|not ok)\s+(\d+)\s*-?\s*(.*?)(?:\s+#\s*(TODO|SKIP)\b\s*(.*))?$/i.exec(line))) {
      last = { n: Number(m[2]), name: m[3].trim(), ok: m[1] === 'ok', directive: m[4]?.toUpperCase() ?? null, reason: m[5]?.trim() ?? '', diag: [] };
      tests.push(last);
      continue;
    }
    if (/^Bail out!/.test(line)) { tests.push({ n: 0, name: line, ok: false, directive: null, reason: '', diag: [] }); continue; }
    if (line.startsWith('#') && last) last.diag.push(line.replace(/^#\s?/, ''));
    else if (/ERROR|psql:/.test(line)) tests.push({ n: 0, name: line, ok: false, directive: null, reason: 'script error', diag: [] });
  }
  return { planned, tests };
}
const tally = (tests) => ({
  passed: tests.filter((t) => t.ok && !t.directive).length,
  failed: tests.filter((t) => !t.ok && t.directive !== 'TODO').length,
  known: tests.filter((t) => !t.ok && t.directive === 'TODO').length,
  skipped: tests.filter((t) => t.directive === 'SKIP').length,
  total: tests.length,
});

// ---------- collect --------------------------------------------------------------------------
const suites = [];        // { key, title, ran, ok, passed, failed, known, note, failures: [] }
const knownFailures = []; // { suite, where, test, reason }
const failures = [];      // { suite, where, test, detail }

// unit tests
const unitRows = (read('unit/tests.jsonl') ?? '').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const unitByFile = new Map();
for (const r of unitRows) {
  const f = unitByFile.get(r.file) ?? { passed: 0, failed: 0, skipped: 0 };
  if (r.status === 'pass') f.passed += 1; else if (r.status === 'fail') f.failed += 1; else f.skipped += 1;
  unitByFile.set(r.file, f);
  if (r.status === 'fail') failures.push({ suite: 'Unit tests', where: r.file, test: r.name, detail: r.error });
}
{
  const ran = unitRows.length > 0;
  const failed = unitRows.filter((r) => r.status === 'fail').length;
  suites.push({ key: 'unit', title: 'Unit tests (`node:test`, rummy-home3/tests)', ran, ok: ran && failed === 0,
    passed: unitRows.filter((r) => r.status === 'pass').length, failed, known: 0,
    note: ran ? `${unitByFile.size} files` : 'no results found' });
}

// tsc
{
  const st = status('unit/tsc.status');
  const ran = st != null;
  const txt = (read('unit/tsc.txt') ?? '').trim();
  const errors = (txt.match(/error TS\d+/g) ?? []).length;
  suites.push({ key: 'tsc', title: 'TypeScript (`tsc --noEmit`)', ran, ok: ran && st === 0, passed: ran && st === 0 ? 1 : 0, failed: ran && st !== 0 ? 1 : 0, known: 0,
    note: ran ? (st === 0 ? 'no type errors' : `${errors} error(s)`) : 'not run' });
  if (ran && st !== 0) failures.push({ suite: 'TypeScript', where: 'rummy-home3', test: 'tsc --noEmit', detail: txt.split('\n').slice(0, 15).join('\n') });
}

// migrations + seed
{
  const st = status('db/migrations.status');
  const ran = st != null;
  const txt = (read('db/migrations.txt') ?? '').trim();
  suites.push({ key: 'migrations', title: 'Every migration (001–021) + seed on a fresh local Supabase', ran, ok: ran && st === 0, passed: ran && st === 0 ? 1 : 0, failed: ran && st !== 0 ? 1 : 0, known: 0,
    note: ran ? (st === 0 ? 'applied from empty' : 'failed') : 'not run' });
  if (ran && st !== 0) failures.push({ suite: 'Migrations', where: 'supabase db reset', test: 'apply every migration + seed.sql', detail: txt.split('\n').slice(-20).join('\n') });
}

// rollbacks
const rollbacks = parseTap(read('db/rollbacks.tap'));
{
  const st = status('db/rollbacks.status');
  const ran = st != null || rollbacks.tests.length > 0;
  const t = tally(rollbacks.tests);
  const planOk = rollbacks.planned == null || rollbacks.planned === rollbacks.tests.length;
  suites.push({ key: 'rollbacks', title: 'Rollbacks 021→013 replayed, then 013–021 re-applied (twice)', ran, ok: ran && t.failed === 0 && planOk && (st ?? 0) === 0, ...t,
    note: ran ? (planOk ? '' : `planned ${rollbacks.planned}, ran ${rollbacks.tests.length}`) : 'not run' });
  for (const x of rollbacks.tests.filter((x) => !x.ok)) (x.directive === 'TODO' ? knownFailures : failures).push({ suite: 'Rollbacks', where: 'ci/db/replay-rollbacks.sh', test: x.name, reason: x.reason, detail: x.diag.join('\n') });
}

// pgTAP
const pgtapFiles = new Map(); // file -> tally + tests
{
  const dir = path.join(OUT, 'db', 'pgtap');
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.tap')).sort()) {
      const parsed = parseTap(fs.readFileSync(path.join(dir, f), 'utf8'));
      const t = tally(parsed.tests);
      const planOk = parsed.planned != null && parsed.planned === parsed.tests.length;
      if (!planOk) t.failed += 1;
      pgtapFiles.set(f.replace(/\.tap$/, '.sql'), { ...t, planned: parsed.planned, tests: parsed.tests, planOk });
      for (const x of parsed.tests.filter((x) => !x.ok)) (x.directive === 'TODO' ? knownFailures : failures).push({ suite: 'pgTAP', where: f.replace(/\.tap$/, '.sql'), test: x.name, reason: x.reason, detail: x.diag.join('\n') });
      if (!planOk) failures.push({ suite: 'pgTAP', where: f.replace(/\.tap$/, '.sql'), test: 'plan', detail: `planned ${parsed.planned ?? '?'} tests, ${parsed.tests.length} ran (a statement probably errored)` });
    }
  }
  const all = [...pgtapFiles.values()];
  const st = status('db/pgtap.status');
  const ran = all.length > 0;
  const sum = (k) => all.reduce((a, f) => a + f[k], 0);
  suites.push({ key: 'pgtap', title: 'pgTAP: RLS, privacy, 014/016/017 rules, public scorecard, 020 bundles, 021 email uniqueness', ran, ok: ran && sum('failed') === 0 && (st ?? 0) === 0,
    passed: sum('passed'), failed: sum('failed'), known: sum('known'), total: sum('total'), note: ran ? `${all.length} files` : 'not run' });
}

// concurrency
const conc = parseTap(read('db/concurrency.tap'));
{
  const st = status('db/concurrency.status');
  const ran = st != null || conc.tests.length > 0;
  const t = tally(conc.tests);
  const planOk = conc.planned == null || conc.planned === conc.tests.length;
  suites.push({ key: 'concurrency', title: 'Two-client concurrency (`save_round`, seat removal, declare)', ran, ok: ran && t.failed === 0 && planOk && (st ?? 0) === 0, ...t,
    note: ran ? (planOk ? '' : `planned ${conc.planned}, ran ${conc.tests.length}`) : 'not run' });
  for (const x of conc.tests.filter((x) => !x.ok)) (x.directive === 'TODO' ? knownFailures : failures).push({ suite: 'Concurrency', where: 'ci/db/concurrency-save-round.mjs', test: x.name, reason: x.reason, detail: x.diag.join('\n') });
}

// ---------- per product workflow --------------------------------------------------------------
const scenarioOf = (name) => /^(\d+)[a-z]?\./.exec(name)?.[1] + '.';   // '5a.' and '5b.' belong to scenario 5.
const workflows = map.map((w) => {
  const unit = { passed: 0, failed: 0 };
  for (const f of w.unit ?? []) { const r = unitByFile.get(f); if (r) { unit.passed += r.passed; unit.failed += r.failed; } }
  const db = { passed: 0, failed: 0, known: 0 };
  for (const f of w.db ?? []) { const r = pgtapFiles.get(f); if (r) { db.passed += r.passed; db.failed += r.failed; db.known += r.known; } }
  const cc = { passed: 0, failed: 0, known: 0 };
  for (const t of conc.tests) {
    if (!(w.concurrency ?? []).includes(scenarioOf(t.name))) continue;
    if (t.ok) cc.passed += 1; else if (t.directive === 'TODO') cc.known += 1; else cc.failed += 1;
  }
  const ran = unit.passed + unit.failed + db.passed + db.failed + db.known + cc.passed + cc.failed + cc.known > 0;
  const failed = unit.failed + db.failed + cc.failed;
  return { id: w.id, title: w.title, ran, ok: ran && failed === 0, unit, db, concurrency: cc, known: db.known + cc.known };
});

const unmapped = [...unitByFile.keys()].filter((f) => !map.some((w) => (w.unit ?? []).includes(f)));

// ---------- render ---------------------------------------------------------------------------
const env = process.env;
const ref = env.REPORT_REF ?? env.GITHUB_REF_NAME ?? '';
const sha = (env.REPORT_SHA ?? env.GITHUB_SHA ?? '').slice(0, 7);
const runUrl = env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` : null;
const overallFailed = suites.some((s) => s.ran && !s.ok) || failures.length > 0;
const required = ['unit', 'tsc', 'migrations', 'rollbacks', 'pgtap', 'concurrency'];
const notRun = required.filter((k) => !suites.find((s) => s.key === k)?.ran);
const overall = overallFailed ? 'FAIL' : notRun.length ? 'INCOMPLETE' : 'PASS';
const icon = (ok, ran = true) => (!ran ? '⚪ not run' : ok ? '✅ pass' : '❌ FAIL');
const n = (x) => (x ? String(x) : '–');

const md = [];
md.push(`# EZ Score test report${ref ? ` — \`${ref}\`` : ''}${sha ? ` @ \`${sha}\`` : ''}`);
md.push('');
md.push(`**Overall: ${overall === 'PASS' ? '✅ PASS' : overall === 'FAIL' ? '❌ FAIL' : '⚠️ INCOMPLETE'}** — ${suites.reduce((a, s) => a + (s.passed ?? 0), 0)} checks passed, ${failures.length} failed, ${knownFailures.length} known failures (bugs already recorded, see below).${notRun.length ? ` Not run: ${notRun.join(', ')}.` : ''}`);
md.push('');
md.push(`_Generated ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC${runUrl ? ` · [run log](${runUrl})` : ''}. A ✅ means every automated check for that row passed; it does not replace the phone checklist in docs/testing/phone-checklist.md._`);
md.push('');
md.push('## By product workflow');
md.push('');
md.push('| Workflow | Status | Unit tests | Database tests | Two users at once | Known failures |');
md.push('|---|---|---|---|---|---|');
for (const w of workflows) {
  md.push(`| ${w.title} | ${icon(w.ok, w.ran)} | ${n(w.unit.passed)} / ${n(w.unit.passed + w.unit.failed)} | ${n(w.db.passed)} / ${n(w.db.passed + w.db.failed + w.db.known)} | ${n(w.concurrency.passed)} / ${n(w.concurrency.passed + w.concurrency.failed + w.concurrency.known)} | ${n(w.known)} |`);
}
if (unmapped.length) md.push(`| Other checks | ${icon(unmapped.every((f) => unitByFile.get(f).failed === 0))} | ${unmapped.reduce((a, f) => a + unitByFile.get(f).passed, 0)} / ${unmapped.reduce((a, f) => a + unitByFile.get(f).passed + unitByFile.get(f).failed, 0)} | – | – | – |`);
md.push('');
md.push('## Suites');
md.push('');
md.push('| Suite | Result | Passed | Failed | Known failures | Note |');
md.push('|---|---|---|---|---|---|');
for (const s of suites) md.push(`| ${s.title} | ${icon(s.ok, s.ran)} | ${n(s.passed)} | ${n(s.failed)} | ${n(s.known)} | ${s.note ?? ''} |`);
md.push('');

if (failures.length) {
  md.push('## ❌ Failures');
  md.push('');
  for (const f of failures) {
    md.push(`- **${f.suite}** · \`${f.where}\` · ${f.test}`);
    if (f.detail) md.push(`\n  \`\`\`\n  ${f.detail.split('\n').slice(0, 12).join('\n  ')}\n  \`\`\``);
  }
  md.push('');
}

md.push('## Known failures (real bugs, recorded on purpose, app code not changed)');
md.push('');
if (knownFailures.length === 0) md.push('_None._');
else {
  const byReason = new Map();
  for (const k of knownFailures) { const list = byReason.get(k.reason) ?? []; list.push(k); byReason.set(k.reason, list); }
  for (const [reason, list] of byReason) {
    md.push(`- **${reason}**`);
    for (const k of list) md.push(`  - ${k.suite} · \`${k.where}\` · ${k.test}`);
  }
}
md.push('');

md.push('<details><summary>Per-file breakdown</summary>');
md.push('');
md.push('| File | Passed | Failed | Known failures |');
md.push('|---|---|---|---|');
for (const [f, r] of [...unitByFile.entries()].sort()) md.push(`| rummy-home3/${f} | ${r.passed} | ${r.failed} | – |`);
for (const [f, r] of pgtapFiles) md.push(`| rummy-home3/supabase/tests/${f} | ${r.passed} | ${r.failed} | ${r.known} |`);
if (rollbacks.tests.length) { const t = tally(rollbacks.tests); md.push(`| ci/db/replay-rollbacks.sh | ${t.passed} | ${t.failed} | ${t.known} |`); }
if (conc.tests.length) { const t = tally(conc.tests); md.push(`| ci/db/concurrency-save-round.mjs | ${t.passed} | ${t.failed} | ${t.known} |`); }
md.push('');
md.push('</details>');
md.push('');
md.push('_How to read this: the top table is the one to look at. Each row is one of the nine workflows from the phone checklist. "Unit tests" are the node:test checks of the app logic; "Database tests" are pgTAP checks run as different signed-in users against a fresh local copy of the database; "Two users at once" are two real connections racing each other. Known failures are listed, never hidden, and do not turn the run red._');

const markdown = md.join('\n');
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'report.md'), markdown);
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ overall, ref, sha, generatedAt: new Date().toISOString(), workflows, suites, failures, knownFailures }, null, 2));
if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
console.log(markdown);
process.exit(overall === 'PASS' ? 0 : 1);

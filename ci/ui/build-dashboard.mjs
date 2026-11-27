/**
 * The test dashboard Sree opens from his PC (PR 17, C): a static site on the gh-pages branch.
 *
 *   node ci/ui/build-dashboard.mjs <artifacts-dir> <site-dir>
 *
 *   artifacts-dir   every downloaded ui-* artifact of this run (ui-<slug>-<device>-<suite>/<set>/...)
 *   site-dir        the gh-pages checkout; this run is added under runs/<run-id>/ and the index rebuilt
 *
 * Per run: one page with every device × suite table, screenshots inline, videos for the flows that
 * kept one (failures always; the chaos suite always), crash lines, and links to the GitHub run.
 * The index lists the last 15 runs (older run folders are pruned) and, while anything is running,
 * polls the public Actions API every 60 s so he can watch jobs go green from the browser; each
 * running job links to its live log on GitHub. Nothing secret is on the page: the repo is public and
 * the API calls are unauthenticated reads.
 *
 * Env: GITHUB_RUN_ID, GITHUB_RUN_NUMBER, GITHUB_REPOSITORY, GITHUB_SERVER_URL, GITHUB_SHA, GITHUB_REF_NAME,
 *      GITHUB_EVENT_NAME, GITHUB_HEAD_REF, PR_NUMBER, SELECT_TIER, SELECT_REASON, KEEP_RUNS (default 15)
 */
import fs from 'node:fs';
import path from 'node:path';

const ART = path.resolve(process.argv[2] ?? 'ci/out/ui-all');
const SITE = path.resolve(process.argv[3] ?? 'site');
const RUN_ID = process.env.GITHUB_RUN_ID ?? String(Date.now());
const RUN_NUMBER = process.env.GITHUB_RUN_NUMBER ?? '';
const REPO = process.env.GITHUB_REPOSITORY ?? 'sreeatcandorps/RummyHome';
const SERVER = process.env.GITHUB_SERVER_URL ?? 'https://github.com';
const RUN_URL = `${SERVER}/${REPO}/actions/runs/${RUN_ID}`;
const SHA = (process.env.GITHUB_SHA ?? '').slice(0, 7);
const BRANCH = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || '';
const EVENT = process.env.GITHUB_EVENT_NAME ?? '';
const PR = process.env.PR_NUMBER ?? '';
const TIER = process.env.SELECT_TIER ?? '';
const REASON = process.env.SELECT_REASON ?? '';
const KEEP = Number(process.env.KEEP_RUNS ?? 15);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// A job's colour: its suite's status file(s). A PR smoke shard ("smoke-a") writes smoke.status, and full.status when
// the selected full flows ran after it; both must be 0.
function jobStatus(dir, suite) {
  const base = suite.replace(/^(smoke)-[a-z]$/, '$1');
  const names = base === 'smoke' ? ['smoke', 'full'] : [suite];
  const found = names.map((n) => path.join(dir, `${n}.status`)).filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, 'utf8').trim());
  if (found.length === 0) return null;
  return found.every((v) => v === '0') ? '0' : '1';
}

// ---------- collect this run --------------------------------------------------------------------
const jobs = [];
if (fs.existsSync(ART)) {
  for (const art of fs.readdirSync(ART).sort()) {
    const dir = path.join(ART, art);
    if (!fs.statSync(dir).isDirectory()) continue;
    const m = art.match(/-(pixel6|pixel4a|pixel7pro|tablet|small)-([a-z-]+)$/);
    const device = m?.[1] ?? 'device';
    const suite = m?.[2] ?? 'suite';
    const SET_ORDER = ['smoke', 'full', 'chaos', 'roles', 'two-device', 'monkey', 'known-bugs'];
    const sets = [];
    for (const set of fs.readdirSync(dir).sort((a, b) => (SET_ORDER.indexOf(a) + 1 || 99) - (SET_ORDER.indexOf(b) + 1 || 99))) {
      const sdir = path.join(dir, set);
      const csv = path.join(sdir, 'results.csv');
      if (!fs.existsSync(csv)) continue;
      const flows = fs.readFileSync(csv, 'utf8').split('\n').filter(Boolean).map((l) => {
        const [name, result, secs] = l.split(',');
        return { name, ok: result === 'pass', secs: Number(secs) || 0 };
      });
      const crashes = fs.existsSync(path.join(sdir, 'crashes.csv'))
        ? fs.readFileSync(path.join(sdir, 'crashes.csv'), 'utf8').split('\n').filter(Boolean).map((l) => { const p = l.split(','); return { flow: p[0], kind: p[1], detail: p.slice(2).join(',') }; })
        : [];
      const screens = fs.existsSync(path.join(sdir, 'screens')) ? fs.readdirSync(path.join(sdir, 'screens')).filter((f) => f.endsWith('.png')).sort() : [];
      const videos = fs.existsSync(path.join(sdir, 'videos')) ? fs.readdirSync(path.join(sdir, 'videos')).filter((f) => f.endsWith('.mp4')).sort() : [];
      sets.push({ set, flows, crashes, screens, videos, src: sdir });
    }
    const status = jobStatus(dir, suite);
    jobs.push({ artifact: art, device, suite, sets, status });
  }
}

const total = jobs.flatMap((j) => j.sets.filter((s) => s.set !== 'known-bugs').flatMap((s) => s.flows));
const failed = total.filter((f) => !f.ok).length;
const crashes = jobs.flatMap((j) => j.sets.flatMap((s) => s.crashes.map((c) => ({ ...c, device: j.device, set: s.set }))));

// ---------- copy media into the site ----------------------------------------------------------
const runDir = path.join(SITE, 'runs', RUN_ID);
fs.rmSync(runDir, { recursive: true, force: true });
fs.mkdirSync(runDir, { recursive: true });
for (const j of jobs) {
  for (const s of j.sets) {
    const dest = path.join(runDir, `${j.device}-${j.suite}`, s.set);
    fs.mkdirSync(path.join(dest, 'screens'), { recursive: true });
    for (const f of s.screens) fs.copyFileSync(path.join(s.src, 'screens', f), path.join(dest, 'screens', f));
    if (s.videos.length) {
      fs.mkdirSync(path.join(dest, 'videos'), { recursive: true });
      for (const f of s.videos) fs.copyFileSync(path.join(s.src, 'videos', f), path.join(dest, 'videos', f));
    }
    if (s.crashes.length && fs.existsSync(path.join(s.src, 'crashes'))) {
      fs.mkdirSync(path.join(dest, 'crashes'), { recursive: true });
      for (const f of fs.readdirSync(path.join(s.src, 'crashes'))) fs.copyFileSync(path.join(s.src, 'crashes', f), path.join(dest, 'crashes', f));
    }
    if (fs.existsSync(path.join(s.src, 'monkey.log'))) fs.copyFileSync(path.join(s.src, 'monkey.log'), path.join(dest, 'monkey.log'));
  }
}

// ---------- run page ----------------------------------------------------------------------------
const CSS = `
body{font:14px/1.45 system-ui,sans-serif;margin:0;background:#f6f7f5;color:#1f2a24}
header{background:#1b4d3e;color:#fff;padding:14px 24px} header h1{margin:0;font-size:18px} header a{color:#cfe9dc}
main{padding:16px 24px;max-width:1500px} h2{font-size:16px;margin:28px 0 8px;border-bottom:1px solid #d8ddd9;padding-bottom:4px}
h3{font-size:14px;margin:18px 0 6px}
table{border-collapse:collapse;background:#fff;margin:6px 0 12px} td,th{border:1px solid #dfe3e0;padding:4px 10px;text-align:left;font-size:13px}
.pass{color:#1b7f3b;font-weight:600} .fail{color:#b00020;font-weight:700} .skip{color:#777} .run{color:#b26a00;font-weight:600}
.pill{display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;margin-right:6px}
.pill.ok{background:#dff3e6;color:#1b7f3b} .pill.bad{background:#fde0e3;color:#b00020} .pill.live{background:#fff1d6;color:#9a5b00}
.grid{display:flex;flex-wrap:wrap;gap:10px} figure{margin:0;background:#fff;border:1px solid #e1e5e2;border-radius:8px;padding:6px}
figure img{max-height:360px;max-width:100%;border-radius:4px;display:block;background:#000} figcaption{font-size:11px;color:#555;margin-top:4px;max-width:200px;word-break:break-all}
video{max-height:360px;border-radius:4px;background:#000}
.muted{color:#667} code{background:#eef1ee;padding:1px 4px;border-radius:3px} .crash{background:#fff4f4;border-left:4px solid #b00020;padding:6px 10px;margin:6px 0}
#live table{width:100%} .dot{display:inline-block;width:10px;height:10px;border-radius:5px;margin-right:6px;background:#aaa}
.dot.in_progress,.dot.queued{background:#e0a100;animation:p 1.2s infinite} .dot.success{background:#1b7f3b} .dot.failure{background:#b00020}
@keyframes p{50%{opacity:.3}}
`;

function pageHead(title, sub) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style>
<header><h1>EZ Score — device tests</h1><div>${sub}</div></header><main>`;
}

const when = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const runTitle = `Run #${RUN_NUMBER || RUN_ID} · ${BRANCH}${PR ? ` · PR #${PR}` : ''} · ${TIER || EVENT}`;
const page = [pageHead(runTitle, `<a href="../../">← all runs</a> · <a href="${RUN_URL}">this run on GitHub</a> · ${esc(when)} · <code>${esc(SHA)}</code>`)];
page.push(`<p><span class="pill ${failed || crashes.length ? 'bad' : 'ok'}">${total.length - failed}/${total.length} flows passed</span>${crashes.length ? `<span class="pill bad">${crashes.length} crash/ANR</span>` : ''}<span class="muted">${esc(REASON)}</span></p>`);
if (crashes.length) {
  page.push('<h2>Crashes and freezes</h2>');
  for (const c of crashes) page.push(`<div class="crash"><b>${esc(c.kind.toUpperCase())}</b> in <code>${esc(c.set)}/${esc(c.flow)}</code> on ${esc(c.device)}<br><span class="muted">${esc(c.detail)}</span></div>`);
}
for (const j of jobs) {
  page.push(`<h2>${esc(j.device)} · ${esc(j.suite)} ${j.status === null ? '' : j.status === '0' ? '<span class="pill ok">green</span>' : '<span class="pill bad">red</span>'}</h2>`);
  if (j.sets.length === 0) page.push('<p class="muted">No results (the job did not get as far as running flows — see the GitHub log).</p>');
  for (const s of j.sets) {
    const passed = s.flows.filter((f) => f.ok).length;
    page.push(`<h3>${esc(s.set)}${s.set === 'known-bugs' ? ' <span class="muted">(quarantined)</span>' : ''} — ${passed}/${s.flows.length}</h3>`);
    page.push('<table><tr><th>Flow</th><th>Result</th><th>Time</th><th>Video</th></tr>');
    for (const f of s.flows) {
      const video = s.videos.find((v) => v === `${f.name}.mp4`);
      const rel = `${j.device}-${j.suite}/${s.set}`;
      page.push(`<tr><td><code>${esc(f.name)}</code></td><td class="${f.ok ? 'pass' : 'fail'}">${f.ok ? 'pass' : 'FAIL'}</td><td>${f.secs}s</td><td>${video ? `<a href="${rel}/videos/${esc(video)}">▶ watch</a>` : ''}</td></tr>`);
    }
    page.push('</table>');
    if (s.screens.length) {
      page.push('<div class="grid">');
      for (const f of s.screens) page.push(`<figure><a href="${j.device}-${j.suite}/${s.set}/screens/${esc(f)}"><img loading="lazy" src="${j.device}-${j.suite}/${s.set}/screens/${esc(f)}" alt="${esc(f)}"></a><figcaption>${esc(f)}</figcaption></figure>`);
      page.push('</div>');
    }
    const failVideos = s.videos.filter((v) => s.flows.some((f) => !f.ok && v === `${f.name}.mp4`));
    if (failVideos.length) {
      page.push('<div class="grid">');
      for (const v of failVideos) page.push(`<figure><video controls preload="metadata" src="${j.device}-${j.suite}/${s.set}/videos/${esc(v)}"></video><figcaption>${esc(v)}</figcaption></figure>`);
      page.push('</div>');
    }
  }
}
page.push('</main></html>');
fs.writeFileSync(path.join(runDir, 'index.html'), page.join('\n'));

// ---------- history + index ------------------------------------------------------------------
const histPath = path.join(SITE, 'runs.json');
let history = [];
try { history = JSON.parse(fs.readFileSync(histPath, 'utf8')); } catch { history = []; }
history = history.filter((r) => String(r.id) !== String(RUN_ID));
history.unshift({
  id: RUN_ID, number: RUN_NUMBER, when, branch: BRANCH, pr: PR, sha: SHA, tier: TIER || EVENT, url: RUN_URL,
  passed: total.length - failed, total: total.length, crashes: crashes.length,
  jobs: jobs.map((j) => ({ device: j.device, suite: j.suite, ok: j.status === '0' })),
});
history = history.slice(0, KEEP);
for (const d of fs.existsSync(path.join(SITE, 'runs')) ? fs.readdirSync(path.join(SITE, 'runs')) : []) {
  if (!history.some((r) => String(r.id) === d)) fs.rmSync(path.join(SITE, 'runs', d), { recursive: true, force: true });
}
fs.writeFileSync(histPath, JSON.stringify(history, null, 1));

const index = [pageHead('EZ Score — device tests', `<a href="${SERVER}/${REPO}/actions/workflows/ci.yml">Actions</a> · <a href="${SERVER}/${REPO}/issues?q=is%3Aissue+label%3Afound-by-tests">bugs found by tests</a> · <a href="${SERVER}/${REPO}/blob/${esc(BRANCH || 'main')}/rummy-home3/docs/test-plan/README.md">test plan</a>`)];
index.push(`<h2>Live now</h2><div id="live"><p class="muted">Loading the last workflow runs from GitHub…</p></div>`);
index.push('<h2>Finished runs</h2><table><tr><th>Run</th><th>When</th><th>Branch / PR</th><th>Tier</th><th>Flows</th><th>Crashes</th><th>Jobs</th></tr>');
for (const r of history) {
  const jobsHtml = r.jobs.map((j) => `<span class="${j.ok ? 'pass' : 'fail'}">${esc(j.device)}·${esc(j.suite)}</span>`).join(' &nbsp; ');
  index.push(`<tr><td><a href="runs/${esc(r.id)}/">#${esc(r.number || r.id)}</a> <span class="muted"><code>${esc(r.sha)}</code></span></td><td>${esc(r.when)}</td><td>${esc(r.branch)}${r.pr ? ` · <a href="${SERVER}/${REPO}/pull/${esc(r.pr)}">PR #${esc(r.pr)}</a>` : ''}</td><td>${esc(r.tier)}</td><td class="${r.passed === r.total ? 'pass' : 'fail'}">${r.passed}/${r.total}</td><td class="${r.crashes ? 'fail' : ''}">${r.crashes}</td><td>${jobsHtml}</td></tr>`);
}
index.push('</table>');
index.push(`<p class="muted">Built ${esc(when)}. Each run keeps its screenshots and the videos of failing / chaos flows for the last ${KEEP} runs. Every run here used a throw-away local Supabase on the runner — never the live project.</p>`);
index.push(`<script>
const REPO=${JSON.stringify(REPO)};
const live=document.getElementById('live');
async function poll(){
  try{
    const r=await fetch('https://api.github.com/repos/'+REPO+'/actions/runs?per_page=12',{headers:{accept:'application/vnd.github+json'}});
    if(!r.ok) throw new Error('GitHub API '+r.status);
    const d=await r.json();
    const runs=d.workflow_runs.filter(x=>x.name==='CI');
    const rows=[];
    for(const x of runs.slice(0,8)){
      const st=x.status==='completed'?x.conclusion:x.status;
      let jobsHtml='';
      if(x.status!=='completed'){
        try{
          const j=await (await fetch(x.jobs_url+'?per_page=50')).json();
          jobsHtml=(j.jobs||[]).map(k=>'<div><span class="dot '+(k.status==='completed'?k.conclusion:k.status)+'"></span><a href="'+k.html_url+'">'+k.name+'</a> <span class="muted">'+(k.status==='completed'?k.conclusion:k.status)+(k.steps?' · '+((k.steps.find(s=>s.status==='in_progress')||{}).name||''):'')+'</span></div>').join('');
        }catch(e){}
      }
      rows.push('<tr><td><span class="dot '+st+'"></span><a href="'+x.html_url+'">#'+x.run_number+'</a></td><td>'+(x.head_branch||'')+'</td><td>'+x.event+'</td><td class="'+(st==='success'?'pass':st==='failure'?'fail':'run')+'">'+st+'</td><td>'+new Date(x.run_started_at||x.created_at).toLocaleString()+'</td><td>'+jobsHtml+'</td></tr>');
    }
    const anyLive=runs.some(x=>x.status!=='completed');
    live.innerHTML='<table><tr><th>Run</th><th>Branch</th><th>Trigger</th><th>Status</th><th>Started</th><th>Jobs (while running)</th></tr>'+rows.join('')+'</table><p class="muted">'+(anyLive?'Something is running — this list refreshes every 60 s. Click a job for its live log.':'Nothing running right now. Refreshes every 60 s.')+'</p>';
  }catch(e){ live.innerHTML='<p class="muted">Could not reach the GitHub API ('+e.message+'). The finished runs below are still current.</p>'; }
}
poll(); setInterval(poll,60000);
</script>`);
index.push('</main></html>');
fs.writeFileSync(path.join(SITE, 'index.html'), index.join('\n'));
fs.writeFileSync(path.join(SITE, '.nojekyll'), '');

console.log(`dashboard: run ${RUN_ID} — ${total.length - failed}/${total.length} flows, ${crashes.length} crash(es), ${jobs.length} job(s); ${history.length} runs kept`);

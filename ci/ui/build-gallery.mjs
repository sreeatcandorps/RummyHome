/**
 * Turns the output of ci/ui/run-flows.sh into something a person can read:
 *
 *   <out>/ui/<set>/results.csv      flow,pass|fail,seconds
 *   <out>/ui/<set>/screens/*.png    screenshots the flows took (and <flow>--FAILED.png)
 *
 * Writes
 *   <out>/ui/summary.md    pass/fail table per set + screenshot list (job summary and PR comment)
 *   <out>/ui/index.html    gallery: one card per screenshot, grouped by set, with the light / dark /
 *                          landscape variants of the same screen side by side; open from the artifact
 *
 *   node ci/ui/build-gallery.mjs [outDir]      (default ci/out)
 *
 * Exits 0 always; the runner script already decided pass/fail for the job.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(process.argv[2] ?? path.join(here, '..', 'out'));
const UI = path.join(OUT, 'ui');
const SETS = ['smoke', 'full', 'known-bugs'];

const sets = [];
for (const set of SETS) {
  const dir = path.join(UI, set);
  const csv = path.join(dir, 'results.csv');
  if (!fs.existsSync(csv)) continue;
  const flows = fs
    .readFileSync(csv, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [name, result, secs] = l.split(',');
      return { name, ok: result === 'pass', secs: Number(secs) || 0 };
    });
  const screensDir = path.join(dir, 'screens');
  const screens = fs.existsSync(screensDir)
    ? fs.readdirSync(screensDir).filter((f) => f.endsWith('.png')).sort()
    : [];
  sets.push({ set, flows, screens });
}

// ---------- markdown ---------------------------------------------------------------------------
const md = [];
md.push('## Device UI tests (Maestro, Android emulator)', '');
if (sets.length === 0) {
  md.push('_No UI results found under `ci/out/ui`._');
} else {
  for (const { set, flows, screens } of sets) {
    const passed = flows.filter((f) => f.ok).length;
    const label = set === 'known-bugs' ? 'known-bugs (quarantined: red until the fixing PR lands)' : set;
    md.push(`### ${label} — ${passed}/${flows.length} flows passed`, '');
    md.push('| Flow | Result | Time |', '|---|---|---|');
    for (const f of flows) md.push(`| \`${f.name}\` | ${f.ok ? 'pass' : '**FAIL**'} | ${f.secs}s |`);
    md.push('');
    if (screens.length) {
      md.push(`<details><summary>${screens.length} screenshots</summary>`, '');
      for (const s of screens) md.push(`- \`ui/${set}/screens/${s}\``);
      md.push('', '</details>', '');
    }
  }
  md.push(
    'Screenshots are in the `ui-screenshots-*` artifact of this run; open `ui/index.html` inside it for the gallery.',
    '',
  );
}
fs.mkdirSync(UI, { recursive: true });
fs.writeFileSync(path.join(UI, 'summary.md'), md.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md.join('\n') + '\n');

// ---------- html gallery -----------------------------------------------------------------------
// Group "60b-home-dark.png", "01-home.png" and "03-scorecard-4p-landscape.png" style names by the
// screen they show so the variants sit next to each other.
function screenKey(file) {
  return file
    .replace(/\.png$/, '')
    .replace(/^\d+[a-z]?-/, '')
    .replace(/-(dark|landscape|FAILED)/g, '')
    .replace(/--$/, '');
}
function variant(file) {
  if (file.includes('--FAILED')) return 'failed';
  if (file.includes('-landscape')) return 'landscape';
  if (file.includes('-dark')) return 'dark';
  return 'light';
}
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const html = [];
html.push(`<!doctype html><meta charset="utf-8"><title>EZ Score device UI screenshots</title>
<style>
body{font:14px system-ui,sans-serif;margin:24px;background:#fafafa;color:#222}
h1{font-size:20px} h2{font-size:16px;margin-top:32px;border-bottom:1px solid #ddd;padding-bottom:4px}
table{border-collapse:collapse;margin:8px 0 16px} td,th{border:1px solid #ddd;padding:4px 8px;text-align:left}
.fail{color:#b00020;font-weight:600} .pass{color:#1b7f3b}
.screen{margin:16px 0;padding:12px;background:#fff;border:1px solid #e5e5e5;border-radius:8px}
.screen h3{margin:0 0 8px;font-size:14px}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start}
figure{margin:0} figcaption{font-size:12px;color:#666;margin-top:4px}
img{max-height:520px;max-width:100%;border:1px solid #ccc;border-radius:6px;background:#000}
</style>
<h1>EZ Score — device UI screenshots</h1>
<p>Maestro flows on a Pixel 6 / API 34 emulator. Light is the default; dark and landscape variants sit beside the same screen when the set has them.</p>`);
for (const { set, flows, screens } of sets) {
  const passed = flows.filter((f) => f.ok).length;
  html.push(`<h2>${esc(set)} — ${passed}/${flows.length} flows passed</h2>`);
  html.push('<table><tr><th>Flow</th><th>Result</th><th>Time</th></tr>');
  for (const f of flows) {
    html.push(
      `<tr><td><code>${esc(f.name)}</code></td><td class="${f.ok ? 'pass' : 'fail'}">${f.ok ? 'pass' : 'FAIL'}</td><td>${f.secs}s</td></tr>`,
    );
  }
  html.push('</table>');
  const groups = new Map();
  for (const s of screens) {
    const key = screenKey(s);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  for (const [key, files] of groups) {
    html.push(`<div class="screen"><h3>${esc(key)}</h3><div class="row">`);
    for (const f of files) {
      html.push(
        `<figure><img loading="lazy" src="${esc(set)}/screens/${esc(f)}" alt="${esc(f)}"><figcaption>${esc(variant(f))} · ${esc(f)}</figcaption></figure>`,
      );
    }
    html.push('</div></div>');
  }
}
fs.writeFileSync(path.join(UI, 'index.html'), html.join('\n'));
console.log(md.join('\n'));

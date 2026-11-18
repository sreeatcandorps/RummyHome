#!/usr/bin/env node
// Builds docs/flows: inventory, flow pages (Mermaid), matrices (md + csv), coverage summary.
// Run from rummy-home3/:  node docs/flows/build.mjs   (then render PNGs with mmdc, see README)
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCREENS, POPUPS, WARNINGS, EMAILS, REDIRECT_ROUTES } from './data/inventory.mjs';
import { FLOWS, MAP } from './data/flows.mjs';
import { REQUIREMENTS } from './data/requirements.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..'); // rummy-home3
const REPO = join(APP, '..');
const OUT = HERE;

// ---------- last results (links) ----------
const RUN_PR = 'https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240';
const RUN_DOCS = 'https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374';
const RUN_NIGHTLY = 'https://github.com/sreeatcandorps/RummyHome/actions/runs/43733029118';
const KNOWN_FAIL = new Set([
  'e2e/chaos/c10-pool-everyone-out.yaml', 'e2e/chaos/c12-logout-dead-session--revoke-session.yaml',
  'e2e/two-device/t1-a-expect.yaml', 'e2e/two-device/b-save-now.yaml',
  'e2e/full/10-sign-out-bad-passcode.yaml', 'e2e/full/21-scorecard-font-scale.yaml', 'e2e/full/40-results-save-and-past.yaml',
  'e2e/full/41-share-images.yaml', 'e2e/full/70-game-log.yaml', 'e2e/full/80-add-round-count-warnings.yaml',
]);
function lastResult(path) {
  const type = testType(path);
  if (type === 'full') return KNOWN_FAIL.has(path) ? `[fail · nightly Nov 15 on stale PR 19 branch](${RUN_NIGHTLY})` : `[pass · nightly Nov 15 (stale PR 19 branch)](${RUN_NIGHTLY})`;
  if (['smoke', 'roles', 'chaos', 'two-device'].includes(type)) return KNOWN_FAIL.has(path) ? `[fail · non-blocking, PR run 9817239](${RUN_PR})` : `[pass · PR run 9817239](${RUN_PR})`;
  if (type === 'lib') return `[pass (shared piece) · PR run 9817239](${RUN_PR})`;
  if (type === 'volume') return '[manual Nov 12 · docs/volume-testing.md](../volume-testing.md)';
  return `[pass · run 6a262d2](${RUN_DOCS})`;
}
function testType(path) {
  if (path.startsWith('e2e/')) return path.split('/')[1];
  if (path.startsWith('tests/')) return 'unit';
  if (path.startsWith('supabase/tests/')) return 'pgTAP';
  if (path.includes('concurrency')) return 'concurrency';
  if (path.includes('monkey')) return 'monkey';
  if (path.startsWith('ci/volume')) return 'volume';
  return 'other';
}
const TEST_TYPES = ['unit', 'pgTAP', 'concurrency', 'smoke', 'full', 'roles', 'chaos', 'two-device', 'monkey', 'volume'];

// ---------- validation ----------
const ITEMS = [...SCREENS, ...POPUPS, ...WARNINGS, ...EMAILS];
const byId = new Map(ITEMS.map((i) => [i.id, i]));
const errors = [];
for (const f of FLOWS) {
  for (const n of f.nodes) if (n.ref && !byId.has(n.ref)) errors.push(`${f.id}: unknown ref ${n.ref}`);
  const keys = new Set(f.nodes.map((n) => n.k));
  for (const [a, b] of f.edges) for (const k of [a, b]) if (!keys.has(k)) errors.push(`${f.id}: edge uses unknown node ${k}`);
  for (const s of f.scenarios) for (const t of s.tests) if (!existsSync(join(t.startsWith('ci/') ? REPO : APP, t))) errors.push(`${s.id}: missing test ${t}`);
  for (const r of f.requirements) if (!REQUIREMENTS.find((x) => x.id === r)) errors.push(`${f.id}: unknown requirement ${r}`);
}
for (const r of REQUIREMENTS) for (const i of r.items) if (!byId.has(i)) errors.push(`${r.id}: unknown item ${i}`);
for (const p of [...POPUPS, ...WARNINGS]) for (const s of p.screens) if (!byId.has(s)) errors.push(`${p.id}: unknown screen ${s}`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

// ---------- test corpus ----------
function listFiles(dir, filter) {
  const abs = join(APP, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).filter(filter).map((f) => `${dir}/${f}`).sort();
}
const SKIP_UNIT = new Set(['tests/e2e-flows.test.ts', 'tests/test-selection-pr17.test.ts']);
const corpus = [
  ...['smoke', 'full', 'roles', 'chaos', 'two-device'].flatMap((d) => listFiles(`e2e/${d}`, (f) => f.endsWith('.yaml'))),
  ...listFiles('tests', (f) => f.endsWith('.test.ts')).filter((p) => !SKIP_UNIT.has(p)),
  ...listFiles('supabase/tests', (f) => f.endsWith('.sql')),
  'ci/db/concurrency-save-round.mjs', 'ci/chaos/monkey.sh',
].map((p) => ({ path: p, type: testType(p), text: readFileSync(join(p.startsWith('ci/') ? REPO : APP, p), 'utf8') }));

function touches(item) {
  return corpus.filter((c) => item.signals.some((s) => c.text.includes(s))).map((c) => c.path);
}
for (const i of ITEMS) {
  i.tests = touches(i);
  i.flows = FLOWS.filter((f) => f.nodes.some((n) => n.ref === i.id)).map((f) => f.id);
}
// A test that touches a pop-up / warning also touches its host screen.
for (const p of [...POPUPS, ...WARNINGS]) for (const s of p.screens) byId.get(s).tests = [...new Set([...byId.get(s).tests, ...p.tests])];

// ---------- helpers ----------
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '0%');
const esc = (s) => String(s).replace(/"/g, '#quot;').replace(/\|/g, '/');
const csvCell = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
const csv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
const link = (p) => `[\`${p.replace(/^e2e\//, '').replace(/^tests\//, '').replace(/^supabase\/tests\//, 'pgTAP/')}\`](../../../${p.startsWith('ci/') ? '../' : ''}${p})`;
const linkFromRoot = (p) => `[\`${p}\`](../../${p.startsWith('ci/') ? '../' : ''}${p})`;
const kindOf = (id) => (id.startsWith('S') ? 'screen' : id.startsWith('P') ? 'popup' : id.startsWith('W') ? 'warning' : 'email');
const short = (s, n = 64) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const slug = (f) => `${f.id}-${f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
const GAP = '<span style="color:#c62828">**GAP**</span>';

// ---------- mermaid ----------
function mermaid(flow) {
  const lines = ['%%{init: {"flowchart": {"wrappingWidth": 230, "nodeSpacing": 30, "rankSpacing": 40}, "themeVariables": {"fontSize": "14px"}}}%%', 'flowchart TD'];
  for (const n of flow.nodes) {
    let label, cls;
    if (n.ref) {
      const it = byId.get(n.ref);
      label = `${it.id} ${short(it.name)}`;
      cls = it.tests.length ? kindOf(it.id) : 'gap';
    } else { label = n.label; cls = n.type === 'end' ? 'stop' : n.type; }
    const l = esc(label);
    const shape = n.ref
      ? kindOf(n.ref) === 'screen' ? `["${l}"]` : kindOf(n.ref) === 'popup' ? `(["${l}"])` : kindOf(n.ref) === 'warning' ? `[/"${l}"/]` : `[["${l}"]]`
      : n.type === 'decision' ? `{"${l}"}` : n.type === 'end' ? `(("${l}"))` : n.type === 'flow' ? `[["${l}"]]` : n.type === 'screen' ? `["${l}"]` : `("${l}")`;
    lines.push(`  ${n.k}${shape}:::${cls}`);
  }
  for (const [a, b, lab] of flow.edges) lines.push(lab ? `  ${a} -->|"${esc(lab)}"| ${b}` : `  ${a} --> ${b}`);
  lines.push(
    '  classDef screen fill:#e3f2fd,stroke:#1565c0,color:#0d2c54',
    '  classDef popup fill:#fff8e1,stroke:#f9a825,color:#4e3a00',
    '  classDef warning fill:#f3e5f5,stroke:#6a1b9a,color:#2e0b40',
    '  classDef email fill:#e8f5e9,stroke:#2e7d32,color:#0b3d12',
    '  classDef step fill:#ffffff,stroke:#616161,color:#212121',
    '  classDef decision fill:#fafafa,stroke:#616161,color:#212121',
    '  classDef stop fill:#eeeeee,stroke:#424242,color:#212121',
    '  classDef flow fill:#e3f2fd,stroke:#1565c0,color:#0d2c54',
    '  classDef gap fill:#fde2e2,stroke:#c62828,color:#7f0000,stroke-width:2px',
  );
  return lines.join('\n');
}

// ---------- outputs ----------
for (const d of ['mmd', 'png', 'flows', 'csv']) mkdirSync(join(OUT, d), { recursive: true });

// map
writeFileSync(join(OUT, 'mmd', 'F00-map.mmd'), mermaid(MAP) + '\n');

// flows
const flowPages = [];
for (const f of FLOWS) {
  const name = slug(f);
  writeFileSync(join(OUT, 'mmd', `${name}.mmd`), mermaid(f) + '\n');
  const items = f.nodes.filter((n) => n.ref).map((n) => byId.get(n.ref));
  const gaps = items.filter((i) => !i.tests.length);
  const rows = f.scenarios.map((s) => `| ${s.id} | ${s.kind} | ${s.text} | ${s.tests.length ? s.tests.map(link).join(' · ') : GAP} |`);
  const md = [
    `# ${f.id} — ${f.name}`, '',
    `Requirements: ${f.requirements.join(', ')} · Screens / pop-ups / warnings in this flow: ${items.length} · untested (red): ${gaps.length}${gaps.length ? ' — ' + gaps.map((g) => g.id).join(', ') : ''}`, '',
    `![${f.id}](../png/${name}.png)`, '',
    '```mermaid', mermaid(f), '```', '',
    '## Scenarios', '', '| # | Kind | Scenario | Tests |', '| --- | --- | --- | --- |', ...rows, '',
    '## Nodes', '', '| ID | Name | File | Tests touching it |', '| --- | --- | --- | --- |',
    ...items.map((i) => `| ${i.id} | ${i.name} | \`${i.file}\` | ${i.tests.length ? i.tests.length : GAP} |`), '',
  ].join('\n');
  writeFileSync(join(OUT, 'flows', `${name}.md`), md);
  flowPages.push({ f, name, items, gaps });
}

// inventory.md
const invRows = (list, extra) => list.map((i) => `| ${i.id} | ${i.name} | \`${i.file}\` |${extra ? ` ${extra(i)} |` : ''} ${i.flows.length ? i.flows.join(' ') : GAP} | ${i.tests.length ? i.tests.length : GAP} |`);
writeFileSync(join(OUT, 'inventory.md'), [
  '# Screen, pop-up and warning inventory (from code)', '',
  `Screens **${SCREENS.length}** (+ ${REDIRECT_ROUTES.length} redirect-only routes) · Pop-ups **${POPUPS.length}** · Warnings **${WARNINGS.length}** · Emails **${EMAILS.length}**. "Tests" = number of test files whose text contains one of the item's signals (see \`data/inventory.mjs\`).`, '',
  '## Screens', '', '| ID | Screen | File | Route | Flows | Tests |', '| --- | --- | --- | --- | --- | --- |',
  ...invRows(SCREENS, (i) => `\`${i.route}\``), '',
  '### Redirect-only / flagged-off routes (not counted)', '', '| File | Goes to |', '| --- | --- |', ...REDIRECT_ROUTES.map((r) => `| \`${r.file}\` | ${r.to} |`), '',
  '## Pop-ups (dialogs, sheets, menus, toasts, modals)', '', '| ID | Pop-up | File | Kind · host screens | Flows | Tests |', '| --- | --- | --- | --- | --- | --- |',
  ...invRows(POPUPS, (i) => `${i.kind} · ${i.screens.join(' ')}`), '',
  '## Warnings, errors, banners, tags', '', '| ID | Warning | File | Kind · host screens | Flows | Tests |', '| --- | --- | --- | --- | --- | --- |',
  ...invRows(WARNINGS, (i) => `${i.kind} · ${i.screens.join(' ')}`), '',
  '## Emails', '', '| ID | Email | File | Trigger | Flows | Tests |', '| --- | --- | --- | --- | --- | --- |',
  ...invRows(EMAILS, (i) => i.trigger), '',
].join('\n'));

// matrices
const scrPop = [...SCREENS, ...POPUPS, ...WARNINGS];
const flowIds = FLOWS.map((f) => f.id);
const mA = [['Requirement', 'Text', 'Source', 'Screens / pop-ups / warnings', 'Untested among them']].concat(REQUIREMENTS.map((r) => [r.id, r.text, r.source, r.items.join(' '), r.items.filter((i) => !byId.get(i).tests.length).join(' ')]));
const mB = [['ID', 'Name', ...flowIds, 'In no flow']].concat(scrPop.map((i) => [i.id, i.name, ...flowIds.map((f) => (i.flows.includes(f) ? 'x' : '')), i.flows.length ? '' : 'FLAG']));
const mC = [['ID', 'Name', ...TEST_TYPES, 'Total', 'Untouched']].concat(scrPop.map((i) => [i.id, i.name, ...TEST_TYPES.map((t) => i.tests.filter((p) => testType(p) === t).length || ''), i.tests.length, i.tests.length ? '' : 'FLAG']));
const mD = [['Scenario', 'Kind', 'Flow', 'Requirements', 'Screens / pop-ups', 'Scenario text', 'Test file', 'Test type', 'Last result']];
for (const f of FLOWS) for (const s of f.scenarios) {
  const screens = f.nodes.filter((n) => n.ref).map((n) => n.ref).join(' ');
  if (!s.tests.length) mD.push([s.id, s.kind, f.id, f.requirements.join(' '), screens, s.text, 'GAP', '', '']);
  for (const t of s.tests) mD.push([s.id, s.kind, f.id, f.requirements.join(' '), screens, s.text, t, testType(t), lastResult(t).replace(/\[([^\]]+)\]\(([^)]+)\)/, '$1 $2')]);
}
const mE = [['ID', 'Kind', 'Name', 'Host screens', 'Flows', 'Trigger', 'Tests']].concat([...POPUPS, ...WARNINGS].map((i) => [i.id, i.kind, i.name, i.screens.join(' '), i.flows.join(' ') || 'NONE', i.trigger, i.tests.length]));
writeFileSync(join(OUT, 'csv', 'a-requirements.csv'), csv(mA));
writeFileSync(join(OUT, 'csv', 'b-screen-x-flow.csv'), csv(mB));
writeFileSync(join(OUT, 'csv', 'c-screen-x-test.csv'), csv(mC));
writeFileSync(join(OUT, 'csv', 'd-scenario-traceability.csv'), csv(mD));
writeFileSync(join(OUT, 'csv', 'e-warnings-triggers.csv'), csv(mE));

const mdTable = (rows, mark = (v) => v) => [`| ${rows[0].join(' | ')} |`, `| ${rows[0].map(() => '---').join(' | ')} |`, ...rows.slice(1).map((r) => `| ${r.map((v) => mark(String(v))).join(' | ')} |`)].join('\n');
const flag = (v) => (v === 'FLAG' || v === 'GAP' || v === 'NONE' ? GAP : v);
writeFileSync(join(OUT, 'matrices.md'), [
  '# Traceability matrices', '', 'CSV twins in `csv/`. Red = no flow / no test.', '',
  '## a. Requirements → spec section → screens / pop-ups', '', mdTable(mA.map((r, i) => (i ? [r[0], r[1], r[2].startsWith('http') ? `[link](${r[2]})` : `[${r[2].split('#')[0].replace('../', '')}](${r[2]})`, r[3], r[4] ? `<span style="color:#c62828">${r[4]}</span>` : ''] : r))), '',
  '## b. Screen / pop-up / warning × flow', '', mdTable(mB, flag), '',
  '## c. Screen / pop-up / warning × test type (number of test files)', '', mdTable(mC, flag), '',
  '## d. Scenario → flow → requirement → screens → test file → last result', '',
  mdTable(mD.map((r, i) => (i ? [r[0], r[1], r[2], r[3], r[4], r[5], r[6] === 'GAP' ? GAP : linkFromRoot(r[6]), r[7], r[6] === 'GAP' ? '' : lastResult(r[6])] : r))), '',
  '## e. Every pop-up and warning: flow + trigger', '', mdTable(mE, flag), '',
].join('\n'));

// README (summary + coverage matrix + gaps)
const touchedFlow = (l) => l.filter((i) => i.flows.length).length;
const touchedTest = (l) => l.filter((i) => i.tests.length).length;
const cov = [['Flow', ...TEST_TYPES, 'Scenarios', 'GAP scenarios']].concat(FLOWS.map((f) => {
  const tests = f.scenarios.flatMap((s) => s.tests);
  return [`[${f.id}](flows/${slug(f)}.md) ${f.name}`, ...TEST_TYPES.map((t) => new Set(tests.filter((p) => testType(p) === t)).size || ''), f.scenarios.length, f.scenarios.filter((s) => !s.tests.length).length || ''];
}));
const totals = ['**Total**', ...TEST_TYPES.map((t) => new Set(FLOWS.flatMap((f) => f.scenarios.flatMap((s) => s.tests)).filter((p) => testType(p) === t)).size), FLOWS.reduce((a, f) => a + f.scenarios.length, 0), FLOWS.reduce((a, f) => a + f.scenarios.filter((s) => !s.tests.length).length, 0)];
cov.push(totals);
const gapItems = scrPop.filter((i) => !i.tests.length);
const noFlow = scrPop.filter((i) => !i.flows.length);
const gapScen = FLOWS.flatMap((f) => f.scenarios.filter((s) => !s.tests.length).map((s) => `${s.id} ${s.text}`));
const untestedReq = REQUIREMENTS.filter((r) => r.items.every((i) => !byId.get(i).tests.length));
writeFileSync(join(OUT, 'README.md'), [
  '# User flows & scenarios (PR 23)', '',
  'One Mermaid flowchart per flow (boxes = screens / steps, diamonds = decisions, every arrow a path), nodes labelled with the IDs from [`inventory.md`](inventory.md); **red node = no test touches it**. Under each flow: numbered scenarios (happy / edge / misuse) with the tests that cover them or GAP. Matrices a–e in [`matrices.md`](matrices.md) and `csv/`. Generated by `node docs/flows/build.mjs` from `data/*.mjs`; PNGs by `mmdc` (see the foot of this page).', '',
  '## Summary', '',
  `| | Count | Touched by a flow | Touched by a test |`, `| --- | --- | --- | --- |`,
  `| Screens | ${SCREENS.length} | ${touchedFlow(SCREENS)} (${pct(touchedFlow(SCREENS), SCREENS.length)}) | ${touchedTest(SCREENS)} (${pct(touchedTest(SCREENS), SCREENS.length)}) |`,
  `| Pop-ups | ${POPUPS.length} | ${touchedFlow(POPUPS)} (${pct(touchedFlow(POPUPS), POPUPS.length)}) | ${touchedTest(POPUPS)} (${pct(touchedTest(POPUPS), POPUPS.length)}) |`,
  `| Warnings | ${WARNINGS.length} | ${touchedFlow(WARNINGS)} (${pct(touchedFlow(WARNINGS), WARNINGS.length)}) | ${touchedTest(WARNINGS)} (${pct(touchedTest(WARNINGS), WARNINGS.length)}) |`,
  `| Emails | ${EMAILS.length} | ${touchedFlow(EMAILS)} (${pct(touchedFlow(EMAILS), EMAILS.length)}) | ${touchedTest(EMAILS)} (${pct(touchedTest(EMAILS), EMAILS.length)}) |`,
  `| Requirements | ${REQUIREMENTS.length} | — | ${REQUIREMENTS.length - untestedReq.length} (${pct(REQUIREMENTS.length - untestedReq.length, REQUIREMENTS.length)}) |`,
  `| Scenarios | ${totals[TEST_TYPES.length + 1]} | ${FLOWS.length} flows | ${totals[TEST_TYPES.length + 1] - totals[TEST_TYPES.length + 2]} (${pct(totals[TEST_TYPES.length + 1] - totals[TEST_TYPES.length + 2], totals[TEST_TYPES.length + 1])}) |`, '',
  `Redirect-only routes (not counted): ${REDIRECT_ROUTES.length}. Test corpus scanned: ${corpus.length} files (${TEST_TYPES.map((t) => `${t} ${corpus.filter((c) => c.type === t).length}`).filter((s) => !s.endsWith(' 0')).join(', ')}).`, '',
  '"Touched by a test" = some test file names one of the item\'s signals (testID, copy, helper); a pop-up or warning touched also counts for its host screen. It says a test *reaches* the item, not that every branch is asserted — the scenario GAP list below is the stricter view.', '',
  '## Map', '', '![Map](png/F00-map.png)', '', '```mermaid', mermaid(MAP), '```', '',
  '## Coverage matrix (flow × test type = distinct test files tagged in that flow\'s scenarios)', '', mdTable(cov), '',
  '## GAP list', '',
  `### Screens / pop-ups / warnings no test touches (${gapItems.length})`, '', ...gapItems.map((i) => `- ${GAP} ${i.id} ${i.name} — \`${i.file}\` — flows: ${i.flows.join(' ') || 'none'}`), '',
  `### In no flow (${noFlow.length})`, '', ...(noFlow.length ? noFlow.map((i) => `- ${i.id} ${i.name}`) : ['- none']), '',
  `### Scenarios without a test (${gapScen.length})`, '', ...gapScen.map((s) => `- ${GAP} ${s}`), '',
  `### Requirements with no touched item (${untestedReq.length})`, '', ...(untestedReq.length ? untestedReq.map((r) => `- ${r.id} ${r.text}`) : ['- none']), '',
  '## Flows', '', ...flowPages.map(({ f, name, items, gaps }) => `- [${f.id} ${f.name}](flows/${name}.md) — ${f.scenarios.length} scenarios, ${items.length} nodes, ${gaps.length ? `${gaps.length} red` : 'no red'} · [PNG](png/${name}.png)`), '',
  '## Legend', '', 'Blue box = screen (S) · yellow stadium = pop-up (P) · purple slant = warning (W) · green double box = email (E) · white = step · diamond = decision · **red = no test touches it**.', '',
  '## Rebuild', '', '```bash', 'cd rummy-home3 && node docs/flows/build.mjs', 'for f in docs/flows/mmd/*.mmd; do mmdc -i "$f" -o "docs/flows/png/$(basename "${f%.mmd}").png" -b white -s 2; done', '```', '',
  'Related: PR 16 planning tables in [`../test-plan/`](../test-plan/) (W-codes there were pre-build estimates; this folder is the code-enumerated set). Test codes per PR live in [`../testing-strategy.md`](../testing-strategy.md).', '',
].join('\n'));

console.log(`screens ${SCREENS.length} popups ${POPUPS.length} warnings ${WARNINGS.length} emails ${EMAILS.length}; red items ${gapItems.length}; gap scenarios ${gapScen.length}; no-flow ${noFlow.length}; corpus ${corpus.length}`);

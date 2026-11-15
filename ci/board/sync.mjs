#!/usr/bin/env node
// Board sync — keeps the RummyHome project board (user-owned Projects v2) in step with the PRs and
// issues, so nobody has to update a page by hand. Rules: ci/board/rules.mjs. Run by
// .github/workflows/board-sync.yml on PR / issue / CI events and every two hours; by hand:
//
//   PROJECT_TOKEN=… node ci/board/sync.mjs --reconcile [--dry-run]     every open PR and issue + every card
//   PROJECT_TOKEN=… node ci/board/sync.mjs --pr 68                      one PR
//   PROJECT_TOKEN=… node ci/board/sync.mjs --issue 57                   one issue
//
// Env: PROJECT_TOKEN (required; never printed), PROJECT_OWNER (default sreeatcandorps), PROJECT_NUMBER
// (default 1), GITHUB_REPOSITORY (default sreeatcandorps/RummyHome). Inside Actions, GITHUB_EVENT_NAME +
// GITHUB_EVENT_PATH pick the mode. No dependencies: Node 20 fetch + GraphQL.
import { readFileSync, appendFileSync } from 'node:fs';
import { checksState, issueStatus, noteFor, prStatus, STATUS } from './rules.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const DRY = flag('--dry-run');

const TOKEN = process.env.PROJECT_TOKEN;
if (!TOKEN) {
  console.error('::error title=PROJECT_TOKEN missing::Add a repository secret named PROJECT_TOKEN (Settings › Secrets and variables › Actions › New repository secret) — a personal access token with project read/write and repo read. See ci/board/README.md.');
  process.exit(1);
}
const PROJECT_OWNER = process.env.PROJECT_OWNER || 'sreeatcandorps';
const PROJECT_NUMBER = Number(process.env.PROJECT_NUMBER || 1);
const [REPO_OWNER, REPO_NAME] = (process.env.GITHUB_REPOSITORY || 'sreeatcandorps/RummyHome').split('/');

const changes = [];
const log = (s) => console.log(s);

async function gql(query, variables = {}) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `bearer ${TOKEN}`, 'content-type': 'application/json', 'user-agent': 'rummyhome-board-sync' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors) {
    const msg = (json.errors ?? []).map((e) => e.message).join('; ') || `HTTP ${res.status}`;
    throw new Error(`GraphQL: ${msg}`);
  }
  return json.data;
}

// ---------- the board ----------
async function loadProject() {
  const fields = `fields(first: 50) { nodes {
    ... on ProjectV2SingleSelectField { id name dataType options { id name } }
    ... on ProjectV2Field { id name dataType }
  } }`;
  const q = `query($owner: String!, $n: Int!) {
    user(login: $owner) { projectV2(number: $n) { id title ${fields} } }
  }`;
  let data;
  try {
    data = await gql(q, { owner: PROJECT_OWNER, n: PROJECT_NUMBER });
  } catch (e) {
    throw new Error(`cannot read project ${PROJECT_OWNER}/projects/${PROJECT_NUMBER} — does PROJECT_TOKEN have the "project" scope? (${e.message})`);
  }
  const p = data?.user?.projectV2;
  if (!p) throw new Error(`project ${PROJECT_OWNER}/projects/${PROJECT_NUMBER} not found or not visible to PROJECT_TOKEN`);
  const status = p.fields.nodes.find((f) => f?.name?.toLowerCase() === 'status' && f.options);
  if (!status) throw new Error('the board has no single-select field named "Status"');
  const options = {};
  for (const want of Object.values(STATUS)) {
    const o = status.options.find((x) => x.name.trim().toLowerCase() === want.toLowerCase());
    if (!o) throw new Error(`Status option "${want}" is missing on the board (have: ${status.options.map((x) => x.name).join(', ')})`);
    options[want] = o.id;
  }
  const note = p.fields.nodes.find((f) => f?.name?.toLowerCase() === 'note' && f.dataType === 'TEXT') ?? null;
  log(`board: ${p.title} · Status options ok${note ? ' · Note field present' : ' · no Note field (skipping notes)'}`);
  return { id: p.id, statusFieldId: status.id, options, noteFieldId: note?.id ?? null };
}

async function ensureItem(project, contentId) {
  if (DRY) {
    const d = await gql(`query($pid: ID!, $cid: ID!) { node(id: $cid) { ... on PullRequest { projectItems(first: 20) { nodes { id project { id } } } } ... on Issue { projectItems(first: 20) { nodes { id project { id } } } } } }`, { pid: project.id, cid: contentId });
    return d.node?.projectItems?.nodes?.find((n) => n.project.id === project.id)?.id ?? null;
  }
  const d = await gql(`mutation($pid: ID!, $cid: ID!) { addProjectV2ItemById(input: { projectId: $pid, contentId: $cid }) { item { id } } }`, { pid: project.id, cid: contentId });
  return d.addProjectV2ItemById.item.id;
}

async function readItem(itemId) {
  const d = await gql(`query($id: ID!) { node(id: $id) { ... on ProjectV2Item {
    status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
    note: fieldValueByName(name: "Note") { ... on ProjectV2ItemFieldTextValue { text } }
  } } }`, { id: itemId });
  return { status: d.node?.status?.name ?? null, note: d.node?.note?.text ?? null };
}

async function setStatus(project, itemId, status) {
  if (DRY) return;
  await gql(`mutation($pid: ID!, $iid: ID!, $fid: ID!, $oid: String!) {
    updateProjectV2ItemFieldValue(input: { projectId: $pid, itemId: $iid, fieldId: $fid, value: { singleSelectOptionId: $oid } }) { projectV2Item { id } } }`,
    { pid: project.id, iid: itemId, fid: project.statusFieldId, oid: project.options[status] });
}

async function setNote(project, itemId, text) {
  if (DRY || !project.noteFieldId) return;
  await gql(`mutation($pid: ID!, $iid: ID!, $fid: ID!, $text: String!) {
    updateProjectV2ItemFieldValue(input: { projectId: $pid, itemId: $iid, fieldId: $fid, value: { text: $text } }) { projectV2Item { id } } }`,
    { pid: project.id, iid: itemId, fid: project.noteFieldId, text });
}

async function place(project, kind, number, contentId, status, note) {
  const itemId = await ensureItem(project, contentId);
  const current = itemId ? await readItem(itemId) : { status: null, note: null };
  const label = `${kind} #${number}`;
  if (!itemId) { changes.push(`${label}: add → ${status}${note ? ` · note "${note}"` : ''}`); log(`  ${label}: (dry) would add → ${status}`); return; }
  if (current.status !== status) {
    await setStatus(project, itemId, status);
    changes.push(`${label}: ${current.status ?? '(new)'} → ${status}`);
    log(`  ${label}: ${current.status ?? '(new)'} → ${status}`);
  } else log(`  ${label}: ${status} (unchanged)`);
  if (note && project.noteFieldId && current.note !== note) {
    await setNote(project, itemId, note);
    changes.push(`${label}: note "${note}"`);
    log(`  ${label}: note "${note}"`);
  }
}

// ---------- PRs and issues ----------
const PR_FIELDS = `id number title state merged isDraft body labels(first: 30) { nodes { name } }
  commits(last: 1) { nodes { commit { statusCheckRollup { contexts(first: 100) { nodes {
    __typename ... on CheckRun { name status conclusion } ... on StatusContext { context state } } } } } } }`;

async function syncPr(project, number) {
  const d = await gql(`query($o: String!, $r: String!, $n: Int!) { repository(owner: $o, name: $r) { pullRequest(number: $n) { ${PR_FIELDS} } } }`,
    { o: REPO_OWNER, r: REPO_NAME, n: number });
  const pr = d.repository.pullRequest;
  if (!pr) { log(`  PR #${number}: not found`); return; }
  const labels = pr.labels.nodes.map((l) => l.name);
  const checks = checksState(pr.commits.nodes[0]?.commit?.statusCheckRollup?.contexts?.nodes ?? []);
  const status = prStatus({ state: pr.state, merged: pr.merged, isDraft: pr.isDraft, labels, title: pr.title, checks });
  const note = noteFor({ state: pr.state, merged: pr.merged, body: pr.body });
  log(`PR #${number} "${pr.title.slice(0, 60)}" · ${pr.state.toLowerCase()}${pr.isDraft ? ' draft' : ''} · checks ${checks} → ${status}`);
  await place(project, 'PR', number, pr.id, status, note);
}

async function syncIssue(project, number) {
  const d = await gql(`query($o: String!, $r: String!, $n: Int!) { repository(owner: $o, name: $r) { issue(number: $n) { id number title state labels(first: 30) { nodes { name } } } } }`,
    { o: REPO_OWNER, r: REPO_NAME, n: number });
  const is = d.repository.issue;
  if (!is) { log(`  issue #${number}: not found`); return; }
  const status = issueStatus({ state: is.state, labels: is.labels.nodes.map((l) => l.name) });
  log(`issue #${number} "${is.title.slice(0, 60)}" · ${is.state.toLowerCase()} → ${status}`);
  await place(project, 'issue', number, is.id, status, null);
}

async function prsForCommit(sha) {
  const d = await gql(`query($o: String!, $r: String!, $oid: GitObjectID!) { repository(owner: $o, name: $r) { object(oid: $oid) { ... on Commit { associatedPullRequests(first: 10) { nodes { number state } } } } } }`,
    { o: REPO_OWNER, r: REPO_NAME, oid: sha });
  return (d.repository.object?.associatedPullRequests?.nodes ?? []).filter((p) => p.state === 'OPEN').map((p) => p.number);
}

async function listAll(kind) {
  const out = [];
  let after = null;
  for (;;) {
    const d = await gql(`query($o: String!, $r: String!, $after: String) { repository(owner: $o, name: $r) { ${kind}(states: OPEN, first: 100, after: $after) { nodes { number } pageInfo { hasNextPage endCursor } } } }`,
      { o: REPO_OWNER, r: REPO_NAME, after });
    const page = d.repository[kind];
    out.push(...page.nodes.map((n) => n.number));
    if (!page.pageInfo.hasNextPage) return out;
    after = page.pageInfo.endCursor;
  }
}

async function listBoard(project) {
  const prs = new Set(); const issues = new Set();
  let after = null;
  for (;;) {
    const d = await gql(`query($id: ID!, $after: String) { node(id: $id) { ... on ProjectV2 { items(first: 100, after: $after) { nodes { content { __typename ... on PullRequest { number repository { nameWithOwner } } ... on Issue { number repository { nameWithOwner } } } } pageInfo { hasNextPage endCursor } } } } }`,
      { id: project.id, after });
    const page = d.node.items;
    for (const n of page.nodes) {
      const c = n.content;
      if (!c || c.repository?.nameWithOwner?.toLowerCase() !== `${REPO_OWNER}/${REPO_NAME}`.toLowerCase()) continue;
      (c.__typename === 'PullRequest' ? prs : issues).add(c.number);
    }
    if (!page.pageInfo.hasNextPage) return { prs, issues };
    after = page.pageInfo.endCursor;
  }
}

async function reconcile(project) {
  const onBoard = await listBoard(project);
  const prs = new Set([...onBoard.prs, ...(await listAll('pullRequests'))]);
  const issues = new Set([...onBoard.issues, ...(await listAll('issues'))]);
  log(`reconcile: ${prs.size} PRs, ${issues.size} issues (board + open)`);
  for (const n of [...prs].sort((a, b) => a - b)) await syncPr(project, n);
  for (const n of [...issues].sort((a, b) => a - b)) await syncIssue(project, n);
}

// ---------- mode ----------
async function main() {
  const project = await loadProject();
  const event = process.env.GITHUB_EVENT_NAME;
  const payload = process.env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) : {};

  if (flag('--reconcile') || event === 'schedule' || event === 'workflow_dispatch') await reconcile(project);
  else if (opt('--pr')) await syncPr(project, Number(opt('--pr')));
  else if (opt('--issue')) await syncIssue(project, Number(opt('--issue')));
  else if (event === 'pull_request_target' || event === 'pull_request') await syncPr(project, payload.pull_request.number);
  else if (event === 'issues') await syncIssue(project, payload.issue.number);
  else if (event === 'workflow_run') {
    const sha = payload.workflow_run?.head_sha;
    const numbers = sha ? await prsForCommit(sha) : [];
    log(`workflow_run "${payload.workflow_run?.name}" ${payload.workflow_run?.conclusion} on ${String(sha).slice(0, 7)} → PRs ${numbers.join(', ') || 'none'}`);
    for (const n of numbers) await syncPr(project, n);
  } else {
    log(`nothing to do for event "${event ?? '(none)'}" — use --reconcile, --pr N or --issue N`);
  }

  const summary = changes.length ? changes.map((c) => `- ${c}`).join('\n') : '- no changes';
  log(`\n${DRY ? 'DRY RUN — planned' : 'changes'}:\n${summary}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Board sync${DRY ? ' (dry run)' : ''}\n${summary}\n`);
}

main().catch((e) => {
  console.error(`::error title=Board sync failed::${String(e.message ?? e).replace(/bearer \S+/gi, 'bearer ***')}`);
  process.exit(1);
});

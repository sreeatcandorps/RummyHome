/**
 * "What changed since this PR's last green device run?" — the input of the rule that skips the emulators for a push
 * that only brings docs (a rebase onto a main with new notes, a fix to the PR's own write-up). See ci/select-tests.mjs
 * (`sinceGreenFiles`) and rummy-home3/docs/testing-today.md.
 *
 *   node ci/since-green.mjs        (the `select` job: needs GH_TOKEN, GITHUB_REPOSITORY, BRANCH, HEAD_SHA, RUN_ID)
 *
 * Finds the newest earlier successful pull_request run of ci.yml on this branch whose device jobs (`ui-…smoke…`) all
 * passed, takes the PR head it ran on, and writes `git diff --name-only <that head> <this head>` to $SINCE_OUT
 * (default ci/out/since-files.txt). It writes NOTHING when there is no such run, when the old head cannot be fetched
 * (force-pushed away), or when anything fails: no file means "run the device plan as usual". Never a reason to skip
 * unless it is certain.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** A run's jobs count as a green device run when a smoke job ran and every `ui-` job passed. */
export function isGreenDeviceRun(jobs) {
  const ui = (jobs ?? []).filter((j) => /^ui-/.test(j.name));
  return ui.some((j) => /smoke/.test(j.name)) && ui.every((j) => j.conclusion === 'success');
}

/**
 * runs: newest first, each { id, head_sha }. jobsFor(id) → the run's jobs [{ name, conclusion }].
 * Returns the head sha of the newest run (other than `currentRunId`) with a green device run, or null.
 */
export function lastGreenHead(runs, jobsFor, currentRunId = null, limit = 15) {
  for (const run of (runs ?? []).filter((r) => String(r.id) !== String(currentRunId)).slice(0, limit)) {
    if (isGreenDeviceRun(jobsFor(run.id))) return run.head_sha;
  }
  return null;
}

function gh(args) {
  return JSON.parse(execFileSync('gh', ['api', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
}

function main() {
  const { GITHUB_REPOSITORY: repo, BRANCH: branch, HEAD_SHA: head, RUN_ID: runId } = process.env;
  const out = process.env.SINCE_OUT || 'ci/out/since-files.txt';
  if (!repo || !branch || !head) { console.log('since-green: no repo / branch / head: nothing to compare'); return; }
  try {
    const runs = gh([`repos/${repo}/actions/workflows/ci.yml/runs?event=pull_request&status=success&per_page=30&branch=${encodeURIComponent(branch)}`]).workflow_runs;
    const sha = lastGreenHead(runs, (id) => gh([`repos/${repo}/actions/runs/${id}/jobs?per_page=100`]).jobs, runId);
    if (!sha) { console.log('since-green: no earlier green device run on this branch'); return; }
    try { execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { stdio: 'ignore' }); } catch {
      execFileSync('git', ['fetch', '--no-tags', '--quiet', 'origin', sha], { stdio: 'inherit' });
    }
    const files = execFileSync('git', ['diff', '--name-only', sha, head], { encoding: 'utf8' }).split('\n').filter(Boolean);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, files.join('\n'));
    console.log(`since-green: last green device run was on ${sha.slice(0, 7)}; ${files.length} file(s) differ now${files.length ? `: ${files.slice(0, 8).join(', ')}${files.length > 8 ? ', …' : ''}` : ''}`);
  } catch (e) {
    console.log(`since-green: could not compare (${String(e.message ?? e).split('\n')[0]}); the device plan runs as usual`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main();

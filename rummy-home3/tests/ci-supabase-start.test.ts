import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Nov 26: #149's and #151's database jobs lost every start to "failed to bind host port 0.0.0.0:54322/tcp:
// address already in use", and the Docker restarts did not free it. ci/supabase-start.sh now moves the database
// to a free port and hands the URL on; these runs use fake supabase / docker / sudo commands.

const repo = path.resolve(process.cwd(), '..');
const script = path.join(repo, 'ci/supabase-start.sh');

function fakeBin(dir: string, name: string, body: string) {
  const p = path.join(dir, name);
  writeFileSync(p, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(p, 0o755);
}

function run(firstFailure: string) {
  const work = mkdtempSync(path.join(tmpdir(), 'sb-start-'));
  const bin = path.join(work, 'bin');
  mkdirSync(bin);
  mkdirSync(path.join(work, 'supabase'));
  copyFileSync(path.join(process.cwd(), 'supabase/config.toml'), path.join(work, 'supabase/config.toml'));
  const calls = path.join(work, 'starts');
  fakeBin(bin, 'supabase', [
    'if [ "$1" = start ]; then',
    `  n=$(cat "${calls}" 2>/dev/null || echo 0); echo $((n + 1)) > "${calls}"`,
    `  if [ "$n" = 0 ]; then echo '${firstFailure}'; exit 1; fi`,
    '  echo "Started supabase local development setup."; exit 0',
    'fi',
    'exit 0',
  ].join('\n'));
  fakeBin(bin, 'docker', 'exit 0');
  fakeBin(bin, 'sudo', 'exit 0');
  fakeBin(bin, 'ss', 'exit 0');
  fakeBin(bin, 'sleep', 'exit 0');
  const githubEnv = path.join(work, 'github_env');
  const urlFile = path.join(work, 'db-url');
  const out = execFileSync('bash', [script, '-x', 'studio'], {
    cwd: work,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, CI: '1', GITHUB_ENV: githubEnv, DB_URL_FILE: urlFile },
    encoding: 'utf8',
  });
  const config = readFileSync(path.join(work, 'supabase/config.toml'), 'utf8');
  const dbPort = /\[db\][^[]*?\nport = (\d+)/.exec(config)?.[1];
  return { out, config, dbPort, githubEnv: existsSync(githubEnv) ? readFileSync(githubEnv, 'utf8') : '', url: readFileSync(urlFile, 'utf8').trim() };
}

test('supabase-start: the database port held on the runner → the database moves, no Docker restart, the URL follows', () => {
  const r = run('failed to start docker container "supabase_db_ezscore-test": Error response from daemon: failed to set up container networking: driver failed programming external connectivity on endpoint supabase_db_ezscore-test (ae47): failed to bind host port 0.0.0.0:54322/tcp: address already in use');
  assert.ok(r.dbPort && r.dbPort !== '54322', `the [db] port moved (now ${r.dbPort})`);
  assert.match(r.config, /\nshadow_port = 54320/, 'shadow_port is left alone');
  assert.match(r.config, /\[api\][^[]*\nport = 54321/, 'the API port (baked into the test APK) is left alone');
  assert.equal(r.url, `postgresql://postgres:postgres@127.0.0.1:${r.dbPort}/postgres`);
  assert.equal(r.githubEnv.trim(), `DB_URL=${r.url}`);
  assert.match(r.out, /Database port moved/);
  assert.doesNotMatch(r.out, /restarting the Docker daemon/);
});

test('supabase-start: any other failure → Docker restart, the port stays, the URL is the default', () => {
  const r = run('failed to pull docker image: 504 Gateway Timeout');
  assert.equal(r.dbPort, '54322');
  assert.equal(r.url, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
  assert.equal(r.githubEnv.trim(), `DB_URL=${r.url}`);
  assert.match(r.out, /restarting the Docker daemon/);
});

test('ci.yml: no job sets DB_URL itself, and every step that starts the stack and uses $DB_URL reads it from the script', () => {
  const wf = readFileSync(path.join(repo, '.github/workflows/ci.yml'), 'utf8');
  assert.doesNotMatch(wf, /^\s+DB_URL: postgresql:\/\/postgres/m, 'a job-level DB_URL would shadow the one from $GITHUB_ENV');
  for (const step of wf.split(/\n\s+- (?:name|id): /)) {
    if (!step.includes('ci/supabase-start.sh -x') || !step.includes('$DB_URL')) continue;
    assert.match(step, /supabase-start\.sh[^\n]*\n\s+DB_URL=\$\(cat \/tmp\/ezscore-db-url\)/, `step "${step.split('\n')[0]}" reads the URL right after the start`);
  }
});

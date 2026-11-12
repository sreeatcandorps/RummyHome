/**
 * Screenshots of the web /r/ pages at each volume size (final launch batch, item 9).
 *
 * Serves rummy-home3/public/ on a local port with the __SUPABASE_URL__ / __SUPABASE_ANON_KEY__
 * tokens pointed at that same port, answers /rest/v1/rpc/public_scorecard and
 * /rest/v1/rpc/public_result from the payloads ci/volume/run-volume.mjs saved (the real RPC
 * output of the local database), and drives headless Chrome to take one PNG per size into
 * ci/out/volume/screenshots/. Nothing contacts the hosted project.
 *
 *   node ci/volume/screenshots.mjs           (after run-volume.mjs)
 *
 * Env: CHROME (default google-chrome), OUT (default ci/out/volume)
 */
import http from 'node:http';
import { readFileSync, readdirSync, mkdirSync, existsSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');
const PUBLIC = path.join(ROOT, 'rummy-home3', 'public');
const OUT = process.env.OUT ?? path.join(ROOT, 'ci', 'out', 'volume');
const PAYLOADS = path.join(OUT, 'payloads');
const SHOTS = path.join(OUT, 'screenshots');
const CHROME = process.env.CHROME ?? 'google-chrome';
mkdirSync(SHOTS, { recursive: true });

const payloads = new Map();
for (const file of readdirSync(PAYLOADS)) {
  if (!file.endsWith('.json')) continue;
  payloads.set(file.replace(/\.json$/, ''), JSON.parse(readFileSync(path.join(PAYLOADS, file), 'utf8')));
}
// The scorecard page only accepts a 48-hex token; one per payload, mapped back on the RPC route.
const tokenOf = (key) => Buffer.from(key).toString('hex').padEnd(48, '0').slice(0, 48);
const keyOfToken = new Map([...payloads.keys()].map((key) => [tokenOf(key), key]));

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    if (url.pathname === '/rest/v1/rpc/public_scorecard' || url.pathname === '/rest/v1/rpc/public_result') {
      const args = body ? JSON.parse(body) : {};
      const key = args.p_token ?? args.p_id ?? '';
      const data = payloads.get(keyOfToken.get(key) ?? key) ?? [...payloads.values()].find((v) => v && v.id === key) ?? null;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }
    let file = url.pathname === '/' ? '/index.html' : url.pathname;
    if (/^\/r\/?$/.test(file) || /^\/r\/[0-9a-f-]+$/i.test(file)) file = '/r/index.html';
    const abs = path.join(PUBLIC, file);
    if (!abs.startsWith(PUBLIC) || !existsSync(abs) || statSync(abs).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    const ext = path.extname(abs);
    let content = readFileSync(abs);
    if (ext === '.html') {
      content = Buffer.from(content.toString('utf8')
        .replaceAll('__SUPABASE_URL__', `http://127.0.0.1:${server.address().port}`)
        .replaceAll('__SUPABASE_ANON_KEY__', 'local-volume-test-key'));
    }
    res.writeHead(200, { 'Content-Type': types[ext] ?? 'application/octet-stream' });
    res.end(content);
  });
});

/** Chrome runs while this process keeps serving the page, so the spawn must not block the event loop. */
function run(cmd, args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (c) => { stderr += c; });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('close', (status) => { clearTimeout(timer); resolve({ status, stderr }); });
  });
}

async function shoot(url, file, { width = 1280, height = 1600 } = {}) {
  const t0 = performance.now();
  const profile = mkdtempSync(path.join(os.tmpdir(), 'ezscore-shot-'));
  const r = await run(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--user-data-dir=${profile}`, `--window-size=${width},${height}`, '--virtual-time-budget=4000', `--screenshot=${file}`, url,
  ], 15_000);
  rmSync(profile, { recursive: true, force: true });
  const ms = performance.now() - t0;
  const ok = existsSync(file) && statSync(file).size > 0;
  console.log(`${ok ? 'ok' : 'not ok'} - ${path.basename(file)} (${Math.round(ms)} ms incl. browser start)`);
  if (!ok) console.log(`# ${r.stderr.slice(0, 400)}`);
  return ok;
}

server.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  let failed = 0;
  const keys = [...payloads.keys()].sort();
  for (const key of keys) {
    const url = key.startsWith('scorecard-')
      ? `${base}/scorecard.html?t=${tokenOf(key)}`
      : `${base}/r/index.html?id=${encodeURIComponent(payloads.get(key)?.id ?? key)}`;
    // Results and the tallest scorecards are long pages: give them room so the whole table is in the PNG.
    const height = key.endsWith('-500r') ? 6000 : key.endsWith('-200r') ? 3200 : 1600;
    const file = path.join(SHOTS, `${key}.png`);
    if (!(await shoot(url, file, { width: key.startsWith('result-') ? 1400 : 1280, height }))) failed += 1;
  }
  server.close();
  process.exit(failed ? 1 : 0);
});

// A tiny DevTools-protocol client: one headless Chrome, many screenshots. No npm dependency
// (Node 22 has WebSocket built in), so `node docs/themes/build.mjs` runs on a bare checkout.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CANDIDATES = [process.env.CHROME, '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch() {
  const bin = CANDIDATES.find((p) => existsSync(p));
  if (!bin) throw new Error('No Chrome found. Set CHROME=/path/to/chrome.');
  const profile = mkdtempSync(join(tmpdir(), 'themes-chrome-'));
  const proc = spawn(bin, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--disable-dev-shm-usage', '--allow-file-access-from-files', '--font-render-hinting=none', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
  { stdio: 'ignore' });
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 200 && !existsSync(portFile); i++) await sleep(50);
  if (!existsSync(portFile)) { proc.kill('SIGKILL'); throw new Error('Chrome did not start.'); }
  const [port, path] = readFileSync(portFile, 'utf8').trim().split('\n');
  const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

  let nextId = 1;
  const pending = new Map();
  const waiters = [];
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
      return;
    }
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].method === msg.method && waiters[i].sessionId === msg.sessionId) waiters.splice(i, 1)[0].resolve(msg.params);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
  const once = (method, sessionId) => new Promise((resolve) => waiters.push({ method, sessionId, resolve }));

  /**
   * Screenshot `html` (a string) or `file` at `width` x `height` CSS px and `scale` device px per CSS px.
   * `fullPage` grows the height to the document's.
   */
  async function shot({ html, file, out, width, height, scale = 1, fullPage = false }) {
    let url = file ? pathToFileURL(file).href : null;
    let temp = null;
    if (html != null) {
      temp = join(profile, `page-${nextId}.html`);
      writeFileSync(temp, html);
      url = pathToFileURL(temp).href;
    }
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false }, sessionId);
    const loaded = once('Page.loadEventFired', sessionId);
    await send('Page.navigate', { url }, sessionId);
    await loaded;
    await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))', awaitPromise: true }, sessionId);
    let clipHeight = height;
    if (fullPage) {
      const { result } = await send('Runtime.evaluate', { expression: 'Math.ceil(document.documentElement.getBoundingClientRect().height)', returnByValue: true }, sessionId);
      clipHeight = result.value;
      await send('Emulation.setDeviceMetricsOverride', { width, height: clipHeight, deviceScaleFactor: scale, mobile: false }, sessionId);
    }
    const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: fullPage, clip: { x: 0, y: 0, width, height: clipHeight, scale: 1 } }, sessionId);
    writeFileSync(out, Buffer.from(data, 'base64'));
    await send('Target.closeTarget', { targetId });
    return { width: Math.round(width * scale), height: Math.round(clipHeight * scale) };
  }

  /** Run `expression` in a page made from `html` and return its JSON value (used to read pixels back). */
  async function evaluate({ html, expression, width = 800, height = 600 }) {
    const temp = join(profile, `eval-${nextId}.html`);
    writeFileSync(temp, html);
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
    const loaded = once('Page.loadEventFired', sessionId);
    await send('Page.navigate', { url: pathToFileURL(temp).href }, sessionId);
    await loaded;
    const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    await send('Target.closeTarget', { targetId });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  }

  async function close() {
    try { await send('Browser.close'); } catch { /* already gone */ }
    ws.close();
    await sleep(200);
    proc.kill('SIGKILL');
    rmSync(profile, { recursive: true, force: true });
  }

  return { shot, evaluate, close };
}

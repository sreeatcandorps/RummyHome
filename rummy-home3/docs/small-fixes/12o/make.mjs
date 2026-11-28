#!/usr/bin/env node
/**
 * Row 12o mockups (New game's players step with the keyboard up). Pictures only, not app code.
 *
 *   cd rummy-home3 && npm ci                  # the icon font comes from @expo/vector-icons
 *   node docs/small-fixes/12o/make.mjs        # every drawn frame
 *
 * Draws src/picker.html in headless Chrome at 3x: the small phone is 360 x 780 dp with text size 1.3
 * (1080 x 2340), the Pixel 6 is 412 x 915 dp (1236 x 2745). Roboto and playwright-core are fetched into .cache/
 * (not committed); NODE_MODULES=/path/to/rummy-home3/node_modules points at another checkout's icon font.
 *
 * Not drawn here: 1-today-small.png is the real CI frame 32-seating-13p--FAILED.png from run 46065162206
 * (artifact ui-cursor-seating-circle-build-f877-small-smoke-b). src/keyboard-small.png is that frame's keyboard
 * and nav bar (y 1406-2340); src/keyboard-pixel6.png is the Pixel 6 job's 26b-create-account-name-keyboard.png
 * (y 1500-2400) with its three suggestion words painted over in the strip's grey and its ✓ key replaced by the
 * small phone's search key (the picker's field is a search box).
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..', '..', '..');
const CACHE = path.join(HERE, '.cache');
const FONTS = path.join(CACHE, 'fonts');
const CHROME = process.env.CHROME || '/usr/local/bin/google-chrome';
mkdirSync(FONTS, { recursive: true });

const roboto = path.join(FONTS, 'Roboto.ttf');
if (!existsSync(roboto)) {
  const res = await fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/roboto/Roboto%5Bwdth,wght%5D.ttf');
  if (!res.ok) throw new Error(`Roboto: HTTP ${res.status}`);
  writeFileSync(roboto, Buffer.from(await res.arrayBuffer()));
}

const modules = process.env.NODE_MODULES || path.join(APP, 'node_modules');
const VECTOR = path.join(modules, '@expo/vector-icons/build/vendor/react-native-vector-icons');
if (!existsSync(VECTOR)) throw new Error('run `npm ci` in rummy-home3 first, or set NODE_MODULES (the icon font lives in node_modules)');
copyFileSync(path.join(VECTOR, 'Fonts/MaterialCommunityIcons.ttf'), path.join(FONTS, 'MaterialCommunityIcons.ttf'));
const glyphs = JSON.parse(readFileSync(path.join(VECTOR, 'glyphmaps/MaterialCommunityIcons.json'), 'utf8'));
const ICON_NAMES = [
  'arrow-left', 'help-circle-outline', 'information-outline', 'magnify', 'close', 'fire', 'sort-alphabetical-ascending',
  'account-plus-outline', 'database-search', 'arrow-right', 'arrow-down', 'chevron-down', 'wifi', 'signal',
  'battery-charging-high', 'triangle', 'circle', 'square-rounded',
];
const icons = Object.fromEntries(ICON_NAMES.map((n) => {
  if (glyphs[n] == null) throw new Error(`no such icon: ${n}`);
  return [n, glyphs[n]];
}));
writeFileSync(path.join(HERE, 'src/icons.js'), `// Written by make.mjs from @expo/vector-icons' MaterialCommunityIcons glyph map.\nwindow.ICONS = ${JSON.stringify(icons)};\n`);

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require(path.join(CACHE, 'node_modules/playwright-core')));
} catch {
  execFileSync('npm', ['i', '--prefix', CACHE, '--no-audit', '--no-fund', '--no-save', 'playwright-core@1.49.1'], { stdio: 'inherit' });
  ({ chromium } = require(path.join(CACHE, 'node_modules/playwright-core')));
}

const DEVICES = { small: { w: 360, h: 780 }, pixel6: { w: 412, h: 915 } };
const frames = [
  { name: '1-today-pixel6', dev: 'pixel6', s: 'today' },
  { name: '2-option-a-small', dev: 'small', s: 'a' },
  { name: '2-option-a-pixel6', dev: 'pixel6', s: 'a' },
  { name: '3-option-b-small', dev: 'small', s: 'b' },
  { name: '3-option-b-pixel6', dev: 'pixel6', s: 'b' },
  { name: '4-keyboard-closed-small', dev: 'small', s: 'closed' },
  { name: '4-keyboard-closed-pixel6', dev: 'pixel6', s: 'closed' },
  // Calibration only: the drawn "today" on the small phone, to lay over the real CI frame. Kept in .cache.
  { name: '.cache/calibrate-today-small', dev: 'small', s: 'today', calibrate: true },
];

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--font-render-hinting=none', '--allow-file-access-from-files'] });
let failed = false;
for (const f of frames) {
  const { w, h } = DEVICES[f.dev];
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 3 });
  const problems = [];
  page.on('pageerror', (e) => problems.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
  await page.goto(`${pathToFileURL(path.join(HERE, 'src/picker.html')).href}?${new URLSearchParams({ dev: f.dev, s: f.s })}`);
  await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => {}))]));
  if (f.calibrate) await page.evaluate(() => document.querySelector('.note')?.remove());
  const m = await page.evaluate(() => window.measure());
  await page.locator('#phone').screenshot({ path: path.join(HERE, `${f.name}.png`) });
  await page.close();
  // The fix has to put the one result fully above the keyboard (or, with it closed, above the bar).
  const limit = m.kbTop ?? m.bar.top;
  const resultClear = m.row.bottom <= Math.min(limit, m.bar.top);
  if (f.s !== 'today' && !resultClear) problems.push(`result row ends at ${m.row.bottom} dp, under ${Math.min(limit, m.bar.top)} dp`);
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${f.name}.png  strip ${m.strip.top}-${m.strip.bottom} · search ${m.search.top}-${m.search.bottom} · result ${m.row.top}-${m.row.bottom} · bar ${m.bar.top} · keyboard ${m.kbTop ?? '-'}`);
  for (const p of problems) console.log('     ', p);
  if (problems.length) failed = true;
}
await browser.close();
if (failed) process.exit(1);

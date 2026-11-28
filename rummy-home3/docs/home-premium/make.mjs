#!/usr/bin/env node
/**
 * Home, three premium directions (Sree, Nov 27 2026: "It doesn't feel premium … premium Indian colors,
 * Indian Bollywood"). Mockups only: nothing here is app code.
 *
 *   cd rummy-home3 && npm ci                 # the icon font and its glyph map come from @expo/vector-icons
 *   node docs/home-premium/make.mjs          # every frame and every sheet
 *   node docs/home-premium/make.mjs a-light  # only frames / sheets whose name contains "a-light"
 *
 * What it does: downloads the Google Fonts it needs and playwright-core into .cache/ (not committed), copies
 * the app's own icon font there, writes src/icons.js, opens home.html in headless Chrome at 3x (Pixel 6 =
 * 412 x 915 dp; the small phone = 360 x 780 dp with text size 1.3), then lays the frames out on the sheets with
 * sheet.html. It measures every text colour against its background and fails if one is under 4.5 : 1 or if any
 * text is cut. The today-*.png files are real CI screenshots and are not made here (see ../home-premium.md).
 *
 * To look at one frame by hand, open e.g. home.html?d=b&mode=dark&state=empty in Chrome
 * (d = a | b | c, mode = light | dark, state = games | empty | all, w, h, fs, tall=1).
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..', '..');
const CACHE = path.join(HERE, '.cache');
const FONTS = path.join(CACHE, 'fonts');
const CHROME = process.env.CHROME || '/usr/local/bin/google-chrome';
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const wanted = (name) => only.length === 0 || only.some((o) => name.includes(o));

mkdirSync(FONTS, { recursive: true });

// ---------- fonts (all free, Open Font License, from github.com/google/fonts) ----------
const GF = 'https://raw.githubusercontent.com/google/fonts/main/ofl/';
const FONT_FILES = {
  'Roboto.ttf': 'roboto/Roboto%5Bwdth,wght%5D.ttf',
  'DMSerifDisplay-Regular.ttf': 'dmserifdisplay/DMSerifDisplay-Regular.ttf',
  'YesevaOne-Regular.ttf': 'yesevaone/YesevaOne-Regular.ttf',
  'Poppins-SemiBold.ttf': 'poppins/Poppins-SemiBold.ttf',
};
for (const [file, src] of Object.entries(FONT_FILES)) {
  const to = path.join(FONTS, file);
  if (existsSync(to)) continue;
  const res = await fetch(GF + src);
  if (!res.ok) throw new Error(`font ${file}: HTTP ${res.status}`);
  writeFileSync(to, Buffer.from(await res.arrayBuffer()));
  console.log('font', file);
}

// ---------- the app's icons: MaterialCommunityIcons, the same glyphs react-native-paper draws ----------
const VECTOR = path.join(APP, 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons');
if (!existsSync(VECTOR)) throw new Error('run `npm ci` in rummy-home3 first (the icon font lives in node_modules)');
copyFileSync(path.join(VECTOR, 'Fonts/MaterialCommunityIcons.ttf'), path.join(FONTS, 'MaterialCommunityIcons.ttf'));
const glyphs = JSON.parse(readFileSync(path.join(VECTOR, 'glyphmaps/MaterialCommunityIcons.json'), 'utf8'));
const ICON_NAMES = [
  'plus', 'podium', 'account-group', 'information-outline', 'help-circle-outline', 'circle-medium', 'flag-checkered',
  'lock-outline', 'crown-outline', 'shield-account-outline', 'trophy-outline', 'account-multiple-outline', 'chevron-right',
  'chevron-down', 'home-variant', 'delete-outline', 'hand-wave-outline', 'account-alert-outline', 'link-variant',
  'wifi-strength-4', 'signal-cellular-3', 'battery-80', 'cards-spade', 'cards-heart', 'rhombus',
  'card-account-details-outline',
];
const icons = Object.fromEntries(ICON_NAMES.map((n) => {
  if (!glyphs[n]) throw new Error(`no such icon: ${n}`);
  return [n, glyphs[n]];
}));
writeFileSync(path.join(HERE, 'src/icons.js'), `// Written by make.mjs from @expo/vector-icons' MaterialCommunityIcons glyph map.\nwindow.ICONS = ${JSON.stringify(icons, null, 1)};\n`);

// ---------- headless Chrome through playwright-core (kept in .cache, never in package.json) ----------
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require(path.join(CACHE, 'node_modules/playwright-core')));
} catch {
  console.log('installing playwright-core into .cache …');
  execFileSync('npm', ['i', '--prefix', CACHE, '--no-audit', '--no-fund', '--no-save', 'playwright-core@1.49.1'], { stdio: 'inherit' });
  ({ chromium } = require(path.join(CACHE, 'node_modules/playwright-core')));
}

const PIXEL6 = { w: 412, h: 915, fs: 1 };
const SMALL = { w: 360, h: 780, fs: 1.3 };
/** The direction shown on the small phone: the recommended one. */
const SMALL_DIRECTION = 'a';

const frames = [];
for (const d of ['a', 'b', 'c']) {
  for (const mode of ['light', 'dark']) {
    for (const state of ['games', 'empty']) frames.push({ name: `${d}-${mode}-${state}`, d, mode, state, ...PIXEL6 });
  }
  frames.push({ name: `${d}-light-all`, d, mode: 'light', state: 'all', tall: 1, ...PIXEL6 });
}
for (const mode of ['light', 'dark']) {
  frames.push({ name: `${SMALL_DIRECTION}-${mode}-small-games`, d: SMALL_DIRECTION, mode, state: 'games', ...SMALL });
}
frames.push({ name: `${SMALL_DIRECTION}-light-small-empty`, d: SMALL_DIRECTION, mode: 'light', state: 'empty', ...SMALL });
frames.push({ name: `${SMALL_DIRECTION}-light-small-all`, d: SMALL_DIRECTION, mode: 'light', state: 'all', tall: 1, ...SMALL });

const SHEETS = ['overview', 'dark', 'empty', 'a', 'b', 'c', 'small', 'everything'];

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--font-render-hinting=none', '--allow-file-access-from-files'] });
const fileUrl = (file, params) => `${pathToFileURL(path.join(HERE, file)).href}?${new URLSearchParams(params)}`;
let failed = false;

for (const f of frames) {
  if (!wanted(f.name)) continue;
  const page = await browser.newPage({ viewport: { width: f.w, height: f.h }, deviceScaleFactor: 3 });
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(String(e)));
  await page.goto(fileUrl('home.html', { d: f.d, mode: f.mode, state: f.state, w: f.w, h: f.h, fs: f.fs, tall: f.tall ? 1 : 0 }));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  // Nothing may be cut: no text box narrower than its text (D95), and every text colour at least 4.5 : 1.
  const report = await page.evaluate(() => window.audit());
  for (const line of report.cut) problems.push(`cut text: ${line}`);
  for (const c of report.contrast) problems.push(`contrast ${c.ratio} : 1 (${c.fg} on ${c.bg}): "${c.text}"`);
  await page.locator('.phone').screenshot({ path: path.join(HERE, `${f.name}.png`) });
  await page.close();
  const low = report.lowest ? ` · lowest text contrast ${report.lowest.ratio} : 1 ("${report.lowest.text}")` : '';
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${f.name}.png${low}`);
  for (const p of problems) console.log('     ', p);
  if (problems.length) failed = true;
}

for (const s of SHEETS) {
  const name = `sheet-${s}`;
  if (!wanted(name)) continue;
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
  await page.goto(fileUrl('sheet.html', { sheet: s }));
  await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => {}))]));
  const missing = await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')));
  if (missing.length) { console.log('FAIL', name, 'missing', missing.join(', ')); failed = true; }
  await page.locator('.sheet').screenshot({ path: path.join(HERE, `${name}.png`) });
  await page.close();
  console.log('ok  ', `${name}.png`);
}

await browser.close();
if (failed) process.exit(1);

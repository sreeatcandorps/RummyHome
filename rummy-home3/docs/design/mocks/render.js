/* Renders mock.html into PNGs under ../mockups/.
 *
 * Usage (from this folder):
 *   npm i --no-save playwright-core        # or point CHROME at any Chrome/Chromium
 *   CHROME=/usr/bin/google-chrome node render.js [after|alternatives|confetti|compare|all]
 *
 * Needs network access for Nunito (Google Fonts) and the MDI webfont (jsdelivr).
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const HERE = __dirname;
const OUT = path.join(HERE, '..', 'mockups');
const MOCK = 'file://' + path.join(HERE, 'mock.html');
const CHROME = process.env.CHROME || '/usr/local/bin/google-chrome';
const SCREENS = ['home', 'scorecard', 'add-round', 'results', 'players'];
const MODES = ['light', 'dark'];

async function shot(page, url, file, fullPage = false) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage });
  console.log('wrote', path.relative(OUT, file));
}

async function main() {
  const what = process.argv[2] || 'all';
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  if (what === 'after' || what === 'all') {
    for (const s of SCREENS) for (const m of MODES) {
      await shot(page, `${MOCK}?screen=${s}&mode=${m}&palette=A`, path.join(OUT, 'after', `${s}-${m}.png`), s === 'results');
    }
  }
  if (what === 'confetti' || what === 'all') {
    for (const m of MODES) {
      await shot(page, `${MOCK}?screen=confetti&mode=${m}&palette=A`, path.join(OUT, 'confetti', `results-winner-${m}.png`));
    }
  }
  if (what === 'alternatives' || what === 'all') {
    for (const p of ['B', 'C']) for (const m of MODES) {
      await shot(page, `${MOCK}?screen=home&mode=${m}&palette=${p}`, path.join(OUT, 'alternatives', `${p}-home-${m}.png`));
    }
  }
  if (what === 'compare' || what === 'all') {
    const cmp = await ctx.newPage();
    await cmp.setViewportSize({ width: 860, height: 920 });
    for (const s of SCREENS) for (const m of MODES) {
      const before = path.join(OUT, 'before', `${s === 'results' ? 'results-view' : s}-${m}.png`);
      const after = path.join(OUT, 'after', `${s}-${m}.png`);
      if (!fs.existsSync(before) || !fs.existsSync(after)) continue;
      const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
      const html = `<!doctype html><html data-mode="${m}"><head><meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800&display=swap" rel="stylesheet">
        <style>body{margin:0;background:${m === 'dark' ? '#0A0D0B' : '#E9E9E2'};font-family:Nunito,sans-serif;color:${m === 'dark' ? '#EAEDE9' : '#17201B'}}
        .wrap{display:flex;gap:40px;padding:24px 30px 30px;align-items:flex-start}
        .col{display:flex;flex-direction:column;gap:10px;align-items:center}
        .col h2{margin:0;font-size:20px;font-weight:800}
        .col img{width:390px;height:844px;object-fit:cover;object-position:top;border-radius:28px;box-shadow:0 8px 30px rgba(0,0,0,.18)}
        </style></head><body><div class="wrap">
        <div class="col"><h2>Before · ${s} (${m})</h2><img src="${b64(before)}"></div>
        <div class="col"><h2>After · Clubhouse</h2><img src="${b64(after)}"></div></div></body></html>`;
      await cmp.setContent(html, { waitUntil: 'networkidle' });
      await cmp.waitForTimeout(200);
      const file = path.join(OUT, 'compare', `${s}-${m}.png`);
      await cmp.screenshot({ path: file, fullPage: true });
      console.log('wrote', path.relative(OUT, file));
    }
  }
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
/**
 * Help screenshots (docs/help-design.md Q11.3a): take the real phone screenshots a CI smoke run
 * produced, halve them, draw the numbered badges from scripts/help-callouts.json, and write
 * assets/help/<topic>.png. Re-run after a smoke run on the branch so the pictures match the build.
 *
 *   gh run download <run-id> -n ui-pixel6-smoke -D /tmp/smoke
 *   node scripts/help-screenshots.mjs /tmp/smoke/smoke/screens
 *
 * Only pngjs (already in node_modules) — no native image library. Badge positions are in source
 * pixels (the 1080 × 2400 Pixel 6 frame). `--only <file>` limits the run to one picture. An entry's optional
 * `crop` keeps only the top `crop` source pixels, for a section picture of part of a screen (D98).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const callouts = JSON.parse(fs.readFileSync(path.join(here, 'help-callouts.json'), 'utf8'));
const args = process.argv.slice(2);
const srcDir = args.find((a) => !a.startsWith('--')) ?? '/tmp/smoke/smoke/screens';
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const outDir = path.join(root, 'assets', 'help');
fs.mkdirSync(outDir, { recursive: true });

/** Output scale: 1080 → 540 wide, sharp enough for a 400-dp wide card, ~1/4 of the bytes. */
const SCALE = 2;
const BADGE = { r: 0xc2, g: 0x41, b: 0x0c }; // the orange the design uses for callouts
const WHITE = { r: 255, g: 255, b: 255 };

// 5 × 7 digit font, enough for 1–9 and 10+ badges.
const FONT = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
};

function downscale(src, crop) {
  const w = Math.floor(src.width / SCALE);
  const h = Math.floor(Math.min(src.height, crop ?? src.height) / SCALE);
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < SCALE; dy++) {
        for (let dx = 0; dx < SCALE; dx++) {
          const i = ((y * SCALE + dy) * src.width + (x * SCALE + dx)) * 4;
          r += src.data[i]; g += src.data[i + 1]; b += src.data[i + 2];
        }
      }
      const n = SCALE * SCALE;
      const o = (y * w + x) * 4;
      out.data[o] = r / n; out.data[o + 1] = g / n; out.data[o + 2] = b / n; out.data[o + 3] = 255;
    }
  }
  return out;
}

function put(png, x, y, c) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const i = (y * png.width + x) * 4;
  png.data[i] = c.r; png.data[i + 1] = c.g; png.data[i + 2] = c.b; png.data[i + 3] = 255;
}

function disc(png, cx, cy, radius, c) {
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      if (x * x + y * y <= radius * radius) put(png, cx + x, cy + y, c);
    }
  }
}

function digits(png, cx, cy, text, scale, c) {
  const glyphW = 5 * scale, gap = scale;
  const total = text.length * glyphW + (text.length - 1) * gap;
  let x0 = Math.round(cx - total / 2);
  const y0 = Math.round(cy - (7 * scale) / 2);
  for (const ch of text) {
    const rows = FONT[ch];
    rows.forEach((row, ry) => {
      [...row].forEach((bit, rx) => {
        if (bit !== '1') return;
        for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) put(png, x0 + rx * scale + dx, y0 + ry * scale + dy, c);
      });
    });
    x0 += glyphW + gap;
  }
}

function badge(png, n, sx, sy) {
  const cx = Math.round(sx / SCALE), cy = Math.round(sy / SCALE);
  disc(png, cx, cy, 24, WHITE);
  disc(png, cx, cy, 21, BADGE);
  digits(png, cx, cy, String(n), 3, WHITE);
}

let written = 0;
for (const [file, spec] of Object.entries(callouts)) {
  if (only && only !== file) continue;
  const srcPath = path.join(srcDir, `${spec.source}.png`);
  if (!fs.existsSync(srcPath)) { console.warn(`skip ${file}: no ${srcPath}`); continue; }
  const src = PNG.sync.read(fs.readFileSync(srcPath));
  const out = downscale(src, spec.crop);
  spec.badges.forEach(([x, y], i) => badge(out, i + 1, x, y));
  fs.writeFileSync(path.join(outDir, `${file}.png`), PNG.sync.write(out, { colorType: 2 }));
  written++;
  console.log(`${file}.png ← ${spec.source} (${spec.badges.length} badges)`);
}
console.log(`${written} help screenshot${written === 1 ? '' : 's'} written to ${path.relative(root, outDir)}`);

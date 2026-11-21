import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Sree, Nov 21 (APK v17): "the Joker icon … it's like a square shape, but then it's a circle, so it's not very clean."
// Android shows the central 72 of the 108 dp adaptive canvas and guarantees only a 66 dp circle (61 %). The
// foreground must keep every non-background pixel inside that circle; the shape comes from the launcher.
const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const appJson = require('../app.json');

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
function png(rel: string): { width: number; height: number; data: Buffer } {
  return PNG.sync.read(readFileSync(path.join(root, rel)));
}

/** Largest distance from the centre (as a fraction of the half-width) of any pixel that differs from `bg`. */
function reach(img: { width: number; height: number; data: Buffer }, bg: [number, number, number] | null, tol = 12) {
  const cx = img.width / 2;
  const cy = img.height / 2;
  let max = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      const visible = bg
        ? Math.max(Math.abs(img.data[i] - bg[0]), Math.abs(img.data[i + 1] - bg[1]), Math.abs(img.data[i + 2] - bg[2])) > tol && img.data[i + 3] > 8
        : img.data[i + 3] > 8;
      if (!visible) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / cx;
      if (d > max) max = d;
    }
  }
  return max;
}

const hex = (s: string): [number, number, number] => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const SAFE = 66 / 108;

test('adaptive icon: everything that is not the background colour sits inside the 66 dp safe circle', () => {
  const fg = png('assets/adaptive-icon.png');
  assert.equal(fg.width, 1024);
  const bg = hex(appJson.expo.android.adaptiveIcon.backgroundColor);
  const r = reach(fg, bg);
  assert.ok(r <= SAFE, `art reaches ${(r * 100).toFixed(1)} % of the half-width; the safe circle ends at ${(SAFE * 100).toFixed(1)} %`);
});

test('adaptive icon: the themed (monochrome) layer exists, is a single colour and stays in the safe circle', () => {
  const mono = png('assets/adaptive-icon-mono.png');
  assert.equal(appJson.expo.android.adaptiveIcon.monochromeImage, './assets/adaptive-icon-mono.png');
  const r = reach(mono, null);
  assert.ok(r <= SAFE, `silhouette reaches ${(r * 100).toFixed(1)} %`);
  let painted = 0;
  for (let i = 0; i < mono.data.length; i += 4) {
    if (mono.data[i + 3] > 128) {
      painted += 1;
      assert.ok(mono.data[i] > 240 && mono.data[i + 1] > 240 && mono.data[i + 2] > 240, 'white silhouette');
    }
  }
  assert.ok(painted > 20_000, 'the silhouette is not empty');
});

test('store icon is full bleed (no second frame) and the splash keeps the approved tile', () => {
  const icon = png('assets/icon.png');
  assert.equal(icon.width, 1024);
  const corner = [icon.data[0], icon.data[1], icon.data[2]];
  assert.deepEqual(corner, hex(appJson.expo.android.adaptiveIcon.backgroundColor), 'corner pixel is the tile green: no cream margin for iOS / Play to frame');
  assert.equal(appJson.expo.splash.image, './assets/splash-icon.png');
  assert.equal(appJson.expo.splash.backgroundColor, '#FBF1E1');
  const splash = png('assets/splash-icon.png');
  assert.equal(splash.width, 1024);
});

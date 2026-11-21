import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const read = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');

// The New game "Playing" halo looped for ever on the JS thread, so the screen never went idle: Maestro
// waited 60–100 s per tap (smoke/19 ran 10 min) and the Pixel 7 Pro nightly timed out (#88 #103 #106).
test('New game halo: breathes a few times on the native thread, then rests; not an accessibility element', () => {
  const src = read('app/(screens)/games/new.tsx');
  const halo = src.slice(src.indexOf('function PlayingCount'), src.indexOf('const scale = pop.interpolate'));
  assert.match(src, /const HALO_BREATHS = 3;/);
  assert.match(halo, /Animated\.loop\([\s\S]*?\), \{ iterations: HALO_BREATHS \}\)/, 'finite breaths, never an endless loop');
  const haloTimings = halo.match(/Animated\.timing\(halo,[^\n]*\n/g) ?? [];
  assert.equal(haloTimings.length, 2);
  for (const t of haloTimings) assert.match(t, /useNativeDriver: true/, 'opacity + scale run on the native thread');
  assert.match(halo, /\}, \[count, halo\]\);/, 'a seat change breathes again');
  assert.match(src, /styles\.countHalo[\s\S]{0,40}/);
  assert.match(src, /<Animated\.View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style=\{\[styles\.countHalo/, 'out of the accessibility tree so test drivers do not see it move');
});

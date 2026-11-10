import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { headerMenuReducer, HeaderMenuState } from '../utils/headerMenu';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('bug 2: every close of the header menu hands the next tap a fresh Menu instance', () => {
  let state: HeaderMenuState = { open: false, key: 0 };
  state = headerMenuReducer(state, 'open');
  assert.deepEqual(state, { open: true, key: 0 });
  state = headerMenuReducer(state, 'open');
  assert.deepEqual(state, { open: true, key: 0 }, 'opening twice does not remount under the finger');
  state = headerMenuReducer(state, 'close');
  assert.deepEqual(state, { open: false, key: 1 }, 'a tap outside closes and remounts');
  state = headerMenuReducer(state, 'open');
  assert.deepEqual(state, { open: true, key: 1 }, 'the next tap on ⋮ opens the new instance');
  state = headerMenuReducer(state, 'reset');
  assert.deepEqual(state, { open: false, key: 2 }, 'coming back from a share sheet remounts too');
  // Quick open → dismiss → open → dismiss: keys keep moving so no instance is ever reused after a dismiss.
  const keys: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    state = headerMenuReducer(headerMenuReducer(state, 'open'), 'close');
    keys.push(state.key);
  }
  assert.deepEqual(keys, [3, 4, 5]);
});

test('the scorecard and score-entry headers key their Menu off the hook', () => {
  for (const file of ['app/(screens)/games/[id].tsx', 'app/(screens)/score-entry.tsx']) {
    const src = read(file);
    assert.match(src, /useMenuThenShare\(\)/, file);
    assert.match(src, /key=\{menuKey\}/, `${file} remounts the Menu with menuKey`);
    assert.match(src, /onDismiss=\{\(\) => setMenuOpen\(false\)\}/, `${file} closes through the hook`);
  }
});

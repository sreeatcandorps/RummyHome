import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createScrollSync, ScrollSide } from '../utils/scrollSync';

const read = (relative: string) => readFileSync(path.join(__dirname, '..', relative), 'utf8');

// ---------------------------------------------------------------------------
// Nov 11 P2 — scorecard header swipes sideways and stays in step with the rows
// ---------------------------------------------------------------------------

function harness() {
  const calls: Array<[ScrollSide, number]> = [];
  const sync = createScrollSync((side, x) => calls.push([side, x]));
  return { calls, sync };
}

test('swiping the rows moves the header, and the echo from the header does not bounce back', () => {
  const { calls, sync } = harness();
  assert.equal(sync.onScroll('body', 120), true);
  assert.deepEqual(calls, [['header', 120]]);
  // scrollTo fires the header's own scroll event with the same offset: nothing to do.
  assert.equal(sync.onScroll('header', 120), false);
  assert.deepEqual(calls, [['header', 120]]);
});

test('swiping the header moves the rows (the other direction works the same way)', () => {
  const { calls, sync } = harness();
  sync.onScroll('body', 120);
  sync.onScroll('header', 120);
  assert.equal(sync.onScroll('header', 40), true);
  assert.deepEqual(calls.at(-1), ['body', 40]);
  assert.equal(sync.onScroll('body', 40), false);
  assert.deepEqual(sync.offsets, { header: 40, body: 40 });
});

test('a long fling is one scrollTo per frame, never a loop, and sub-pixel echoes are ignored', () => {
  const { calls, sync } = harness();
  const frames = Array.from({ length: 60 }, (_, index) => (index + 1) * 17.3);
  for (const x of frames) {
    sync.onScroll('body', x);
    sync.onScroll('header', Math.round(x * 2) / 2); // platforms round programmatic offsets
  }
  assert.equal(calls.length, frames.length);
  assert.ok(calls.every(([side]) => side === 'header'));
  assert.equal(sync.onScroll('body', 0), true);
  assert.equal(sync.onScroll('header', 0.25), false);
});

test('ScoreTable: header and rows are two horizontal scroll views wired through the sync, no translated header', () => {
  const table = read('components/game/ScoreTable.tsx');
  assert.match(table, /import \{ createScrollSync \} from '@\/utils\/scrollSync'/);
  assert.match(table, /const headerRef = useRef<ScrollView>\(null\);\s+const bodyRef = useRef<ScrollView>\(null\);/);
  assert.match(table, /\(side === 'header' \? headerRef : bodyRef\)\.current\?\.scrollTo\(\{ x, animated: false \}\)/);
  assert.match(table, /ref=\{headerRef\}\s+horizontal\s+style=\{styles\.flex\}\s+scrollEnabled=\{scrollsSideways\}\s+showsHorizontalScrollIndicator=\{false\}\s+onScroll=\{onHeaderScroll\}\s+scrollEventThrottle=\{16\}/);
  assert.match(table, /ref=\{bodyRef\}\s+horizontal\s+scrollEnabled=\{scrollsSideways\}\s+showsHorizontalScrollIndicator=\{scrollsSideways\}\s+onScroll=\{onBodyScroll\}\s+scrollEventThrottle=\{16\}/);
  assert.doesNotMatch(table, /Animated/, 'the header is no longer a translated copy of the body offset');
  assert.doesNotMatch(table, /styles\.clip/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { newestRoundOffset, POOL_CARD_MAX_ROWS, poolCardBodyHeight } from '../utils/scorecardLayout';

const src = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

// ---- Sree's 5-line rule (Nov 18): the pool card in portrait hugs its rounds and stops at five ----

test('the card body is the content height until five round rows, then the cap', () => {
  assert.equal(POOL_CARD_MAX_ROWS, 5);
  const row = 48;
  // 0 rounds: placeholder row + empty row + three footer lines (~42) ≈ 3 rows: hugs.
  assert.equal(poolCardBodyHeight(row * 2 + 42, row, POOL_CARD_MAX_ROWS), 138);
  assert.equal(poolCardBodyHeight(row * 2 + row + 42, row, POOL_CARD_MAX_ROWS), 186, 'two rounds: hugs');
  assert.equal(poolCardBodyHeight(row * 5 + row + 42, row, POOL_CARD_MAX_ROWS), 240, 'five rounds: the cap, the empty row and footer scroll below');
  assert.equal(poolCardBodyHeight(row * 12, row, POOL_CARD_MAX_ROWS), 240);
  assert.equal(poolCardBodyHeight(-1, row, POOL_CARD_MAX_ROWS), 0);
});

test('the newest round sits at the bottom of the viewport; the footer is below it, never parked on', () => {
  const row = 48;
  const viewport = 5 * row;
  assert.equal(newestRoundOffset(3, row, viewport), 0, 'three rounds: nothing to scroll');
  assert.equal(newestRoundOffset(5, row, viewport), 0, 'five rounds fill the card exactly');
  assert.equal(newestRoundOffset(6, row, viewport), row, 'round 6: one row up, rounds 2–6 showing');
  assert.equal(newestRoundOffset(12, row, viewport), 7 * row);
  assert.equal(newestRoundOffset(0, row, viewport), 0);
});

test('ScoreTable in hug mode: placeholder row at 0 rounds, one empty row, maxHeight of five rows, scrollTo the newest round; full mode unchanged', () => {
  const table = src('components/game/ScoreTable.tsx');
  assert.match(table, /hugRows\?: number/);
  assert.match(table, /const maxBodyHeight = hugRows \? hugRows \* rowHeight : undefined/);
  assert.match(table, /style=\{hugging \? \[styles\.none, \{ maxHeight: maxBodyHeight \}\] : styles\.flex\}/, 'the body hugs up to the cap; Points keeps flex: 1');
  assert.match(table, /if \(hugRows\) verticalRef\.current\?\.scrollTo\(\{ y: newestRoundOffset\(roundCount, rowHeight, viewportHeight\.current\), animated \}\);\s*else verticalRef\.current\?\.scrollToEnd\(\{ animated \}\)/, 'hug: newest round at the bottom; full: the end as before');
  assert.match(table, /roundCount === 0 && hugging \?[\s\S]*?testID="score-table-placeholder-row"/, 'line 1 of 5 at 0 rounds is a round-row-height placeholder');
  assert.match(table, /\{hugging \? <View style=\{\{ height: rowHeight \}\} testID="score-table-spacer-row" \/> : null\}/, 'the empty row between the rounds and the footer');
  assert.doesNotMatch(table, /below\?: React\.ReactNode|\{below \?/, 'the landscape "standings below" slot is gone');
  assert.match(table, /tableHug: \{\s*flexGrow: 0,\s*flexShrink: 1,/);
});

test('the scorecard: pool portrait hugs, Points and landscape fill; landscape pool has no standings but the admin keeps Give awards in the strip', () => {
  const screen = src('app/(screens)/games/[id].tsx');
  assert.match(screen, /hugRows=\{pool && !sideways \? POOL_CARD_MAX_ROWS : undefined\}/);
  assert.doesNotMatch(screen, /portraitPaneHeights|PORTRAIT_TABLE_FLEX|PORTRAIT_STANDINGS_FLEX|below=\{/, 'the 70 / 30 split and the landscape standings are gone');
  assert.match(screen, /\{pool \? <View style=\{styles\.poolTablePane\} testID="pool-table-pane">\{table\}<\/View> : table\}/);
  assert.match(screen, /<ScrollView style=\{styles\.flex\} contentContainerStyle=\{styles\.portraitStandingsContent\} showsVerticalScrollIndicator testID="pool-standings-pane">/, 'the standings take what is left');
  assert.match(screen, /pool && sideways && canManageNow && !game\.closedAt \?[\s\S]*?testID="strip-give-awards"[\s\S]*?\{game\.awardedAt \? 'Change awards' : 'Give awards'\}/, 'landscape completed pool: awards reachable from the strip');
  assert.doesNotMatch(src('utils/scorecardLayout.ts'), /PORTRAIT_TABLE_FLEX/);
});

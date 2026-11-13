import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  cellFontSize,
  columnLayout,
  dealsBadge,
  footerOneLine,
  headerHeight,
  headerType,
  playersChipLabel,
  rowHeight,
  scorecardFooterLines,
  TABLE_MAX_FONT_SCALE,
} from '../utils/scorecardLayout';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

// ---------------------------------------------------------------------------
// PR 4 — Scorecard: header height from the type, one scroller, strip chip, footer lines
// ---------------------------------------------------------------------------

test('A4-1 header height comes from the three line heights, so it grows with the type and never clips', () => {
  // 5 players on a 390 dp phone: 348 / 5 = 69.6 dp columns → 17 / 20 / 9 pt.
  const wide = columnLayout(390, 5, false);
  assert.equal(Math.floor(wide.columnWidth), 69);
  const type = headerType(wide.columnWidth);
  assert.deepEqual([type.initials.fontSize, type.total.fontSize, type.deals.fontSize], [17, 20, 9]);
  const h = headerHeight(wide.columnWidth, false, 1);
  assert.equal(h, type.initials.lineHeight + type.total.lineHeight + type.deals.lineHeight + 4 + 8);
  assert.ok(h >= 66 && h <= 70, `about the old 68 dp at font scale 1 (${h})`);
  // Font scale 1.3 is capped at 1.2 and the box grows with it instead of clipping.
  const big = headerHeight(wide.columnWidth, false, 1.3);
  assert.equal(big, headerHeight(wide.columnWidth, false, TABLE_MAX_FONT_SCALE));
  assert.ok(big > h + 8, `taller at a bigger font (${big} > ${h})`);
  // Landscape is shorter only through its padding, never by cutting a line.
  assert.equal(headerHeight(wide.columnWidth, true, 1), h - 2);
});

test('A4-2 the type steps down at narrow columns: 10 and 20 players', () => {
  const ten = columnLayout(390, 10, false);
  assert.equal(ten.scrollsSideways, true, '348 / 10 = 34.8 < 38: scrolls sideways at the 38 dp minimum');
  assert.equal(ten.columnWidth, 38);
  assert.equal(cellFontSize(38), 13);
  assert.deepEqual([headerType(38).initials.fontSize, headerType(38).total.fontSize, headerType(38).deals.fontSize], [12, 12, 8]);
  assert.equal(dealsBadge(38), 'icon', 'no "DEA…": the cards icon below 44 dp');
  assert.equal(dealsBadge(44), 'text');
  assert.equal(dealsBadge(69.6), 'text');
  const twenty = columnLayout(390, 20, false);
  assert.equal(twenty.contentWidth, 38 * 20);
  assert.ok(headerHeight(38, false) < headerHeight(69.6, false), 'a narrow header is shorter, not clipped');
  // Landscape 844 dp with 10 players: 796 / 10 = 79.6 → full-size type, no sideways scroll.
  const land = columnLayout(844, 10, true);
  assert.equal(land.scrollsSideways, false);
  assert.equal(headerType(land.columnWidth).total.fontSize, 20);
});

test('A4-3 rows keep their size at font scale 1 and grow (capped) with the phone font', () => {
  assert.equal(rowHeight(69.6, 5, false, 1), 48);
  assert.equal(rowHeight(38, 10, false, 1), 42);
  assert.equal(rowHeight(79.6, 10, true, 1), 34);
  assert.ok(rowHeight(79.6, 10, true, 1.3) > 34, 'landscape rows grow for a big font instead of clipping');
  assert.equal(rowHeight(69.6, 5, false, 1.3), rowHeight(69.6, 5, false, 1.2));
});

test('A4-4 strip chip counts seats, not who has scored', () => {
  assert.equal(playersChipLabel(10), '10 players');
  assert.equal(playersChipLabel(1), '1 player');
  const screen = src('app/(screens)/games/[id].tsx');
  assert.match(screen, /playersChipLabel\(players\.length\)/, 'the chip is driven by the seated players');
  assert.match(screen, /icon="account-group-outline"/);
});

test('A4-5 footer lines: creator, one Admin line per admin, Unique game ID = share code; no "Game S16"', () => {
  const members = [
    { id: 'u1', name: 'Sree Koneru', seatRole: 'game_admin' },
    { id: 'u2', name: 'Harish Gadupudi', seatRole: 'game_admin' },
    { id: 'u3', name: 'Priya Tella', seatRole: 'game_admin' },
    { id: 'u4', name: 'Anil', seatRole: 'player' },
  ];
  const three = scorecardFooterLines({ createdBy: 'u1', shareCode: '7f3a2c' }, members);
  assert.deepEqual(three, [
    { label: 'Creator', value: 'Sree Koneru' },
    { label: 'Admin', value: 'Harish Gadupudi' },
    { label: 'Admin', value: 'Priya Tella' },
    { label: 'Unique game ID', value: '7F3A2C' },
  ]);
  const one = scorecardFooterLines({ createdBy: 'u1', shareCode: 'ABCDEF' }, members.slice(0, 2));
  assert.equal(one.filter((l) => l.label === 'Admin').length, 1);
  const none = scorecardFooterLines({ createdBy: 'x', shareCode: null }, [{ id: 'u4', name: 'Anil', seatRole: 'player' }], 'Zed');
  assert.deepEqual(none, [{ label: 'Creator', value: 'Zed' }], 'no admins, no code: one line');
  assert.equal(footerOneLine(three), 'Creator: Sree Koneru · Admin: Harish Gadupudi · Admin: Priya Tella · Unique game ID: 7F3A2C');
  for (const line of three) assert.doesNotMatch(line.value, /^Game /, 'the game label lives in the strip, not the footer');
});

test('A4-6 one horizontal scroller holds the header and the rows; no JS scroll sync, no fixed heights', () => {
  const table = src('components/game/ScoreTable.tsx');
  assert.doesNotMatch(table, /scrollSync|createScrollSync/, 'the two-ScrollView JS sync is gone (D4.2)');
  assert.doesNotMatch(table, /headerHeight = compact \? 58 : 68|rowHeight = compact \? 34/, 'no fixed header or row height');
  assert.match(table, /headerHeight\(columnWidth, compact, fontScale\)/);
  assert.match(table, /stickyHeaderIndices=\{\[0\]\}/, 'the header is pinned by the native sticky header, inside the single horizontal scroller');
  assert.match(table, /useNativeDriver: true/, 'the frozen round column follows the rows on the UI thread');
  assert.match(table, /maxFontSizeMultiplier=\{TABLE_MAX_FONT_SCALE\}/);
  assert.match(table, /directionalLockEnabled/);
  assert.equal((table.match(/<ScrollView\s|<Animated\.ScrollView\s/g) ?? []).length, 2, 'exactly two scroll views: one horizontal, one vertical');
  assert.match(table, /dealsBadge\(columnWidth\) === 'text'/, 'DEALS shrinks or becomes the cards icon');
  const footer = src('components/game/GameIdFooter.tsx');
  assert.match(footer, /scorecardFooterLines\(game, members, creatorName\)/);
  assert.match(footer, /footerOneLine\(lines\)/, 'landscape: one line');
  const screen = src('app/(screens)/games/[id].tsx');
  assert.match(screen, /<GameIdFooter game=\{game\} members=\{members\} compact=\{isShort\} \/>/, 'the footer sits under the table card, outside the scrollers');
  assert.doesNotMatch(screen, /footer=\{idFooter\}/);
});

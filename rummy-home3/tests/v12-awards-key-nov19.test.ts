import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { legendHtml, ResultsRoundTable } from '../utils/resultsDetails';
import { MIN_CELL_WIDTH, rechunkRoundTable, ROUND_COLUMN_WIDTH, screenBlockSize } from '../utils/roundBlocks';
import { legendColumns, legendRows } from '../utils/legendKey';

const src = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

// ---- APK v12 feedback (Sree, Nov 19), points 13 and 14; see docs/v12-feedback.md ----

test('v12 #13: players per block come from the width, never more than the PDF block, never under one', () => {
  assert.equal(screenBlockSize(0, 3, 5), 5, 'before the first layout: the data blocks');
  assert.equal(screenBlockSize(360 - 32, 3, 5), 5, 'a 328 dp card at 56 dp cells: five fit (328-40)/56 = 5.1');
  assert.equal(screenBlockSize(300, 3, 5), 4, "Sree's photo: four at a readable size, not five clipped");
  assert.equal(screenBlockSize(300, 8, 5), 3, 'eight-character scores (-12,345) widen the cells: three');
  assert.equal(screenBlockSize(300, 3, 4), 4, 'the PDF block size is the ceiling');
  assert.equal(screenBlockSize(80, 3, 5), 1, 'never zero');
  assert.equal(ROUND_COLUMN_WIDTH, 40);
  assert.equal(MIN_CELL_WIDTH, 56);
});

test('v12 #13: re-cutting the table keeps every player, total and round in seat order', () => {
  const table: ResultsRoundTable = {
    label: 'Game 1', start: { date: '', time: '' }, code: 'ABC',
    initials: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], names: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], playerNos: [1, 2, 3, 4, 5, 6, 7],
    rows: [{ round: 1, cells: ['1', '2', '3', '4', '5', '6', '7'] }, { round: 2, cells: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }],
    totals: ['10', '20', '30', '40', '50', '60', '70'],
    blocks: [], blockSize: 5, multiplier: null, totalsOnly: false,
  } as unknown as ResultsRoundTable;
  const blocks = rechunkRoundTable(table, 4);
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks[0].heads.map((h) => h.initials), ['A', 'B', 'C', 'D']);
  assert.deepEqual(blocks[1].heads.map((h) => `${h.initials}${h.total}#${h.playerNo}`), ['E50#5', 'F60#6', 'G70#7']);
  assert.deepEqual(blocks[1].rows[1], { round: 2, cells: ['e', 'f', 'g'] });
  assert.equal(rechunkRoundTable(table, 5), table.blocks, 'the data blocks are reused when the size matches');
});

test('v12 #13: the on-screen block measures itself; cells flex inside the row; a short block is padded, not stretched', () => {
  const view = src('components/share/FinalScoresView.tsx');
  assert.match(view, /onLayout=\{\(e\) => setWidth\(Math\.floor\(e\.nativeEvent\.layout\.width\)\)\}/);
  assert.match(view, /screenBlockSize\(width, widestChars\(/);
  assert.match(view, /cell: \{ flex: 1, minWidth: 0/);
  assert.doesNotMatch(view, /100 \/ ROUND_BLOCK/, 'the 20 % cells that overflowed beside the 40 dp round column are gone');
  assert.match(view, /fillers\.map\(\(index\) => <View key=\{`f\$\{index\}`\} style=\{styles\.cell\} \/>\)/);
  assert.match(view, /<LegendKey/);
});

test('v12 #14: the key is a two-column table (initials · name · #ID) that reads down the columns', () => {
  assert.equal(legendColumns(360), 2);
  assert.equal(legendColumns(280), 1, 'a very narrow card: one column');
  const entries = ['A', 'B', 'C', 'D', 'E'].map((initials, i) => ({ initials, name: `Name ${initials}`, playerNo: i + 1 }));
  const rows = legendRows(entries, 2);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => row.map((e) => e?.initials ?? null)), [['A', 'D'], ['B', 'E'], ['C', null]]);
  assert.deepEqual(legendRows(entries, 1).map((row) => row[0]?.initials), ['A', 'B', 'C', 'D', 'E']);
  for (const file of ['components/results/BandTable.tsx', 'components/share/FinalScoresView.tsx']) {
    assert.match(src(file), /<LegendKey\s+entries=/, `${file} uses the shared key`);
    assert.doesNotMatch(src(file), /'  ·  '/, `${file}: no run-on dot-separated line`);
  }
  const html = legendHtml(entries.slice(0, 2));
  assert.match(html, /^<div class="legend"><span><b>A<\/b> Name A <small>· #1<\/small><\/span><span><b>B<\/b> Name B <small>· #2<\/small><\/span><\/div>$/);
  assert.match(src('utils/resultsDetails.ts'), /\.legend \{[^}]*grid-template-columns: 1fr 1fr/, 'the PDF key is a two-column grid');
});

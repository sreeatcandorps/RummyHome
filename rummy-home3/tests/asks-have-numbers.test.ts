import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// D132 (Nov 27): Build Bot's audit found Sree's asks filed as "suggestion, awaits his pick" with no Q-number,
// so they never reached the list he reads, and decisions that lived only in unmerged PRs. Sree: "Who's checking
// to see if all the questions have been answered? … if you still see a chance of this happening, then
// definitely do something about it."

const doc = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

function forSreeBlock(nextUp: string): string {
  const start = nextUp.indexOf('## For Sree today');
  return nextUp.slice(start, nextUp.indexOf('\n## ', start + 1));
}

function mentionedIds(block: string): Set<string> {
  const ids = new Set<string>();
  for (const m of block.matchAll(/Q(\d+)(?:\s*[–-]\s*Q?(\d+))?/g)) {
    for (let n = Number(m[1]); n <= Number(m[2] ?? m[1]); n += 1) ids.add(`Q${n}`);
  }
  return ids;
}

const WAITS_ON_SREE = /awaits? (his|Sree's) (pick|yes|answer|look)|suggestion, awaits|needs (his|Sree's|a) pick|waiting on his pick/i;

export function unnumberedAsks(nextUp: string): string[] {
  return nextUp
    .split('\n')
    .filter((line) => line.startsWith('|') && WAITS_ON_SREE.test(line) && !/\bQ\d+\b/.test(line))
    .map((line) => line.slice(0, 80));
}

export function recordedQuestionIds(decisions: string): Set<string> {
  const ids = new Set<string>();
  for (const line of decisions.split('\n')) {
    const id = line.split('|')[1]?.trim();
    if (id && /^Q\d+$/.test(id)) ids.add(id);
  }
  return ids;
}

test('parsers: a row waiting on Sree needs a Q-number', () => {
  const table = [
    '| 5 | **Awards** — *suggestion, awaits his pick* | x |',
    '| 6 | **Round saved** — Q59, awaits his pick | x |',
    '| 7 | **Add by initials** — built | x |',
  ].join('\n');
  assert.deepEqual(unnumberedAsks(table), ['| 5 | **Awards** — *suggestion, awaits his pick* | x |']);
  assert.deepEqual([...recordedQuestionIds('| Q3 | d | q |\n| D4 | d | x |\n| Q10 | d | q |')], ['Q3', 'Q10']);
});

test('no row of next-up.md waits on Sree without a Q-number', () => {
  assert.deepEqual(unnumberedAsks(doc('docs/next-up.md')), []);
});

test('every Q in the For Sree block is recorded in decisions.md on this branch', () => {
  const recorded = recordedQuestionIds(doc('docs/decisions.md'));
  const missing = [...mentionedIds(forSreeBlock(doc('docs/next-up.md')))].filter((id) => !recorded.has(id));
  assert.deepEqual(missing, [], `questions Sree is shown that decisions.md does not have: ${missing.join(', ')}`);
});

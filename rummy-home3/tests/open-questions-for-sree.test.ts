import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Sree, Nov 24: "How did this get lost?" The §8.8 / §8.9 question lived only in a PR that was closed and
// folded into another, never got a Q-number and never reached the five-line block he reads (D82), so it sat
// unanswered. D83: a fix counts only when a test proves it. Every open or asked Q in decisions.md must be
// named in next-up.md's "For Sree today" block until it is answered.

const doc = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

export function openQuestionIds(decisions: string): string[] {
  const open = decisions.slice(decisions.indexOf('## Open'));
  const ids: string[] = [];
  for (const line of open.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    const id = cells[1];
    const status = cells[cells.length - 2];
    if (/^Q\d+$/.test(id ?? '') && /^(open|asked)$/i.test(status ?? '')) ids.push(id);
  }
  return ids;
}

export function mentionedIds(block: string): Set<string> {
  const ids = new Set<string>();
  for (const m of block.matchAll(/Q(\d+)(?:\s*[–-]\s*Q?(\d+))?/g)) {
    const from = Number(m[1]);
    const to = m[2] ? Number(m[2]) : from;
    for (let n = from; n <= to; n += 1) ids.add(`Q${n}`);
  }
  return ids;
}

export function forSreeBlock(nextUp: string): string {
  const start = nextUp.indexOf('## For Sree today');
  const end = nextUp.indexOf('\n## ', start + 1);
  return nextUp.slice(start, end);
}

test('parsers: ranges expand, answered rows are not open', () => {
  assert.deepEqual([...mentionedIds('Q3, Q5, Q16–Q19 and Q29-Q31')], ['Q3', 'Q5', 'Q16', 'Q17', 'Q18', 'Q19', 'Q29', 'Q30', 'Q31']);
  const table = '## Open\n| Q1 | d | q | x | asked |\n| Q2 | d | q | x | answered Nov 23 → D70 |\n| Q4 | d | q | x | open |';
  assert.deepEqual(openQuestionIds(table), ['Q1', 'Q4']);
});

test('every open or asked question is in the For Sree block', () => {
  const open = openQuestionIds(doc('docs/decisions.md'));
  assert.ok(open.length > 0, 'the Open table parsed');
  const block = forSreeBlock(doc('docs/next-up.md'));
  assert.ok(block.length > 0, 'next-up.md has a "For Sree today" block');
  const named = mentionedIds(block);
  const missing = open.filter((id) => !named.has(id));
  assert.deepEqual(missing, [], `open questions Sree never sees: ${missing.join(', ')}`);
});

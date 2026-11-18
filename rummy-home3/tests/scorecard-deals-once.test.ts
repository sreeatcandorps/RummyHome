import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

test('final batch 8: who deals is shown once (the DEALS column badge), not again in the round heading', () => {
  const scorecard = src('app/(screens)/games/[id].tsx');
  assert.doesNotMatch(scorecard, /deals`/, 'the status tag no longer says "AR deals"');
  assert.match(scorecard, /<Tag label=\{`Round \$\{maxRounds \+ 1\}`\} tone="primary" icon="cards-outline" \/>/);
  assert.match(scorecard, /nextDealerId=\{nextDealerId\}/, 'the table still gets the next dealer for its badge');
  const table = src('components/game/ScoreTable.tsx');
  assert.equal((table.match(/DEALS/g) ?? []).length, 1, 'exactly one DEALS badge text in the table');
});

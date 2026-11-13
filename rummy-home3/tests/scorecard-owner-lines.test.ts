import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gameOwnersLines } from '../utils/gameOwners';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

test('final batch 7: Creator and Admin sit on separate lines in the scorecard info area', () => {
  const members = [
    { id: 'u1', name: 'Sree Koneru', seatRole: 'game_admin' },
    { id: 'u2', name: 'Harish Test', seatRole: 'game_admin' },
    { id: 'u3', name: 'Priya Test', seatRole: 'player' },
  ];
  const lines = gameOwnersLines({ id: 'g', gameNumber: 3, gameType: 'stake', createdBy: 'u1' } as any, members);
  assert.deepEqual(lines, ['Game S3', 'Creator Sree Koneru', 'Admin Harish Test']);
  assert.equal(lines.length, 3, 'three lines, not one joined line');
  for (const line of lines) assert.doesNotMatch(line, / · /, 'nothing is joined on one line');

  const footer = src('components/game/GameIdFooter.tsx');
  assert.match(footer, /\{lines\.map\(\(line, index\) => \(/, 'the footer renders one Text per line');
  assert.match(footer, /numberOfLines=\{1\}/);
  assert.match(footer, /footerOneLine\(lines\)/, 'PR 4: landscape joins them on one line');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gameLabelList, gameLabelOf, gameLabelPrefix, gameTitle, nextLocalGameLabel } from '../utils/gameLabel';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');

test('028: S for Points games, P for Pool games; the server label wins over the number', () => {
  assert.equal(gameLabelPrefix('stake'), 'S');
  assert.equal(gameLabelPrefix('pool'), 'P');
  assert.equal(gameLabelPrefix(undefined), 'S');
  assert.equal(gameLabelOf({ gameLabel: 'P3', gameNumber: 3, gameType: 'pool' }), 'P3');
  assert.equal(gameLabelOf({ gameNumber: 3, gameType: 'pool' }), 'P3', 'older server: prefix from the type');
  assert.equal(gameLabelOf({ gameNumber: 3 }), 'S3');
  assert.equal(gameLabelOf({ gameLabel: 'S9', gameNumber: 2 }), 'S9', 'the stored label is never recomputed');
  assert.equal(gameLabelOf({}), null);
  assert.match(src('utils/gameDisplay.ts'), /return gameLabelOf\(game\)/, 'the card badge shows the label');
  assert.equal(gameTitle({ gameLabel: 'S3' }), 'Game S3');
  assert.equal(gameTitle({}, 'Scorecard'), 'Scorecard');
  assert.equal(gameLabelList(['S3', 'P1']), ' (S3, P1)');
  assert.equal(gameLabelList([]), '');
});

test('028 / 038: local games follow the same rule as next_game_number (lowest free, per prefix, only active games count)', () => {
  const games = [
    { gameLabel: 'S1', gameType: 'stake' as const, createdBy: 'me', players: [] },
    { gameLabel: 'S2', gameType: 'stake' as const, createdBy: 'me', players: [], closedAt: '2026-11-10' },
    { gameLabel: 'S3', gameType: 'stake' as const, createdBy: 'other', players: ['me'] },
    { gameLabel: 'S4', gameType: 'stake' as const, createdBy: 'other', players: ['someone'] },
    { gameLabel: 'P1', gameType: 'pool' as const, createdBy: 'me', players: [], deletedAt: '2026-11-11' },
  ];
  assert.equal(nextLocalGameLabel(games, 'me', 'stake'), 'S2', 'S1 mine, S2 closed (free), S3 I sit in, S4 not mine');
  assert.equal(nextLocalGameLabel(games, 'me', 'pool'), 'P1', 'the deleted P1 frees its number');
  // 038 (D5.1, Sree): a Completed game frees its number too, so a new day starts at S1 again.
  const yesterday = [
    { gameLabel: 'S1', gameType: 'stake' as const, createdBy: 'me', players: [], isComplete: true },
    { gameLabel: 'S2', gameType: 'stake' as const, createdBy: 'me', players: [], isComplete: true },
  ];
  assert.equal(nextLocalGameLabel(yesterday, 'me', 'stake'), 'S1', 'completed games do not hold their numbers');
  assert.equal(nextLocalGameLabel([...yesterday, { gameLabel: 'S1', gameType: 'stake' as const, createdBy: 'me', players: [] }], 'me', 'stake'), 'S2', 'a live S1 does');
  assert.equal(nextLocalGameLabel([], 'me', 'stake'), 'S1');
  assert.equal(nextLocalGameLabel([{ gameNumber: 1, gameType: 'stake' as const, createdBy: 'me' }], 'me', 'stake'), 'S2', 'a pre-028 local row counts through its number');
});

test('028: the long id left every screen; the label is shown everywhere the G badge was', () => {
  const footer = src('components/game/GameIdFooter.tsx');
  assert.doesNotMatch(footer, /game\.id\b|Clipboard/, 'no UUID, no copy (PR 4 shows the 6-character share code instead)');
  assert.match(footer, /scorecardFooterLines/);
  const scorecard = src('app/(screens)/games/[id].tsx');
  assert.match(scorecard, /title: gameTitle\(game, 'Scorecard'\)/, 'the scorecard header says "Game S3"');
  for (const rel of ['utils/gameDisplay.ts', 'utils/gameOwners.ts', 'utils/results.ts', 'utils/resultsSave.ts', 'utils/finalScoresSheet.ts', 'utils/scorecardSheet.ts', 'utils/linkPlayer.ts', 'app/(screens)/hidden-deleted.tsx']) {
    assert.doesNotMatch(src(rel), /`G\$\{/, `${rel} builds no G-number`);
  }
  assert.doesNotMatch(src('utils/finalScoresSheet.ts'), /shortId|slice\(-6\)/, 'the share sheet footer has no short id either');
  const games = src('services/games.ts');
  assert.match(games, /gameLabel: game\.game_label \?\? null/, 'the server label is read');
  assert.match(games, /nextLocalGameLabel\(existingGames, input\.createdBy, input\.gameType\)/, 'local games are numbered by the same rule');
  for (const rel of ['web/scorecard.html', 'public/scorecard.html']) {
    assert.match(src(rel), /card\.gameLabel/, `${rel} reads the label`);
    assert.doesNotMatch(src(rel), /'G' \+/, `${rel} prints no G-number`);
  }
  assert.match(src('public/link.html'), /req\.gameLabels/);
  const mail = src('supabase/functions/send-email/index.ts');
  assert.match(mail, /p\.gameLabels/);
  assert.match(mail, /`Game \$\{p\.gameLabel\}`/);
  assert.doesNotMatch(mail, /`G\$\{/);
});

test('028: the migration assigns under a lock, backfills in creation order and never renumbers', () => {
  const sql = src('supabase/migrations/028_game_labels.sql');
  assert.match(sql, /pg_advisory_xact_lock\(hashtext\('games\.game_label'\)\)/);
  assert.match(sql, /case when p_type = 'pool' then 'P' else 'S' end/);
  assert.match(sql, /g\.closed_at is null/, 'closed games do not block');
  assert.match(sql, /g\.deleted_at is null/, 'deleted games do not block');
  assert.match(sql, /m\.removed_at is null/, 'removed My players (027) leave the circle');
  assert.match(sql, /order by g\.created_at, g\.id/, 'backfill in creation order');
  assert.match(sql, /A game''s number never changes/);
  assert.match(sql, /'Can''t link yet\. %s %s %s both %s and #%s\. In %s, clear one of their scores to zero and remove them from the game first\.'/);
  assert.doesNotMatch(sql, /drop function if exists public\.(list_my_link_requests|list_link_requests_for_me|link_conflicts)\(/, '025 signatures are untouched so 025 stays re-runnable');
  src('supabase/rollback/rollback_028_game_labels.sql');
});

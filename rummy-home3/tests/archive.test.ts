import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8');
import { deleteGameWarning, deletedBody, removedGamesNote, restoreGameNote } from '../utils/archive';
import { GameResult, withoutGames } from '../utils/results';

const result: GameResult = {
  id: 'r1',
  declaredAt: '2026-11-10T10:00:00.000Z',
  declaredBy: 'sree',
  gameIds: ['g1', 'g2'],
  standings: [
    { id: 'harish', name: 'Harish', points: 70, games: 2, place: 1 },
    { id: 'priya', name: 'Priya', points: -25, games: 1, place: 2 },
    { id: 'rk', name: 'R K', points: -45, games: 1, place: 3 },
  ],
  sheet: {
    players: [{ id: 'harish', name: 'Harish' }, { id: 'priya', name: 'Priya' }, { id: 'rk', name: 'R K' }],
    games: [
      { id: 'g1', name: 'A1', label: 'G1', date: '2026-11-09', scores: { harish: 60, priya: -25, rk: -35 } },
      { id: 'g2', name: 'A2', label: 'G2', date: '2026-11-10', scores: { harish: 10, rk: -10 } },
    ],
  },
  reusedGameIds: ['g1'],
};

test('withoutGames drops the game, totals again, and remembers what left', () => {
  const next = withoutGames(result, ['g1']);
  assert.deepEqual(next.gameIds, ['g2']);
  assert.deepEqual(next.removedGameIds, ['g1']);
  assert.deepEqual(next.reusedGameIds, []);
  assert.deepEqual(next.sheet?.games.map((g) => g.id), ['g2']);
  assert.deepEqual(next.standings.map((s) => [s.id, s.points, s.games, s.place]), [['harish', 10, 1, 1], ['rk', -10, 1, 2]]);
  assert.deepEqual(next.sheet?.players.map((p) => p.id), ['harish', 'rk'], 'a player only in the removed game drops out');
});

test('withoutGames is a no-op for a game the result never had, and removing everything empties it', () => {
  assert.equal(withoutGames(result, ['zzz']), result);
  const empty = withoutGames(result, ['g1', 'g2']);
  assert.deepEqual(empty.gameIds, []);
  assert.deepEqual(empty.standings, []);
  assert.deepEqual([...(empty.removedGameIds ?? [])].sort(), ['g1', 'g2']);
});

test('Delete game warning names each saved result exactly as specified', () => {
  assert.equal(deleteGameWarning([]), null);
  assert.equal(deleteGameWarning([{ resultNo: 3 }]), 'This game is in result R3. Deleting it removes it from that result too.');
  assert.equal(deleteGameWarning([{ resultNo: 1 }, { resultNo: 3 }]), 'This game is in results R1 and R3. Deleting it removes it from those results too.');
  assert.equal(deleteGameWarning([{ resultNo: 1 }, { resultNo: 2 }, { resultNo: 3 }]), 'This game is in results R1, R2 and R3. Deleting it removes it from those results too.');
});

test('restore and deleted copy', () => {
  assert.equal(restoreGameNote(0), 'Game restored.');
  assert.match(restoreGameNote(1), /not added back/);
  assert.match(restoreGameNote(2), /2 saved results/);
  assert.equal(removedGamesNote(0), null);
  assert.match(removedGamesNote(1) ?? '', /One game was deleted/);
  assert.match(deletedBody('game', true), /Restore/);
  assert.match(deletedBody('result', false), /Only the person who deleted this result/);
});

test('scorecard menu offers Hide game to everyone and Delete game to managers only', () => {
  const screenSrc = src('app/(screens)/games/[id].tsx');
  assert.match(screenSrc, /title="Hide game"/);
  assert.match(screenSrc, /\{canManage \? \([\s\S]*?title="Delete game"/);
  assert.match(screenSrc, /setCanManage\(access\.isCreator \|\| access\.seatRole === 'game_admin'\)/);
  assert.match(screenSrc, /deleteGameWarning\(holding\)/, 'the warning about saved results is shown before Delete');
});

test('the result page offers Delete result only to canManage viewers and shows the deleted state', () => {
  const screenSrc = src('app/(screens)/results/[id].tsx');
  assert.match(screenSrc, /result\?\.canManage \? \([\s\S]*?title="Delete result"/);
  assert.match(screenSrc, /RESULT_DELETED_TITLE/);
});

test('the public share page says when a game was deleted', () => {
  const html = src('public/scorecard.html');
  assert.match(html, /card\.deleted === true[\s\S]*?This game was deleted\./);
});

test('migration 023 excludes deleted rows from every reader it rewrites and 023 is listed to apply', () => {
  const sql = src('supabase/migrations/023_hide_and_soft_delete.sql');
  for (const fn of ['list_visible_game_ids', 'can_read_game', 'visible_games', 'get_home_bundle', 'get_game_bundle', 'public_scorecard', 'list_new_game_candidates', 'can_see_game_result', 'reused_game_ids', 'get_game_result', 'list_game_results_page', 'declare_game_result']) {
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}\\(`), `${fn} is rewritten`);
  }
  assert.match(sql, /deleted_at is null/);
  const docs = src('docs/migrations-to-apply.md');
  assert.match(docs, /023_hide_and_soft_delete\.sql/);
});

test('the scorecard footer names the game, its creator and admins, and offers the full ID to copy', async () => {
  const { gameOwnersLine } = await import('../utils/gameOwners');
  const members = [
    { id: 'h', name: 'Harish', seatRole: 'game_admin' },
    { id: 'p', name: 'Priya', seatRole: 'player' },
    { id: 'c', name: 'Cora', seatRole: 'game_admin' },
  ];
  assert.equal(gameOwnersLine({ gameNumber: 12, createdBy: 's' }, members, 'Sree'), 'G12 · Creator Sree · Admins Harish, Cora');
  assert.equal(gameOwnersLine({ gameNumber: 3, createdBy: 'h' }, members), 'G3 · Creator Harish · Admin Cora');
  assert.equal(gameOwnersLine({ gameNumber: null, createdBy: 'x' }, [{ id: 'p', name: 'Priya', seatRole: 'player' }]), '');
  const screen = src('app/(screens)/games/[id].tsx');
  assert.match(screen, /<GameIdFooter game=\{game\} members=\{members\} onCopied=\{setLinkNote\} \/>/);
  const footer = src('components/game/GameIdFooter.tsx');
  assert.match(footer, /Clipboard\.setStringAsync\(game\.id\)/);
  assert.match(footer, /\{`ID \$\{game\.id\}`\}/, 'the full id is shown, not a short code');
});

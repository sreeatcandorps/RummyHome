import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { buildFinalScoresSheet } from '../utils/finalScoresSheet';
import {
  addAdminBlockedReason,
  addAdminPreview,
  addAdminProblem,
  gameAdminLines,
  gameAdminTextLines,
  PLAYERS_ADMINS_TITLE,
} from '../utils/gameAdmins';

const game = {
  createdBy: 'c',
  players: ['c', 'p', 'a'],
  adminIds: ['c', 'a', 'k'],
  unseatedAdminIds: ['k'],
  spectators: ['v'],
  closedAt: null as string | null,
  isComplete: false,
};

const roster = [
  { id: 'p', name: 'Pat Player', playerNo: 12, seatRole: 'player' as const, seated: true },
  { id: 'a', name: 'Anu Admin', playerNo: 7, seatRole: 'game_admin' as const, seated: true },
  { id: 'c', name: 'Cary Creator', playerNo: 3, seatRole: 'game_admin' as const, seated: true },
  { id: 'k', name: 'Kim Keeper', playerNo: 39, seatRole: 'game_admin' as const, seated: false },
  { id: 'v', name: 'Val Viewer', playerNo: 50, seatRole: 'spectator' as const, seated: false },
];

test('nov 10: Add admin is for open or completed games, by a game admin; never for a closed game', () => {
  assert.equal(addAdminBlockedReason(game, true), null, 'open game, admin');
  assert.equal(addAdminBlockedReason({ ...game, isComplete: true }, true), null, 'completed game, admin');
  assert.match(addAdminBlockedReason({ ...game, isComplete: true, closedAt: '2026-11-10T00:00:00Z' }, true) ?? '', /Closed/);
  assert.match(addAdminBlockedReason(game, false) ?? '', /Only a game admin/);
});

test('nov 10: the Player ID typed for Add admin must be a registered account not already in the game', () => {
  assert.equal(addAdminProblem(null, game), 'No registered player has that Player ID.');
  assert.match(addAdminProblem({ id: 'u', name: 'U', status: 'unregistered' }, game) ?? '', /not a registered account/);
  assert.match(addAdminProblem({ id: 'u', name: 'U', managedBy: 'c' }, game) ?? '', /not a registered account/);
  assert.match(addAdminProblem({ id: 'c', name: 'Cary Creator' }, game) ?? '', /creator/);
  assert.match(addAdminProblem({ id: 'k', name: 'Kim Keeper' }, game) ?? '', /already an admin/);
  assert.match(addAdminProblem({ id: 'p', name: 'Pat Player' }, game) ?? '', /playing in this game.*menu/);
  assert.match(addAdminProblem({ id: 'v', name: 'Val Viewer' }, game) ?? '', /watching this game/);
  assert.equal(addAdminProblem({ id: 'new', name: 'Nia New', status: 'registered' }, game), null, 'a registered outsider may be added');
  assert.match(addAdminPreview({ name: 'Nia New' }), /not a player: no score column, not counted/);
});

test('nov 10: Game admins list — creator first, then seated admins, then admins who do not play, each with a Player ID', () => {
  const lines = gameAdminLines(roster, game);
  assert.deepEqual(lines.map((line) => [line.name, line.badge, line.role, line.playing]), [
    ['Cary Creator', '#3', 'Creator', true],
    ['Anu Admin', '#7', 'Admin', true],
    ['Kim Keeper', '#39', 'Admin', false],
  ]);
  assert.ok(!lines.some((line) => line.id === 'p'), 'a plain player is not an admin');
  assert.ok(!lines.some((line) => line.id === 'v'), 'a viewer is not an admin');
  assert.deepEqual(gameAdminTextLines(lines), ['Cary Creator · #3', 'Anu Admin · #7', 'Kim Keeper · #39']);
  assert.deepEqual(gameAdminTextLines(gameAdminLines([{ id: 'x', name: 'No Id', seatRole: 'game_admin', seated: true }], { createdBy: 'x', players: ['x'] })), ['No Id']);
});

test('nov 10: a non-player admin is not counted as a player and appears on the final scores picture', () => {
  // The seated players are the score columns; the non-playing admin K has no column.
  const seated = roster.filter((seat) => seat.seated && seat.seatRole !== 'spectator');
  assert.equal(seated.length, 3);
  const sheet = buildFinalScoresSheet({
    game: { id: 'g1', gameNumber: 4, date: '2026-11-10T20:00:00Z', completedAt: '2026-11-10T23:00:00Z', isComplete: true },
    players: seated.map(({ id, name }) => ({ id, name })),
    scores: { p: [10], a: [-30], c: [20] },
    admins: gameAdminTextLines(gameAdminLines(roster, game)),
    now: new Date('2026-11-10T23:05:00Z'),
  });
  assert.equal(sheet.players.length, 3, 'the admin who does not play has no score block');
  assert.deepEqual(sheet.adminLines, ['Game admins: Cary Creator · #3, Anu Admin · #7, Kim Keeper · #39']);
  const bare = buildFinalScoresSheet({ game: { id: 'g1', date: '2026-11-10T20:00:00Z', isComplete: false }, players: [], scores: {} });
  assert.deepEqual(bare.adminLines, [], 'nothing shown when the admins are unknown');
});

test('nov 10: the menu and page are called Players/Admins; a load failure offers Retry instead of "Game not available"', () => {
  assert.equal(PLAYERS_ADMINS_TITLE, 'Players/Admins');
  const scorecard = readFileSync(path.join(__dirname, '..', 'app', '(screens)', 'games', '[id].tsx'), 'utf8');
  assert.match(scorecard, /title=\{PLAYERS_ADMINS_TITLE\}/);
  assert.doesNotMatch(scorecard, /title="Players"/);
  const page = readFileSync(path.join(__dirname, '..', 'app', '(screens)', 'games', 'players.tsx'), 'utf8');
  assert.match(page, /title: PLAYERS_ADMINS_TITLE/);
  assert.match(page, /actionLabel="Retry"/);
  assert.match(page, /onAction=\{reload\}/);
  assert.match(page, /addNonPlayerAdmin\(game\.id, target\.id\)/);
  assert.match(page, /addAdminBlockedReason\(game, canScore\)/);
});

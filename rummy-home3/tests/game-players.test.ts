import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { linkTargetProblem, playerIdBadge, registrationLabel, seatMenu, seatRoleLabel, zerosForJoiner } from '../utils/gamePlayers';

const game = { createdBy: 'me', players: ['me', 'a', 'u'], adminIds: ['me', 'a'], unseatedAdminIds: [], spectators: ['w'] };

test('role and registration tags', () => {
  assert.equal(seatRoleLabel({ id: 'me', name: 'Me', seatRole: 'game_admin' }, game), 'Creator');
  assert.equal(seatRoleLabel({ id: 'a', name: 'A', seatRole: 'game_admin' }, game), 'Admin');
  assert.equal(seatRoleLabel({ id: 'u', name: 'U', seatRole: 'player' }, game), 'Player');
  assert.equal(seatRoleLabel({ id: 'w', name: 'W', seatRole: 'spectator' }, game), 'View only');
  assert.equal(registrationLabel({ status: 'registered' }), 'Registered');
  assert.equal(registrationLabel({}), 'Registered');
  assert.equal(registrationLabel({ status: 'pending' }), 'Pending');
  assert.equal(registrationLabel({ status: 'unregistered' }), 'Unregistered');
  assert.equal(playerIdBadge({ playerNo: 42 }), '#42');
  assert.equal(playerIdBadge({ playerCode: 'AB12' }), 'AB12');
  assert.equal(playerIdBadge({}), null);
});

test('per-player menu: creator keeps admin, identity actions only for my unregistered players, nothing for viewers', () => {
  assert.deepEqual(seatMenu({ id: 'u', name: 'U' }, game, 'me', false), []);
  const creator = seatMenu({ id: 'me', name: 'Me', seatRole: 'game_admin' }, game, 'me', true);
  assert.deepEqual(creator.map((m) => [m.item, m.enabled]), [['remove_admin', false]]);
  const registered = seatMenu({ id: 'a', name: 'A', seatRole: 'game_admin', status: 'registered' }, game, 'me', true);
  assert.deepEqual(registered.map((m) => m.item), ['remove_admin']);
  const mine = seatMenu({ id: 'u', name: 'U', seatRole: 'player', status: 'unregistered', managedBy: 'me' }, game, 'me', true);
  assert.deepEqual(mine.map((m) => [m.item, m.enabled]), [['make_admin', true], ['edit_name', true], ['invite', true], ['link_id', true]]);
  const theirs = seatMenu({ id: 'u', name: 'U', seatRole: 'player', status: 'pending', managedBy: 'someone-else' }, game, 'me', true);
  assert.deepEqual(theirs.map((m) => [m.item, m.enabled]), [['make_admin', true], ['edit_name', false], ['invite', false], ['link_id', false]]);
  assert.match(theirs[1].reason ?? '', /organiser who added/);
  const viewer = seatMenu({ id: 'w', name: 'W', seatRole: 'spectator' }, game, 'me', true);
  assert.deepEqual(viewer, []);
});

test('link target checks: unknown, same, unregistered, duplicate, ok', () => {
  assert.match(linkTargetProblem(null, game, 'u') ?? '', /No registered player/);
  assert.match(linkTargetProblem({ id: 'u' }, game, 'u') ?? '', /same player/);
  assert.match(linkTargetProblem({ id: 'x', status: 'unregistered', managedBy: 'me' }, game, 'u') ?? '', /not a registered account/);
  assert.match(linkTargetProblem({ id: 'a', status: 'registered' }, game, 'u') ?? '', /already in this game/);
  assert.match(linkTargetProblem({ id: 'w', status: 'registered' }, game, 'u') ?? '', /already in this game/);
  assert.equal(linkTargetProblem({ id: 'new', status: 'registered' }, game, 'u'), null);
});

test('a player joining mid-game gets an explicit 0 for every round already played', () => {
  assert.deepEqual(zerosForJoiner({ a: [-10, 20, -10], b: [10, -20, 10] }, ['a', 'b']), [0, 0, 0]);
  assert.deepEqual(zerosForJoiner({}, ['a']), []);
});

test('the Players page has no remove, no "Add view only" and no "Add non-player admin"', () => {
  const page = readFileSync(path.join(process.cwd(), 'app/(screens)/games/players.tsx'), 'utf8');
  assert.doesNotMatch(page, /Add view only|Add non-player admin|Remove player|removePlayer/);
  assert.match(page, /Add a player/);
  assert.match(page, /Link to a Player ID|link_id/);
});

test('migration 015 checks admin, ownership, registration and duplicates before moving a seat', () => {
  const sql = readFileSync(path.join(process.cwd(), 'supabase/migrations/015_link_seat_to_player.sql'), 'utf8');
  assert.match(sql, /is_game_admin\(p_game_id\)/);
  assert.match(sql, /managed_by is distinct from auth\.uid\(\)/);
  assert.match(sql, /not in \('unregistered', 'pending'\)/);
  assert.match(sql, /They are already in this game/);
  assert.match(sql, /update public\.scores set profile_id = p_target_profile where game_id = p_game_id/);
  assert.match(sql, /grant execute on function public\.link_seat_to_player[^;]*to authenticated/);
});

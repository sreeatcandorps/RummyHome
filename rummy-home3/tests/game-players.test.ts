import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { linkLanding, linkTargetProblem, myPlayerMenu, playerIdBadge, registrationLabel, SEAT_MENU_LABEL, seatMenu, seatRoleLabel, zerosForJoiner } from '../utils/gamePlayers';

const game = { createdBy: 'me', players: ['me', 'a', 'u'], adminIds: ['me', 'a'], unseatedAdminIds: [], spectators: ['w'] };

test('role and registration tags', () => {
  assert.equal(seatRoleLabel({ id: 'me', name: 'Me', seatRole: 'game_admin' }, game), 'Creator');
  assert.equal(seatRoleLabel({ id: 'a', name: 'A', seatRole: 'game_admin' }, game), 'Admin');
  assert.equal(seatRoleLabel({ id: 'u', name: 'U', seatRole: 'player' }, game), 'Player');
  assert.equal(seatRoleLabel({ id: 'w', name: 'W', seatRole: 'spectator' }, game), 'View only');
  assert.equal(registrationLabel({ status: 'registered' }), 'Registered');
  assert.equal(registrationLabel({}), 'Registered');
  assert.equal(registrationLabel({ status: 'pending' }), 'Pending registration');
  assert.equal(registrationLabel({ status: 'unregistered' }), 'Unregistered');
  assert.equal(playerIdBadge({ playerNo: 42 }), '#42');
  assert.equal(playerIdBadge({ playerCode: 'AB12' }), 'AB12');
  assert.equal(playerIdBadge({}), null);
});

test('per-player menu (unified, item 5): Invite · Link · Edit initials · Edit name · Make/Remove admin · Remove from game', () => {
  assert.deepEqual(seatMenu({ id: 'u', name: 'U' }, game, 'me', false), []);
  const creator = seatMenu({ id: 'me', name: 'Me', seatRole: 'game_admin' }, game, 'me', true);
  assert.deepEqual(creator.map((m) => [m.item, m.enabled]), [['edit_initials', true], ['remove_admin', false], ['remove_player', true]]);
  const registered = seatMenu({ id: 'a', name: 'A', seatRole: 'game_admin', status: 'registered' }, game, 'me', true);
  assert.deepEqual(registered.map((m) => m.item), ['edit_initials', 'remove_admin', 'remove_player']);
  const mine = seatMenu({ id: 'u', name: 'U', seatRole: 'player', status: 'unregistered', managedBy: 'me' }, game, 'me', true);
  assert.deepEqual(mine.map((m) => [m.item, m.enabled]), [['invite', true], ['link_id', true], ['edit_initials', true], ['edit_name', true], ['make_admin', true], ['remove_player', true]]);
  const theirs = seatMenu({ id: 'u', name: 'U', seatRole: 'player', status: 'pending', managedBy: 'someone-else' }, game, 'me', true);
  assert.deepEqual(theirs.map((m) => [m.item, m.enabled]), [['invite', false], ['link_id', false], ['edit_initials', true], ['edit_name', false], ['make_admin', true], ['remove_player', true]]);
  assert.match(theirs[0].reason ?? '', /organiser who added/);
  const viewer = seatMenu({ id: 'w', name: 'W', seatRole: 'spectator' }, game, 'me', true);
  assert.deepEqual(viewer, []);
  assert.equal(SEAT_MENU_LABEL.link_id, 'Link to Player ID');
  assert.equal(SEAT_MENU_LABEL.invite, 'Invite to register');
  // The same menu on My players: no game roles; Remove from My players at the end.
  assert.deepEqual(myPlayerMenu({ id: 'u', status: 'unregistered', managedBy: 'me' }, 'me').map((m) => m.item), ['invite', 'link_id', 'edit_initials', 'edit_name', 'remove_from_list']);
  assert.deepEqual(myPlayerMenu({ id: 'a', status: 'registered' }, 'me').map((m) => m.item), ['edit_initials', 'remove_from_list']);
  assert.deepEqual(myPlayerMenu({ id: 'me', status: 'registered' }, 'me'), [], 'the owner has no menu on their own row');
});

test('link target checks: unknown, same, unregistered, already seated, ok', () => {
  assert.match(linkTargetProblem(null, game, 'u') ?? '', /No registered player/);
  assert.match(linkTargetProblem({ id: 'u' }, game, 'u') ?? '', /same player/);
  assert.match(linkTargetProblem({ id: 'x', status: 'unregistered', managedBy: 'me' }, game, 'u') ?? '', /not a registered account/);
  assert.match(linkTargetProblem({ id: 'a', status: 'registered' }, game, 'u') ?? '', /already playing/);
  assert.equal(linkTargetProblem({ id: 'new', status: 'registered' }, game, 'u'), null);
});

test('a viewer or non-playing admin of the game can take the seat (Nov 10 finding)', () => {
  const withAdmin = { ...game, unseatedAdminIds: ['boss'], adminIds: ['me', 'a', 'boss'] };
  assert.equal(linkTargetProblem({ id: 'w', status: 'registered' }, withAdmin, 'u'), null);
  assert.equal(linkTargetProblem({ id: 'boss', status: 'registered' }, withAdmin, 'u'), null);
  assert.equal(linkLanding({ id: 'w' }, withAdmin), 'viewer_takes_seat');
  assert.equal(linkLanding({ id: 'boss' }, withAdmin), 'admin_takes_seat');
  assert.equal(linkLanding({ id: 'new' }, withAdmin), 'new_seat');
});

test('a player joining mid-game gets an explicit 0 for every round already played', () => {
  assert.deepEqual(zerosForJoiner({ a: [-10, 20, -10], b: [10, -20, 10] }, ['a', 'b']), [0, 0, 0]);
  assert.deepEqual(zerosForJoiner({}, ['a']), []);
});

test('the Players page has Remove from game (rule-checked, confirmed) but no "Add view only" or "Add non-player admin"', () => {
  const page = readFileSync(path.join(process.cwd(), 'app/(screens)/games/players.tsx'), 'utf8');
  assert.doesNotMatch(page, /Add view only|Add non-player admin/);
  assert.match(page, />\s*Add new player\s*</, 'the bottom button reads Add new player');
  assert.doesNotMatch(page, /Add new players/);
  assert.match(page, /link_id/);
  assert.match(page, /<PlayerActionMenu/, 'the unified menu component');
  assert.match(page, /item === 'remove_player'/);
  assert.match(page, /seatRemovalProblem\(game\.scores\[seat\.id\]\)/, 'the delete rule runs before anything is asked');
  assert.match(page, /kind: 'remove_blocked', message: problem/, 'a blocked removal shows the exact message');
  assert.match(page, /Remove \{sheet\.seat\.name\}\?/, 'a confirmation comes first');
  assert.match(page, /gamesService\.removeSeatIfNoScores\(game\.id, sheet\.seat\.id\)/, 'the confirm runs the same removal as the picker');
  assert.equal(SEAT_MENU_LABEL.remove_player, 'Remove from game');
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

test('migration 017 lets a non-playing admin or viewer take the seat and still refuses a seated target', () => {
  const sql = readFileSync(path.join(process.cwd(), 'supabase/migrations/017_link_seat_takeover.sql'), 'utf8');
  assert.match(sql, /create or replace function public\.link_seat_to_player\(p_game_id uuid, p_seat_profile uuid, p_target_profile uuid\)/);
  assert.match(sql, /security definer/);
  assert.match(sql, /is_game_admin\(p_game_id\)/);
  assert.match(sql, /They are already playing in this game/);
  assert.doesNotMatch(sql, /'They are already in this game\.'/);
  assert.match(sql, /delete from public\.game_players gp where gp\.id = existing\.id/);
  assert.match(sql, /role = case when existing\.role = 'game_admin' then 'game_admin' else role end/);
  assert.match(sql, /if p_target_profile <> auth\.uid\(\) then\s+insert into public\.my_players/);
  assert.match(sql, /grant execute on function public\.link_seat_to_player[^;]*to authenticated/);
  const rollback = readFileSync(path.join(process.cwd(), 'supabase/rollback/rollback_017_link_seat_takeover.sql'), 'utf8');
  assert.match(rollback, /create or replace function public\.link_seat_to_player/);
  assert.match(rollback, /They are already in this game/);
  const doc = readFileSync(path.join(process.cwd(), 'docs/migrations-to-apply.md'), 'utf8');
  assert.match(doc, /## 017/);
});

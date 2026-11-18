-- 017 link_seat_to_player: hand an unregistered seat (and its scores / dealer turns in this
-- game) to a registered Player ID. Refusals from 015 stay; 017 adds: a non-playing admin or a
-- viewer who is already in the game takes the seat; a seated target is still refused; linking
-- to yourself adds no self row in My players.
-- Game A: rk (sree's placeholder) seated with +30 / 0; viewer = spectator; coadmin = unseated game_admin;
--         outsider not in A; harish seated; sree = creator, not seated.
begin;
select plan(25);

-- not an admin of A
select tests.login('00000000-0000-4000-8000-000000000003');
select throws_ok(
  $$ select * from public.link_seat_to_player('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000005') $$,
  '42501', 'Only a game admin can link players.', 'seated player cannot link');

-- admin of A but not the organiser who added rk (coadmin manages nobody)
select tests.login('00000000-0000-4000-8000-000000000006');
select throws_ok(
  $$ select * from public.link_seat_to_player('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000005') $$,
  'Only the organiser who added this player can change them.', 'co-admin who did not add the placeholder cannot link it');

select tests.login('00000000-0000-4000-8000-000000000001');
-- seat must be an unregistered player
select throws_ok(
  $$ select * from public.link_seat_to_player('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000005') $$,
  'Only an unregistered player can be linked to a Player ID.', 'a registered seat cannot be re-linked');
-- target must be a registered, unmanaged account
select throws_ok(
  $$ select * from public.link_seat_to_player('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a3') $$,
  'That Player ID is not a registered account.', 'target cannot be another placeholder');
select throws_ok(
  $$ select * from public.link_seat_to_player('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000ff') $$,
  'That Player ID is not a registered account.', 'unknown target id');
-- seated target refused (017 keeps this)
select throws_ok(
  $$ select * from public.link_seat_to_player('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000002') $$,
  'They are already playing in this game.', 'a seated target is refused');
-- placeholder not in this game
select throws_ok(
  $$ select * from public.link_seat_to_player('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-000000000005') $$,
  'That player is not in this game.', 'a placeholder that is not seated in A cannot be linked in A');

-- 017 case 1: the unseated co-admin takes the seat and stays admin
select results_eq(
  $$ select id, display_name from public.link_seat_to_player('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000006') $$,
  $$ values ('00000000-0000-4000-8000-000000000006'::uuid, 'Cora Coadmin'::text) $$,
  'non-playing co-admin takes rk''s seat');
select is((select count(*) from public.game_players where game_id = '10000000-0000-4000-8000-00000000000a' and profile_id = '00000000-0000-4000-8000-000000000006')::int, 1, 'co-admin has exactly one membership row');
select results_eq(
  $$ select role::text, seated, player_order from public.game_players where game_id = '10000000-0000-4000-8000-00000000000a' and profile_id = '00000000-0000-4000-8000-000000000006' $$,
  $$ values ('game_admin'::text, true, 2) $$,
  'co-admin is now seated in rk''s seat order and still game_admin');
select is((select count(*) from public.game_players where game_id = '10000000-0000-4000-8000-00000000000a' and profile_id = '00000000-0000-4000-8000-0000000000a1')::int, 0, 'rk no longer has a seat in A');
select is((select sum(value) from public.scores where game_id = '10000000-0000-4000-8000-00000000000a' and profile_id = '00000000-0000-4000-8000-000000000006')::int, 30, 'rk''s +30 / 0 moved to the co-admin');
select is((select count(*) from public.rounds where game_id = '10000000-0000-4000-8000-00000000000a' and dealer_profile_id = '00000000-0000-4000-8000-0000000000a1')::int, 0, 'dealer turns moved off the placeholder');
select is((select player_status from public.profiles where id = '00000000-0000-4000-8000-0000000000a1'), 'merged', 'rk had no other games, so it is marked merged');
select ok(not exists (select 1 from public.my_players where owner_id = auth.uid() and player_id = '00000000-0000-4000-8000-0000000000a1'), 'rk dropped from sree''s My players');
select ok(exists (select 1 from public.my_players where owner_id = auth.uid() and player_id = '00000000-0000-4000-8000-000000000006'), 'co-admin added to sree''s My players');

-- 017 case 2: a viewer takes a seat (new placeholder cd seated into A for this)
select tests.logout();
update public.profiles set managed_by = '00000000-0000-4000-8000-000000000001' where id = '00000000-0000-4000-8000-0000000000a3';
insert into public.game_players (game_id, profile_id, player_order, role, seated)
values ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a3', 6, 'player', true);
select tests.login('00000000-0000-4000-8000-000000000001');
select lives_ok(
  $$ select * from public.link_seat_to_player('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-000000000004') $$,
  'viewer takes cd''s seat');
select results_eq(
  $$ select role::text, seated from public.game_players where game_id = '10000000-0000-4000-8000-00000000000a' and profile_id = '00000000-0000-4000-8000-000000000004' $$,
  $$ values ('player'::text, true) $$,
  'viewer is now a seated player, one row');
select is((select player_status from public.profiles where id = '00000000-0000-4000-8000-0000000000a3'), 'unregistered', 'cd still has game C, so it is NOT merged');

-- 017 case 3: an outsider takes a seat and lands in My players
select tests.logout();
insert into public.profiles (id, display_name, first_name, last_name, player_status, managed_by, player_code)
values ('00000000-0000-4000-8000-0000000000a4', 'E F', 'E', 'F', 'unregistered', '00000000-0000-4000-8000-000000000001', 'EF0004');
insert into public.game_players (game_id, profile_id, player_order, role, seated)
values ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a4', 7, 'player', true);
select tests.login('00000000-0000-4000-8000-000000000001');
select lives_ok(
  $$ select * from public.link_seat_to_player('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-000000000005') $$,
  'outsider is linked into the seat');
select ok(exists (select 1 from public.my_players where owner_id = auth.uid() and player_id = '00000000-0000-4000-8000-000000000005'), 'outsider added to sree''s My players');

-- 017 case 4: linking to yourself writes no self row in My players (sree is not seated in A)
select tests.logout();
insert into public.profiles (id, display_name, first_name, last_name, player_status, managed_by, player_code)
values ('00000000-0000-4000-8000-0000000000a5', 'G H', 'G', 'H', 'unregistered', '00000000-0000-4000-8000-000000000001', 'GH0005');
insert into public.game_players (game_id, profile_id, player_order, role, seated)
values ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a5', 8, 'player', true);
select tests.login('00000000-0000-4000-8000-000000000001');
select lives_ok(
  $$ select * from public.link_seat_to_player('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a5', auth.uid()) $$,
  'organiser links a seat to their own Player ID');
select results_eq(
  $$ select seated from public.game_players where game_id = '10000000-0000-4000-8000-00000000000a' and profile_id = auth.uid() $$,
  $$ values (true) $$,
  'organiser is now seated');
select ok(not exists (select 1 from public.my_players where owner_id = auth.uid() and player_id = auth.uid()), 'no self row in My players');

-- the app admin may link anyone''s placeholder (bypasses the managed_by check)
select tests.logout();
insert into public.profiles (id, display_name, first_name, last_name, player_status, managed_by, player_code)
values ('00000000-0000-4000-8000-0000000000a6', 'I J', 'I', 'J', 'unregistered', '00000000-0000-4000-8000-000000000002', 'IJ0006');
insert into public.game_players (game_id, profile_id, player_order, role, seated)
values ('10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000a6', 5, 'player', true);
select tests.login('00000000-0000-4000-8000-000000000007');
select lives_ok(
  $$ select * from public.link_seat_to_player('10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000a6', '00000000-0000-4000-8000-000000000008') $$,
  'app admin links a placeholder they do not manage');

select * from finish();
rollback;

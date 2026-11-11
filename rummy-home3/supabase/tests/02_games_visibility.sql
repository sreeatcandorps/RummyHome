-- Who can see game A and who can write to it (006 is_game_member / is_game_admin, 001/002 policies).
-- Game A: created by sree (not seated); harish, priya, rk, zero seated players; viewer spectator; coadmin unseated game_admin.
begin;
select plan(24);

-- outsider: nothing
select tests.login('00000000-0000-4000-8000-000000000005');
select is((select count(*) from public.games)::int, 0, 'outsider lists no games');
select is((select count(*) from public.list_visible_game_ids())::int, 0, 'outsider: list_visible_game_ids is empty');
select is((select count(*) from public.rounds)::int, 0, 'outsider reads no rounds');
select is((select count(*) from public.scores)::int, 0, 'outsider reads no scores');
select is((select count(*) from public.game_players)::int, 0, 'outsider reads no seats');
select throws_like(
  $$ insert into public.rounds (game_id, round_number, created_by) values ('10000000-0000-4000-8000-00000000000a', 9, auth.uid()) $$,
  '%row-level security%', 'outsider cannot insert a round');

-- seated player: sees, cannot score
select tests.login('00000000-0000-4000-8000-000000000003');
select ok(exists (select 1 from public.games where id = '10000000-0000-4000-8000-00000000000a'), 'seated player sees game A');
select ok('10000000-0000-4000-8000-00000000000a' in (select * from public.list_visible_game_ids()), 'seated player: A in list_visible_game_ids');
select is((select count(*) from public.rounds where game_id = '10000000-0000-4000-8000-00000000000a')::int, 3, 'seated player reads all three round rows (2 live + 1 undone)');
select throws_like(
  $$ insert into public.rounds (game_id, round_number, created_by) values ('10000000-0000-4000-8000-00000000000a', 9, auth.uid()) $$,
  '%row-level security%', 'seated player cannot insert a round');
update public.game_players set role = 'game_admin' where game_id = '10000000-0000-4000-8000-00000000000a' and profile_id = auth.uid();
select is((select role::text from public.game_players where game_id = '10000000-0000-4000-8000-00000000000a' and profile_id = auth.uid()), 'player', 'seated player cannot promote themselves (update touches 0 rows)');
select ok(not exists (select 1 from public.games where id = '10000000-0000-4000-8000-00000000000c'), 'seated player does not see game C they are not in');

-- viewer (spectator): sees, cannot score
select tests.login('00000000-0000-4000-8000-000000000004');
select ok(exists (select 1 from public.games where id = '10000000-0000-4000-8000-00000000000a'), 'viewer sees game A');
select is((select count(*) from public.scores where game_id = '10000000-0000-4000-8000-00000000000a')::int, 10, 'viewer reads the scores');
select throws_like(
  $$ insert into public.rounds (game_id, round_number, created_by) values ('10000000-0000-4000-8000-00000000000a', 9, auth.uid()) $$,
  '%row-level security%', 'viewer cannot insert a round');
select ok(not public.is_game_admin('10000000-0000-4000-8000-00000000000a'), 'viewer is not a game admin');

-- non-playing creator: sees and can score
select tests.login('00000000-0000-4000-8000-000000000001');
select ok(exists (select 1 from public.games where id = '10000000-0000-4000-8000-00000000000a'), 'non-playing creator sees game A');
select ok(public.is_game_admin('10000000-0000-4000-8000-00000000000a'), 'non-playing creator is a game admin');
select lives_ok(
  $$ insert into public.rounds (game_id, round_number, created_by) values ('10000000-0000-4000-8000-00000000000a', 9, auth.uid()) $$,
  'non-playing creator can insert a round');

-- unseated co-admin: sees and can score
select tests.login('00000000-0000-4000-8000-000000000006');
select ok(exists (select 1 from public.games where id = '10000000-0000-4000-8000-00000000000a'), 'unseated co-admin sees game A');
select ok(public.is_game_admin('10000000-0000-4000-8000-00000000000a'), 'unseated co-admin is a game admin');
select lives_ok(
  $$ insert into public.rounds (game_id, round_number, created_by) values ('10000000-0000-4000-8000-00000000000a', 10, auth.uid()) $$,
  'unseated co-admin can insert a round');

-- app admin: sees everything
select tests.login('00000000-0000-4000-8000-000000000007');
select is((select count(*) from public.games)::int, 3, 'app admin lists every game');

-- anon: nothing
select tests.anon();
select is((select count(*) from public.games)::int, 0, 'anon lists no games');

select * from finish();
rollback;

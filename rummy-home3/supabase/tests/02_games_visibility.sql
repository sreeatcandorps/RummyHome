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
  '%permission denied%', 'outsider cannot insert a round (036: no direct inserts at all)');

-- seated player: sees, cannot score
select tests.login('00000000-0000-4000-8000-000000000003');
select ok(exists (select 1 from public.games where id = '10000000-0000-4000-8000-00000000000a'), 'seated player sees game A');
select ok('10000000-0000-4000-8000-00000000000a' in (select * from public.list_visible_game_ids()), 'seated player: A in list_visible_game_ids');
select is((select count(*) from public.rounds where game_id = '10000000-0000-4000-8000-00000000000a')::int, 4, 'seated player reads all four round rows (2 live + 2 undone)');
select throws_like(
  $$ insert into public.rounds (game_id, round_number, created_by) values ('10000000-0000-4000-8000-00000000000a', 9, auth.uid()) $$,
  '%permission denied%', 'seated player cannot insert a round');
update public.game_players set role = 'game_admin' where game_id = '10000000-0000-4000-8000-00000000000a' and profile_id = auth.uid();
select is((select role::text from public.game_players where game_id = '10000000-0000-4000-8000-00000000000a' and profile_id = auth.uid()), 'player', 'seated player cannot promote themselves (update touches 0 rows)');
select ok(not exists (select 1 from public.games where id = '10000000-0000-4000-8000-00000000000c'), 'seated player does not see game C they are not in');

-- viewer (spectator): sees, cannot score
select tests.login('00000000-0000-4000-8000-000000000004');
select ok(exists (select 1 from public.games where id = '10000000-0000-4000-8000-00000000000a'), 'viewer sees game A');
select is((select count(*) from public.scores where game_id = '10000000-0000-4000-8000-00000000000a')::int, 12, 'viewer reads the scores');
select throws_like(
  $$ insert into public.rounds (game_id, round_number, created_by) values ('10000000-0000-4000-8000-00000000000a', 9, auth.uid()) $$,
  '%permission denied%', 'viewer cannot insert a round');
select ok(not public.is_game_admin('10000000-0000-4000-8000-00000000000a'), 'viewer is not a game admin');

-- non-playing creator: sees and can score
select tests.login('00000000-0000-4000-8000-000000000001');
select ok(exists (select 1 from public.games where id = '10000000-0000-4000-8000-00000000000a'), 'non-playing creator sees game A');
select ok(public.is_game_admin('10000000-0000-4000-8000-00000000000a'), 'non-playing creator is a game admin');
select lives_ok(
  $$ select public.save_round('10000000-0000-4000-8000-00000000000a', 3,
       '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-10},
         {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"rummy","value":10}]'::jsonb, false) $$,
  'non-playing creator can save a round (036: through save_round only)');

-- unseated co-admin: sees and can score
select tests.login('00000000-0000-4000-8000-000000000006');
select ok(exists (select 1 from public.games where id = '10000000-0000-4000-8000-00000000000a'), 'unseated co-admin sees game A');
select ok(public.is_game_admin('10000000-0000-4000-8000-00000000000a'), 'unseated co-admin is a game admin');
select lives_ok(
  $$ select public.save_round('10000000-0000-4000-8000-00000000000a', 4,
       '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-10},
         {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"rummy","value":10}]'::jsonb, false) $$,
  'unseated co-admin can save a round');

-- app admin: sees everything
select tests.login('00000000-0000-4000-8000-000000000007');
select is((select count(*) from public.games)::int, 3, 'app admin lists every game');

-- anon: nothing
select tests.anon();
select is((select count(*) from public.games)::int, 0, 'anon lists no games');

select * from finish();
rollback;

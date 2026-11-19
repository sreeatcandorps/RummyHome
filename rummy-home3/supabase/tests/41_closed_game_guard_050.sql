-- 050: a Closed game (in a saved result) cannot change on the server: no round saved, undone or edited,
-- no score touched, no status / completed_at change — until the result is deleted. Identity moves on
-- rounds (dealer_profile_id) stay allowed. Game R: sree (admin, seated) with harish and priya, Points.
begin;
select plan(19);

\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set R '''10000000-0000-4000-8000-0000000000f5'''

-- ---------- shape ----------
select has_function('public', 'games_closed_guard', array[]::text[], '050 games guard function');
select has_function('public', 'rounds_closed_guard', array[]::text[], '050 rounds / scores guard function');
select has_trigger('public', 'games', 'games_closed_guard', '050 trigger on games');
select has_trigger('public', 'rounds', 'rounds_closed_guard', '050 trigger on rounds');
select has_trigger('public', 'scores', 'scores_closed_guard', '050 trigger on scores');

-- ---------- game R: one round, Completed, in a result ----------
insert into public.games (id, created_by, status, game_type, settings, share_code)
values (:R, :SREE, 'active', 'stake',
        '{"gameType":"stake","expenseEnabled":false,"expenseAmount":0,"stakeDrop":-10,"stakeMiddleDrop":-30,"maxCount":-80}', 'CLOS50');
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated) values
  (:R, :SREE, 0, 1, 'game_admin', true),
  (:R, :HARISH, 1, 2, 'player', true),
  (:R, :PRIYA, 2, 3, 'player', true);

select tests.login(:SREE);
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000f5', 1,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":50},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-20},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-30}]'::jsonb, false) $$, 'round 1 saved while Active');
update public.games set status = 'completed', completed_at = now() where id = :R;
select lives_ok($$ select public.declare_game_result(array['10000000-0000-4000-8000-0000000000f5']::uuid[]) $$, 'sree saves a result for R');
select tests.logout();
create temp table t_rr as select grg.result_id as id from public.game_result_games grg where grg.game_id = :R limit 1;
grant select on t_rr to authenticated;
select ok((select closed_at is not null from public.games where id = :R), 'R is Closed');
-- as the database owner (RLS lets no app role edit a score row anyway): the trigger is what refuses
select throws_ok($$ update public.scores set value = -99 where game_id = '10000000-0000-4000-8000-0000000000f5' and profile_id = '00000000-0000-4000-8000-000000000002' $$,
  'PT423', 'This game is Closed: it is part of a saved result. Delete the result first.', '050 a score of a Closed game cannot be edited, not even directly');
select throws_ok($$ insert into public.rounds (game_id, round_number, dealer_profile_id, created_by) values ('10000000-0000-4000-8000-0000000000f5', 2, '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001') $$,
  'PT423', 'This game is Closed: it is part of a saved result. Delete the result first.', '050 a round cannot be inserted into a Closed game, not even directly');
select tests.login(:SREE);

-- ---------- nothing changes while Closed ----------
select throws_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000f5', 2,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-5},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-5}]'::jsonb, false) $$,
  'PT423', 'This game is Closed: it is part of a saved result. Delete the result first.', '050 save_round on a Closed game is refused');
select throws_ok($$ select public.undo_last_round('10000000-0000-4000-8000-0000000000f5') $$,
  'PT423', 'This game is Closed: it is part of a saved result. Delete the result first.', '050 undo on a Closed game is refused');
select throws_ok($$ update public.games set status = 'active', completed_at = null where id = '10000000-0000-4000-8000-0000000000f5' $$,
  'PT423', 'This game is Closed: it is part of a saved result. Delete the result first.', '050 a Closed game cannot go back to Active');
select lives_ok($$ update public.rounds set dealer_profile_id = '00000000-0000-4000-8000-000000000003' where game_id = '10000000-0000-4000-8000-0000000000f5' $$,
  '050 an identity move on the dealer column is still allowed (seat linking)');
select is((select count(*)::int from public.rounds where game_id = :R and undone_at is null), 1, '050 still exactly one live round');

-- ---------- the result goes, the game is Completed again, and everything works ----------
select lives_ok($$ select public.delete_result((select id from t_rr)) $$, 'the result is deleted');
select ok((select closed_at is null from public.games where id = :R), 'R is back to Completed');
select lives_ok($$ update public.games set status = 'active', completed_at = null where id = '10000000-0000-4000-8000-0000000000f5' $$, '050 reopen allowed once the result is gone');
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000f5', 2,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-5},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-5}]'::jsonb, false) $$, '050 round 2 saves after the result is gone');

select tests.logout();
select * from finish();
rollback;

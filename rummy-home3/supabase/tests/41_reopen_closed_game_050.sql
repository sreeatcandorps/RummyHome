-- 050 (D49 B): a Closed game can be reopened. The result that counts it stays, stamped Out of date; every
-- other game in that result goes Closed → Completed; the Log says so; the results RPCs carry the stamp.
-- While a game is still Closed its rounds and scores do not change (reopen first). Games R1 and R2: sree
-- (admin, seated) with harish and priya, Points; one result over both.
begin;
select plan(28);

\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set R1 '''10000000-0000-4000-8000-0000000000f5'''
\set R2 '''10000000-0000-4000-8000-0000000000f6'''

-- ---------- shape ----------
select has_function('public', 'games_reopen_closed', array[]::text[], '050 reopen function');
select has_function('public', 'rounds_closed_guard', array[]::text[], '050 rounds / scores guard function');
select has_function('public', 'result_stale_json', array['uuid'], '050 stale json');
select has_function('public', 'get_game_result_v028', array['uuid'], '050 keeps the 028 body under a versioned name');
select has_trigger('public', 'games', 'games_reopen_closed', '050 trigger on games');
select has_trigger('public', 'rounds', 'rounds_closed_guard', '050 trigger on rounds');
select has_trigger('public', 'scores', 'scores_closed_guard', '050 trigger on scores');
select has_column('public', 'game_results', 'stale_at', '050 stale_at column');
select ok(not exists (select 1 from pg_trigger where tgname = 'games_closed_guard'), '050 the first draft''s status guard is not there');

-- ---------- two games, one round each, Completed, one result over both ----------
insert into public.games (id, created_by, status, game_type, settings, share_code) values
  (:R1, :SREE, 'active', 'stake', '{"gameType":"stake","expenseEnabled":false,"expenseAmount":0,"stakeDrop":-10,"stakeMiddleDrop":-30,"maxCount":-80}', 'CLOS51'),
  (:R2, :SREE, 'active', 'stake', '{"gameType":"stake","expenseEnabled":false,"expenseAmount":0,"stakeDrop":-10,"stakeMiddleDrop":-30,"maxCount":-80}', 'CLOS52');
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated) values
  (:R1, :SREE, 0, 1, 'game_admin', true), (:R1, :HARISH, 1, 2, 'player', true), (:R1, :PRIYA, 2, 3, 'player', true),
  (:R2, :SREE, 0, 1, 'game_admin', true), (:R2, :HARISH, 1, 2, 'player', true), (:R2, :PRIYA, 2, 3, 'player', true);

select tests.login(:SREE);
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000f5', 1,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":50},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-20},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-30}]'::jsonb, false) $$, 'R1 round 1 saved');
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000f6', 1,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"count","value":-10},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"rummy","value":40},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-30}]'::jsonb, false) $$, 'R2 round 1 saved');
update public.games set status = 'completed', completed_at = now() where id in (:R1, :R2);
select lives_ok($$ select public.declare_game_result(array['10000000-0000-4000-8000-0000000000f5', '10000000-0000-4000-8000-0000000000f6']::uuid[]) $$, 'sree saves one result over R1 and R2');
select tests.logout();
create temp table t_rr as select grg.result_id as id from public.game_result_games grg where grg.game_id = :R1 limit 1;
grant select on t_rr to authenticated;
select ok((select closed_at is not null from public.games where id = :R1) and (select closed_at is not null from public.games where id = :R2), 'R1 and R2 are Closed');

-- ---------- while Closed: rounds and scores do not change (not even directly) ----------
select throws_ok($$ update public.scores set value = -99 where game_id = '10000000-0000-4000-8000-0000000000f5' and profile_id = '00000000-0000-4000-8000-000000000002' $$,
  'PT423', 'This game is Closed: it is part of a saved result. Reopen it first.', '050 a score of a Closed game cannot be edited directly');
select tests.login(:SREE);
select throws_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000f5', 2,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-5},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-5}]'::jsonb, false) $$,
  'PT423', 'This game is Closed: it is part of a saved result. Reopen it first.', '050 save_round on a Closed game is refused (reopen is the door)');
select is((select public.get_game_result((select id from t_rr))->>'staleAt'), null, 'the result is not Out of date before the reopen');

-- ---------- the door: reopen R1 ----------
select lives_ok($$ update public.games set status = 'active', completed_at = null where id = '10000000-0000-4000-8000-0000000000f5' $$, '050 a Closed game can be reopened');
select ok((select closed_at is null and status = 'active' from public.games where id = :R1), 'R1 is Active and no longer Closed');
select ok((select closed_at is null and status = 'completed' from public.games where id = :R2), 'R2 went Closed → Completed with it');
select is((select public.get_game_result((select id from t_rr))->>'staleBy'), '00000000-0000-4000-8000-000000000001', 'the result is stamped Out of date by sree');
select is((select public.get_game_result((select id from t_rr))->>'staleGameId'), '10000000-0000-4000-8000-0000000000f5', 'the stamp names R1');
select is((select public.get_game_result((select id from t_rr))->>'staleGameLabel'), (select public.game_label_text(game_label, game_number) from public.games where id = :R1), 'get_game_result carries the stamp (game label)');
select ok((select bool_or((e->>'id') = (select id from t_rr)::text and e->>'staleAt' is not null) from jsonb_array_elements(public.list_game_results_page(10, 0)) e), 'list_game_results_page carries the stamp');
select ok(exists (select 1 from public.event_log where game_id = :R2 and kind = 'unclosed' and summary like 'Back to Completed — result % is Out of date%'), 'R2''s Log says its result is Out of date');
select ok(exists (select 1 from public.event_log where game_id = :R1 and kind = 'unclosed' and summary like 'Reopened while Closed — result % is Out of date%'), 'R1''s Log says it was reopened while Closed');

-- ---------- after the reopen: scores change, the result does not ----------
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000f5', 2,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-5},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-5}]'::jsonb, false) $$, '050 round 2 saves after the reopen');
select is((select jsonb_array_length(public.get_game_result((select id from t_rr))->'standings')), 3, 'the result still has its stored standings');
update public.games set status = 'completed', completed_at = now() where id = :R1;
select ok((select public.get_game_result((select id from t_rr))->>'staleAt' is not null), 'completing again does not clear the stamp (the numbers moved)');

select tests.logout();
select * from finish();
rollback;

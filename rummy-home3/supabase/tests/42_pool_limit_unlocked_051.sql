-- 051 (D53): the pool limit may change once rounds exist. Changing it re-reads who is out against the
-- new limit and logs each player who went out or came back in. The 042 lock is gone.
-- Game U: sree (admin, seated) with harish, priya; limit 101.
begin;
select plan(23);

\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set U '''10000000-0000-4000-8000-0000000000f1'''
\set PTS '''10000000-0000-4000-8000-0000000000f2'''

-- ---------- shape ----------
select hasnt_trigger('public', 'games', 'games_pool_settings_lock', '051 the 042 lock trigger is gone');
select hasnt_function('public', 'games_pool_settings_lock', array[]::text[], '051 the lock function is gone');
select has_function('public', 'games_pool_limit_changed', array[]::text[], '051 trigger function exists');
select has_trigger('public', 'games', 'games_pool_limit_changed', '051 trigger on games');
select ok(not has_function_privilege('authenticated', 'public.games_pool_limit_changed()', 'execute'), '051 the trigger function is not callable directly');

-- ---------- game U ----------
insert into public.games (id, created_by, status, game_type, settings, share_code)
values (:U, :SREE, 'active', 'pool',
        '{"gameType":"pool","poolLimit":101,"dropAmount":25,"mdAmount":50,"maxCount":80}', 'POOL51');
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated) values
  (:U, :SREE, 0, 1, 'game_admin', true),
  (:U, :HARISH, 1, 2, 'player', true),
  (:U, :PRIYA, 2, 3, 'player', true);

select tests.login(:SREE);

-- no rounds yet: the limit changes quietly (settings_changed only)
select lives_ok($$ update public.games set settings = settings || '{"poolLimit":151}' where id = '10000000-0000-4000-8000-0000000000f1' $$, 'limit 101→151 before any round');
select is((select count(*)::int from public.event_log where game_id = :U and kind in ('player_out', 'player_back_in')), 0, 'no out / back-in lines without rounds');
update public.games set settings = settings || '{"poolLimit":101}' where id = :U;

-- round 1: harish 60, priya 30 · round 2: harish 50 (110, out), priya 30 (60)
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000f1', 1,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":0},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":60},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":30}]'::jsonb, false) $$, 'round 1');
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000f1', 2,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":0},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":50},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":30}]'::jsonb, false) $$, 'round 2');
select is((select out_round from public.game_players where game_id = :U and profile_id = :HARISH), 2, 'harish is out in round 2 at 101');

-- ---------- raise the limit: harish comes back ----------
select lives_ok($$ update public.games set settings = settings || '{"poolLimit":201}' where id = '10000000-0000-4000-8000-0000000000f1' $$,
  '051 the limit may change once rounds exist (042 lock gone)');
select is((select out_round from public.game_players where game_id = :U and profile_id = :HARISH), null, '051 harish is back in at 201');
select is(public.pool_players_in(:U), array[:SREE, :HARISH, :PRIYA]::uuid[], '051 three in again, seat order');
select is((select summary from public.event_log where game_id = :U and kind = 'player_back_in' order by id desc limit 1),
  'Harish Test is back in · 110 (limit 201)', '051 the Log says who came back, with the total and the new limit');
select is((select details->>'wasOutRound' from public.event_log where game_id = :U and kind = 'player_back_in' order by id desc limit 1), '2', '051 and the round they had gone out in');
select is((select level::text from public.event_log where game_id = :U and kind = 'player_back_in' order by id desc limit 1), 'important', '051 back-in lines are important');
select is((select count(*)::int from public.event_log where game_id = :U and kind = 'settings_changed' and summary like '%Pool limit 101→201%'), 1, '042 settings_changed line still written');

-- ---------- lower the limit: harish (110) and priya (60) go out, sree (0) stays ----------
select lives_ok($$ update public.games set settings = settings || '{"poolLimit":51}' where id = '10000000-0000-4000-8000-0000000000f1' $$, 'limit 201→51');
select is((select out_round from public.game_players where game_id = :U and profile_id = :HARISH), 1, '051 harish out in round 1 at 51 (60 ≥ 51)');
select is((select out_round from public.game_players where game_id = :U and profile_id = :PRIYA), 2, '051 priya out in round 2 at 51 (30+30)');
select is(public.pool_players_in(:U), array[:SREE]::uuid[], '051 only sree is in');
select is((select summary from public.event_log where game_id = :U and kind = 'player_out' and (details->>'limitChanged')::boolean order by id desc limit 1),
  'Priya Test is out · 60 (limit 51) · Round 2', '051 the Log names each player put out by the new limit');

-- ---------- a Points game is untouched ----------
insert into public.games (id, created_by, status, game_type, settings, share_code)
values (:PTS, :SREE, 'active', 'stake', '{"gameType":"points","dropAmount":25,"mdAmount":50,"maxCount":80}', 'PTS51');
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated) values (:PTS, :SREE, 0, 1, 'game_admin', true);
select lives_ok($$ update public.games set settings = settings || '{"poolLimit":201}' where id = '10000000-0000-4000-8000-0000000000f2' $$, 'a Points game ignores poolLimit');

select * from finish();
rollback;

-- 049 (D46 C): reopening a pool that has awards clears them and writes a Log line; a pool without
-- awards and a Points game reopen as before; a Closed pool is never reopened (so never cleared).
-- Game Q: sree (admin, seated) with harish, priya; limit 101.
begin;
select plan(16);

\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set Q '''10000000-0000-4000-8000-0000000000e1'''
\set PTS '''10000000-0000-4000-8000-0000000000e2'''

-- ---------- shape ----------
select has_function('public', 'games_pool_reopen_clears_awards', array[]::text[], '049 trigger function exists');
select has_trigger('public', 'games', 'games_pool_reopen_clears_awards', '049 trigger on games');
select ok(not has_function_privilege('authenticated', 'public.games_pool_reopen_clears_awards()', 'execute'), '049 the trigger function is not callable directly');

-- ---------- game Q: a pool with awards ----------
insert into public.games (id, created_by, status, game_type, settings, share_code)
values (:Q, :SREE, 'active', 'pool',
        '{"gameType":"pool","poolLimit":101,"reentry":true,"dropAmount":25,"mdAmount":50,"maxCount":80}', 'POOL49');
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated) values
  (:Q, :SREE, 0, 1, 'game_admin', true),
  (:Q, :HARISH, 1, 2, 'player', true),
  (:Q, :PRIYA, 2, 3, 'player', true);

select tests.login(:SREE);
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000e1', 1,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":0},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":20},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":30}]'::jsonb, false) $$, 'round 1 saved');
update public.games set status = 'completed', completed_at = now() where id = :Q;
select lives_ok($$ select public.set_pool_awards('10000000-0000-4000-8000-0000000000e1',
  '{"00000000-0000-4000-8000-000000000001": 200, "00000000-0000-4000-8000-000000000002": -100, "00000000-0000-4000-8000-000000000003": -100}'::jsonb,
  '{"preset":"winner","presetLabel":"Winner takes all","entry":100,"poolTotal":300,"givenOut":300}'::jsonb) $$, 'awards given');
select isnt((select awarded_at from public.games where id = :Q), null, 'awarded_at set before the reopen');

-- the reopen (what reopenGame sends)
update public.games set status = 'active', completed_at = null where id = :Q and status = 'completed' and closed_at is null;
select is((select status from public.games where id = :Q), 'active', '049 the pool is Active again');
select is((select prize_shares from public.games where id = :Q), null, '049 prize_shares cleared');
select is((select awarded_at from public.games where id = :Q), null, '049 awarded_at cleared (awards pending again)');
select is((select awarded_by from public.games where id = :Q), null, '049 awarded_by cleared');
select is((select award_note from public.games where id = :Q), null, '049 award_note cleared');
select is((select count(*)::int from public.event_log where game_id = :Q and kind = 'awards_changed' and summary like 'Awards cleared%'), 1, '049 one "Awards cleared" Log line');
select is((select (details->'cleared'->>'00000000-0000-4000-8000-000000000001')::int from public.event_log where game_id = :Q and summary like 'Awards cleared%'), 200, '049 the Log keeps what was cleared');
select is((select count(*)::int from public.event_log where game_id = :Q and kind = 'reopened'), 1, '049 the Reopened line is still written too');

-- a second reopen without awards writes nothing new
update public.games set status = 'completed', completed_at = now() where id = :Q;
update public.games set status = 'active', completed_at = null where id = :Q;
select is((select count(*)::int from public.event_log where game_id = :Q and summary like 'Awards cleared%'), 1, '049 no awards, nothing to clear, no second line');

-- ---------- a Points game is untouched ----------
insert into public.games (id, created_by, status, game_type, settings, share_code, prize_shares)
values (:PTS, :SREE, 'completed', 'stake', '{"gameType":"stake"}', 'PTS049', '{"00000000-0000-4000-8000-000000000001": 50}'::jsonb);
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated) values (:PTS, :SREE, 0, 1, 'game_admin', true);
update public.games set status = 'active', completed_at = null where id = :PTS;
select is((select prize_shares->>'00000000-0000-4000-8000-000000000001' from public.games where id = :PTS), '50', '049 a Points game keeps prize_shares on reopen');

select tests.logout();
select * from finish();
rollback;

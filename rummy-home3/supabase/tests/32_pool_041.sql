-- 041 (PR 13): pool games. Plus points, out at the limit, re-entry once at the highest score in,
-- undo of a re-entry as its own step, locked settings after a round, awards for a Completed pool,
-- "Give awards first" in results, awards (not round sums) in the result.
-- Game P: sree (admin, seated) with harish, priya, zero; limit 101, Drop 25, MD 50, Full 80.
begin;
select plan(76);

\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set ZERO '''00000000-0000-4000-8000-000000000008'''
\set RK '''00000000-0000-4000-8000-0000000000a1'''
\set P '''10000000-0000-4000-8000-0000000000d1'''

-- ---------- shape ----------
select has_column('public', 'games', 'awarded_at', 'games.awarded_at');
select has_column('public', 'games', 'award_note', 'games.award_note');
select has_column('public', 'game_players', 'out_round', 'game_players.out_round');
select has_column('public', 'game_players', 'reentered_round', 'game_players.reentered_round');
select has_column('public', 'game_players', 'reentry_score', 'game_players.reentry_score');
select has_column('public', 'game_players', 'entries', 'game_players.entries');
select has_function('public', 'reenter_player', array['uuid', 'uuid']);
select has_function('public', 'set_pool_awards', array['uuid', 'jsonb', 'jsonb']);
select ok(has_function_privilege('authenticated', 'public.reenter_player(uuid, uuid)', 'execute'), 'signed-in users may call reenter_player');
select ok(not has_function_privilege('anon', 'public.set_pool_awards(uuid, jsonb, jsonb)', 'execute'), 'anon may not give awards');
select has_trigger('public', 'scores', 'scores_pool_sign', 'pool sign trigger on scores');
select has_trigger('public', 'games', 'games_pool_settings_lock', 'settings lock trigger on games');

-- ---------- game P ----------
insert into public.games (id, created_by, status, game_type, settings, share_code)
values (:P, :SREE, 'active', 'pool',
        '{"gameType":"pool","poolLimit":101,"reentry":true,"dropAmount":25,"mdAmount":50,"maxCount":80}', 'POOL01');
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated) values
  (:P, :SREE, 0, 1, 'game_admin', true),
  (:P, :HARISH, 1, 2, 'player', true),
  (:P, :PRIYA, 2, 3, 'player', true),
  (:P, :ZERO, 3, 4, 'player', true);
select is((select entries from public.game_players where game_id = :P and profile_id = :SREE), 1, 'a seat starts with one entry');

select tests.login(:SREE);

-- 13.3 sign and winner rules
select throws_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000d1', 1,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"count","value":-10},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"rummy","value":0},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":20},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"count","value":30}]'::jsonb, false) $$,
  'P0001', 'Pool scores are plus points. Type the hand as a positive number; the winner is 0.', '13.3 a negative value is refused');
select throws_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000d1', 1,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"count","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":5},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":20},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"count","value":30}]'::jsonb, false) $$,
  'P0001', 'Every round has a winner at 0. Tap the winner, then Rummy.', '13.3 a round without a 0 is refused');
select throws_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000d1', 1,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"count","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"rummy","value":0},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":20}]'::jsonb, false) $$,
  'P0001', 'Every player still in needs a score: Zed Zero.', '13.3 every player still in must be scored');

-- Round 1: sree 0 (rummy), harish 25 (drop), priya 40, zero 80 (full). Two zeros allowed in round 2.
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000d1', 1,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":0},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"drop","value":25},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":40},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"count","value":80}]'::jsonb, false) $$, '13.3 round 1 saved');
select is(public.pool_total(:P, :ZERO), 80, '13.4 pool total adds up');
select tests.logout();
select throws_ok($$ insert into public.scores (round_id, game_id, profile_id, score_type, value)
  select r.id, r.game_id, '00000000-0000-4000-8000-0000000000a1', 'count', -5 from public.rounds r where r.game_id = '10000000-0000-4000-8000-0000000000d1' and r.round_number = 1 $$,
  '23514', null, '13.3 the trigger refuses a negative pool score written directly');
select throws_ok($$ insert into public.scores (round_id, game_id, profile_id, score_type, value)
  values ('30000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a3', 'count', 5) $$,
  '23514', null, '13.3 a Points game still refuses a positive count (037 rule moved into the trigger)');
select tests.login(:SREE);
select is((select out_round from public.game_players where game_id = :P and profile_id = :ZERO), null, '13.4 80 is under 101: still in');
select is((select kind from public.event_log where game_id = :P and kind = 'round_added' order by id desc limit 1), 'round_added', 'round logged');
select matches((select summary from public.event_log where game_id = :P and kind = 'round_added' order by id desc limit 1), 'Sree Test won$', 'the pool summary names the winner as won');

select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000d1', 2,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":0},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"rummy","value":0},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":30},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"count","value":21}]'::jsonb, false) $$, '13.6 two zeros in one round are allowed');
select is(public.pool_total(:P, :ZERO), 101, '13.4 zero reaches 101');
select is((select out_round from public.game_players where game_id = :P and profile_id = :ZERO), 2, '13.4 100 in, 101 out: out in round 2');
select is((select count(*)::int from public.event_log where game_id = :P and kind = 'player_out'), 1, '13.4 player_out logged once');
select is((select details->>'total' from public.event_log where game_id = :P and kind = 'player_out'), '101', 'with the total');
select is(public.pool_players_in(:P), array[:SREE, :HARISH, :PRIYA]::uuid[], '13.4 three still in');

-- 13.5 settings locked after a live round; re-entry may still change
select throws_ok($$ update public.games set settings = settings || '{"poolLimit":201}' where id = '10000000-0000-4000-8000-0000000000d1' $$,
  'PT423', null, '13.5 the limit is locked once a round exists');
-- 042: Drop / Middle drop / Full count are free once rounds exist (Q14.23); the Log records it
select lives_ok($$ update public.games set settings = settings || '{"dropAmount":30}' where id = '10000000-0000-4000-8000-0000000000d1' $$, '13.5 (042) Drop may change mid-game');
select is((select count(*)::int from public.event_log where game_id = :P and kind = 'settings_changed' and summary like '%Drop 25→30%'), 1, '13.5 (042) the change is in the Log');
update public.games set settings = settings || '{"dropAmount":25}' where id = :P;
select lives_ok($$ update public.games set settings = settings || '{"reentry":false}' where id = '10000000-0000-4000-8000-0000000000d1' $$, '13.5 re-entry can be switched');

-- 13.7 scoring a player who is out is refused; round 3 among the three in
select throws_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000d1', 3,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":0},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"count","value":10}]'::jsonb, false) $$,
  'P0001', 'Zed Zero is out of the pool and cannot be scored. Re-enter them first.', '13.7 a player who is out cannot be scored');
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000d1', 3,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"count","value":12},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"rummy","value":0},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":25}]'::jsonb, false) $$, '13.7 round 3 with the three players in');
select is((select dealer_profile_id from public.rounds where game_id = :P and round_number = 3 and undone_at is null), :PRIYA::uuid,
  '13.7 the deal skips nobody yet (round 2 dealer harish → priya)');

-- 13.8 re-entry: off → refused; on → once, at the highest score still in
select throws_ok($$ select public.reenter_player('10000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-000000000008') $$,
  'P0001', 'Re-entries are off for this pool. Allow them in Game settings first.', '13.8 re-entry off is refused (041 reentry:false reads as limit 0)');
update public.games set settings = (settings - 'reentry') || '{"reentryLimit":1}' where id = :P;
select throws_ok($$ select public.reenter_player('10000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-000000000003') $$,
  'P0001', 'They are still in the pool.', '13.8 a player still in cannot re-enter');
select is((public.reenter_player(:P, :ZERO))->>'score', '95', '13.8 zero re-enters at the highest score in (priya 40+30+25 = 95)');
select is((select reentered_round from public.game_players where game_id = :P and profile_id = :ZERO), 4, '13.8 back for round 4');
select is((select entries from public.game_players where game_id = :P and profile_id = :ZERO), 2, '13.8 two entries');
select is((select out_round from public.game_players where game_id = :P and profile_id = :ZERO), null, '13.8 no longer out');
select is(public.pool_total(:P, :ZERO), 95, '13.8 total restarts at the re-entry score');
select is((select count(*)::int from public.event_log where game_id = :P and kind = 'player_reentered'), 1, '13.8 logged');
select throws_ok($$ select public.reenter_player('10000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-000000000008') $$,
  'P0001', 'They are still in the pool.', '13.8 cannot re-enter while in');

-- 13.9 undo: the re-entry is its own step, undone before round 3
select is((public.undo_last_round(:P))->>'reentryUndone', '00000000-0000-4000-8000-000000000008', '13.9 undo takes the re-entry back first');
select is((select out_round from public.game_players where game_id = :P and profile_id = :ZERO), 2, '13.9 zero is out again (round 2)');
select is((select entries from public.game_players where game_id = :P and profile_id = :ZERO), 1, '13.9 entries back to one');
select is((select count(*)::int from public.event_log where game_id = :P and kind = 'reentry_undone'), 1, '13.9 reentry_undone logged');
select is((public.undo_last_round(:P))->>'roundNumber', '3', '13.9 the next undo takes round 3');
select is((public.undo_last_round(:P))->>'roundNumber', '2', '13.9 then round 2');
select is((select out_round from public.game_players where game_id = :P and profile_id = :ZERO), null, '13.9 undoing round 2 brings zero back in');

-- re-enter after round 2 again, then a second re-entry is refused once out again
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000d1', 2,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":0},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":30},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"count","value":80}]'::jsonb, false) $$, 'round 2 again: zero 160');
select is((select out_round from public.game_players where game_id = :P and profile_id = :ZERO), 2, 'zero out at 160');
select is((public.reenter_player(:P, :ZERO))->>'score', '70', 're-enters at 70 (priya 40+30)');
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-0000000000d1', 3,
  '[{"playerId":"00000000-0000-4000-8000-000000000001","scoreType":"rummy","value":0},
    {"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"count","value":40}]'::jsonb, false) $$, 'round 3: zero 110, out again');
select is((select out_round from public.game_players where game_id = :P and profile_id = :ZERO), 3, 'out in round 3 (second time)');
select throws_ok($$ select public.reenter_player('10000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-000000000008') $$,
  'P0001', 'They have already re-entered once.', '13.8 re-entry limited to 1 is once per player');
select is((select dealer_profile_id from public.rounds where game_id = :P and round_number = 3 and undone_at is null), :PRIYA::uuid, 'round 3 dealer priya');

-- 13.10 a late joiner starts at the highest score still in, no zero rows
select lives_ok($$ select public.add_seated_player('10000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000a1', 'RK') $$, '13.10 RK joins mid-pool');
select is((select reentry_score from public.game_players where game_id = :P and profile_id = :RK), 80, '13.10 at the highest score in (priya 80)');
select is((select count(*)::int from public.scores where game_id = :P and profile_id = :RK), 0, '13.10 no 0 rows written for a pool');

-- 13.11 awards: only once Completed, no sum check, logged; results need them
select throws_ok($$ select public.set_pool_awards('10000000-0000-4000-8000-0000000000d1', '{"00000000-0000-4000-8000-000000000001": 300}'::jsonb) $$,
  'P0001', 'Complete the pool first, then give awards.', '13.11 awards need a Completed pool');
update public.games set status = 'completed', completed_at = now() where id = :P;
select throws_ok($$ select public.declare_game_result(array['10000000-0000-4000-8000-0000000000d1']::uuid[]) $$,
  'P0001', null, '13.12 a result refuses a pool without awards');
select throws_ok($$ select public.set_pool_awards('10000000-0000-4000-8000-0000000000d1', '{"00000000-0000-4000-8000-000000000005": 300}'::jsonb) $$,
  'P0001', 'Awards can only go to players in this game, as whole numbers.', '13.11 an outsider cannot be awarded');
select lives_ok($$ select public.set_pool_awards('10000000-0000-4000-8000-0000000000d1',
  '{"00000000-0000-4000-8000-000000000001": 300, "00000000-0000-4000-8000-000000000002": -100, "00000000-0000-4000-8000-000000000003": -100, "00000000-0000-4000-8000-000000000008": -50, "00000000-0000-4000-8000-0000000000a1": -100}'::jsonb,
  '{"preset":"winner","presetLabel":"Winner takes all","entry":100,"poolTotal":500,"givenOut":450}'::jsonb) $$, '13.11 awards saved even though 50 points were not given out');
select is((select prize_shares->>'00000000-0000-4000-8000-000000000001' from public.games where id = :P), '300', '13.11 the award is stored');
select isnt((select awarded_at from public.games where id = :P), null, '13.11 awarded_at set');
select is((select count(*)::int from public.event_log where game_id = :P and kind = 'awards_set'), 1, '13.11 awards_set logged');
select lives_ok($$ select public.set_pool_awards('10000000-0000-4000-8000-0000000000d1',
  '{"00000000-0000-4000-8000-000000000001": 350, "00000000-0000-4000-8000-000000000002": -100, "00000000-0000-4000-8000-000000000003": -100, "00000000-0000-4000-8000-000000000008": -50, "00000000-0000-4000-8000-0000000000a1": -100}'::jsonb) $$, '13.11 awards edited');
select is((select count(*)::int from public.event_log where game_id = :P and kind = 'awards_changed'), 1, '13.11 awards_changed logged');

-- 13.12 the result takes the awards, not the round sums, and marks the game a pool
select lives_ok($$ select public.declare_game_result(array['10000000-0000-4000-8000-0000000000d1']::uuid[]) $$, '13.12 result saved once awarded');
select tests.logout();
select is((select r.places->'games'->0->>'kind' from public.game_results r join public.game_result_games grg on grg.result_id = r.id where grg.game_id = :P), 'pool', '13.12 games[].kind = pool');
select is((select (r.places->'games'->0->'scores'->>'00000000-0000-4000-8000-000000000001')::int from public.game_results r join public.game_result_games grg on grg.result_id = r.id where grg.game_id = :P), 350, '13.12 the pool contributes the award (350), not the round sum');
select is((select (s->>'points')::int from public.game_results r join public.game_result_games grg on grg.result_id = r.id, jsonb_array_elements(r.places->'standings') s where grg.game_id = :P and s->>'id' = '00000000-0000-4000-8000-000000000008'), -50, '13.12 a player who was out still has their award');
select tests.login(:SREE);
select throws_ok($$ select public.set_pool_awards('10000000-0000-4000-8000-0000000000d1', '{"00000000-0000-4000-8000-000000000001": 1}'::jsonb) $$,
  'P0001', 'Awards are locked: this pool is in a saved result. Delete the result first.', '13.12 awards lock once the pool is in a result');

select tests.logout();
select * from finish();
rollback;

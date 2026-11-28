-- 031 round-robin rotation: save_round deals to the seat before the previous round's dealer in
-- the current seat order (057, anticlockwise; a player added mid-game lengthens the next rotation), a
-- re-saved round keeps its dealer, and the bundle / public scorecard carry who dealt each round.
-- Game A: seats harish(0), priya(1), rk(2), zero(3); the seed has round 1 dealt by harish, round 2 by
-- priya (saved under the old rule; saved rounds keep their dealer).
begin;
select plan(20);

\set A '''10000000-0000-4000-8000-00000000000a'''
\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set RK '''00000000-0000-4000-8000-0000000000a1'''
\set ZERO '''00000000-0000-4000-8000-000000000008'''
\set CD '''00000000-0000-4000-8000-0000000000a3'''
\set OUTSIDER '''00000000-0000-4000-8000-000000000005'''

select ok(has_function_privilege('authenticated', 'public.save_round(uuid, integer, jsonb, boolean)', 'execute'), 'signed-in users can still save rounds');
select ok(has_function_privilege('anon', 'public.public_scorecard(text)', 'execute'), 'anon can still read the public scorecard');

select tests.login(:SREE);

-- round 3: after priya comes the seat before her, harish
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-00000000000a', 3,
  '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-10},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-20},
    {"playerId":"00000000-0000-4000-8000-0000000000a1","scoreType":"rummy","value":30},
    {"playerId":"00000000-0000-4000-8000-000000000008","scoreType":"count","value":0}]'::jsonb, false) $$, 'round 3 saved');
select is((select dealer_profile_id from public.rounds where game_id = :A and round_number = 3 and undone_at is null), :HARISH::uuid, 'round 3: harish deals (the seat before priya)');

-- cd joins mid-game at the end of the seat order
select tests.logout();
select lives_ok($$ insert into public.game_players (game_id, profile_id, player_order, role, seated)
  values ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a3', 9, 'player', true) $$, 'cd joins mid-game');
select tests.login(:SREE);

-- round 4: cd (the seat before harish, round the circle); round 5: zero; round 6: rk (the rotation is now five rounds long)
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-00000000000a', 4,
  '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"rummy","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-10}]'::jsonb, false) $$, 'round 4 saved');
select is((select dealer_profile_id from public.rounds where game_id = :A and round_number = 4 and undone_at is null), :CD::uuid, 'round 4: the new player deals (the seat before seat 1 is now cd)');
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-00000000000a', 5,
  '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"rummy","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-10}]'::jsonb, false) $$, 'round 5 saved');
select is((select dealer_profile_id from public.rounds where game_id = :A and round_number = 5 and undone_at is null), :ZERO::uuid, 'round 5: zero deals');
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-00000000000a', 6,
  '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"rummy","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-10}]'::jsonb, false) $$, 'round 6 saved');
select is((select dealer_profile_id from public.rounds where game_id = :A and round_number = 6 and undone_at is null), :RK::uuid, 'round 6: rk deals');

-- Edit round 4: the dealer stays cd even though the seat order would now say otherwise
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-00000000000a', 4,
  '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"rummy","value":20},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-20}]'::jsonb, true) $$, 'round 4 edited');
select is((select dealer_profile_id from public.rounds where game_id = :A and round_number = 4 and undone_at is null), :CD::uuid, 'an edited round keeps its dealer');

-- the bundle and the public page carry who dealt each live round
select is((public.get_game_bundle(:A))->'dealers'->>'1', :HARISH, 'bundle: round 1 dealer');
select is((public.get_game_bundle(:A))->'dealers'->>'6', :RK, 'bundle: round 6 dealer');
select is((public.get_game_bundle(:A))->'dealers'->>'1003', null, 'bundle: undone rounds are not listed');
select tests.logout();
select is((public.public_scorecard((select view_token from public.games where id = :A)))->'dealers'->>'5', :ZERO, 'public scorecard: round 5 dealer');
select is(((public.public_scorecard((select view_token from public.games where id = :A)))->>'maxCount')::int,
          (select (settings->>'maxCount')::int from public.games where id = :A), 'public scorecard: maxCount for the colour rule');

-- a previous dealer who is no longer seated: fall back to the round rule (round 1 seat 1, round 2 the last seat, …)
update public.rounds set dealer_profile_id = :OUTSIDER where game_id = :A and round_number = 6 and undone_at is null;
select tests.login(:SREE);
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-00000000000a', 7,
  '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"rummy","value":10},
    {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-10}]'::jsonb, false) $$, 'round 7 saved after the previous dealer left');
select is((select dealer_profile_id from public.rounds where game_id = :A and round_number = 7 and undone_at is null), :CD::uuid, 'round 7: round-rule fallback (seat 1 minus 6, round the 5 seats = seat 5, cd)');

select * from finish();
rollback;

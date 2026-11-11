-- 020: the bundle RPCs return exactly what the row policies would let the caller read, the
-- rewritten visibility RPCs keep their 006/012/013 answers, and no bundle carries another
-- account's email, phone or zip_code.
-- Game A: created by sree (not seated); harish, priya, rk (placeholder), zero seated; viewer spectator;
-- coadmin unseated admin. 2 live rounds (8 score rows) + 1 undone round (2 rows that never count).
-- Game B: harish (admin), priya, ab (harish's placeholder); 1 round; declared in result R1.
-- Game C: sree's, closed; harish, zero, cd (sree's placeholder); no rounds.
begin;
select plan(61);

-- A game id with its own letters, used in a few places below
\set A '''10000000-0000-4000-8000-00000000000a'''
\set B '''10000000-0000-4000-8000-00000000000b'''
\set C '''10000000-0000-4000-8000-00000000000c'''
\set R1 '''20000000-0000-4000-8000-0000000000e1'''

-- ---------------------------------------------------------------------------
-- outsider: nothing but their own profile row
-- ---------------------------------------------------------------------------
select tests.login('00000000-0000-4000-8000-000000000005');
select is(public.get_game_bundle(:A), null, 'outsider: get_game_bundle(A) is null');
select is(public.get_game_bundle('00000000-0000-4000-8000-00000000dead'), null, 'get_game_bundle of an unknown id is null (not an error)');
select is(public.get_home_bundle(50)->'games', '[]'::jsonb, 'outsider: home bundle lists no games');
select is(public.get_home_bundle(50)->'profile'->>'id', auth.uid()::text, 'home bundle profile is the caller''s own row');
select is(public.get_home_bundle(50)->'profile'->>'email', 'outsider@test.local', 'home bundle profile carries the caller''s own email (what my_profile returns)');
select is(public.get_home_bundle(50)->'my_players', '[]'::jsonb, 'outsider: home bundle roster is empty');
select is(public.list_result_candidates(50), '[]'::jsonb, 'outsider: no result candidates');
select is(public.list_game_results_page(5, 0), '[]'::jsonb, 'outsider: no results page (013 rule, 020 body)');
select is(public.get_game_result(:R1), null, 'outsider: get_game_result(R1) is null');

-- ---------------------------------------------------------------------------
-- seated player (priya, in A and B)
-- ---------------------------------------------------------------------------
select tests.login('00000000-0000-4000-8000-000000000003');
select isnt(public.get_game_bundle(:A), null, 'seated player: get_game_bundle(A) returns');
select is(public.get_game_bundle(:A)->'game'->>'id', :A, 'bundle.game is the games row');
select is(public.get_game_bundle(:A)->'game'->>'share_code', 'GAMEA1', 'bundle.game carries the games columns');
select is(jsonb_array_length(public.get_game_bundle(:A)->'game_players'), 6, 'bundle.game_players has every seat row (players, spectator, unseated admin)');
select is(
  (select jsonb_agg(e->>'profile_id' order by (e->>'player_order')::int) from jsonb_array_elements(public.get_game_bundle(:A)->'game_players') e),
  (select jsonb_agg(gp.profile_id::text order by gp.player_order) from public.game_players gp where gp.game_id = :A),
  'bundle seats are the same rows, in player_order, as the game_players select');
select is(jsonb_array_length(public.get_game_bundle(:A)->'scores'), 8, 'bundle.scores has the 8 live score rows and none from the undone round');
select is(
  (select sum((e->>'value')::int)::int from jsonb_array_elements(public.get_game_bundle(:A)->'scores') e),
  (select sum(s.value)::int from public.scores s join public.rounds r on r.id = s.round_id where s.game_id = :A and r.undone_at is null),
  'bundle.scores sum equals the live scores under the row policies');
select ok(
  (select bool_and(e ? 'round_number' and e ? 'profile_id' and e ? 'score_type' and e ? 'value') from jsonb_array_elements(public.get_game_bundle(:A)->'scores') e),
  'each bundle score row has profile_id, score_type, value and round_number');
select is(
  (select e->'profiles'->>'display_name' from jsonb_array_elements(public.get_game_bundle(:A)->'game_players') e where e->>'profile_id' = '00000000-0000-4000-8000-0000000000a1'),
  'R K', 'a seated player sees the placeholder''s name in the same game (can_see_profile)');
select is(
  (select e->'profiles'->>'display_name' from jsonb_array_elements(public.get_game_bundle(:A)->'game_players') e where e->>'profile_id' = '00000000-0000-4000-8000-000000000002'),
  'Harish Test', 'registered seat profiles carry display_name');
select ok(
  (select bool_and((e->'profiles') ? 'player_code' and (e->'profiles') ? 'public_player_no' and (e->'profiles') ? 'player_status' and (e->'profiles') ? 'managed_by' and (e->'profiles') ? 'first_name' and (e->'profiles') ? 'last_name')
   from jsonb_array_elements(public.get_game_bundle(:A)->'game_players') e),
  'seat profiles carry the columns listGamePlayers selects');
select ok(
  not exists (select 1 from jsonb_array_elements(public.get_game_bundle(:A)->'game_players') e
              where (e->'profiles') ? 'email' or (e->'profiles') ? 'phone' or (e->'profiles') ? 'zip_code'),
  'no seat profile in the game bundle has email, phone or zip_code');
select is(public.get_game_bundle(:C), null, 'seated player: a game they are not in is null (same as the games policy)');

-- home bundle
select is(
  (select jsonb_agg(e->>'id' order by e->>'id') from jsonb_array_elements(public.get_home_bundle(50)->'games') e),
  (select jsonb_agg(id::text order by id::text) from public.games where id in (select public.list_visible_game_ids())),
  'home bundle games = list_visible_game_ids() filtered by the games policy');
select is(public.get_home_bundle(50)->'games'->0->>'id', :A, 'home bundle games are newest first');
select is(jsonb_array_length(public.get_home_bundle(50)->'games'->0->'game_players'), 6, 'home bundle games embed their seat rows');
select ok(
  not exists (select 1 from jsonb_array_elements(public.get_home_bundle(50)->'games') g, jsonb_array_elements(g->'game_players') e where e ? 'profiles'),
  'home bundle seats carry no profile fields at all');
select is(public.get_home_bundle(50)->'claim_requests', '[]'::jsonb, 'home bundle claim_requests is the list_claim_requests() result');
select is(public.get_home_bundle(50)->'notices', '[]'::jsonb, 'home bundle notices is the take_creator_notices() result');
select ok(
  not exists (select 1 from jsonb_array_elements(public.get_home_bundle(50)->'my_players') e where e ? 'email' or e ? 'phone' or e ? 'zip_code'),
  'home bundle roster rows have no contact columns');
select is(public.get_home_bundle(2)->'games'->0->>'id', :A, 'home bundle honours p_limit (newest first)');
select is(jsonb_array_length(public.get_home_bundle(1)->'games'), 1, 'home bundle p_limit=1 returns one game');

-- result candidates
select is(jsonb_array_length(public.list_result_candidates(50)), 2, 'seated player: two result candidates (A and B)');
select is(public.list_result_candidates(50)->0->'game'->>'id', :A, 'candidates are newest first');
select is(
  (select e->'totals' from jsonb_array_elements(public.list_result_candidates(50)) e where e->'game'->>'id' = :A),
  '{"00000000-0000-4000-8000-000000000002": 30, "00000000-0000-4000-8000-000000000003": -60, "00000000-0000-4000-8000-0000000000a1": 30, "00000000-0000-4000-8000-000000000008": 0}'::jsonb,
  'candidate totals for A are the live sums per player (undone round excluded)');
select is(
  (select e->'totals' from jsonb_array_elements(public.list_result_candidates(50)) e where e->'game'->>'id' = :B),
  '{"00000000-0000-4000-8000-000000000002": 60, "00000000-0000-4000-8000-000000000003": -25, "00000000-0000-4000-8000-0000000000a2": -35}'::jsonb,
  'candidate totals for B');
select ok(
  not exists (select 1 from jsonb_array_elements(public.list_result_candidates(50)) g, jsonb_array_elements(g->'game_players') e
              where (e->'profiles') ? 'email' or (e->'profiles') ? 'phone' or (e->'profiles') ? 'zip_code'),
  'no seat profile in the result candidates has email, phone or zip_code');
select is(
  (select e->'profiles'->>'display_name' from jsonb_array_elements(public.list_result_candidates(50)->1->'game_players') e where e->>'profile_id' = '00000000-0000-4000-8000-0000000000a2'),
  'A B', 'candidate seats carry the placeholder names the caller may see');

-- results: the rewritten page and the rounds embed
select is(public.list_game_results_page(5, 0)->0->>'id', :R1, 'seated player sees R1 on the results page');
select tests.logout();
update public.game_results set places = jsonb_set(places, '{games,0,scores}',
  '{"00000000-0000-4000-8000-000000000002": 60, "00000000-0000-4000-8000-000000000003": -25, "00000000-0000-4000-8000-0000000000a2": -35}'::jsonb)
  where id = :R1;
select tests.login('00000000-0000-4000-8000-000000000003');
select is(public.get_game_result(:R1)->'sheet'->'games'->0->'rounds',
  '{"00000000-0000-4000-8000-000000000002": [60], "00000000-0000-4000-8000-000000000003": [-25], "00000000-0000-4000-8000-0000000000a2": [-35]}'::jsonb,
  'get_game_result embeds per-round values for a game the viewer may read');
select is(public.get_game_result(:R1)->'sheet'->'games'->0->>'label', 'G1', '018 label is still there');
select is(public.get_game_result(:R1)->'sheet'->'players'->0->>'name', 'Harish Test', '018 players are still there');

-- ---------------------------------------------------------------------------
-- viewer (spectator seat in A): a member, so seats and scores come through
-- ---------------------------------------------------------------------------
select tests.login('00000000-0000-4000-8000-000000000004');
select is(jsonb_array_length(public.get_game_bundle(:A)->'scores'), 8, 'viewer (spectator seat) reads the scores in the bundle, as under the scores policy');

-- ---------------------------------------------------------------------------
-- non-playing creator (sree): A and C, every seat and score
-- ---------------------------------------------------------------------------
select tests.login('00000000-0000-4000-8000-000000000001');
select is(jsonb_array_length(public.get_game_bundle(:A)->'game_players'), 6, 'creator not seated: bundle has every seat');
select is(jsonb_array_length(public.get_game_bundle(:A)->'scores'), 8, 'creator not seated: bundle has every live score');
select is(
  (select jsonb_agg(e->>'id' order by e->>'id') from jsonb_array_elements(public.get_home_bundle(50)->'games') e),
  jsonb_build_array(:A, :C), 'creator: home bundle lists A and C');
select is(public.get_home_bundle(50)->'profile'->>'email', 'sree@test.local', 'creator: own email in own profile row only');
select is(jsonb_array_length(public.get_home_bundle(50)->'my_players'), 5, 'home bundle roster is list_my_players() (five rows for sree)');
select is(
  (select e->'totals' from jsonb_array_elements(public.list_result_candidates(50)) e where e->'game'->>'id' = :C),
  '{}'::jsonb, 'a game with no rounds has empty totals');
select is(public.list_game_results_page(5, 0), '[]'::jsonb, 'creator of A and C is not connected to R1 (B only)');

-- ---------------------------------------------------------------------------
-- app admin: every game; placeholder profiles only where can_see_profile allows
-- ---------------------------------------------------------------------------
select tests.login('00000000-0000-4000-8000-000000000007');
select isnt(public.get_game_bundle(:A), null, 'app admin: get_game_bundle(A) returns');
select is(
  (select e->'profiles' from jsonb_array_elements(public.get_game_bundle(:A)->'game_players') e where e->>'profile_id' = '00000000-0000-4000-8000-0000000000a1'),
  'null'::jsonb, 'app admin not in the game: the placeholder''s profile is null (the profiles policy would hide the row)');
select is(
  (select e->'profiles'->>'display_name' from jsonb_array_elements(public.get_game_bundle(:A)->'game_players') e where e->>'profile_id' = '00000000-0000-4000-8000-000000000002'),
  'Harish Test', 'app admin sees registered seat profiles');
select is(public.list_game_results_page(5, 0)->0->>'id', :R1, 'app admin sees every result');

-- ---------------------------------------------------------------------------
-- spectator_access (public live link) only: game row yes, seats and scores no
-- ---------------------------------------------------------------------------
select tests.logout();
update public.games set spectator_access = true where id = :A;
select tests.login('00000000-0000-4000-8000-000000000005');
select is(public.get_game_bundle(:A)->'game'->>'id', :A, 'spectator_access: outsider gets the game row');
select is(public.get_game_bundle(:A)->'game_players', '[]'::jsonb, 'spectator_access: no seat rows (same as the game_players policy)');
select is(public.get_game_bundle(:A)->'scores', '[]'::jsonb, 'spectator_access: no scores (same as the scores policy)');
select is(public.get_home_bundle(50)->'games', '[]'::jsonb, 'spectator_access does not put the game on Home (list_visible_game_ids unchanged)');

-- ---------------------------------------------------------------------------
-- email-match seat (006 branch kept): a seat whose profile email equals the JWT email
-- ---------------------------------------------------------------------------
select tests.logout();
insert into public.profiles (id, display_name, first_name, last_name, player_status, managed_by, player_code, email)
values ('00000000-0000-4000-8000-0000000000a9', 'O Outsider', 'O', 'Outsider', 'pending', '00000000-0000-4000-8000-000000000001', 'OO0009', 'OUTSIDER@test.local');
insert into public.game_players (game_id, profile_id, player_order, role, seated)
values (:C, '00000000-0000-4000-8000-0000000000a9', 3, 'player', true);
select tests.login('00000000-0000-4000-8000-000000000005');
select ok(:C in (select * from public.list_visible_game_ids()), 'a seat matched by email (case-insensitive) still lists the game');

-- ---------------------------------------------------------------------------
-- anon: no bundles at all
-- ---------------------------------------------------------------------------
select tests.anon();
select throws_ok($$ select public.get_game_bundle('10000000-0000-4000-8000-00000000000a') $$, '42501', null, 'anon cannot call get_game_bundle');
select throws_ok($$ select public.get_home_bundle(50) $$, '42501', null, 'anon cannot call get_home_bundle');
select throws_ok($$ select public.list_result_candidates(50) $$, '42501', null, 'anon cannot call list_result_candidates');

select * from finish();
rollback;

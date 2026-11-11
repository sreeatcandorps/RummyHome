-- The 020 bundle RPCs, timed as the `authenticated` role for the same seeded user as
-- 20_bench.sql. Needs migration 020 applied (errors with "function does not exist" before).
\pset pager off
\timing off

select p.id as uid, p.email into temp t_user
from public.profiles p where p.email = 'user1@example.com';
select g.id as gid, g.view_token into temp t_game
from public.games g, t_user u where g.created_by = u.uid and g.status = 'active' order by g.created_at limit 1;

grant usage on schema auth to authenticated, anon;
select uid as "uid", email as "email" from t_user \gset
select gid as "gid", view_token as "token" from t_game \gset

select set_config('request.jwt.claims', json_build_object('sub', :'uid', 'email', :'email', 'role', 'authenticated')::text, false);
set role authenticated;

\echo '################ SCORECARD: get_game_bundle(gid) (replaces games + game_players + scores + game_players/profiles)'
explain (analyze, buffers) select public.get_game_bundle(:'gid');
select octet_length(public.get_game_bundle(:'gid')::text) as bundle_bytes;

\echo '################ HOME: get_home_bundle(50) (replaces my_profile + list_visible_game_ids + games + take_creator_notices + list_claim_requests + list_my_players) — rolled back because it consumes notices'
begin;
explain (analyze, buffers) select public.get_home_bundle(50);
rollback;
begin;
select octet_length(public.get_home_bundle(50)::text) as home_bytes, jsonb_array_length(public.get_home_bundle(50)->'games') as games;
rollback;

\echo '################ RESULTS picker: list_result_candidates(50) (replaces list_visible_game_ids + games + scores in(all) + N x game_players)'
explain (analyze, buffers) select public.list_result_candidates(50);
select octet_length(public.list_result_candidates(50)::text) as candidates_bytes, jsonb_array_length(public.list_result_candidates(50)) as games;

\echo '################ RESULTS detail: get_game_result with embedded rounds (replaces getGame per game)'
select (public.list_game_results_page(1,0)->0->>'id') as "rid" \gset
explain (analyze, buffers) select public.get_game_result(:'rid');
select octet_length(public.get_game_result(:'rid')::text) as result_bytes;

reset role;

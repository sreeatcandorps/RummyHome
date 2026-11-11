\pset pager off
grant usage on schema auth to authenticated, anon;
select p.id as "uid", p.email as "email" from public.profiles p where p.email = 'user1@example.com' \gset
-- Biggest game this user can see (most score rows) — the worst-case scorecard open.
select s.game_id as "gid", count(*) as "nscores" from public.scores s join public.games g on g.id = s.game_id
where g.created_by = :'uid' group by s.game_id order by 2 desc limit 1 \gset
\echo 'Test game score rows:' :nscores

select set_config('request.jwt.claims', json_build_object('sub', :'uid', 'email', :'email', 'role', 'authenticated')::text, false);

\echo '################ A. scores for one game, NO RLS (owner role) — raw cost'
explain (analyze, buffers) select s.*, row_to_json(r.*) as rounds from public.scores s
left join lateral (select rr.round_number, rr.undone_at from public.rounds rr where rr.id = s.round_id) r on true
where s.game_id = :'gid';

set role authenticated;
\echo '################ B. same query WITH RLS as written (is_app_admin() OR is_game_member(game_id) per row)'
explain (analyze, buffers) select s.*, row_to_json(r.*) as rounds from public.scores s
left join lateral (select rr.round_number, rr.undone_at from public.rounds rr where rr.id = s.round_id) r on true
where s.game_id = :'gid';
reset role;

-- Variant policy: wrap helpers in (select ...) so the planner evaluates them once (InitPlan).
begin;
drop policy "members read scores" on public.scores;
create policy "members read scores" on public.scores for select to authenticated
using ((select public.is_app_admin()) or (select public.is_game_member(game_id)));
set role authenticated;
\echo '################ C. same query, policy rewritten with (select ...) wrappers'
explain (analyze, buffers) select s.*, row_to_json(r.*) as rounds from public.scores s
left join lateral (select rr.round_number, rr.undone_at from public.rounds rr where rr.id = s.round_id) r on true
where s.game_id = :'gid';
reset role;
rollback;

\echo '################ D. PAYLOAD: bytes PostgREST would return for getGame''s three requests + listGamePlayers'
select
  (select length(json_agg(g)::text) from public.games g where g.id = :'gid') as games_bytes,
  (select length(json_agg(gp)::text) from public.game_players gp where gp.game_id = :'gid') as game_players_bytes,
  (select length(json_agg(j)::text) from (
     select s.*, (select row_to_json(x) from (select rr.round_number, rr.undone_at from public.rounds rr where rr.id = s.round_id) x) as rounds
     from public.scores s where s.game_id = :'gid') j) as scores_select_star_bytes,
  (select length(json_agg(j)::text) from (
     select s.profile_id, s.value, r.round_number
     from public.scores s join public.rounds r on r.id = s.round_id where s.game_id = :'gid' and r.undone_at is null) j) as scores_minimal_bytes,
  (select length(json_agg(j)::text) from (
     select gp.profile_id, gp.role, gp.seated, gp.player_order,
       (select row_to_json(x) from (select pr.display_name, pr.player_code, pr.public_player_no, pr.email, pr.player_status, pr.managed_by, pr.first_name, pr.last_name from public.profiles pr where pr.id = gp.profile_id) x) as profiles
     from public.game_players gp where gp.game_id = :'gid') j) as list_game_players_bytes;

\echo '################ E. PAYLOAD: Home list — games select * with game_players embed, 50 games'
select length(json_agg(j)::text) as home_games_bytes, count(*) as games
from (
  select g.*, (select json_agg(json_build_object('profile_id', x.profile_id, 'player_order', x.player_order, 'role', x.role, 'seated', x.seated)) from public.game_players x where x.game_id = g.id) as game_players
  from public.games g where g.created_by = :'uid' order by created_at desc limit 50
) j;

\echo '################ F. A compact get_game_bundle equivalent: one query, scores as per-player arrays'
explain (analyze, buffers)
select jsonb_build_object(
  'game', to_jsonb(g) - 'settings' || jsonb_build_object('settings', g.settings),
  'seats', (select jsonb_agg(jsonb_build_object('id', gp.profile_id, 'role', gp.role, 'seated', gp.seated, 'order', gp.player_order,
              'name', pr.display_name, 'no', pr.public_player_no, 'status', pr.player_status) order by gp.player_order)
            from public.game_players gp join public.profiles pr on pr.id = gp.profile_id where gp.game_id = g.id),
  'scores', (select jsonb_object_agg(profile_id, vals) from (
              select s.profile_id, jsonb_agg(s.value order by r.round_number) vals
              from public.scores s join public.rounds r on r.id = s.round_id
              where s.game_id = g.id and r.undone_at is null group by s.profile_id) t)
) from public.games g where g.id = :'gid';

select length((select jsonb_build_object(
  'game', to_jsonb(g),
  'seats', (select jsonb_agg(jsonb_build_object('id', gp.profile_id, 'role', gp.role, 'seated', gp.seated, 'order', gp.player_order,
              'name', pr.display_name, 'no', pr.public_player_no, 'status', pr.player_status) order by gp.player_order)
            from public.game_players gp join public.profiles pr on pr.id = gp.profile_id where gp.game_id = g.id),
  'scores', (select jsonb_object_agg(profile_id, vals) from (
              select s.profile_id, jsonb_agg(s.value order by r.round_number) vals
              from public.scores s join public.rounds r on r.id = s.round_id
              where s.game_id = g.id and r.undone_at is null group by s.profile_id) t)
)::text from public.games g where g.id = :'gid')) as bundle_bytes;

\echo '################ G. WRITE: save_round RPC as authenticated (rolled back)'
set role authenticated;
begin;
select max(round_number) + 1 as "nextround" from public.rounds where game_id = :'gid' and undone_at is null \gset
explain (analyze, buffers) select public.save_round(:'gid', :nextround, (
  select jsonb_agg(jsonb_build_object('playerId', profile_id, 'scoreType', 'count', 'value', -20))
  from public.game_players where game_id = :'gid' and seated and role <> 'spectator'), false);
rollback;
reset role;

\echo '################ H. profiles RLS: can_see_profile per row when the game has guest (managed) seats'
-- The seed does not seat guests, so this falls back to the test game (registered seats only).
select coalesce(
  (select gp.game_id from public.game_players gp join public.profiles p on p.id = gp.profile_id
   where p.managed_by = :'uid' limit 1),
  :'gid'::uuid) as "ggid" \gset
\echo 'game used for profiles RLS check:' :ggid
set role authenticated;
explain (analyze, buffers)
select gp.profile_id, row_to_json(p.*) from public.game_players gp
left join lateral (select pr.display_name from public.profiles pr where pr.id = gp.profile_id) p on true
where gp.game_id = :'ggid';
reset role;

\echo '################ I. Index check: which indexes exist on the hot tables'
select tablename, indexname, indexdef from pg_indexes where schemaname = 'public'
and tablename in ('games','game_players','rounds','scores','profiles','my_players','game_results','game_result_games','player_links','creator_notices')
order by tablename, indexname;

\echo '################ J. Table sizes per 1000 users (extrapolation base)'
select relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid)) total from pg_stat_user_tables where schemaname='public' order by n_live_tup desc limit 12;

\echo '################ K. RESULTS PAGE: scores for every visible game (listGamesForCurrentUser includeScores) vs server-side totals'
-- The app sends the id list literally (in.(…)); materialise it the same way instead of inlining the RPC.
create temp table t_vis as select v as id from public.list_visible_game_ids() v order by 1 limit 50;
grant select on t_vis to authenticated;
set role authenticated;
\echo '-- K1. scores select *, rounds(round_number, undone_at) where game_id in (<all visible ids, limit 50>) — what results/index.tsx downloads'
explain (analyze, buffers)
select s.*, row_to_json(r.*) as rounds from public.scores s
left join lateral (select rr.round_number, rr.undone_at from public.rounds rr where rr.id = s.round_id) r on true
where s.game_id in (select id from t_vis);
select count(*) as score_rows, sum(octet_length((to_jsonb(s) || jsonb_build_object('rounds', jsonb_build_object('round_number', rr.round_number, 'undone_at', rr.undone_at)))::text)) as scores_bytes
from public.scores s join public.rounds rr on rr.id = s.round_id
where s.game_id in (select id from t_vis);
\echo '-- K2. the same information as per-game per-player totals computed in SQL (what a list_result_candidates RPC would return)'
explain (analyze, buffers)
select g.id, jsonb_agg(jsonb_build_object('profile_id', t.profile_id, 'total', t.total, 'rounds', t.rounds)) as totals
from public.games g
join lateral (
  select s.profile_id, sum(s.value) as total, count(*) as rounds
  from public.scores s join public.rounds r on r.id = s.round_id and r.undone_at is null
  where s.game_id = g.id group by s.profile_id
) t on true
where g.id in (select id from t_vis)
group by g.id;
select sum(octet_length(row_to_json(x)::text)) as totals_bytes from (
  select g.id, jsonb_agg(jsonb_build_object('profile_id', t.profile_id, 'total', t.total, 'rounds', t.rounds)) as totals
  from public.games g
  join lateral (
    select s.profile_id, sum(s.value) as total, count(*) as rounds
    from public.scores s join public.rounds r on r.id = s.round_id and r.undone_at is null
    where s.game_id = g.id group by s.profile_id
  ) t on true
  where g.id in (select id from t_vis)
  group by g.id) x;
reset role;
\echo '-- K3. K2 as a SECURITY DEFINER RPC would run it: visibility checked once up front (t_vis), no per-row RLS'
explain (analyze, buffers)
select g.id, jsonb_agg(jsonb_build_object('profile_id', t.profile_id, 'total', t.total, 'rounds', t.rounds)) as totals
from public.games g
join lateral (
  select s.profile_id, sum(s.value) as total, count(*) as rounds
  from public.scores s join public.rounds r on r.id = s.round_id and r.undone_at is null
  where s.game_id = g.id group by s.profile_id
) t on true
where g.id in (select id from t_vis)
group by g.id;

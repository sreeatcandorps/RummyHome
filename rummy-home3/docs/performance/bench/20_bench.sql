-- Runs as the `authenticated` role with a JWT for one seeded user, so RLS applies exactly as through PostgREST.
\pset pager off
\timing off

-- Pick a test user (one who created games) and one of their live games.
select p.id as uid, p.email into temp t_user
from public.profiles p where p.email = 'user1@example.com';
select g.id as gid, g.view_token into temp t_game
from public.games g, t_user u where g.created_by = u.uid and g.status = 'active' order by g.created_at limit 1;

-- Supabase grants this to API roles by default; a plain Postgres does not.
grant usage on schema auth to authenticated, anon;
select uid as "uid", email as "email" from t_user \gset
select gid as "gid", view_token as "token" from t_game \gset

select set_config('request.jwt.claims', json_build_object('sub', :'uid', 'email', :'email', 'role', 'authenticated')::text, false);
set role authenticated;

\echo '################ HOME: list_visible_game_ids()'
explain (analyze, buffers, format text) select * from public.list_visible_game_ids();

\echo '################ HOME: games + game_players embed (PostgREST shape), in(<visible ids>) order created_at desc limit 50'
explain (analyze, buffers) 
select g.*, coalesce(gp.j, '[]'::json) as game_players
from public.games g
left join lateral (
  select json_agg(json_build_object('profile_id', x.profile_id, 'player_order', x.player_order, 'role', x.role, 'seated', x.seated)) j
  from public.game_players x where x.game_id = g.id
) gp on true
where g.id in (select public.list_visible_game_ids())
order by g.created_at desc limit 50;

\echo '################ HOME/EVERY SCREEN: my_profile select * where id = me (getCurrentProfile; 019 column grants route own-row reads through the view)'
explain (analyze, buffers) select * from public.my_profile where id = :'uid';

\echo '################ SCORECARD getGame 1/3: games select * where id'
explain (analyze, buffers) select * from public.games where id = :'gid';

\echo '################ SCORECARD getGame 2/3: game_players select * where game_id order player_order'
explain (analyze, buffers) select * from public.game_players where game_id = :'gid' order by player_order;

\echo '################ SCORECARD getGame 3/3: scores select *, rounds(round_number, undone_at) where game_id'
explain (analyze, buffers)
select s.*, row_to_json(r.*) as rounds
from public.scores s
left join lateral (select rr.round_number, rr.undone_at from public.rounds rr where rr.id = s.round_id) r on true
where s.game_id = :'gid';

\echo '################ SCORECARD listGamePlayers: game_players + profiles embed where game_id'
explain (analyze, buffers)
select gp.profile_id, gp.role, gp.seated, gp.player_order, row_to_json(p.*) as profiles
from public.game_players gp
left join lateral (
  select pr.display_name, pr.player_code, pr.public_player_no, pr.player_status, pr.managed_by, pr.first_name, pr.last_name
  from public.profiles pr where pr.id = gp.profile_id
) p on true
where gp.game_id = :'gid' order by gp.player_order;

\echo '################ NEW GAME: list_new_game_candidates(100)'
explain (analyze, buffers) select * from public.list_new_game_candidates(100);

\echo '################ MY PLAYERS: list_my_players()'
explain (analyze, buffers) select * from public.list_my_players();

\echo '################ MY PLAYERS: list_my_unregistered_players(null)'
explain (analyze, buffers) select * from public.list_my_unregistered_players(null);

\echo '################ MY PLAYERS: list_claim_requests() (ClaimRequestsCard on the tab)'
explain (analyze, buffers) select * from public.list_claim_requests();

\echo '################ FIND: search_players(''Player 12'')'
explain (analyze, buffers) select * from public.search_players('Player 12');

\echo '################ RESULTS list: list_game_results_page(5, 0)'
explain (analyze, buffers) select public.list_game_results_page(5, 0);

\echo '################ RESULTS detail: get_game_result(first visible)'
select (public.list_game_results_page(1,0)->0->>'id') as "rid" \gset
explain (analyze, buffers) select public.get_game_result(:'rid');

\echo '################ HOME: list_claim_requests(), take_creator_notices() (called on every Home focus)'
explain (analyze, buffers) select * from public.list_claim_requests();
begin;
explain (analyze, buffers) select * from public.take_creator_notices();
rollback;

\echo '################ PUBLIC LIVE SCORECARD: public_scorecard(token)'
explain (analyze, buffers) select public.public_scorecard(:'token');

\echo '################ WRITE: save_round RPC (new round) — run inside a rolled-back transaction'
begin;
select max(round_number) + 1 as "nextround" from public.rounds where game_id = :'gid' and undone_at is null \gset
explain (analyze, buffers) select public.save_round(:'gid', :nextround, (
  select jsonb_agg(jsonb_build_object('playerId', profile_id, 'scoreType', 'count', 'value', -20))
  from public.game_players where game_id = :'gid' and seated and role <> 'spectator'), false);
rollback;

reset role;

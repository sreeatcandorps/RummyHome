-- Seed: N users, each creating games with 4-6 seated players, 8-25 rounds each.
-- Scale knobs below. Deterministic (setseed) so numbers are reproducible.
-- Trigger enforce_profile_auth_user needs an auth.users row per registered profile.

\set users 2000
\set games_per_user 15

select setseed(0.42);

-- Disable the per-row triggers that would slow bulk seeding but keep semantics equivalent.
alter table public.games disable trigger games_assign_number;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
select gen_random_uuid(), 'user' || g || '@example.com', now(), jsonb_build_object('display_name', 'Player ' || g)
from generate_series(1, :users) g;

-- handle_new_user (001) already inserted a profile per auth user; fill in names.
update public.profiles p set first_name = 'First' || u.n, last_name = 'Last' || u.n
from (select id, row_number() over (order by created_at, id) n from auth.users) u where u.id = p.id;

-- Unregistered players managed by each user (2 per user), like "Add new players".
insert into public.profiles (id, display_name, first_name, last_name, player_status, managed_by)
select gen_random_uuid(), 'Guest ' || p.n || ' of ' || u.display_name, 'Guest', 'Num' || p.n, 'unregistered', u.id
from public.profiles u, generate_series(1, 2) p(n)
where u.managed_by is null;

-- Games: each user creates games_per_user games, mostly completed, a couple active.
insert into public.games (id, created_by, status, game_type, settings, current_round, share_code, created_at, game_number, completed_at)
select gen_random_uuid(),
       u.id,
       case when g <= 2 then 'active'::public.game_status else 'completed'::public.game_status end,
       'stake'::public.game_type,
       '{"gameType":"stake","dropAmount":-10,"mdAmount":-30,"maxCount":-80}'::jsonb,
       1,
       upper(substr(md5(u.id::text || g), 1, 6)) || substr(md5(g::text || u.id::text), 1, 4),
       now() - (g || ' days')::interval,
       g,
       case when g <= 2 then null else now() - (g || ' days')::interval + interval '2 hours' end
from public.profiles u, generate_series(1, :games_per_user) g
where u.managed_by is null;

-- Seats: creator + 3..5 other players (random registered users + the creator's guests).
with seats as (
  select g.id as game_id, g.created_by,
         (select array_agg(id) from (
            select p.id from public.profiles p
            where p.id <> g.created_by and p.managed_by is null
            order by md5(p.id::text || g.id::text) limit (3 + (abs(hashtext(g.id::text)) % 3))
         ) x) as others
  from public.games g
)
insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated)
select game_id, created_by, 0, 1, 'game_admin'::public.game_member_role, true from seats
union all
select s.game_id, o.pid, o.ord::int, o.ord::int + 1, 'player'::public.game_member_role, true
from seats s, unnest(s.others) with ordinality as o(pid, ord);

-- Rounds: 8..25 per completed game, 3..6 per active game.
insert into public.rounds (id, game_id, round_number, dealer_profile_id, created_by, created_at)
select gen_random_uuid(), g.id, r, g.created_by, g.created_by, g.created_at + (r || ' minutes')::interval * 6
from public.games g,
     lateral generate_series(1, case when g.status = 'active' then 3 + (abs(hashtext(g.id::text)) % 4) else 8 + (abs(hashtext(g.id::text)) % 18) end) r;

-- Scores: one per seated player per round. Values are <= 0 (count/drop) or rummy >= 0.
insert into public.scores (round_id, game_id, profile_id, score_type, value)
select r.id, r.game_id, gp.profile_id,
       case when (abs(hashtext(r.id::text || gp.profile_id::text)) % 6) = 0 then 'rummy'::public.score_type
            when (abs(hashtext(r.id::text || gp.profile_id::text)) % 6) = 1 then 'drop'::public.score_type
            else 'count'::public.score_type end,
       case when (abs(hashtext(r.id::text || gp.profile_id::text)) % 6) = 0 then 0
            when (abs(hashtext(r.id::text || gp.profile_id::text)) % 6) = 1 then -10
            else -(abs(hashtext(gp.profile_id::text || r.id::text)) % 80) end
from public.rounds r
join public.game_players gp on gp.game_id = r.game_id and gp.seated and gp.role <> 'spectator';

update public.games g set current_round = (select max(round_number) + 1 from public.rounds r where r.game_id = g.id);

-- my_players roster: everyone a user has played with.
insert into public.my_players (owner_id, player_id, games_together)
select g.created_by, gp.profile_id, count(*)
from public.games g join public.game_players gp on gp.game_id = g.id
where gp.profile_id <> g.created_by
group by g.created_by, gp.profile_id
on conflict do nothing;

-- Results: each user declares 3 results of 3 games each from their completed games.
with picks as (
  select u.id as declared_by, i,
         (select array_agg(id) from (
            select id from public.games where created_by = u.id and status = 'completed'
            order by created_at offset i*3 limit 3) x) as ids
  from public.profiles u, generate_series(0, 2) i
  where u.managed_by is null
),
ins as (
  insert into public.game_results (declared_by, declared_at, places)
  select declared_by, now() - (i || ' days')::interval, jsonb_build_object(
    'standings', (select jsonb_agg(jsonb_build_object('id', p.profile_id, 'name', 'P', 'points', -100, 'games', 3, 'place', 1))
                  from (select distinct profile_id from public.game_players where game_id = any(ids)) p),
    'players', '[]'::jsonb,
    'games', (select jsonb_agg(jsonb_build_object('id', x, 'name', 'G', 'date', now(), 'scores', '{}'::jsonb)) from unnest(ids) x))
  from picks where ids is not null and array_length(ids, 1) = 3
  returning id, declared_by, declared_at
)
insert into public.game_result_games (result_id, game_id)
select ins.id, x
from ins
join picks on picks.declared_by = ins.declared_by
          and picks.i = extract(day from now() - ins.declared_at)::int,
     unnest(picks.ids) x
on conflict do nothing;

update public.games g set closed_at = r.declared_at
from public.game_result_games grg join public.game_results r on r.id = grg.result_id
where grg.game_id = g.id and g.closed_at is null;

alter table public.games enable trigger games_assign_number;

analyze;

select 'profiles' t, count(*) from public.profiles
union all select 'auth.users', count(*) from auth.users
union all select 'games', count(*) from public.games
union all select 'game_players', count(*) from public.game_players
union all select 'rounds', count(*) from public.rounds
union all select 'scores', count(*) from public.scores
union all select 'my_players', count(*) from public.my_players
union all select 'game_results', count(*) from public.game_results
union all select 'game_result_games', count(*) from public.game_result_games;

select pg_size_pretty(pg_total_relation_size('public.scores')) scores_size,
       pg_size_pretty(pg_total_relation_size('public.rounds')) rounds_size,
       pg_size_pretty(pg_total_relation_size('public.game_players')) gp_size,
       pg_size_pretty(pg_database_size(current_database())) db_size;

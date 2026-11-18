-- Results: places and the per-game score sheet across finished games.
-- Apply after 007_redesign.sql. This file is not applied by the app.
-- Settle tables are unchanged and stay unused while the app flag is off.
--
-- Highest points are 1st place. Ties share a place and the next place skips
-- (1, 1, 3), matching rummy-home3/utils/results.ts. The expense column
-- (a score with no profile) is not a player.
--
-- places is a jsonb object:
--   standings: [{id,name,points,games,place}]
--   players:   [{id,name}] in the same order as standings
--   games:     [{id,name,date,scores}] scores omit anyone who did not play
-- A results view can include at most 50 distinct seated players.

create table if not exists public.game_results (
  id uuid primary key default gen_random_uuid(),
  declared_by uuid not null references public.profiles(id) on delete restrict,
  declared_at timestamptz not null default now(),
  places jsonb not null
);

create table if not exists public.game_result_games (
  result_id uuid not null references public.game_results(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  primary key (result_id, game_id)
);

create index if not exists game_results_declared_at_idx on public.game_results (declared_at desc);
create index if not exists game_result_games_game_idx on public.game_result_games (game_id);

alter table public.game_results enable row level security;
alter table public.game_result_games enable row level security;

revoke all on table public.game_results from public, anon, authenticated;
revoke all on table public.game_result_games from public, anon, authenticated;

create or replace function public.declare_game_result(p_game_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  gid uuid;
  distinct_ids uuid[];
  player_count integer;
  places jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  select coalesce(array_agg(distinct x), array[]::uuid[])
  into distinct_ids
  from unnest(coalesce(p_game_ids, array[]::uuid[])) as u(x)
  where x is not null;

  if coalesce(array_length(distinct_ids, 1), 0) = 0 then
    raise exception 'Pick at least one finished game';
  end if;
  if array_length(distinct_ids, 1) > 30 then
    raise exception 'Results can include at most 30 games';
  end if;

  if (
    select count(*)
    from public.games g
    where g.id = any(distinct_ids)
      and g.status = 'completed'
  ) <> array_length(distinct_ids, 1) then
    raise exception 'Only finished games can be declared';
  end if;

  if exists (
    select 1
    from unnest(distinct_ids) as target(id)
    where not public.is_game_admin(target.id)
  ) then
    raise exception 'Only an admin of every selected game can declare results';
  end if;

  with seated as (
    select gp.game_id, gp.profile_id
    from public.game_players gp
    where gp.game_id = any(distinct_ids)
      and gp.is_active
      and gp.role <> 'spectator'
      and gp.seated
  )
  select count(distinct profile_id)::integer
  into player_count
  from seated;

  if coalesce(player_count, 0) > 50 then
    raise exception 'Results can include at most 50 players';
  end if;

  with seated as (
    select gp.game_id, gp.profile_id, pr.display_name as name
    from public.game_players gp
    join public.profiles pr on pr.id = gp.profile_id
    where gp.game_id = any(distinct_ids)
      and gp.is_active
      and gp.role <> 'spectator'
      and gp.seated
  ),
  points as (
    select s.game_id, s.profile_id, sum(s.value)::integer as points
    from public.scores s
    join public.rounds r on r.id = s.round_id and r.undone_at is null
    where s.game_id = any(distinct_ids)
      and s.profile_id is not null
    group by s.game_id, s.profile_id
  ),
  totals as (
    select
      seated.profile_id,
      max(seated.name) as name,
      coalesce(sum(points.points), 0)::integer as points,
      count(distinct seated.game_id)::integer as games
    from seated
    left join points
      on points.game_id = seated.game_id
     and points.profile_id = seated.profile_id
    group by seated.profile_id
  ),
  ranked as (
    select
      profile_id,
      name,
      points,
      games,
      rank() over (order by points desc)::integer as place
    from totals
  ),
  per_game as (
    select
      g.id,
      g.created_at,
      coalesce(nullif(g.share_code, ''), upper(right(g.id::text, 6))) as name,
      coalesce((
        select jsonb_object_agg(x.profile_id::text, x.points)
        from (
          select s.profile_id, coalesce(max(p.points), 0)::integer as points
          from seated s
          left join points p
            on p.game_id = s.game_id
           and p.profile_id = s.profile_id
          where s.game_id = g.id
          group by s.profile_id
        ) x
      ), '{}'::jsonb) as scores
    from public.games g
    where g.id = any(distinct_ids)
  )
  select jsonb_build_object(
    'standings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', profile_id,
        'name', name,
        'points', points,
        'games', games,
        'place', place
      ) order by place, name)
      from ranked
    ), '[]'::jsonb),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object('id', profile_id, 'name', name) order by place, name)
      from ranked
    ), '[]'::jsonb),
    'games', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'date', created_at,
        'scores', scores
      ) order by created_at, name)
      from per_game
    ), '[]'::jsonb)
  )
  into places
  from (select 1) as anchor;

  insert into public.game_results (declared_by, places)
  values (auth.uid(), places)
  returning id into new_id;

  foreach gid in array distinct_ids loop
    insert into public.game_result_games (result_id, game_id)
    values (new_id, gid);
  end loop;

  return public.get_game_result(new_id);
end;
$$;

create or replace function public.get_game_result(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then null
    else (
      select jsonb_build_object(
        'id', r.id,
        'declaredAt', r.declared_at,
        'declaredBy', r.declared_by,
        'gameIds', coalesce((
          select jsonb_agg(g.game_id)
          from public.game_result_games g
          where g.result_id = r.id
        ), '[]'::jsonb),
        'standings', coalesce(r.places->'standings', '[]'::jsonb),
        'sheet', jsonb_build_object(
          'players', coalesce(r.places->'players', '[]'::jsonb),
          'games', coalesce(r.places->'games', '[]'::jsonb)
        )
      )
      from public.game_results r
      where r.id = p_id
    )
  end;
$$;

create or replace function public.list_game_results()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then '[]'::jsonb
    else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'declaredAt', r.declared_at,
        'gameCount', (select count(*) from public.game_result_games g where g.result_id = r.id),
        'firstNames', coalesce((
          select jsonb_agg(p->>'name' order by p->>'name')
          from jsonb_array_elements(coalesce(r.places->'standings', '[]'::jsonb)) p
          where (p->>'place')::integer = 1
        ), '[]'::jsonb)
      ) order by r.declared_at desc)
      from public.game_results r
    ), '[]'::jsonb)
  end;
$$;

revoke all on function public.declare_game_result(uuid[]) from public;
revoke all on function public.get_game_result(uuid) from public;
revoke all on function public.list_game_results() from public;

grant execute on function public.declare_game_result(uuid[]) to authenticated;
grant execute on function public.get_game_result(uuid) to authenticated;
grant execute on function public.list_game_results() to authenticated;

-- Game numbers (G1, G2...) per creator and Closed status for results.
-- Apply after 008_results.sql. This file is not applied by the app.
--
-- game_number is per-creator, assigned at creation time (next sequential),
-- and never changes. Closed games keep their number.
--
-- closed_at marks when a game was included in a Results declaration.
-- A game becomes Closed once it's part of any declared result.

-- Add the columns
alter table public.games
  add column if not exists game_number integer,
  add column if not exists closed_at timestamptz;

-- Backfill existing games with sequential numbers per creator by creation order
with numbered as (
  select
    id,
    row_number() over (partition by created_by order by created_at) as rn
  from public.games
  where game_number is null
)
update public.games g
set game_number = n.rn
from numbered n
where g.id = n.id;

-- Backfill closed_at for games already in declared results
update public.games g
set closed_at = (
  select min(gr.declared_at)
  from public.game_result_games grg
  join public.game_results gr on gr.id = grg.result_id
  where grg.game_id = g.id
)
where g.closed_at is null
  and exists (
    select 1 from public.game_result_games grg where grg.game_id = g.id
  );

-- Function to assign the next game number for a creator
create or replace function public.assign_game_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_num integer;
begin
  select coalesce(max(game_number), 0) + 1
  into next_num
  from public.games
  where created_by = new.created_by;
  
  new.game_number := next_num;
  return new;
end;
$$;

-- Trigger to auto-assign game_number on insert
drop trigger if exists games_assign_number on public.games;
create trigger games_assign_number
before insert on public.games
for each row
when (new.game_number is null)
execute function public.assign_game_number();

-- Function to mark games as closed when included in results
-- This is called by declare_game_result after inserting into game_result_games
create or replace function public.close_games_in_result(p_game_ids uuid[], p_declared_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.games
  set closed_at = p_declared_at
  where id = any(p_game_ids)
    and closed_at is null;
end;
$$;

-- Update declare_game_result to close games after declaring
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
  declared_ts timestamptz;
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

  declared_ts := now();

  insert into public.game_results (declared_by, declared_at, places)
  values (auth.uid(), declared_ts, places)
  returning id into new_id;

  foreach gid in array distinct_ids loop
    insert into public.game_result_games (result_id, game_id)
    values (new_id, gid);
  end loop;

  -- Mark included games as closed
  perform public.close_games_in_result(distinct_ids, declared_ts);

  return public.get_game_result(new_id);
end;
$$;

-- Index for efficient game_number lookup per creator
create index if not exists games_created_by_number_idx on public.games (created_by, game_number);

-- Index for efficient closed status lookup
create index if not exists games_closed_at_idx on public.games (closed_at) where closed_at is not null;

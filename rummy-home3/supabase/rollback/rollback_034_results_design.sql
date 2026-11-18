-- Rollback for 034_results_design.sql: drops result_versions (every saved version is lost;
-- the results themselves stay in game_results), the snapshot helper and its two triggers, puts
-- back the 024 declare_game_result (scores only, so a game with no rounds saves with 0 players
-- again) and the 028 one-argument public_result with 032's jit setting. Safe to re-run.

drop trigger if exists result_versions_on_remove on public.game_result_games;
drop trigger if exists result_versions_on_save on public.game_results;
drop function if exists public.result_versions_on_remove();
drop function if exists public.result_versions_on_save();
drop function if exists public.snapshot_result_version(uuid, text, uuid);
drop function if exists public.public_result(uuid, integer);
drop table if exists public.result_versions;

-- 024 body
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
      and g.deleted_at is null
  ) <> array_length(distinct_ids, 1) then
    raise exception 'Only finished games can be declared';
  end if;

  if exists (
    select 1
    from unnest(distinct_ids) as u(game_id)
    where not public.is_game_admin(u.game_id)
  ) then
    raise exception 'Only an admin of every selected game can declare results';
  end if;

  select count(distinct s.profile_id)
  into player_count
  from public.scores s
  join public.rounds r on r.id = s.round_id
  where s.game_id = any(distinct_ids)
    and r.undone_at is null
    and s.score_type <> 'expense'
    and s.profile_id is not null;

  if player_count > 50 then
    raise exception 'Results can include at most 50 players';
  end if;

  with live_scores as (
    select s.game_id, s.profile_id, s.value
    from public.scores s
    join public.rounds r on r.id = s.round_id
    where s.game_id = any(distinct_ids)
      and r.undone_at is null
      and s.score_type <> 'expense'
      and s.profile_id is not null
  ),
  per_game as (
    select game_id, profile_id, sum(value)::int as points
    from live_scores
    group by game_id, profile_id
  ),
  per_player as (
    select profile_id, sum(points)::int as points, count(*)::int as games
    from per_game
    group by profile_id
  ),
  named as (
    select pp.profile_id, coalesce(nullif(p.display_name, ''), 'Player') as name, pp.points, pp.games
    from per_player pp
    left join public.profiles p on p.id = pp.profile_id
  ),
  ranked as (
    select *, rank() over (order by points desc)::int as place
    from named
  )
  select jsonb_build_object(
    'standings', coalesce((
      select jsonb_agg(jsonb_build_object('id', profile_id, 'name', name, 'points', points, 'games', games, 'place', place) order by place, name)
      from ranked
    ), '[]'::jsonb),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object('id', profile_id, 'name', name) order by place, name)
      from ranked
    ), '[]'::jsonb),
    'games', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'name', coalesce(g.share_code, upper(right(g.id::text, 6))),
        'date', g.created_at,
        'scores', coalesce((
          select jsonb_object_agg(pg.profile_id::text, pg.points)
          from per_game pg
          where pg.game_id = g.id
        ), '{}'::jsonb)
      ) order by g.created_at, g.id)
      from public.games g
      where g.id = any(distinct_ids)
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

  perform public.close_games_in_result(distinct_ids, declared_ts);
  perform public.queue_result_saved_emails(new_id);

  return public.get_game_result(new_id);
end;
$$;
revoke all on function public.declare_game_result(uuid[]) from public, anon;
grant execute on function public.declare_game_result(uuid[]) to authenticated;

-- 028 body, 032 setting
create or replace function public.public_result(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with r as (select * from public.game_results where id = p_id),
  pl as (select public.result_places_json(p_id) as v),
  players as (
    select t.ord - 1 as pos, t.e->>'id' as id, coalesce(t.e->>'name', 'Player') as name, pr.public_player_no as player_no,
           (select gp.label from public.game_result_games grg join public.game_players gp on gp.game_id = grg.game_id and gp.profile_id::text = t.e->>'id'
             where grg.result_id = p_id and grg.removed_at is null and gp.label is not null order by grg.game_id limit 1) as label
    from pl, jsonb_array_elements(coalesce(pl.v->'players', '[]'::jsonb)) with ordinality t(e, ord)
    left join public.profiles pr on pr.id::text = t.e->>'id'
  )
  select case
    when not exists (select 1 from r) then null
    when (select deleted_at from r) is not null then jsonb_build_object('id', p_id, 'deleted', true)
    else jsonb_build_object(
      'id', p_id,
      'declaredAt', (select declared_at from r),
      'declarerName', (select coalesce(nullif(p.display_name, ''), 'Player') from r join public.profiles p on p.id = r.declared_by),
      'players', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'playerNo', player_no, 'label', label) order by pos) from players), '[]'::jsonb),
      'standings', coalesce((
        select jsonb_agg(jsonb_build_object('player', p.pos, 'name', p.name, 'points', (s->>'points')::int, 'games', (s->>'games')::int, 'place', (s->>'place')::int) order by (s->>'place')::int, p.name)
        from pl, jsonb_array_elements(coalesce(pl.v->'standings', '[]'::jsonb)) s
        join players p on p.id = s->>'id'
      ), '[]'::jsonb),
      'games', coalesce((
        select jsonb_agg(jsonb_build_object(
          'label', coalesce(public.game_label_text(g.game_label, g.game_number), e->>'name', ''),
          'date', e->>'date',
          'reused', (e->>'id')::uuid = any(array(select jsonb_array_elements_text(public.reused_game_ids(p_id))::uuid)),
          'scores', coalesce((select jsonb_object_agg(p.pos::text, k.value::int) from jsonb_each_text(coalesce(e->'scores', '{}'::jsonb)) k join players p on p.id = k.key), '{}'::jsonb)
        ) order by t.ord)
        from pl, jsonb_array_elements(coalesce(pl.v->'games', '[]'::jsonb)) with ordinality t(e, ord)
        left join public.games g on g.id::text = t.e->>'id'
      ), '[]'::jsonb),
      'reusedCount', jsonb_array_length(public.reused_game_ids(p_id)),
      'removedCount', (select count(*) from public.game_result_games g where g.result_id = p_id and g.removed_at is not null)
    )
  end;
$$;
alter function public.public_result(uuid) set jit = off;
revoke all on function public.public_result(uuid) from public;
grant execute on function public.public_result(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

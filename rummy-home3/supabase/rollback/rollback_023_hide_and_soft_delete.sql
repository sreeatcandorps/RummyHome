-- Rollback for 023_hide_and_soft_delete.sql. Drops the hidden list, the delete/restore RPCs and
-- the soft-delete columns (hidden and deleted marks are lost: everything shows again), and
-- restores the previous bodies of every reader 023 changed (020, 018, 013, 009, 006). 022 and
-- earlier are untouched.

drop function if exists public.hide_game(uuid);
drop function if exists public.unhide_game(uuid);
drop function if exists public.results_holding_game(uuid);
drop function if exists public.delete_game(uuid);
drop function if exists public.restore_game(uuid);
drop function if exists public.delete_result(uuid);
drop function if exists public.restore_result(uuid);
drop function if exists public.list_hidden_and_deleted();
drop function if exists public.sync_closed_at(uuid[]);
drop function if exists public.adjust_games_together(uuid, integer);
drop function if exists public.result_places_json(uuid);
drop function if exists public.can_manage_result(uuid);
drop function if exists public.can_manage_game(uuid);

drop table if exists public.hidden_games;

-- 020 policy body
drop policy if exists "members read games" on public.games;
create policy "members read games"
on public.games for select
to authenticated
using (
  (select public.is_app_admin())
  or created_by = (select auth.uid())
  or (select public.is_game_member(games.id))
  or spectator_access = true
);

-- previous bodies
create or replace function public.list_visible_game_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select g.id
  from public.games g
  where auth.uid() is not null
    and g.created_by = auth.uid()
  union
  select gp.game_id
  from public.game_players gp
  where auth.uid() is not null
    and gp.profile_id = auth.uid()
    and gp.is_active = true
  union
  select gp.game_id
  from public.game_players gp
  join public.profiles p on p.id = gp.profile_id
  where auth.uid() is not null
    and gp.is_active = true
    and p.email is not null
    and lower(p.email) = lower(auth.jwt() ->> 'email');
$$;

create or replace function public.can_read_game(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.games g
    where g.id = p_game_id
      and (public.is_app_admin() or g.created_by = auth.uid() or public.is_game_member(g.id) or g.spectator_access = true)
  );
$$;

drop function if exists public.visible_games(integer, boolean);
create or replace function public.visible_games(p_limit integer default 50)
returns table (game public.games, member boolean)
language sql
stable
security definer
set search_path = public
as $$
  select g, (g.created_by = auth.uid() or exists (
             select 1 from public.game_players gp where gp.game_id = g.id and gp.profile_id = auth.uid() and gp.is_active)) as member
  from public.games g
  where auth.uid() is not null
    and g.id in (select public.list_visible_game_ids())
    and (public.is_app_admin() or g.created_by = auth.uid() or public.is_game_member(g.id) or g.spectator_access = true)
  order by g.created_at desc, g.id desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

create or replace function public.get_home_bundle(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
set jit = off
as $$
declare
  v_admin boolean;
  v_games jsonb;
  v_notices jsonb;
  v_claims jsonb;
  v_roster jsonb;
begin
  if auth.uid() is null then
    return null;
  end if;
  v_admin := public.is_app_admin();

  with vg as (
    select (v.game).*, v.member from public.visible_games(p_limit) v
  ),
  detail as (
    select vg.id from vg where v_admin or vg.member
  ),
  seats as (
    select * from public.seat_rows_json((select coalesce(array_agg(id), '{}'::uuid[]) from detail), '{}'::uuid[], false)
  )
  select coalesce(jsonb_agg(
           to_jsonb(vg) - 'member' || jsonb_build_object('game_players', coalesce(s.seats, '[]'::jsonb))
           order by vg.created_at desc, vg.id desc), '[]'::jsonb)
    into v_games
  from vg
  left join seats s on s.game_id = vg.id;

  select coalesce(jsonb_agg(jsonb_build_object('player_id', n.player_id, 'text', n.text)), '[]'::jsonb)
    into v_notices
  from public.take_creator_notices() n;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.invited_at), '[]'::jsonb)
    into v_claims
  from public.list_claim_requests() c;

  select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
    into v_roster
  from public.list_my_players() m;

  return jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'games', v_games,
    'notices', v_notices,
    'claim_requests', v_claims,
    'my_players', v_roster
  );
end;
$$;

create or replace function public.get_game_bundle(p_game_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set jit = off
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games;
  v_admin boolean;
  v_member boolean;
  v_seats jsonb := '[]'::jsonb;
  v_scores jsonb := '[]'::jsonb;
begin
  if v_uid is null then return null; end if;
  select * into v_game from public.games g where g.id = p_game_id;
  if v_game.id is null then return null; end if;

  v_admin := public.is_app_admin();
  v_member := v_game.created_by = v_uid
    or exists (select 1 from public.game_players gp where gp.game_id = p_game_id and gp.profile_id = v_uid and gp.is_active);
  if not (v_admin or v_member or v_game.spectator_access) then return null; end if;

  if v_admin or v_member then
    select coalesce(s.seats, '[]'::jsonb) into v_seats
    from public.seat_rows_json(array[p_game_id], case when v_member then array[p_game_id] else '{}'::uuid[] end, true) s;
    v_seats := coalesce(v_seats, '[]'::jsonb);

    select coalesce(jsonb_agg(jsonb_build_object(
             'profile_id', s.profile_id,
             'score_type', s.score_type,
             'value', s.value,
             'round_number', r.round_number
           ) order by r.round_number, s.created_at), '[]'::jsonb)
      into v_scores
    from public.scores s
    join public.rounds r on r.id = s.round_id
    where s.game_id = p_game_id
      and r.undone_at is null;
  end if;

  return jsonb_build_object(
    'game', to_jsonb(v_game),
    'game_players', v_seats,
    'scores', v_scores
  );
end;
$$;

create or replace function public.public_scorecard(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then
    return null;
  end if;

  select * into g from public.games where view_token = p_token;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'gameId', g.share_code,
    'startedAt', g.created_at,
    'gameType', g.game_type,
    'status', g.status,
    'currentRound', g.current_round,
    'players', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', pr.display_name,
        'order', gp.player_order
      ) order by gp.player_order), '[]'::jsonb)
      from public.game_players gp
      join public.profiles pr on pr.id = gp.profile_id
      where gp.game_id = g.id
        and gp.is_active
        and gp.role <> 'spectator'
    ),
    'scores', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'profileId', s.profile_id,
        'name', pr.display_name,
        'round', r.round_number,
        'value', s.value,
        'type', s.score_type
      ) order by r.round_number), '[]'::jsonb)
      from public.scores s
      join public.rounds r on r.id = s.round_id
      left join public.profiles pr on pr.id = s.profile_id
      where s.game_id = g.id
        and r.undone_at is null
    )
  );
end;
$$;

create or replace function public.list_new_game_candidates(p_limit integer default 100)
returns table (id uuid, display_name text, player_code text, player_status text, total_games integer, last_played_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with my_games as (
    select g.id, g.created_at
    from public.games g
    where g.created_by = auth.uid()
    union
    select g.id, g.created_at
    from public.game_players a
    join public.games g on g.id = a.game_id
    where a.profile_id = auth.uid()
      and a.role = 'game_admin'
  ),
  stats as (
    select gp.profile_id, count(*)::int as total_games, max(mg.created_at) as last_played_at
    from my_games mg join public.game_players gp on gp.game_id = mg.id
    where gp.profile_id <> auth.uid() and gp.role <> 'spectator' and coalesce(gp.seated, true)
    group by gp.profile_id
  ),
  everyone as (
    select s.profile_id, s.total_games, s.last_played_at from stats s
    union all
    select m.player_id, 0, null from public.my_players m
    where m.owner_id = auth.uid() and not exists (select 1 from stats s where s.profile_id = m.player_id)
  )
  select p.id, coalesce(nullif(p.display_name, ''), 'Rummy Player'), public.player_label(p), p.player_status, e.total_games, e.last_played_at
  from everyone e join public.profiles p on p.id = e.profile_id
  where coalesce(p.player_status, 'registered') not in ('deleted_before_registering','deleted_after_registering','merged')
  order by (e.last_played_at >= now() - interval '14 days') desc nulls last, e.total_games desc, e.last_played_at desc nulls last, p.display_name
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$$;

create or replace function public.can_see_game_result(p_result_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    public.is_app_admin()
    or exists (
      select 1 from public.game_results r
      where r.id = p_result_id and r.declared_by = auth.uid()
    )
    or exists (
      select 1
      from public.game_result_games grg
      where grg.result_id = p_result_id
        and public.is_game_member(grg.game_id)
    )
    -- games.created_by directly: the creator normally also has a game_players row
    -- (unseated admin), but games made before 007 or where that row failed to insert
    -- would otherwise lock the organiser out of their own result.
    or exists (
      select 1
      from public.game_result_games grg
      join public.games g on g.id = grg.game_id
      where grg.result_id = p_result_id
        and g.created_by = auth.uid()
    )
  );
$$;

create or replace function public.reused_game_ids(p_result_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_agg(g.game_id order by g.game_id)
    from public.game_result_games g
    join public.game_results r on r.id = g.result_id
    where g.result_id = p_result_id
      and exists (
        select 1
        from public.game_result_games earlier
        join public.game_results er on er.id = earlier.result_id
        where earlier.game_id = g.game_id
          and earlier.result_id <> g.result_id
          and er.declared_at < r.declared_at
      )
  ), '[]'::jsonb);
$$;

create or replace function public.get_game_result(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
set jit = off
as $$
  select case
    when auth.uid() is null or not public.can_see_game_result(p_id) then null
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
        'reusedGameIds', public.reused_game_ids(r.id),
        'standings', coalesce(r.places->'standings', '[]'::jsonb),
        'sheet', jsonb_build_object(
          'players', coalesce((
            select jsonb_agg(
              e || jsonb_build_object('playerNo', pr.public_player_no)
              order by t.ord)
            from jsonb_array_elements(coalesce(r.places->'players', '[]'::jsonb)) with ordinality as t(e, ord)
            left join public.profiles pr on pr.id::text = t.e->>'id'
          ), '[]'::jsonb),
          'games', coalesce((
            select jsonb_agg(
              e
              || case when g.game_number is not null then jsonb_build_object('label', 'G' || g.game_number::text) else '{}'::jsonb end
              || case when g.id is not null and public.can_read_game(g.id)
                      then jsonb_build_object('rounds', public.game_rounds_json(g.id, e->'scores'))
                      else '{}'::jsonb end
              order by t.ord)
            from jsonb_array_elements(coalesce(r.places->'games', '[]'::jsonb)) with ordinality as t(e, ord)
            left join public.games g on g.id::text = t.e->>'id'
          ), '[]'::jsonb)
        )
      )
      from public.game_results r
      where r.id = p_id
    )
  end;
$$;

create or replace function public.list_game_results_page(p_limit integer default 5, p_offset integer default 0)
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
        'reusedGameIds', public.reused_game_ids(r.id),
        'playerCount', jsonb_array_length(coalesce(r.places->'standings', '[]'::jsonb)),
        'top', coalesce((
          select jsonb_agg(jsonb_build_object(
            'name', p->>'name',
            'points', (p->>'points')::integer,
            'place', (p->>'place')::integer
          ) order by (p->>'place')::integer, p->>'name')
          from jsonb_array_elements(coalesce(r.places->'standings', '[]'::jsonb)) p
          where (p->>'place')::integer <= 3
        ), '[]'::jsonb),
        'firstNames', coalesce((
          select jsonb_agg(p->>'name' order by p->>'name')
          from jsonb_array_elements(coalesce(r.places->'standings', '[]'::jsonb)) p
          where (p->>'place')::integer = 1
        ), '[]'::jsonb)
      ) order by r.declared_at desc)
      from (
        select *
        from public.game_results gr
        where public.is_app_admin()
           or gr.id in (
             select mine.id from public.game_results mine where mine.declared_by = auth.uid()
             union
             select grg.result_id
             from public.game_result_games grg
             join public.game_players gp on gp.game_id = grg.game_id
             where gp.profile_id = auth.uid() and gp.is_active = true
             union
             select grg.result_id
             from public.game_result_games grg
             join public.games g on g.id = grg.game_id
             where g.created_by = auth.uid()
           )
        order by gr.declared_at desc
        limit greatest(1, least(coalesce(p_limit, 5), 50))
        offset greatest(0, coalesce(p_offset, 0))
      ) r
    ), '[]'::jsonb)
  end;
$$;

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

alter table public.game_result_games drop column if exists removed_at;
alter table public.game_results drop column if exists deleted_by;
alter table public.game_results drop column if exists deleted_at;
alter table public.games drop column if exists deleted_by;
alter table public.games drop column if exists deleted_at;

revoke all on function public.visible_games(integer) from public, anon;
grant execute on function public.visible_games(integer) to authenticated;

notify pgrst, 'reload schema';

-- Rollback for 024_emails_and_public_results.sql. Drops the outbox (queued but unsent emails
-- are lost), the email RPCs, the public results reader and the three profile columns
-- (preferences and unsubscribe tokens are lost: everyone is back to the default, which is
-- "on"), and restores the 023 body of declare_game_result and the my_profile view.

drop function if exists public.public_result(uuid);
drop function if exists public.queue_game_started_emails(uuid);
drop function if exists public.queue_result_saved_emails(uuid);
drop function if exists public.unsubscribe_email(text, text);
drop function if exists public.set_email_prefs(boolean, boolean);
drop function if exists public.site_base_url();

drop table if exists public.email_outbox;

-- 023 body (no email queue)
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

  perform public.close_games_in_result(distinct_ids, declared_ts);

  return public.get_game_result(new_id);
end;
$$;

revoke all on function public.declare_game_result(uuid[]) from public, anon;
grant execute on function public.declare_game_result(uuid[]) to authenticated;

drop view if exists public.my_profile;
alter table public.profiles drop column if exists email_token;
alter table public.profiles drop column if exists email_results;
alter table public.profiles drop column if exists email_game_started;

-- 019 view, re-created so it matches the columns again
create or replace view public.my_profile as
  select p.*
  from public.profiles p
  where p.id = auth.uid();
alter view public.my_profile set (security_barrier = true);
revoke all on public.my_profile from public;
revoke all on public.my_profile from anon;
grant select on public.my_profile to authenticated;

notify pgrst, 'reload schema';

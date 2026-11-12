-- Rollback 027: puts back the 007 add/remove/touch bodies, the 022 default_initials and
-- list_my_players, the 023 list_new_game_candidates, drops restore_my_player and
-- in_live_game_with_me, and makes the per-owner initials index whole again. Rows that were
-- soft-removed are deleted here (that is what 007 remove_my_player would have done), so the
-- column can go. Safe to re-run.

drop trigger if exists my_players_restore_initials on public.my_players;
drop function if exists public.my_players_restore_initials();
drop function if exists public.restore_my_player(uuid);
drop function if exists public.in_live_game_with_me(uuid);

delete from public.my_players where removed_at is not null;
drop index if exists public.my_players_owner_active_idx;
drop index if exists public.my_players_owner_initials_key;
alter table public.my_players drop column if exists removed_at;
create unique index if not exists my_players_owner_initials_key
  on public.my_players (owner_id, initials);

-- 022 body
create or replace function public.default_initials(p_owner uuid, p_name text, p_exclude_player uuid default null)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select t.c
     from unnest(public.initials_candidates(p_name)) with ordinality as t(c, ord)
     where not exists (
       select 1 from public.my_players m
       where m.owner_id = p_owner and m.initials = t.c
         and (p_exclude_player is null or m.player_id <> p_exclude_player))
     order by t.ord
     limit 1),
    (public.initials_candidates(p_name))[1]);
$$;

-- 007 bodies
create or replace function public.add_my_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  if p_player_id is null or not exists (select 1 from public.profiles where id = p_player_id) then
    raise exception 'That player was not found';
  end if;
  insert into public.my_players (owner_id, player_id)
  values (auth.uid(), p_player_id)
  on conflict (owner_id, player_id) do nothing;
end;
$$;

create or replace function public.remove_my_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  delete from public.my_players
  where owner_id = auth.uid() and player_id = p_player_id;
end;
$$;

create or replace function public.touch_my_players(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare pid uuid;
begin
  if auth.uid() is null or p_ids is null then return; end if;
  foreach pid in array p_ids loop
    if pid is null or pid = auth.uid() then continue; end if;
    if not exists (select 1 from public.profiles where id = pid) then continue; end if;
    insert into public.my_players (owner_id, player_id, games_together)
    values (auth.uid(), pid, 1)
    on conflict (owner_id, player_id)
    do update set games_together = public.my_players.games_together + 1;
  end loop;
end;
$$;

-- 022 body
create or replace function public.list_my_players()
returns table (id uuid, display_name text, player_code text, games_together integer, initials text, added_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, coalesce(nullif(p.display_name, ''), 'Rummy Player'), public.player_label(p), m.games_together, m.initials, m.created_at
  from public.my_players m
  join public.profiles p on p.id = m.player_id
  where m.owner_id = auth.uid()
    and coalesce(p.player_status, 'registered') not in ('deleted_before_registering','deleted_after_registering','merged')
  order by m.games_together desc, p.display_name;
$$;

-- 023 body
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
    where g.created_by = auth.uid() and g.deleted_at is null
    union
    select g.id, g.created_at
    from public.game_players a
    join public.games g on g.id = a.game_id
    where a.profile_id = auth.uid()
      and a.role = 'game_admin'
      and g.deleted_at is null
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

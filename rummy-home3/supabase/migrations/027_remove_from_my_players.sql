-- 027: Remove from My Players (final launch batch, Nov 12, item 1).
--
-- Removing a player from My Players is a soft remove: the my_players row stays with
-- removed_at set, so every past game, score and result keeps its name and totals, and
-- games_together comes back when the person is added again. While removed, the row is
-- hidden from list_my_players / the picker and its initials are free for someone else
-- (the per-owner unique index covers active rows only). Re-adding (by Player ID or by
-- name through the same add paths) clears removed_at; the stored initials are kept when
-- still free, else the normal default rule (SK, then SUK, ...) picks a new label.
--
-- Blocked while the player sits in a live game the owner can see:
--   "In a live game. Remove them after the game ends."
-- Nothing else changes: not their account, not their own My Players, not other people's
-- games, and nobody is notified.
--
-- remove_my_player keeps its signature, so the app build already on phones gets the soft
-- behaviour too. Safe to re-run. Rollback: supabase/rollback/rollback_027_remove_from_my_players.sql.

-- ---------- A. schema ----------
alter table public.my_players add column if not exists removed_at timestamptz;

create index if not exists my_players_owner_active_idx
  on public.my_players (owner_id) where removed_at is null;

-- Initials are unique among active rows only; a removed row keeps its old label as a hint.
drop index if exists public.my_players_owner_initials_key;
create unique index if not exists my_players_owner_initials_key
  on public.my_players (owner_id, initials) where removed_at is null;

-- 022 default_initials: only active rows take a label.
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
       where m.owner_id = p_owner and m.initials = t.c and m.removed_at is null
         and (p_exclude_player is null or m.player_id <> p_exclude_player))
     order by t.ord
     limit 1),
    (public.initials_candidates(p_name))[1]);
$$;

-- On restore, keep the old initials when nobody active took them; otherwise pick again.
create or replace function public.my_players_restore_initials()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_name text;
begin
  if old.removed_at is not null and new.removed_at is null then
    if new.initials is null or exists (
      select 1 from public.my_players m
      where m.owner_id = new.owner_id and m.initials = new.initials and m.removed_at is null and m.player_id <> new.player_id
    ) then
      select coalesce(nullif(p.display_name, ''), 'Rummy Player') into v_name from public.profiles p where p.id = new.player_id;
      new.initials := public.default_initials(new.owner_id, coalesce(v_name, 'Rummy Player'), new.player_id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists my_players_restore_initials on public.my_players;
create trigger my_players_restore_initials
before update of removed_at on public.my_players
for each row execute function public.my_players_restore_initials();

-- ---------- B. is the player in a live game I can see? ----------
create or replace function public.in_live_game_with_me(p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.game_players gp
    join public.games g on g.id = gp.game_id
    where gp.profile_id = p_player_id
      and gp.is_active and gp.role <> 'spectator' and coalesce(gp.seated, true)
      and g.status = 'active' and g.deleted_at is null and g.completed_at is null and g.closed_at is null
      and g.id in (select public.list_visible_game_ids())
  );
$$;
revoke all on function public.in_live_game_with_me(uuid) from public, anon, authenticated;

-- ---------- C. RPCs ----------
create or replace function public.remove_my_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_player_id = auth.uid() then raise exception 'You are always in your own list.'; end if;
  if public.in_live_game_with_me(p_player_id) then
    raise exception 'In a live game. Remove them after the game ends.';
  end if;
  update public.my_players
     set removed_at = now()
   where owner_id = auth.uid() and player_id = p_player_id and removed_at is null;
end;
$$;

-- Undo on the toast, or a later re-add: the row comes back with its history.
create or replace function public.restore_my_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  update public.my_players
     set removed_at = null
   where owner_id = auth.uid() and player_id = p_player_id and removed_at is not null;
  if not found and not exists (select 1 from public.my_players where owner_id = auth.uid() and player_id = p_player_id) then
    raise exception 'This player is not in your My players.';
  end if;
end;
$$;
revoke all on function public.restore_my_player(uuid) from public, anon;
grant execute on function public.restore_my_player(uuid) to authenticated;

-- 007 add_my_player: a removed row is restored instead of ignored.
create or replace function public.add_my_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_player_id is null or not exists (select 1 from public.profiles where id = p_player_id) then
    raise exception 'That player was not found';
  end if;
  insert into public.my_players (owner_id, player_id)
  values (auth.uid(), p_player_id)
  on conflict (owner_id, player_id) do update set removed_at = null where public.my_players.removed_at is not null;
end;
$$;

-- 007 touch_my_players: playing together again brings a removed player back.
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
    do update set games_together = public.my_players.games_together + 1, removed_at = null;
  end loop;
end;
$$;

-- 022 list_my_players: active rows only (same columns, so the current app build keeps working).
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
  where m.owner_id = auth.uid() and m.removed_at is null
    and coalesce(p.player_status, 'registered') not in ('deleted_before_registering','deleted_after_registering','merged')
  order by m.games_together desc, p.display_name;
$$;

-- 023 list_new_game_candidates: a removed player is not offered at all, not even from the
-- games we played together (Add player by ID or name is the way back).
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
    where m.owner_id = auth.uid() and m.removed_at is null and not exists (select 1 from stats s where s.profile_id = m.player_id)
  )
  select p.id, coalesce(nullif(p.display_name, ''), 'Rummy Player'), public.player_label(p), p.player_status, e.total_games, e.last_played_at
  from everyone e join public.profiles p on p.id = e.profile_id
  where coalesce(p.player_status, 'registered') not in ('deleted_before_registering','deleted_after_registering','merged')
    and not exists (select 1 from public.my_players m where m.owner_id = auth.uid() and m.player_id = e.profile_id and m.removed_at is not null)
  order by (e.last_played_at >= now() - interval '14 days') desc nulls last, e.total_games desc, e.last_played_at desc nulls last, p.display_name
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$$;

comment on column public.my_players.removed_at is
  '027: set by remove_my_player (soft remove). Hidden from lists and initials freed while set; cleared by restore_my_player, add_my_player or playing together again.';

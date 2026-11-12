-- ROLLBACK for 022_player_initials.sql. Safe to re-run.
-- Drops the stored initials, name snapshots and seat labels (that data is lost; the app then
-- recomputes labels from names on the fly, as before 022), the generator functions, the
-- triggers, the three new RPCs, and restores list_my_players (012), seat_rows_json (020) and
-- update_unregistered_player (012) to their previous bodies. 021 and earlier are untouched.

drop function if exists public.set_my_player_initials(uuid, text);
drop function if exists public.refresh_my_player_name(uuid, boolean);
drop function if exists public.set_seat_label(uuid, uuid, text);

drop trigger if exists my_players_fill_defaults on public.my_players;
drop function if exists public.my_players_fill_defaults();
drop trigger if exists game_players_fill_label on public.game_players;
drop function if exists public.game_players_fill_label();
drop function if exists public.seat_default_label(uuid, uuid);
drop function if exists public.default_initials(uuid, text, uuid);
drop function if exists public.initials_candidates(text);
drop function if exists public.initials_push(text[], text);
drop function if exists public.initials_words(text);

drop index if exists public.my_players_owner_initials_key;
alter table public.my_players drop constraint if exists my_players_initials_check;
alter table public.my_players drop column if exists initials;
alter table public.my_players drop column if exists name_snapshot;
alter table public.game_players drop constraint if exists game_players_label_check;
alter table public.game_players drop column if exists label;

-- 020 body
create or replace function public.seat_rows_json(p_games uuid[], p_member uuid[], p_profiles boolean)
returns table (game_id uuid, seats jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select gp.game_id,
         jsonb_agg(
           jsonb_build_object(
             'profile_id', gp.profile_id,
             'player_order', gp.player_order,
             'role', gp.role,
             'seated', gp.seated,
             'is_active', gp.is_active
           )
           || case
                when not p_profiles then '{}'::jsonb
                when gp.game_id = any(p_member) then jsonb_build_object('profiles', public.profile_fields_json(p))
                else jsonb_build_object('profiles', public.public_profile_json(p))
              end
           order by gp.player_order)
  from public.game_players gp
  left join public.profiles p on p.id = gp.profile_id
  where gp.game_id = any(p_games)
  group by gp.game_id;
$$;

-- 012 body
drop function if exists public.list_my_players();
create function public.list_my_players()
returns table (id uuid, display_name text, player_code text, games_together integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, coalesce(nullif(p.display_name, ''), 'Rummy Player'), public.player_label(p), m.games_together
  from public.my_players m
  join public.profiles p on p.id = m.player_id
  where m.owner_id = auth.uid()
    and coalesce(p.player_status, 'registered') not in ('deleted_before_registering','deleted_after_registering','merged')
  order by m.games_together desc, p.display_name;
$$;
revoke all on function public.list_my_players() from public;
grant execute on function public.list_my_players() to authenticated;

-- 012 body
create or replace function public.update_unregistered_player(p_player_id uuid, p_first text, p_last text)
returns table (id uuid, display_name text, player_code text, first_name text, last_name text, player_status text, managed_by uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.profiles := public.require_my_unregistered(p_player_id);
  name text := btrim(concat_ws(' ', nullif(btrim(p_first), ''), nullif(btrim(p_last), '')));
begin
  if r.player_status not in ('unregistered','pending') then raise exception 'Only unregistered players can be edited.'; end if;
  if btrim(coalesce(p_first, '')) = '' or btrim(coalesce(p_last, '')) = '' then raise exception 'Type a first and last name.'; end if;
  update public.profiles set display_name = left(name, 60), first_name = nullif(btrim(p_first), ''), last_name = nullif(btrim(p_last), '')
  where profiles.id = p_player_id;
  return query select p.id, p.display_name, public.player_label(p), p.first_name, p.last_name, p.player_status, p.managed_by
    from public.profiles p where p.id = p_player_id;
end;
$$;

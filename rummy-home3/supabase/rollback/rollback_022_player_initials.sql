-- ROLLBACK for 022_player_initials.sql. Safe to re-run.
-- Drops the stored initials and seat labels (that data is lost; the app then recomputes
-- labels from names on the fly, as before 022), the generator functions, the triggers, the
-- two new RPCs, and restores list_my_players (012) and seat_rows_json (020) to their previous
-- bodies. 021 and earlier are untouched.

drop function if exists public.set_my_player_initials(uuid, text);
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

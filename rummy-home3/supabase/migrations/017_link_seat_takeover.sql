-- 017: Link to a Player ID — a non-playing admin or a viewer of the game may take the seat.
--
-- 015 refused any target who already had a membership row in the game, which
-- blocked the common case the Nov 10 phone test hit: the organiser's co-admin
-- who is keeping score but not playing, or someone watching the game, turns out
-- to be the person behind an unregistered seat. They can now take that seat.
--
-- Behaviour changes versus 015 (everything else is unchanged):
--   * target already SEATED in this game       -> still refused: "They are already playing in this game."
--   * target is a non-playing game_admin here  -> their admin row is replaced by the seat; they keep game_admin and become seated.
--   * target is a spectator (viewer) here      -> their viewer row is replaced by the seat; they become a seated player.
--   * target is the caller                      -> no self row is written to my_players (015 inserted one).
--
-- Safe to re-run (create or replace). Rollback: supabase/rollback/rollback_017_link_seat_takeover.sql
-- restores the 015 function body.

create or replace function public.link_seat_to_player(p_game_id uuid, p_seat_profile uuid, p_target_profile uuid)
returns table (id uuid, display_name text, player_code text, public_player_no bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  seat public.profiles;
  target public.profiles;
  existing public.game_players;
  still_elsewhere integer;
begin
  if auth.uid() is null then raise exception 'Sign in required.' using errcode = '42501'; end if;
  if not (public.is_app_admin() or public.is_game_admin(p_game_id)) then
    raise exception 'Only a game admin can link players.' using errcode = '42501';
  end if;

  select * into seat from public.profiles where profiles.id = p_seat_profile for update;
  if seat.id is null then raise exception 'That player is not in this game.'; end if;
  if coalesce(seat.player_status, 'registered') not in ('unregistered', 'pending') then
    raise exception 'Only an unregistered player can be linked to a Player ID.';
  end if;
  if seat.managed_by is distinct from auth.uid() and not public.is_app_admin() then
    raise exception 'Only the organiser who added this player can change them.';
  end if;
  if not exists (
    select 1 from public.game_players gp
    where gp.game_id = p_game_id and gp.profile_id = p_seat_profile and gp.role <> 'spectator' and coalesce(gp.seated, true)
  ) then
    raise exception 'That player is not in this game.';
  end if;

  select * into target from public.profiles where profiles.id = p_target_profile;
  if target.id is null or target.managed_by is not null or coalesce(target.player_status, 'registered') <> 'registered' then
    raise exception 'That Player ID is not a registered account.';
  end if;

  -- The target may already be here as a non-playing admin or a viewer; a seated player may not take a second seat.
  select * into existing from public.game_players gp
  where gp.game_id = p_game_id and gp.profile_id = p_target_profile for update;
  if existing.id is not null then
    if existing.role <> 'spectator' and coalesce(existing.seated, true) then
      raise exception 'They are already playing in this game.';
    end if;
    delete from public.game_players gp where gp.id = existing.id;
  end if;

  update public.game_players
     set profile_id = p_target_profile,
         seated = true,
         role = case when existing.role = 'game_admin' then 'game_admin' else role end
   where game_id = p_game_id and profile_id = p_seat_profile;
  update public.scores set profile_id = p_target_profile where game_id = p_game_id and profile_id = p_seat_profile;
  update public.rounds set dealer_profile_id = p_target_profile where game_id = p_game_id and dealer_profile_id = p_seat_profile;

  if p_target_profile <> auth.uid() then
    insert into public.my_players (owner_id, player_id, games_together)
    values (auth.uid(), p_target_profile, 1)
    on conflict (owner_id, player_id) do update set games_together = public.my_players.games_together + 1;
  end if;

  -- A placeholder with no games left is folded away; one still used elsewhere stays.
  select count(*) into still_elsewhere from public.game_players gp where gp.profile_id = p_seat_profile;
  if still_elsewhere = 0 then
    update public.profiles set player_status = 'merged' where profiles.id = p_seat_profile;
    update public.player_links set status = 'revoked' where player_id = p_seat_profile and status = 'pending';
    delete from public.my_players where owner_id = auth.uid() and player_id = p_seat_profile;
  end if;

  return query
    select p.id, coalesce(nullif(p.display_name, ''), 'Rummy Player'), p.player_code, p.public_player_no
    from public.profiles p where p.id = p_target_profile;
end;
$$;

revoke all on function public.link_seat_to_player(uuid, uuid, uuid) from public;
revoke all on function public.link_seat_to_player(uuid, uuid, uuid) from anon;
grant execute on function public.link_seat_to_player(uuid, uuid, uuid) to authenticated;

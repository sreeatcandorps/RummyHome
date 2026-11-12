-- ROLLBACK for 019_security_and_concurrency_fixes.sql.
-- Undoes the four fixes in reverse: puts the 016 remove_seat_if_no_scores and the 014
-- save_round bodies back (no per-game lock, no PT409 conflicts), drops the my_profile
-- view and restores whole-table SELECT on profiles for signed-in users (the 011 read
-- policy still decides which rows), and drops the role-lock trigger. No data was changed
-- by 019, so nothing else needs undoing.
--
-- Running this re-opens the two security findings (self-granted app_admin; email, phone
-- and zip readable by any signed-in account). App builds from Nov 11 on still work: they
-- read my_profile first and fall back to profiles when the view is missing.

-- ---------------------------------------------------------------------------
-- D. remove_seat_if_no_scores: the 016 body
-- ---------------------------------------------------------------------------
create or replace function public.remove_seat_if_no_scores(p_game_id uuid, p_profile_id uuid)
returns table (removed boolean, zero_scores_deleted integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  seat public.game_players;
  non_zero integer;
  zeros integer;
  seated_left integer;
  closed timestamptz;
begin
  if auth.uid() is null then raise exception 'Sign in required.' using errcode = '42501'; end if;
  if not (public.is_app_admin() or public.is_game_admin(p_game_id)) then
    raise exception 'Only a game admin can remove players.' using errcode = '42501';
  end if;

  select * into seat from public.game_players gp where gp.game_id = p_game_id and gp.profile_id = p_profile_id for update;
  if seat.game_id is null then raise exception 'That player is not in this game.'; end if;

  select g.closed_at into closed from public.games g where g.id = p_game_id;
  if closed is not null then raise exception 'This game is closed. Its players cannot change.'; end if;

  select count(*) into non_zero
  from public.scores s
  join public.rounds r on r.id = s.round_id
  where s.game_id = p_game_id
    and s.profile_id = p_profile_id
    and r.undone_at is null
    and r.round_number < 1000
    and s.value <> 0;
  if non_zero > 0 then
    raise exception 'You cannot delete this player. You cannot delete a player that has a score. You will have to edit the round and delete all his scores before you remove a player.'
      using errcode = 'P0001';
  end if;

  select count(*) into seated_left
  from public.game_players gp
  where gp.game_id = p_game_id
    and gp.profile_id <> p_profile_id
    and gp.role <> 'spectator'
    and gp.seated;
  if seat.role <> 'spectator' and seat.seated and seated_left < 2 then
    raise exception 'A game needs at least two players. Add someone else before removing this player.';
  end if;

  -- Every remaining score row for this seat in this game is a 0 (live or retired); none carries information.
  delete from public.scores s where s.game_id = p_game_id and s.profile_id = p_profile_id;
  get diagnostics zeros = row_count;

  update public.rounds set dealer_profile_id = null where game_id = p_game_id and dealer_profile_id = p_profile_id;
  delete from public.game_players gp where gp.game_id = p_game_id and gp.profile_id = p_profile_id;

  return query select true, zeros;
end;
$$;

revoke all on function public.remove_seat_if_no_scores(uuid, uuid) from public;
revoke all on function public.remove_seat_if_no_scores(uuid, uuid) from anon;
grant execute on function public.remove_seat_if_no_scores(uuid, uuid) to authenticated;

comment on function public.remove_seat_if_no_scores(uuid, uuid) is
  'Game admin removes a seat only when every one of its round scores is 0 (or it has none). Deletes the zero score rows and the game_players row.';

-- ---------------------------------------------------------------------------
-- C. save_round: the 014 body
-- ---------------------------------------------------------------------------
create or replace function public.save_round(
  p_game_id uuid,
  p_round_number integer,
  p_scores jsonb,
  p_replace boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_round_id uuid;
  v_existing_scores integer;
  v_dealer uuid;
  v_players uuid[];
  v_attempt integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to save a round.' using errcode = '42501';
  end if;
  if not (public.is_app_admin() or public.is_game_admin(p_game_id)) then
    raise exception 'Only a game admin can save scores.' using errcode = '42501';
  end if;
  if p_round_number is null or p_round_number < 1 then
    raise exception 'Round number must be 1 or more.';
  end if;
  if p_scores is null or jsonb_typeof(p_scores) <> 'array' or jsonb_array_length(p_scores) = 0 then
    raise exception 'At least one score is required.';
  end if;

  select array_agg(profile_id order by player_order)
    into v_players
    from public.game_players
   where game_id = p_game_id
     and role <> 'spectator'
     and coalesce(seated, true);
  if v_players is not null and array_length(v_players, 1) > 0 then
    v_dealer := v_players[((p_round_number - 1) % array_length(v_players, 1)) + 1];
  end if;

  select id into v_round_id
    from public.rounds
   where game_id = p_game_id and round_number = p_round_number and undone_at is null
   for update;

  if v_round_id is not null then
    select count(*) into v_existing_scores from public.scores where round_id = v_round_id;

    if p_replace then
      -- Retire the old row to a spare number so the fresh row can take its place.
      v_attempt := 0;
      loop
        begin
          update public.rounds
             set undone_at = now(),
                 undone_by = auth.uid(),
                 undo_reason = 'edited round ' || p_round_number,
                 round_number = 1000 * (v_attempt + 1) + p_round_number
           where id = v_round_id;
          exit;
        exception when unique_violation then
          v_attempt := v_attempt + 1;
          if v_attempt > 5 then raise; end if;
        end;
      end loop;
      v_round_id := null;
    elsif v_existing_scores > 0 then
      -- Duplicate submit of a round that is already saved: just make sure the game moved on.
      update public.games
         set current_round = greatest(coalesce(current_round, 1), p_round_number + 1)
       where id = p_game_id;
      return v_round_id;
    end if;
    -- An empty live round (an earlier interrupted save) is simply reused.
  end if;

  if v_round_id is null then
    insert into public.rounds (game_id, round_number, dealer_profile_id, created_by)
    values (p_game_id, p_round_number, v_dealer, auth.uid())
    returning id into v_round_id;
  end if;

  insert into public.scores (round_id, game_id, profile_id, score_type, value)
  select v_round_id,
         p_game_id,
         (s->>'playerId')::uuid,
         (s->>'scoreType')::public.score_type,
         (s->>'value')::integer
    from jsonb_array_elements(p_scores) as s;

  if not p_replace then
    update public.games
       set current_round = greatest(coalesce(current_round, 1), p_round_number + 1)
     where id = p_game_id;
  end if;

  return v_round_id;
end;
$$;

revoke all on function public.save_round(uuid, integer, jsonb, boolean) from public;
revoke all on function public.save_round(uuid, integer, jsonb, boolean) from anon;
grant execute on function public.save_round(uuid, integer, jsonb, boolean) to authenticated;
comment on function public.save_round(uuid, integer, jsonb, boolean) is null;

-- ---------------------------------------------------------------------------
-- B. profiles: whole-table SELECT back for signed-in users; the view goes
-- ---------------------------------------------------------------------------
drop view if exists public.my_profile;
revoke select on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant select on public.profiles to anon;

-- ---------------------------------------------------------------------------
-- A. role lock trigger
-- ---------------------------------------------------------------------------
drop trigger if exists profiles_lock_role on public.profiles;
drop function if exists public.lock_profile_role();

notify pgrst, 'reload schema';

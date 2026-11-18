-- 019: four fixes found by the CI database suite (PR 9). Apply after 017 and 018.
-- Safe to re-run. Rollback: rollback_019_security_and_concurrency_fixes.sql.
--
-- A. Privilege escalation. "users update own profile" let a signed-in account run
--    update profiles set role = 'app_admin' where id = auth.uid(); is_app_admin() then
--    opened every game, seat and result. A trigger now refuses any role change unless
--    the caller is already an app admin, or is the service role / direct SQL (no user JWT).
--
-- B. Profile privacy. The 011 read policy lets any signed-in account read every registered
--    profile row, including email, phone and zip_code. Reading those three columns is now
--    the owner's alone: SELECT on profiles is granted per column to `authenticated` (name,
--    avatar, Player ID, status and the other non-contact columns); anon loses SELECT
--    entirely. The owner reads their full row through the new `my_profile` view, which is
--    limited to `id = auth.uid()`. The row policy from 011 is unchanged, so who can see
--    WHICH players is the same; what changed is which columns they can see.
--    Client impact: `select('*')` on profiles no longer works for signed-in users; name
--    the columns, or read your own row from my_profile. New profile columns added later
--    must be granted here too (a column-level grant does not cover future columns).
--
-- C. save_round race. Two admins saving the same new round at the same moment both passed
--    the "does the round exist" check, so the loser hit the (game_id, round_number) unique
--    index and the app showed a raw 23505. save_round now serialises writers per game with
--    a transaction-scoped advisory lock; the second writer then finds the committed round.
--    If its payload is identical (double tap, retry after a timeout) the call is a no-op;
--    if it differs the call fails with SQLSTATE PT409 (PostgREST returns HTTP 409) and a
--    plain message the app shows before refreshing the scorecard.
--
-- D. Orphan 0-score row. remove_seat_if_no_scores could run while a save that included that
--    seat was in flight: the seat was deleted, then the save committed a 0 for a player with
--    no seat. Both functions now take the same per-game lock, so one finishes before the
--    other starts, and save_round refuses (PT409) a payload naming a player who is no longer
--    in the game.

-- ---------------------------------------------------------------------------
-- A. profiles.role can only be changed by an app admin or the service role
-- ---------------------------------------------------------------------------
create or replace function public.lock_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_privileged boolean;
begin
  -- No user JWT (SQL editor, migrations, seed, GoTrue's own trigger) or the service role may
  -- set any role. A signed-in user may only if they are already an app admin.
  v_privileged := auth.uid() is null
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.is_app_admin();

  if tg_op = 'INSERT' then
    if new.role is distinct from 'player' and not v_privileged then
      raise exception 'Only an app admin can grant the app admin role.' using errcode = '42501';
    end if;
  elsif new.role is distinct from old.role and not v_privileged then
    raise exception 'Only an app admin can change a player''s role.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_lock_role on public.profiles;
create trigger profiles_lock_role
before insert or update of role on public.profiles
for each row execute function public.lock_profile_role();

comment on function public.lock_profile_role() is
  'Refuses changes to profiles.role unless the caller is an app admin or has no user JWT (service role / SQL).';

-- ---------------------------------------------------------------------------
-- B. email, phone and zip_code are readable by their owner only
-- ---------------------------------------------------------------------------
revoke select on public.profiles from anon;
revoke select on public.profiles from authenticated;
grant select (
  id, created_at, updated_at, first_name, last_name, display_name, avatar_url, role,
  default_settings, player_code, is_demo, demo_owner_id, player_status, managed_by,
  deleted_at, public_player_no
) on public.profiles to authenticated;

-- The signed-in account's own row, every column. Runs as the view owner (not security
-- invoker) so it is not subject to the column grants above; the WHERE keeps it to one row.
create or replace view public.my_profile as
  select p.*
  from public.profiles p
  where p.id = auth.uid();
alter view public.my_profile set (security_barrier = true);
revoke all on public.my_profile from public;
revoke all on public.my_profile from anon;
grant select on public.my_profile to authenticated;

comment on view public.my_profile is
  'The caller''s own profile row including email, phone and zip_code. Other profiles: read public.profiles (contact columns are not granted).';

-- ---------------------------------------------------------------------------
-- C. save_round: one writer per game at a time; same payload is a no-op, a different
--    payload for an already saved round is a PT409 conflict
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
  v_differences integer;
  v_unknown integer;
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

  -- One writer per game until this transaction ends. remove_seat_if_no_scores takes the
  -- same key, so a seat cannot disappear under a save (or a save land under a removal).
  perform pg_advisory_xact_lock(hashtextextended('game:' || p_game_id::text, 0));

  -- Every scored player must still be in the game (checked after the lock, so a removal
  -- that just committed is seen).
  select count(*) into v_unknown
    from jsonb_array_elements(p_scores) as s
   where not exists (
     select 1 from public.game_players gp
      where gp.game_id = p_game_id and gp.profile_id = (s->>'playerId')::uuid
   );
  if v_unknown > 0 then
    raise exception 'The players in this game changed while you were scoring. The scorecard has been refreshed; check the round and save it again.'
      using errcode = 'PT409';
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
      -- The round is already saved. The same payload again is a duplicate submit (double
      -- tap, retry after a timeout): make sure the game moved on and return. A different
      -- payload means someone else saved this round first: refuse, so nothing is lost
      -- silently and the app can refresh.
      select count(*) into v_differences
        from (
          (select s.profile_id, s.score_type, s.value from public.scores s where s.round_id = v_round_id
           except
           select (e->>'playerId')::uuid, (e->>'scoreType')::public.score_type, (e->>'value')::integer
             from jsonb_array_elements(p_scores) as e)
          union all
          (select (e->>'playerId')::uuid, (e->>'scoreType')::public.score_type, (e->>'value')::integer
             from jsonb_array_elements(p_scores) as e
           except
           select s.profile_id, s.score_type, s.value from public.scores s where s.round_id = v_round_id)
        ) as d;
      if v_differences > 0 then
        raise exception 'Round % was just saved by someone else. The scorecard has been refreshed; check it before you save again.', p_round_number
          using errcode = 'PT409';
      end if;
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

comment on function public.save_round(uuid, integer, jsonb, boolean) is
  'Saves one round and its scores atomically. Serialised per game (advisory lock). Same payload twice is a no-op; a different payload for a saved round, or a player no longer in the game, raises PT409.';

-- ---------------------------------------------------------------------------
-- D. remove_seat_if_no_scores: waits for any in-flight save on the game first
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

  -- Same key as save_round: a save that is mid-flight finishes (and its scores are then
  -- checked below) before the seat can go, and no save can start until this one ends.
  perform pg_advisory_xact_lock(hashtextextended('game:' || p_game_id::text, 0));

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
  'Game admin removes a seat only when every one of its round scores is 0 (or it has none). Serialised with save_round per game. Deletes the zero score rows and the game_players row.';

-- PostgREST picks up the new view (hosted projects do this on DDL already; harmless elsewhere).
notify pgrst, 'reload schema';

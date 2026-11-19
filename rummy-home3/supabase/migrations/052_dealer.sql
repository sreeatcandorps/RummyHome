-- 052 — The Dealer sheet (Q8 v2 → D60), a joiner sits at the dealer's seat + 1 (D57), the deal
-- and the open card skip a seat that is out (D58). Sree, Nov 19: "it should just be a menu of its
-- own … keep it more simple and not do the next round/last round"; "I'm okay with A and B."
--
-- A. games: who really deals the round being played (set from the Dealer sheet; applied by save_round
--    to that round only, then cleared or — "this round only" — chained once to the planned seat).
-- B. Log kind dealer_changed.
-- C. dealer_rotation(game, round): the seats in play for a round (out players skipped, D58);
--    next_in_rotation(rotation, after, game); current_dealer(game): who deals the round being played.
-- D. set_round_dealer(game, round, dealer, follow): any round — played, the last, or the next — in one
--    call. Follow re-deals every later round from the new dealer; keep changes that round alone.
-- E. save_round: 041 body + the override (A).
-- F. add_seated_player: 047 body + D57.
-- Re-runnable. Rollback: supabase/rollback/rollback_052_dealer.sql.

-- ---------- A. columns ----------
alter table public.games add column if not exists next_dealer_profile_id uuid references public.profiles(id) on delete set null;
alter table public.games add column if not exists next_dealer_round integer;
alter table public.games add column if not exists next_dealer_keeps_sequence boolean not null default false;
comment on column public.games.next_dealer_profile_id is '052: who really deals round next_dealer_round (Dealer sheet); save_round applies it to that round and clears it.';
comment on column public.games.next_dealer_keeps_sequence is '052: true = "this round only": the round after goes on from the planned dealer.';

-- ---------- B. Log kind ----------
alter table public.event_log drop constraint if exists event_log_kind;
alter table public.event_log add constraint event_log_kind check (kind in (
  'game_created', 'player_added', 'player_removed', 'viewer_added', 'viewer_removed',
  'admin_added', 'admin_removed', 'round_added', 'round_edited', 'round_undone',
  'settings_changed', 'initials_changed', 'player_renamed', 'completed', 'reopened',
  'closed', 'unclosed', 'deleted', 'restored',
  'result_saved', 'result_deleted', 'result_restored', 'result_changed',
  'player_out', 'player_reentered', 'reentry_undone', 'awards_set', 'awards_changed',
  'seating_changed',
  'restore_requested', 'game_purged', 'game_archived',
  'player_back_in',
  'dealer_changed'));

-- ---------- C. rotation helpers ----------
-- The seats in play for round p_round, in seat order: seated, non-spectator players; a pool player
-- who went out in an earlier round is skipped (in for round j while j <= out_round).
create or replace function public.dealer_rotation(p_game_id uuid, p_round integer)
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(gp.profile_id order by gp.player_order), '{}'::uuid[])
    from public.game_players gp
   where gp.game_id = p_game_id and gp.role <> 'spectator' and coalesce(gp.seated, true)
     and gp.player_order < 900
     and (gp.out_round is null or gp.out_round >= p_round);
$$;
revoke all on function public.dealer_rotation(uuid, integer) from public, anon, authenticated;

-- The seat after p_after in p_rotation; when p_after is not in it (out, or left), the next seat up
-- that is; past the end wraps to the first seat. Null rotation → null.
create or replace function public.next_in_rotation(p_rotation uuid[], p_after uuid, p_game_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_pos integer;
  v_next uuid;
  v_after_order integer;
begin
  if p_rotation is null or coalesce(array_length(p_rotation, 1), 0) = 0 then return null; end if;
  v_pos := array_position(p_rotation, p_after);
  if v_pos is not null then
    return p_rotation[(v_pos % array_length(p_rotation, 1)) + 1];
  end if;
  if p_after is null then return p_rotation[1]; end if;
  select gp.player_order into v_after_order from public.game_players gp where gp.game_id = p_game_id and gp.profile_id = p_after;
  if v_after_order is null then return p_rotation[1]; end if;
  select gp.profile_id into v_next
    from public.game_players gp
   where gp.game_id = p_game_id and gp.profile_id = any(p_rotation) and gp.player_order > v_after_order
   order by gp.player_order limit 1;
  return coalesce(v_next, p_rotation[1]);
end;
$$;
revoke all on function public.next_in_rotation(uuid[], uuid, uuid) from public, anon, authenticated;

-- Who deals the round being played (live rounds + 1): the Dealer-sheet override for that round when
-- it names a player still in, else the seat after the last live round's dealer, else seat 1.
create or replace function public.current_dealer(p_game_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_round integer := public.live_round_count(p_game_id) + 1;
  v_rot uuid[] := public.dealer_rotation(p_game_id, v_round);
  v_ovr uuid;
  v_ovr_round integer;
  v_last uuid;
begin
  if coalesce(array_length(v_rot, 1), 0) = 0 then return null; end if;
  select g.next_dealer_profile_id, g.next_dealer_round into v_ovr, v_ovr_round from public.games g where g.id = p_game_id;
  if v_ovr is not null and v_ovr_round = v_round and v_ovr = any(v_rot) then return v_ovr; end if;
  select r.dealer_profile_id into v_last
    from public.rounds r
   where r.game_id = p_game_id and r.undone_at is null and r.round_number < 1000 and r.dealer_profile_id is not null
   order by r.round_number desc limit 1;
  if v_last is null then return v_rot[1]; end if;
  return public.next_in_rotation(v_rot, v_last, p_game_id);
end;
$$;
revoke all on function public.current_dealer(uuid) from public, anon;
grant execute on function public.current_dealer(uuid) to authenticated;

-- ---------- D. set_round_dealer ----------
create or replace function public.set_round_dealer(p_game_id uuid, p_round_number integer, p_dealer uuid, p_follow boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  g public.games%rowtype;
  v_n integer;
  v_rot uuid[];
  v_old uuid;
  v_prev uuid;
  v_next uuid;
  v_had_override boolean;
  v_planned uuid;
  j integer;
  v_from text;
  v_to text;
  v_next_text text;
begin
  if auth.uid() is null then raise exception 'Sign in required.' using errcode = '42501'; end if;
  if not (public.is_app_admin() or public.is_game_admin(p_game_id)
          or exists (select 1 from public.games x where x.id = p_game_id and x.created_by = auth.uid())) then
    raise exception 'Only a game admin can change the dealer.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('game:' || p_game_id::text, 0));
  select * into g from public.games where id = p_game_id;
  if g.id is null or g.deleted_at is not null then raise exception 'This game is not available.'; end if;
  if g.status <> 'active' or g.closed_at is not null then
    raise exception 'The game is completed. Reopen it to change the dealer.';
  end if;
  v_n := public.live_round_count(p_game_id);
  if p_round_number is null or p_round_number < 1 or p_round_number > v_n + 1 then
    raise exception 'Round % has not been played.', p_round_number;
  end if;
  v_rot := public.dealer_rotation(p_game_id, p_round_number);
  if p_dealer is null or not (p_dealer = any(v_rot)) then
    raise exception 'That player is not at the table for round %.', p_round_number;
  end if;

  if p_round_number = v_n + 1 then
    -- The round being played: remember who really deals; save_round applies it.
    v_had_override := g.next_dealer_profile_id is not null and g.next_dealer_round = p_round_number;
    v_old := public.current_dealer(p_game_id);
    -- planned = the sequence without any override
    select r.dealer_profile_id into v_prev
      from public.rounds r
     where r.game_id = p_game_id and r.undone_at is null and r.round_number < 1000 and r.dealer_profile_id is not null
     order by r.round_number desc limit 1;
    v_planned := case when v_prev is null then v_rot[1] else public.next_in_rotation(v_rot, v_prev, p_game_id) end;
    if p_dealer = v_planned and p_follow then
      if not v_had_override then
        return jsonb_build_object('changed', false, 'round', p_round_number, 'dealer', p_dealer);
      end if;
      update public.games set next_dealer_profile_id = null, next_dealer_round = null, next_dealer_keeps_sequence = false where id = p_game_id;
    else
      update public.games
         set next_dealer_profile_id = p_dealer, next_dealer_round = p_round_number, next_dealer_keeps_sequence = not p_follow
       where id = p_game_id;
    end if;
    v_next := case when p_follow then public.next_in_rotation(v_rot, p_dealer, p_game_id)
                   else public.next_in_rotation(v_rot, v_planned, p_game_id) end;
  else
    -- A played round: fix who dealt it; follow re-deals every later round from there.
    select r.dealer_profile_id into v_old
      from public.rounds r
     where r.game_id = p_game_id and r.undone_at is null and r.round_number = p_round_number;
    if v_old is not distinct from p_dealer and not p_follow then
      return jsonb_build_object('changed', false, 'round', p_round_number, 'dealer', p_dealer);
    end if;
    update public.rounds set dealer_profile_id = p_dealer
     where game_id = p_game_id and undone_at is null and round_number = p_round_number;
    if p_follow then
      v_prev := p_dealer;
      for j in (p_round_number + 1)..v_n loop
        v_prev := public.next_in_rotation(public.dealer_rotation(p_game_id, j), v_prev, p_game_id);
        update public.rounds set dealer_profile_id = v_prev where game_id = p_game_id and undone_at is null and round_number = j;
      end loop;
      update public.games set next_dealer_profile_id = null, next_dealer_round = null, next_dealer_keeps_sequence = false where id = p_game_id;
      v_next := public.next_in_rotation(public.dealer_rotation(p_game_id, v_n + 1), v_prev, p_game_id);
    elsif p_round_number = v_n then
      -- Keep the sequence on the last round: the next round goes on from the dealer the card had.
      v_next := public.next_in_rotation(public.dealer_rotation(p_game_id, v_n + 1), v_old, p_game_id);
      update public.games
         set next_dealer_profile_id = v_next, next_dealer_round = v_n + 1, next_dealer_keeps_sequence = false
       where id = p_game_id;
    else
      v_next := public.current_dealer(p_game_id);
    end if;
  end if;

  v_from := coalesce(public.player_snapshot(p_game_id, v_old)->>'ini', '—');
  v_to := coalesce(public.player_snapshot(p_game_id, p_dealer)->>'ini', '—');
  v_next_text := coalesce(public.player_snapshot(p_game_id, v_next)->>'ini', '—');
  perform public.log_event(p_game_id, null, 'dealer_changed', 'important',
    format('Dealer changed · Round %s · %s → %s · %s · Round %s: %s deals', p_round_number, v_from, v_to,
           case when p_follow then 'followed' else 'this round only' end,
           case when p_round_number = v_n + 1 then p_round_number + 1 else v_n + 1 end, v_next_text),
    jsonb_build_object('round', p_round_number, 'from', v_old, 'to', p_dealer, 'follow', p_follow, 'nextDealer', v_next,
                       'names', jsonb_build_array(public.player_snapshot(p_game_id, p_dealer)->>'name')));
  return jsonb_build_object('changed', true, 'round', p_round_number, 'from', v_old, 'dealer', p_dealer, 'follow', p_follow, 'nextDealer', v_next);
end;
$$;
revoke all on function public.set_round_dealer(uuid, integer, uuid, boolean) from public, anon;
grant execute on function public.set_round_dealer(uuid, integer, uuid, boolean) to authenticated;

-- ---------- E. save_round: 041 body + the override ----------
create or replace function public.save_round(
  p_game_id uuid,
  p_round_number integer,
  p_scores jsonb,
  p_replace boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_round_id uuid;
  v_existing_scores integer;
  v_differences integer;
  v_unknown integer;
  v_dealer uuid;
  v_players uuid[];
  v_attempt integer;
  v_prev_dealer uuid;
  v_prev_pos integer;
  v_saver text;
  v_old_round_id uuid;
  v_changes jsonb;
  v_unchanged integer;
  v_summary text;
  v_pool boolean := public.is_pool_game(p_game_id);
  v_in uuid[];
  v_missing text;
  v_out_name text;
  v_limit integer;
  v_rec record;
  v_ovr uuid;
  v_ovr_round integer;
  v_ovr_keeps boolean;
  v_planned uuid;
  v_pos integer;
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

  if v_pool then
    -- 041: plus points only, winners at 0, at least one winner.
    if exists (select 1 from jsonb_array_elements(p_scores) s where (s->>'value')::integer < 0) then
      raise exception 'Pool scores are plus points. Type the hand as a positive number; the winner is 0.';
    end if;
    if exists (select 1 from jsonb_array_elements(p_scores) s where s->>'scoreType' = 'rummy' and (s->>'value')::integer <> 0) then
      raise exception 'In a pool the round winner scores 0.';
    end if;
    if not exists (select 1 from jsonb_array_elements(p_scores) s where (s->>'value')::integer = 0) then
      raise exception 'Every round has a winner at 0. Tap the winner, then Rummy.';
    end if;
    if not p_replace then
      v_in := public.pool_players_in(p_game_id);
      if coalesce(array_length(v_in, 1), 0) <= 1 then
        raise exception 'Only one player is still in. Complete the pool, or re-enter someone first.';
      end if;
      -- A player who is out cannot be scored; every player still in must be.
      select string_agg(public.player_snapshot(p_game_id, (s->>'playerId')::uuid)->>'name', ', ') into v_out_name
        from jsonb_array_elements(p_scores) s
       where not ((s->>'playerId')::uuid = any(v_in));
      if v_out_name is not null then
        raise exception '% is out of the pool and cannot be scored. Re-enter them first.', v_out_name;
      end if;
      select string_agg(public.player_snapshot(p_game_id, u.id)->>'name', ', ') into v_missing
        from unnest(v_in) u(id)
       where not exists (select 1 from jsonb_array_elements(p_scores) s where (s->>'playerId')::uuid = u.id);
      if v_missing is not null then
        raise exception 'Every player still in needs a score: %.', v_missing;
      end if;
    end if;
  end if;

  select array_agg(profile_id order by player_order)
    into v_players
    from public.game_players
   where game_id = p_game_id
     and role <> 'spectator'
     and coalesce(seated, true)
     -- 041: the deal skips players who are out of a pool.
     and (not v_pool or out_round is null);
  -- 031: the deal follows the actual rotation. The dealer is the seat after the previous
  -- live round's dealer in the current seat order (so a player added mid-game makes the
  -- next rotation one round longer). A re-saved round keeps its dealer. The first round,
  -- or a previous dealer who has left the game, falls back to the seat-order rule.
  if v_players is not null and array_length(v_players, 1) > 0 then
    v_dealer := null;
    if p_replace then
      select r.dealer_profile_id into v_dealer
        from public.rounds r
       where r.game_id = p_game_id and r.round_number = p_round_number and r.undone_at is null;
    end if;
    if v_dealer is null then
      select r.dealer_profile_id into v_prev_dealer
        from public.rounds r
       where r.game_id = p_game_id and r.round_number < p_round_number and r.undone_at is null
         and r.dealer_profile_id is not null
       order by r.round_number desc
       limit 1;
      v_prev_pos := array_position(v_players, v_prev_dealer);
      if v_prev_pos is not null then
        v_dealer := v_players[(v_prev_pos % array_length(v_players, 1)) + 1];
      elsif v_prev_dealer is not null and v_pool then
        -- 041: the previous dealer went out; the deal passes to the next seat still in.
        select gp.profile_id into v_dealer
          from public.game_players gp
         where gp.game_id = p_game_id and gp.profile_id = any(v_players)
           and gp.player_order > (select x.player_order from public.game_players x where x.game_id = p_game_id and x.profile_id = v_prev_dealer)
         order by gp.player_order limit 1;
        if v_dealer is null then v_dealer := v_players[1]; end if;
      else
        v_dealer := v_players[((p_round_number - 1) % array_length(v_players, 1)) + 1];
      end if;
    elsif array_position(v_players, v_dealer) is null then
      v_dealer := v_players[((p_round_number - 1) % array_length(v_players, 1)) + 1];
    end if;
    -- 052 (Q8): the Dealer sheet may have named who really deals this round. It applies to the
    -- round it was set for only, and only while that player is still in; a stale one is dropped.
    if not p_replace then
      select g.next_dealer_profile_id, g.next_dealer_round, g.next_dealer_keeps_sequence
        into v_ovr, v_ovr_round, v_ovr_keeps
        from public.games g where g.id = p_game_id;
      if v_ovr is not null and v_ovr_round = p_round_number and v_ovr = any(v_players) then
        v_planned := v_dealer;
        v_dealer := v_ovr;
        if v_ovr_keeps and v_planned is not null then
          -- "This round only": the round after this one goes on as if the planned dealer had dealt.
          v_pos := array_position(v_players, v_planned);
          update public.games
             set next_dealer_profile_id = v_players[(v_pos % array_length(v_players, 1)) + 1],
                 next_dealer_round = p_round_number + 1,
                 next_dealer_keeps_sequence = false
           where id = p_game_id;
        else
          update public.games
             set next_dealer_profile_id = null, next_dealer_round = null, next_dealer_keeps_sequence = false
           where id = p_game_id;
        end if;
      elsif v_ovr is not null and v_ovr_round <= p_round_number then
        update public.games
           set next_dealer_profile_id = null, next_dealer_round = null, next_dealer_keeps_sequence = false
         where id = p_game_id;
      end if;
    end if;
  end if;

  select id into v_round_id
    from public.rounds
   where game_id = p_game_id and round_number = p_round_number and undone_at is null
     for update;

  if v_round_id is not null then
    select count(*) into v_existing_scores from public.scores where round_id = v_round_id;

    if p_replace then
      -- 036: remember the old row so the log can say what changed.
      v_old_round_id := v_round_id;
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
        -- 035: name the admin who saved it, from rounds.created_by.
        select coalesce(nullif(trim(p.display_name), ''), 'another admin') into v_saver
          from public.rounds r
          left join public.profiles p on p.id = r.created_by
         where r.id = v_round_id;
        raise exception 'Round % was just saved by %. Check the scorecard before you save again.', p_round_number, coalesce(v_saver, 'another admin')
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
    -- 035: a new round must follow the last live one. If another admin undid a round while
    -- this one was typing, the number they typed for is now one too far ahead (2.5).
    if not p_replace and p_round_number > (select coalesce(max(round_number), 0) + 1 from public.rounds where game_id = p_game_id and undone_at is null) then
      raise exception 'A round was undone while you were scoring. The scorecard has been refreshed; check the round number and save again.'
        using errcode = 'PT409';
    end if;
    -- 035: only live rounds are unique per number (partial index), so a round undone at this
    -- number no longer blocks the insert. An older row parked at this number by a client that
    -- never retired it is moved out of the way first (belt and braces).
    update public.rounds
       set round_number = 1000 * (1 + (select count(*) from public.rounds x where x.game_id = p_game_id and x.round_number >= 1000 and x.round_number % 1000 = p_round_number)) + p_round_number
     where game_id = p_game_id and round_number = p_round_number and undone_at is not null;
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

  -- 036: the log row (round_added routine / round_edited important with the old→new list)
  if p_replace and v_old_round_id is not null then
    with o as (select profile_id, value from public.scores where round_id = v_old_round_id),
         n as (select profile_id, value from public.scores where round_id = v_round_id),
         d as (
           select coalesce(n.profile_id, o.profile_id) as profile_id, o.value as old_value, n.value as new_value
             from n full join o on o.profile_id = n.profile_id
            where o.value is distinct from n.value
         )
    select coalesce(jsonb_agg(public.player_snapshot(p_game_id, d.profile_id)
             || jsonb_build_object('old', d.old_value, 'new', d.new_value) order by gp.player_order), '[]'::jsonb),
           (select count(*) from n) - count(*)
      into v_changes, v_unchanged
      from d left join public.game_players gp on gp.game_id = p_game_id and gp.profile_id = d.profile_id;
    select string_agg(format('%s %s→%s', c->>'name', public.score_text((c->>'old')::integer), public.score_text((c->>'new')::integer)), ', ')
      into v_summary from jsonb_array_elements(v_changes) c;
    perform public.log_event(p_game_id, null, 'round_edited', 'important',
      format('Round %s edited · %s%s', p_round_number,
             coalesce(v_summary, 'no score changed'),
             case when coalesce(v_unchanged, 0) > 0 then format(' · %s other%s unchanged', v_unchanged, case when v_unchanged = 1 then '' else 's' end) else '' end),
      jsonb_build_object('round', p_round_number, 'changes', v_changes, 'unchanged', coalesce(v_unchanged, 0),
                         'names', (select coalesce(jsonb_agg(c->>'name'), '[]'::jsonb) from jsonb_array_elements(v_changes) c)));
  else
    perform public.log_event(p_game_id, null, 'round_added', 'routine',
      format('Round %s added · Dealer %s · %s', p_round_number,
             coalesce((public.player_snapshot(p_game_id, v_dealer))->>'ini', '—'),
             coalesce((select string_agg(format('%s %s', public.player_snapshot(p_game_id, s.profile_id)->>'name', case when v_pool then 'won' else public.score_text(s.value) end), ', ' order by s.value desc)
                         from public.scores s where s.round_id = v_round_id and ((v_pool and s.value = 0) or (not v_pool and s.value > 0))), 'no winner')),
      jsonb_build_object('round', p_round_number,
                         'dealer', public.player_snapshot(p_game_id, v_dealer),
                         'scores', (select coalesce(jsonb_agg(public.player_snapshot(p_game_id, s.profile_id) || jsonb_build_object('value', s.value, 'type', s.score_type) order by s.value desc), '[]'::jsonb)
                                      from public.scores s where s.round_id = v_round_id),
                         'names', (select coalesce(jsonb_agg(public.player_snapshot(p_game_id, s.profile_id)->>'name'), '[]'::jsonb)
                                      from public.scores s where s.round_id = v_round_id and ((v_pool and s.value = 0) or (not v_pool and s.value > 0)))));
  end if;

  -- 041: who is out after this save (newly out players are logged, important).
  if v_pool then
    v_limit := public.pool_limit_of(p_game_id);
    perform public.pool_recompute(p_game_id);
    for v_rec in
      select gp.profile_id, public.pool_total(p_game_id, gp.profile_id) as total
        from public.game_players gp
       where gp.game_id = p_game_id and gp.out_round = p_round_number
         and not exists (select 1 from public.event_log e where e.game_id = p_game_id and e.kind = 'player_out'
                           and (e.details->>'round')::integer = p_round_number and e.details->>'profileId' = gp.profile_id::text)
    loop
      perform public.log_event(p_game_id, null, 'player_out', 'important',
        format('%s is out · %s (limit %s) · Round %s', public.player_snapshot(p_game_id, v_rec.profile_id)->>'name', v_rec.total, v_limit, p_round_number),
        jsonb_build_object('round', p_round_number, 'profileId', v_rec.profile_id, 'total', v_rec.total, 'limit', v_limit,
                           'names', jsonb_build_array(public.player_snapshot(p_game_id, v_rec.profile_id)->>'name')));
    end loop;
  end if;

  return v_round_id;
end;
$$;

revoke all on function public.save_round(uuid, integer, jsonb, boolean) from public, anon;
grant execute on function public.save_round(uuid, integer, jsonb, boolean) to authenticated;

-- ---------- F. add_seated_player: 047 body + D57 ----------
create or replace function public.add_seated_player(p_game_id uuid, p_profile_id uuid, p_label text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next integer;
  v_zeros integer;
  v_round integer;
  v_high integer;
  v_in uuid[];
  v_plus integer;
  v_number integer;
  v_dealing uuid;
  v_dealer_order integer;
begin
  if auth.uid() is null then raise exception 'Sign in required.' using errcode = '42501'; end if;
  if not (public.is_app_admin() or public.is_game_admin(p_game_id)) then
    raise exception 'Only a game admin can add players.' using errcode = '42501';
  end if;
  if exists (select 1 from public.games g where g.id = p_game_id and (g.closed_at is not null or g.deleted_at is not null)) then
    raise exception 'This game is closed. Its players cannot change.';
  end if;
  if exists (select 1 from public.game_players gp where gp.game_id = p_game_id and gp.profile_id = p_profile_id) then
    raise exception 'They are already in this game.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('game:' || p_game_id::text, 0));
  select coalesce(max(player_order), -1) + 1 into v_next from public.game_players where game_id = p_game_id and player_order < 900;
  v_number := v_next + 1;
  -- 052 (D57): once rounds have been played the newcomer sits right after whoever is dealing now
  -- (the dealer's seat + 1); everyone from that seat up moves one seat. They deal the round after
  -- this one and get the first open card the round after that, so nobody at the table loses a turn.
  -- Before the first round they take the last seat as before.
  if public.live_round_count(p_game_id) > 0 then
    v_dealing := public.current_dealer(p_game_id);
    if v_dealing is not null then
      select gp.player_order into v_dealer_order from public.game_players gp where gp.game_id = p_game_id and gp.profile_id = v_dealing;
    end if;
    if v_dealer_order is not null then
      update public.game_players set player_order = player_order + 10000
       where game_id = p_game_id and player_order > v_dealer_order and player_order < 900;
      update public.game_players set player_order = player_order - 10000 + 1
       where game_id = p_game_id and player_order >= 10000;
      v_next := v_dealer_order + 1;
    end if;
  end if;
  insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated, label)
  values (p_game_id, p_profile_id, v_next, v_number, 'player', true, nullif(upper(btrim(coalesce(p_label, ''))), ''));
  if public.is_pool_game(p_game_id) then
    -- 041: joining a pool mid-game starts at the highest score still in (one entry), no zero rows.
    select coalesce(max(round_number), 0) into v_round from public.rounds where game_id = p_game_id and undone_at is null and round_number < 1000;
    if v_round > 0 then
      v_in := array_remove(public.pool_players_in(p_game_id), p_profile_id);
      select coalesce(max(public.pool_total(p_game_id, u.id)), 0) into v_high from unnest(v_in) u(id);
      -- 047: the game's late-entry rule — the highest score still in, or that + 1
      select public.pool_entry_plus(g.settings, 'lateEntryPlus') into v_plus from public.games g where g.id = p_game_id;
      v_high := v_high + coalesce(v_plus, 0);
      update public.game_players set reentered_round = v_round + 1, reentry_score = v_high where game_id = p_game_id and profile_id = p_profile_id;
    end if;
    return;
  end if;
  -- Joining mid-game: an explicit 0 in every round already played.
  insert into public.scores (round_id, game_id, profile_id, score_type, value)
  select r.id, p_game_id, p_profile_id, 'count', 0
    from public.rounds r where r.game_id = p_game_id and r.undone_at is null and r.round_number < 1000;
  get diagnostics v_zeros = row_count;
end;
$$;
revoke all on function public.add_seated_player(uuid, uuid, text) from public, anon;
grant execute on function public.add_seated_player(uuid, uuid, text) to authenticated;

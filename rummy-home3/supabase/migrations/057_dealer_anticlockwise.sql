-- 057 — The dealer moves anticlockwise, like the cards (Q63). Sree, Nov 27: "the dealer always moves
-- counterclockwise. It's always counterclockwise because whoever gets the open card gets to deal, and then when
-- he deals, he's also dealing counterclockwise." Replaces D58's "the deal moves up one seat" (052): after each
-- round the deal passes to the seat BEFORE the last dealer that is still in (seat 1 → seat N → N−1 …), the player
-- who got that round's first open card. The open card itself is unchanged (the seat before the dealer).
-- docs/dealer-anticlockwise.md has the before/after table and the reasoning for section D.
--
-- A. round_rule_dealer(rotation, round): the dealer of a round when no earlier dealer is known (round 1 → seat 1,
--    round 2 → the last seat, …); used where 031 had v_players[((round - 1) % n) + 1].
-- B. next_in_rotation: the seat before p_after; p_after out or gone → the next seat DOWN still in, wrapping to the
--    highest. current_dealer and set_round_dealer call it and are unchanged.
-- C. save_round (052 body) and set_seating_order (044 body): only their dealer lines change.
-- D. "The dealer's left" (D70 joins, D139 re-entries) stays the seat that deals last and leaves everyone else's turn
--    where it was. Under this rotation that is the seat AFTER the dealer (his own left hand at the table; one disc
--    clockwise on the circle), which gets its cards last; the seat before him now deals next.
--    add_seated_player (054 body): the newcomer takes the dealer's seat + 1, everyone after moves up one; before
--    round 1 the last seat, as before. reenter_player (056 body): the default is the seat after the dealer among the
--    seats still in; the Log's "(left of X)" names the seat still in before him. Both keep 054's pin (the dealer of
--    the round being played keeps it).
-- No signature changes: older builds keep calling the same functions. Played rounds keep their dealers.
-- Written, not applied to live; live gets it only on Sree's yes to this migration. Safe to run twice.
-- Rollback: supabase/rollback/rollback_057_dealer_anticlockwise.sql.

-- ---------- A. round_rule_dealer ----------
create or replace function public.round_rule_dealer(p_rotation uuid[], p_round integer)
returns uuid
language sql
immutable
set search_path = public, pg_temp
as $$
  select case when coalesce(array_length(p_rotation, 1), 0) = 0 then null
              else p_rotation[((array_length(p_rotation, 1) - ((greatest(p_round, 1) - 1) % array_length(p_rotation, 1))) % array_length(p_rotation, 1)) + 1] end;
$$;
revoke all on function public.round_rule_dealer(uuid[], integer) from public, anon, authenticated;

-- ---------- B. next_in_rotation ----------
-- Who deals after p_after: the seat before p_after in p_rotation (anticlockwise, the player who got the first
-- open card); when p_after is not in it (out, or left), the next seat down that is; below seat 1 wraps to the
-- highest. No p_after (no round yet) → seat 1. Null rotation → null.
create or replace function public.next_in_rotation(p_rotation uuid[], p_after uuid, p_game_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_pos integer;
  v_n integer;
  v_next uuid;
  v_after_order integer;
begin
  v_n := coalesce(array_length(p_rotation, 1), 0);
  if v_n = 0 then return null; end if;
  v_pos := array_position(p_rotation, p_after);
  if v_pos is not null then
    return p_rotation[((v_pos - 2 + v_n) % v_n) + 1];
  end if;
  if p_after is null then return p_rotation[1]; end if;
  select gp.player_order into v_after_order from public.game_players gp where gp.game_id = p_game_id and gp.profile_id = p_after;
  if v_after_order is null then return p_rotation[1]; end if;
  select gp.profile_id into v_next
    from public.game_players gp
   where gp.game_id = p_game_id and gp.profile_id = any(p_rotation) and gp.player_order < v_after_order
   order by gp.player_order desc limit 1;
  return coalesce(v_next, p_rotation[v_n]);
end;
$$;
revoke all on function public.next_in_rotation(uuid[], uuid, uuid) from public, anon, authenticated;

-- ---------- C. save_round: the 052 body, the dealer lines mirrored ----------
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
  -- 031: the deal follows the actual rotation. 057 (Q63): the dealer is the seat before the previous
  -- live round's dealer in the current seat order — anticlockwise, the player who got the first open
  -- card. A re-saved round keeps its dealer. The first round, or a previous dealer who has left the
  -- game, falls back to the round rule (round 1 seat 1, round 2 the last seat, …).
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
      if v_prev_pos is not null or (v_prev_dealer is not null and v_pool) then
        -- 041: a previous dealer who went out passes the deal to the next seat down still in.
        v_dealer := public.next_in_rotation(v_players, v_prev_dealer, p_game_id);
      else
        v_dealer := public.round_rule_dealer(v_players, p_round_number);
      end if;
    elsif array_position(v_players, v_dealer) is null then
      v_dealer := public.round_rule_dealer(v_players, p_round_number);
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
          update public.games
             set next_dealer_profile_id = public.next_in_rotation(v_players, v_planned, p_game_id),
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

-- ---------- C. set_seating_order: the 044 body, the dealer lines mirrored ----------
create or replace function public.set_seating_order(p_game_id uuid, p_profile_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  g public.games%rowtype;
  v_seats uuid[];
  v_from uuid[];
  v_n integer;
  v_rounds integer;
  v_last_dealer uuid;
  v_next uuid;
  v_pos integer;
  v_pool boolean;
  v_rotation uuid[];
  v_summary text;
  i integer;
begin
  if auth.uid() is null then raise exception 'Sign in required.' using errcode = '42501'; end if;
  if not (public.is_app_admin() or public.is_game_admin(p_game_id)
          or exists (select 1 from public.games x where x.id = p_game_id and x.created_by = auth.uid())) then
    raise exception 'Only a game admin can change the seating.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('game:' || p_game_id::text, 0));
  select * into g from public.games where id = p_game_id;
  if g.id is null or g.deleted_at is not null then raise exception 'This game is not available.'; end if;
  if g.status <> 'active' or g.closed_at is not null then
    raise exception 'The game is completed. Reopen it to change the seating.';
  end if;

  -- The seats: every seated, non-spectator player, in today's order.
  select array_agg(gp.profile_id order by gp.player_order) into v_from
    from public.game_players gp
   where gp.game_id = p_game_id and gp.role <> 'spectator' and coalesce(gp.seated, true);
  v_n := coalesce(array_length(v_from, 1), 0);
  if v_n = 0 then raise exception 'Every player needs a seat.'; end if;

  -- The list must be those players exactly once each (a viewer or a non-playing admin is not a seat).
  v_seats := p_profile_ids;
  if v_seats is null or coalesce(array_length(v_seats, 1), 0) <> v_n
     or (select count(distinct u) from unnest(v_seats) u) <> v_n
     or exists (select 1 from unnest(v_seats) u where u is null or not (u = any(v_from))) then
    raise exception 'Every player needs a seat.';
  end if;

  if v_seats = v_from then
    return jsonb_build_object('changed', false, 'order', to_jsonb(v_from));
  end if;

  -- One transaction: park the seats clear of the unique key, then number them 0..N-1 from the list.
  update public.game_players set player_order = player_order + 10000
   where game_id = p_game_id and profile_id = any(v_from);
  for i in 1..v_n loop
    update public.game_players set player_order = i - 1
     where game_id = p_game_id and profile_id = v_seats[i];
  end loop;

  -- Who deals next, under the rule the app and save_round already use: 057, the seat before the last live
  -- round's dealer in the new order (a pool skips players who are out); no rounds → seat 1.
  v_rounds := public.live_round_count(p_game_id);
  v_pool := g.game_type = 'pool';
  select array_agg(gp.profile_id order by gp.player_order) into v_rotation
    from public.game_players gp
   where gp.game_id = p_game_id and gp.profile_id = any(v_seats) and (not v_pool or gp.out_round is null);
  if v_rotation is null then v_rotation := v_seats; end if;
  select r.dealer_profile_id into v_last_dealer
    from public.rounds r
   where r.game_id = p_game_id and r.undone_at is null and r.round_number < 1000 and r.dealer_profile_id is not null
   order by r.round_number desc limit 1;
  v_pos := array_position(v_rotation, v_last_dealer);
  if v_pos is not null or (v_last_dealer is not null and v_pool) then
    v_next := public.next_in_rotation(v_rotation, v_last_dealer, p_game_id);
  else
    v_next := public.round_rule_dealer(v_rotation, v_rounds + 1);
  end if;

  select string_agg(format('%s %s', ord, coalesce(nullif(ps->>'ini', ''), (public.initials_candidates(ps->>'name'))[1])), ' · ' order by ord)
    into v_summary
    from unnest(v_seats) with ordinality as s(id, ord)
    cross join lateral public.player_snapshot(p_game_id, s.id) ps;

  perform public.log_event(p_game_id, null, 'seating_changed',
    (case when v_rounds > 0 then 'important' else 'routine' end)::public.event_level,
    'Seating changed · ' || coalesce(v_summary, ''),
    jsonb_build_object('from', to_jsonb(v_from), 'to', to_jsonb(v_seats), 'rounds', v_rounds, 'nextDealer', v_next));

  return jsonb_build_object('changed', true, 'order', to_jsonb(v_seats), 'rounds', v_rounds, 'nextDealer', v_next);
end;
$$;
revoke all on function public.set_seating_order(uuid, uuid[]) from public, anon;
grant execute on function public.set_seating_order(uuid, uuid[]) to authenticated;

-- ---------- D. add_seated_player: the 054 body, the seat after the dealer ----------
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
  v_live integer;
  v_last uuid;
  v_rot uuid[];
  v_planned uuid;
  v_planned_after uuid;
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
  -- 054 (D70) / 057: once rounds have been played the newcomer sits on the left of whoever is dealing now —
  -- the seat after the dealer, which deals last and gets its cards last.
  v_live := public.live_round_count(p_game_id);
  if v_live > 0 then
    v_dealing := public.current_dealer(p_game_id);
    if v_dealing is not null then
      select gp.player_order into v_dealer_order from public.game_players gp where gp.game_id = p_game_id and gp.profile_id = v_dealing;
      select r.dealer_profile_id into v_last
        from public.rounds r
       where r.game_id = p_game_id and r.undone_at is null and r.round_number < 1000 and r.dealer_profile_id is not null
       order by r.round_number desc limit 1;
      v_rot := public.dealer_rotation(p_game_id, v_live + 1);
      v_planned := case when v_last is null then v_rot[1] else public.next_in_rotation(v_rot, v_last, p_game_id) end;
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
  if v_dealing is not null then
    v_rot := public.dealer_rotation(p_game_id, v_live + 1);
    v_planned_after := case when v_last is null then v_rot[1] else public.next_in_rotation(v_rot, v_last, p_game_id) end;
    if v_planned_after is distinct from v_planned then
      update public.games
         set next_dealer_profile_id = v_dealing, next_dealer_round = v_live + 1, next_dealer_keeps_sequence = false
       where id = p_game_id;
    end if;
  end if;
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

-- ---------- D. reenter_player: the 056 body, the seat after the dealer ----------
create or replace function public.reenter_player(p_game_id uuid, p_profile_id uuid, p_seat integer default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  g public.games%rowtype;
  gp public.game_players%rowtype;
  v_next integer;
  v_high integer;
  v_in uuid[];
  v_limit integer;
  v_plus integer;
  v_live integer;
  v_dealing uuid;
  v_last uuid;
  v_rot uuid[];
  v_planned uuid;
  v_planned_after uuid;
  v_seats uuid[];
  v_rest uuid[];
  v_order uuid[];
  v_slots integer[];
  v_n integer;
  v_from integer;
  v_to integer;
  v_pos integer;
  v_i integer;
  v_left_of uuid;
  v_name text;
  v_seat_text text := '';
begin
  if auth.uid() is null then raise exception 'Sign in required.' using errcode = '42501'; end if;
  if not (public.is_app_admin() or public.is_game_admin(p_game_id)) then
    raise exception 'Only a game admin can re-enter a player.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('game:' || p_game_id::text, 0));
  select * into g from public.games where id = p_game_id;
  if g.id is null then raise exception 'This game is not available.'; end if;
  if g.game_type <> 'pool' then raise exception 'Re-entry is for pool games.'; end if;
  if g.status <> 'active' or g.closed_at is not null or g.deleted_at is not null then
    raise exception 'The pool is completed. Reopen it to re-enter a player.';
  end if;
  v_limit := public.pool_reentry_limit(g.settings);
  if v_limit = 0 then
    raise exception 'Re-entries are off for this pool. Allow them in Game settings first.';
  end if;
  select * into gp from public.game_players where game_id = p_game_id and profile_id = p_profile_id;
  if gp.id is null then raise exception 'They are not in this game.'; end if;
  if gp.out_round is null then raise exception 'They are still in the pool.'; end if;
  -- entries counts the first entry too, so re-entries used = entries - 1
  if v_limit is not null and gp.entries - 1 >= v_limit then
    if v_limit = 1 then
      raise exception 'They have already re-entered once.';
    else
      raise exception 'They have used all % re-entries.', v_limit;
    end if;
  end if;
  v_in := public.pool_players_in(p_game_id);
  if coalesce(array_length(v_in, 1), 0) = 0 then raise exception 'Nobody is still in the pool.'; end if;
  select max(public.pool_total(p_game_id, u.id)) into v_high from unnest(v_in) u(id);
  -- 047: the game's re-entry rule — the highest score still in, or that + 1
  v_plus := public.pool_entry_plus(g.settings, 'reentryPlus');
  v_high := v_high + v_plus;
  select coalesce(max(round_number), 0) + 1 into v_next from public.rounds where game_id = p_game_id and undone_at is null and round_number < 1000;

  -- 056: the seats and the deal before anything changes (he is out, so not in the rotation).
  select array_agg(x.profile_id order by x.player_order) into v_seats
    from public.game_players x
   where x.game_id = p_game_id and x.role <> 'spectator' and coalesce(x.seated, true) and x.player_order < 900;
  v_n := coalesce(array_length(v_seats, 1), 0);
  v_from := array_position(v_seats, p_profile_id);
  if p_seat is not null and (p_seat < 1 or p_seat > v_n) then
    raise exception 'Seat must be 1 to %.', v_n;
  end if;
  v_live := public.live_round_count(p_game_id);
  v_dealing := public.current_dealer(p_game_id);
  select r.dealer_profile_id into v_last
    from public.rounds r
   where r.game_id = p_game_id and r.undone_at is null and r.round_number < 1000 and r.dealer_profile_id is not null
   order by r.round_number desc limit 1;
  v_rot := public.dealer_rotation(p_game_id, v_live + 1);
  v_planned := case when v_last is null then v_rot[1] else public.next_in_rotation(v_rot, v_last, p_game_id) end;

  v_to := v_from;
  if v_from is not null and p_seat is not null then
    v_to := p_seat;
  elsif v_from is not null and v_dealing is not null then
    -- 057: walk up from the dealer to the first seat that is still in, or his: his means he is already on the
    -- dealer's left (only out seats between them).
    v_i := array_position(v_seats, v_dealing);
    loop
      v_i := case when v_i = v_n then 1 else v_i + 1 end;
      exit when v_seats[v_i] = p_profile_id or v_seats[v_i] = any(v_rot);
    end loop;
    if v_seats[v_i] <> p_profile_id then
      v_rest := array_remove(v_seats, p_profile_id);
      v_to := array_position(v_rest, v_dealing) + 1;
    end if;
  end if;

  if v_to is distinct from v_from then
    v_rest := array_remove(v_seats, p_profile_id);
    v_order := v_rest[1:v_to - 1] || p_profile_id || v_rest[v_to:];
    -- The seats take back their own order numbers (a viewer or a non-playing admin can hold one below 900).
    select array_agg(x.player_order order by x.player_order) into v_slots
      from public.game_players x where x.game_id = p_game_id and x.profile_id = any(v_seats);
    update public.game_players set player_order = player_order + 10000
     where game_id = p_game_id and profile_id = any(v_seats);
    for v_i in 1..v_n loop
      update public.game_players set player_order = v_slots[v_i]
       where game_id = p_game_id and profile_id = v_order[v_i];
    end loop;
  else
    v_order := v_seats;
  end if;

  update public.game_players
     set reentered_round = v_next, reentry_score = v_high, entries = entries + 1, out_round = null
   where id = gp.id;
  perform public.pool_recompute(p_game_id);

  -- The dealer of the round being played keeps it (054's pin).
  if v_dealing is not null then
    v_rot := public.dealer_rotation(p_game_id, v_live + 1);
    v_planned_after := case when v_last is null then v_rot[1] else public.next_in_rotation(v_rot, v_last, p_game_id) end;
    if v_planned_after is distinct from v_planned then
      update public.games
         set next_dealer_profile_id = v_dealing, next_dealer_round = v_live + 1, next_dealer_keeps_sequence = false
       where id = p_game_id;
    end if;
  end if;

  v_name := public.player_snapshot(p_game_id, p_profile_id)->>'name';
  if v_from is not null then
    if v_to <> v_from then
      -- 057: "left of" names the seat still in just before his, the person whose left he now sits on.
      v_rot := public.dealer_rotation(p_game_id, v_live + 1);
      v_pos := array_position(v_rot, p_profile_id);
      if coalesce(array_length(v_rot, 1), 0) > 1 then
        v_left_of := v_rot[((v_pos - 2 + array_length(v_rot, 1)) % array_length(v_rot, 1)) + 1];
      end if;
      v_seat_text := format(' · Seat %s → %s', v_from, v_to)
        || case when v_left_of is null then '' else format(' (left of %s)', public.player_snapshot(p_game_id, v_left_of)->>'name') end;
    else
      v_seat_text := format(' · Seat %s', v_from);
    end if;
  end if;

  perform public.log_event(p_game_id, null, 'player_reentered', 'important',
    format('%s re-entered at %s · Before round %s · Entry %s', v_name, v_high, v_next, gp.entries + 1) || v_seat_text,
    jsonb_build_object('profileId', p_profile_id, 'score', v_high, 'round', v_next, 'entries', gp.entries + 1,
                       'seatFrom', v_from, 'seat', v_to,
                       'names', jsonb_build_array(v_name)));
  return jsonb_build_object('profileId', p_profile_id, 'score', v_high, 'round', v_next, 'entries', gp.entries + 1,
                            'seatFrom', v_from, 'seat', v_to);
end;
$$;
revoke all on function public.reenter_player(uuid, uuid, integer) from public, anon;
grant execute on function public.reenter_player(uuid, uuid, integer) to authenticated;

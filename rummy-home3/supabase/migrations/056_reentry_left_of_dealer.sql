-- 056 — A player who re-enters a pool sits to the dealer's left, unless the admin picks a seat (D139).
-- Sree (Nov 21): "they have to always sit to the left side of the person that is dealing. Even if someone
-- re-enters … warn and say … his seat is going to be so-and-so number … in between these two people … the
-- admin can move the players around … implement this as a default"; (Q59, Nov 27): "yes, build re-entry
-- as drawn" (design-review-2 §10.6). Extends D70 (054, joins) to re-entries. 055 is #153's.
--
-- reenter_player gains p_seat (1 … N, the seat he ends up in; null = the default). Checks, score, round
-- and entries are 047's, unchanged.
--   * Default: the seat before whoever deals the round being played (current_dealer), worked out with him
--     out of his old seat, exactly as 054 seats a newcomer. Dealer at the lowest seat: the last seat.
--   * Already on the dealer's left (only out seats, or none, between him and the dealer): he stays.
--   * The dealer of the round being played keeps it: when the move puts him straight after the last
--     round's dealer, that round is pinned to the dealer (052 override, follow), as 054 does.
--   * The seats behind him move down one or up one; seat numbers stay 1 … N with no gaps. The rows are
--     parked clear of the unique key first and take back their own order numbers (044 / 054's two steps).
--   * The Log line gains "Seat 5 → 3 (left of Priya)"; payload and return value gain seatFrom / seat.
-- Older builds call it with two arguments and get the default seat.
-- Written, not applied to live; live gets it only on Sree's yes to this migration. Safe to run twice.
-- Rollback: supabase/rollback/rollback_056_reentry_left_of_dealer.sql (047's two-argument body).

drop function if exists public.reenter_player(uuid, uuid);

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
  v_right uuid;
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
    -- Walk back from the dealer to the first seat that is still in, or his: his means he is already on the dealer's left.
    v_i := array_position(v_seats, v_dealing);
    loop
      v_i := case when v_i = 1 then v_n else v_i - 1 end;
      exit when v_seats[v_i] = p_profile_id or v_seats[v_i] = any(v_rot);
    end loop;
    if v_seats[v_i] <> p_profile_id then
      v_rest := array_remove(v_seats, p_profile_id);
      v_pos := array_position(v_rest, v_dealing);
      -- The dealer at the lowest seat: the last seat is already their left.
      v_to := case when v_pos > 1 then v_pos else v_n end;
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
      -- "left of" names the next seat still in, the person he now sits beside.
      v_rot := public.dealer_rotation(p_game_id, v_live + 1);
      v_pos := array_position(v_rot, p_profile_id);
      if coalesce(array_length(v_rot, 1), 0) > 1 then
        v_right := v_rot[(v_pos % array_length(v_rot, 1)) + 1];
      end if;
      v_seat_text := format(' · Seat %s → %s', v_from, v_to)
        || case when v_right is null then '' else format(' (left of %s)', public.player_snapshot(p_game_id, v_right)->>'name') end;
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

-- 054 — A player who joins mid-game sits to the dealer's left: the seat that deals last (D70).
-- Sree (Q13, Nov 23): "New players always sit on the left side of the dealer. It could be a setting in
-- the future, but for now, it's always left as a default." Dealing goes counterclockwise and the deal
-- moves up one seat, so the dealer's left is the seat BEFORE the dealer in seat order. Replaces D57
-- (052: dealer's seat + 1, the newcomer dealt the next round).
--
-- add_seated_player: the 052 body; only the seat changes.
--   * Before round 1 (nobody is dealing): the last seat, as before.
--   * The dealer of the round being played (current_dealer) keeps dealing it. The newcomer takes the
--     dealer's seat and the dealer and everyone after move up one; when the dealer is seat 1 the
--     newcomer takes the last seat instead (the same place in the circle, and nobody's number moves).
--   * The deal is "the seat after the last round's dealer", so a newcomer seated straight after that
--     dealer would take this round's deal. Then the round being played is pinned to its dealer with the
--     Dealer-sheet override (052, follow), which save_round uses once. Nobody else's turn moves.
-- Re-entry (reenter_player) is untouched: a player who re-enters keeps their seat.
-- Re-runnable. Rollback: supabase/rollback/rollback_054_join_left_of_dealer.sql (the 052 body).

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
  -- 054 (D70): once rounds have been played the newcomer sits just before whoever is dealing now.
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
    -- The dealer at seat 1: the last seat is already their left.
    if v_dealer_order is not null and exists (
      select 1 from public.game_players gp
       where gp.game_id = p_game_id and gp.role <> 'spectator' and coalesce(gp.seated, true)
         and gp.player_order < v_dealer_order
    ) then
      update public.game_players set player_order = player_order + 10000
       where game_id = p_game_id and player_order >= v_dealer_order and player_order < 900;
      update public.game_players set player_order = player_order - 10000 + 1
       where game_id = p_game_id and player_order >= 10000;
      v_next := v_dealer_order;
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

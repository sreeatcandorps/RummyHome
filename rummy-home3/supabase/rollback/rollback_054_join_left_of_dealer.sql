-- Rollback 054: add_seated_player goes back to the 052 body (D57: a newcomer sits at the dealer's seat + 1).
-- Seats already given by 054 stay where they are; a pinned dealer for the round being played is used once, as before.

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

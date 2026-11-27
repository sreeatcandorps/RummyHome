-- Rollback 056: reenter_player goes back to 047's two-argument body (a re-entry keeps its seat).
-- Seats already given by 056 stay where they are; a pinned dealer for the round being played is used once, as before.
-- Older builds keep working (they send two arguments). This build sends p_seat only for a seat the admin picked, and
-- without 056 it repeats the call with two arguments (the seat stays where it was).

drop function if exists public.reenter_player(uuid, uuid, integer);

-- 047 body
create or replace function public.reenter_player(p_game_id uuid, p_profile_id uuid)
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

  update public.game_players
     set reentered_round = v_next, reentry_score = v_high, entries = entries + 1, out_round = null
   where id = gp.id;
  perform public.pool_recompute(p_game_id);

  perform public.log_event(p_game_id, null, 'player_reentered', 'important',
    format('%s re-entered at %s · Before round %s · Entry %s', public.player_snapshot(p_game_id, p_profile_id)->>'name', v_high, v_next, gp.entries + 1),
    jsonb_build_object('profileId', p_profile_id, 'score', v_high, 'round', v_next, 'entries', gp.entries + 1,
                       'names', jsonb_build_array(public.player_snapshot(p_game_id, p_profile_id)->>'name')));
  return jsonb_build_object('profileId', p_profile_id, 'score', v_high, 'round', v_next, 'entries', gp.entries + 1);
end;
$$;
revoke all on function public.reenter_player(uuid, uuid) from public, anon;
grant execute on function public.reenter_player(uuid, uuid) to authenticated;

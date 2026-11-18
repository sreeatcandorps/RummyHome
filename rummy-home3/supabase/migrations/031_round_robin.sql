-- 031: round-robin rotation (final launch batch, item 6)
--
-- The deal follows the actual rotation: save_round picks the seat after the previous live
-- round's dealer in the current seat order, so a player added mid-game makes the next
-- rotation one round longer (9 rounds, then 10). get_game_bundle and public_scorecard
-- return who dealt each live round ('dealers': round number -> profile id) so the scorecard
-- and the web /r/ page draw a divider above each round where the first dealer deals again.
-- public_scorecard also carries maxCount for the score colour rule.
--
-- Backward compatible: same signatures and return types; older apps ignore the new keys.
-- Re-runnable. Rollback: supabase/rollback/rollback_031_round_robin.sql.

-- A. save_round: 019 body with the rotation rule for the dealer.
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
  v_prev_dealer uuid;
  v_prev_pos integer;
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
      else
        v_dealer := v_players[((p_round_number - 1) % array_length(v_players, 1)) + 1];
      end if;
    elsif array_position(v_players, v_dealer) is null then
      v_dealer := v_players[((p_round_number - 1) % array_length(v_players, 1)) + 1];
    end if;
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

-- B. get_game_bundle: 028 body plus 'dealers'.
create or replace function public.get_game_bundle(p_game_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set jit = off
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games;
  v_admin boolean;
  v_member boolean;
  v_seats jsonb := '[]'::jsonb;
  v_scores jsonb := '[]'::jsonb;
  v_dealers jsonb := '{}'::jsonb;
begin
  if v_uid is null then return null; end if;
  select * into v_game from public.games g where g.id = p_game_id;
  if v_game.id is null then return null; end if;

  v_admin := public.is_app_admin();
  v_member := v_game.created_by = v_uid
    or exists (select 1 from public.game_players gp where gp.game_id = p_game_id and gp.profile_id = v_uid and gp.is_active);
  if not (v_admin or v_member or v_game.spectator_access) then return null; end if;

  if v_game.deleted_at is not null then
    return jsonb_build_object(
      'deleted', true,
      'game', jsonb_build_object('id', v_game.id, 'game_number', v_game.game_number, 'game_label', public.game_label_text(v_game.game_label, v_game.game_number), 'deleted_at', v_game.deleted_at,
                                 'can_restore', v_game.deleted_by = v_uid or public.can_manage_game(p_game_id))
    );
  end if;

  if v_admin or v_member then
    select coalesce(s.seats, '[]'::jsonb) into v_seats
    from public.seat_rows_json(array[p_game_id], case when v_member then array[p_game_id] else '{}'::uuid[] end, true) s;
    v_seats := coalesce(v_seats, '[]'::jsonb);

    select coalesce(jsonb_agg(jsonb_build_object(
             'profile_id', s.profile_id,
             'score_type', s.score_type,
             'value', s.value,
             'round_number', r.round_number
           ) order by r.round_number, s.created_at), '[]'::jsonb)
      into v_scores
    from public.scores s
    join public.rounds r on r.id = s.round_id
    where s.game_id = p_game_id
      and r.undone_at is null;
  end if;

  -- 031: who dealt each live round, so the scorecard draws a divider each time the first dealer deals again.
  if v_admin or v_member then
    select coalesce(jsonb_object_agg(r.round_number::text, r.dealer_profile_id), '{}'::jsonb)
      into v_dealers
      from public.rounds r
     where r.game_id = p_game_id and r.undone_at is null;
  end if;

  return jsonb_build_object(
    'game', to_jsonb(v_game),
    'game_players', v_seats,
    'scores', v_scores,
    'dealers', v_dealers
  );
end;
$$;

-- C. public_scorecard: 028 body plus 'dealers' and 'maxCount'.
create or replace function public.public_scorecard(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then
    return null;
  end if;

  select * into g from public.games where view_token = p_token;
  if not found then
    return null;
  end if;
  if g.deleted_at is not null then
    return jsonb_build_object('gameId', g.share_code, 'deleted', true);
  end if;

  return jsonb_build_object(
    'gameId', g.share_code,
    'gameLabel', public.game_label_text(g.game_label, g.game_number),
    'startedAt', g.created_at,
    'gameType', g.game_type,
    'status', g.status,
    'currentRound', g.current_round,
    'maxCount', (g.settings->>'maxCount')::integer,
    'dealers', (
      select coalesce(jsonb_object_agg(r.round_number::text, r.dealer_profile_id), '{}'::jsonb)
      from public.rounds r
      where r.game_id = g.id and r.undone_at is null
    ),
    'players', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', pr.display_name,
        'order', gp.player_order
      ) order by gp.player_order), '[]'::jsonb)
      from public.game_players gp
      join public.profiles pr on pr.id = gp.profile_id
      where gp.game_id = g.id
        and gp.is_active
        and gp.role <> 'spectator'
    ),
    'scores', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'profileId', s.profile_id,
        'name', pr.display_name,
        'round', r.round_number,
        'type', s.score_type,
        'value', s.value
      ) order by r.round_number, gp.player_order), '[]'::jsonb)
      from public.scores s
      join public.rounds r on r.id = s.round_id
      left join public.game_players gp on gp.game_id = s.game_id and gp.profile_id = s.profile_id
      left join public.profiles pr on pr.id = s.profile_id
      where s.game_id = g.id
        and r.undone_at is null
    )
  );
end;
$$;

-- Grants are kept by create or replace; restated so the file stands alone.
revoke all on function public.save_round(uuid, integer, jsonb, boolean) from public, anon;
grant execute on function public.save_round(uuid, integer, jsonb, boolean) to authenticated;
revoke all on function public.get_game_bundle(uuid) from public, anon;
grant execute on function public.get_game_bundle(uuid) to authenticated;
revoke all on function public.public_scorecard(text) from public;
grant execute on function public.public_scorecard(text) to anon, authenticated;

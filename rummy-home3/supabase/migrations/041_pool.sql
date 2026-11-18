-- 041 (PR 13): Pool games — docs/pool-design.md is the contract (Sree's Nov 14 decisions).
--
-- A pool is rummy scored upside down: the round's winner(s) score 0, everyone else ADDS their
-- hand; reach the pool limit and you are out; with Re-entry on a player who is out may come back
-- once at the highest score still in. The pool scores are not what the game is worth: once the
-- pool is Completed the admin gives awards (points per player, usually adding up to 0) and those
-- awards are what the pool contributes to Results.
--
-- A. columns: games.awarded_at / awarded_by / award_note (awards themselves reuse prize_shares,
--    never shown with that word); game_players.out_round / reentered_round / reentry_score /
--    entries. games.settings carries poolLimit and reentry for a pool.
-- B. helpers: pool_total(game, player), pool_recompute(game) (out_round is derived from the
--    running totals), scores_pool_sign trigger (a pool score is >= 0, rummy = 0), and
--    games_pool_settings_lock (limit and the three values are fixed once a live round exists).
-- C. save_round pool branch: every value >= 0, rummy rows 0, at least one 0, every player still
--    in is scored, refused with <= 1 player in; the dealer rotation skips players who are out;
--    newly out players are logged.
-- D. undo_last_round pool branch: a re-entry made after the last round is undone first (its own
--    step); otherwise the round, then out_round is recomputed.
-- E. reenter_player, set_pool_awards (no sum check — D9), add_seated_player pool branch (a late
--    joiner starts at the highest score still in).
-- F. declare_game_result: a pool needs awards ("Give awards first"); a pool contributes its awards;
--    places.games[].kind = 'points' | 'pool' (public_result passes it on). seat_rows_json and
--    public_scorecard carry the pool seat fields.
-- G. event_log kinds: player_out, player_reentered, reentry_undone, awards_set, awards_changed.
--
-- Re-runnable. Rollback: supabase/rollback/rollback_041_pool.sql.

-- ---------- A. columns ----------
alter table public.games add column if not exists awarded_at timestamptz;
alter table public.games add column if not exists awarded_by uuid references public.profiles(id) on delete set null;
alter table public.games add column if not exists award_note jsonb;
comment on column public.games.awarded_at is 'Pool only (041): when awards were last saved. Null = awards pending; such a pool cannot join a result.';
comment on column public.games.award_note is 'Pool only (041): {preset, entry, poolTotal, givenOut} for the awards in prize_shares.';

alter table public.game_players add column if not exists out_round integer;
alter table public.game_players add column if not exists reentered_round integer;
alter table public.game_players add column if not exists reentry_score integer;
alter table public.game_players add column if not exists entries integer not null default 1;
comment on column public.game_players.out_round is 'Pool only (041): the live round whose save put this player at or over the limit; null = still in. Derived by pool_recompute.';
comment on column public.game_players.reentered_round is 'Pool only (041): the round the player came back for (re-entry or late join); their total restarts at reentry_score from that round.';

-- ---------- B. helpers ----------
create or replace function public.is_pool_game(p_game_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.games g where g.id = p_game_id and g.game_type = 'pool');
$$;
revoke all on function public.is_pool_game(uuid) from public, anon;
grant execute on function public.is_pool_game(uuid) to authenticated;

create or replace function public.pool_limit_of(p_game_id uuid)
returns integer
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce((g.settings->>'poolLimit')::integer, 101) from public.games g where g.id = p_game_id;
$$;
revoke all on function public.pool_limit_of(uuid) from public, anon;
grant execute on function public.pool_limit_of(uuid) to authenticated;

-- A player's pool score: scores from their (re-)entry round on, starting at the re-entry score.
create or replace function public.pool_total(p_game_id uuid, p_profile_id uuid)
returns integer
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce((select gp.reentry_score from public.game_players gp where gp.game_id = p_game_id and gp.profile_id = p_profile_id and gp.reentered_round is not null), 0)
       + coalesce((
           select sum(s.value)::integer
             from public.scores s
             join public.rounds r on r.id = s.round_id
             left join public.game_players gp on gp.game_id = s.game_id and gp.profile_id = s.profile_id
            where s.game_id = p_game_id and s.profile_id = p_profile_id and r.undone_at is null and s.score_type <> 'expense'
              and (gp.reentered_round is null or r.round_number >= gp.reentered_round)
         ), 0);
$$;
revoke all on function public.pool_total(uuid, uuid) from public, anon;
grant execute on function public.pool_total(uuid, uuid) to authenticated;

-- out_round is derived: the first live round (from the re-entry round on) whose running total
-- reaches the limit. Called after every save, undo, re-entry and late join.
create or replace function public.pool_recompute(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer := public.pool_limit_of(p_game_id);
begin
  if not public.is_pool_game(p_game_id) then return; end if;
  with live as (
    select s.profile_id, r.round_number, sum(s.value)::integer as v
      from public.scores s join public.rounds r on r.id = s.round_id
     where s.game_id = p_game_id and r.undone_at is null and s.score_type <> 'expense' and s.profile_id is not null
     group by s.profile_id, r.round_number
  ), run as (
    select gp.profile_id, l.round_number,
           coalesce(gp.reentry_score, 0) + sum(l.v) over (partition by gp.profile_id order by l.round_number) as total
      from public.game_players gp
      join live l on l.profile_id = gp.profile_id
     where gp.game_id = p_game_id and (gp.reentered_round is null or l.round_number >= gp.reentered_round)
  ), first_out as (
    select profile_id, min(round_number) as rn from run where total >= v_limit group by profile_id
  )
  update public.game_players gp
     set out_round = fo.rn
    from (select gp2.profile_id, (select rn from first_out f where f.profile_id = gp2.profile_id) as rn
            from public.game_players gp2 where gp2.game_id = p_game_id) fo
   where gp.game_id = p_game_id and gp.profile_id = fo.profile_id and gp.out_round is distinct from fo.rn;
end;
$$;
-- Callable by signed-in users because undo_last_round (035, security invoker) runs it; it only
-- re-derives out_round from rows that already exist.
revoke all on function public.pool_recompute(uuid) from public, anon;
grant execute on function public.pool_recompute(uuid) to authenticated;

-- Players still in (seated, not out), in seat order.
create or replace function public.pool_players_in(p_game_id uuid)
returns uuid[]
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(gp.profile_id order by gp.player_order), '{}'::uuid[])
    from public.game_players gp
   where gp.game_id = p_game_id and gp.role <> 'spectator' and coalesce(gp.seated, true) and gp.out_round is null;
$$;
revoke all on function public.pool_players_in(uuid) from public, anon;
grant execute on function public.pool_players_in(uuid) to authenticated;

-- The sign rule per game type, as a trigger: a check constraint cannot look at the game. Points
-- keeps the 037 rule (drop / middle drop / count / expense <= 0, rummy any sign); a pool is the
-- other way up (every value >= 0, the winner's rummy row is 0). The 037 constraint is dropped.
alter table public.scores drop constraint if exists scores_check;
create or replace function public.scores_pool_sign()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_pool_game(new.game_id) then
    if new.value < 0 then
      raise exception 'Pool scores are plus points: % is not allowed.', new.value using errcode = '23514';
    end if;
    if new.score_type = 'rummy' and new.value <> 0 then
      raise exception 'In a pool the round winner scores 0.' using errcode = '23514';
    end if;
  elsif new.score_type <> 'rummy' and new.value > 0 then
    raise exception 'A % score is 0 or less (037 rule).', new.score_type using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.scores_pool_sign() from public, anon, authenticated;
drop trigger if exists scores_pool_sign on public.scores;
create trigger scores_pool_sign before insert or update on public.scores
  for each row execute function public.scores_pool_sign();

-- A pool's limit and its three values are fixed once a live round exists (changing them would
-- change who is out). Re-entry may still be switched.
create or replace function public.games_pool_settings_lock()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.game_type = 'pool' and new.settings is distinct from old.settings
     and exists (select 1 from public.rounds r where r.game_id = new.id and r.undone_at is null)
     and (
       (new.settings->>'poolLimit') is distinct from (old.settings->>'poolLimit')
       or (new.settings->>'dropAmount') is distinct from (old.settings->>'dropAmount')
       or (new.settings->>'mdAmount') is distinct from (old.settings->>'mdAmount')
       or (new.settings->>'maxCount') is distinct from (old.settings->>'maxCount')
     ) then
    raise exception 'Rounds have been saved. The pool limit, Drop, Middle drop and Full count are locked — changing them would change who is out. Undo every round to edit them.'
      using errcode = 'PT423';
  end if;
  return new;
end;
$$;
revoke all on function public.games_pool_settings_lock() from public, anon, authenticated;
drop trigger if exists games_pool_settings_lock on public.games;
create trigger games_pool_settings_lock before update of settings on public.games
  for each row execute function public.games_pool_settings_lock();

-- ---------- G. log kinds (before the functions that use them) ----------
alter table public.event_log drop constraint if exists event_log_kind;
alter table public.event_log add constraint event_log_kind check (kind in (
  'game_created', 'player_added', 'player_removed', 'viewer_added', 'viewer_removed',
  'admin_added', 'admin_removed', 'round_added', 'round_edited', 'round_undone',
  'settings_changed', 'initials_changed', 'player_renamed', 'completed', 'reopened',
  'closed', 'unclosed', 'deleted', 'restored',
  'result_saved', 'result_deleted', 'result_restored', 'result_changed',
  'player_out', 'player_reentered', 'reentry_undone', 'awards_set', 'awards_changed'));

-- ---------- C. save_round: 036 body + pool branch ----------
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

-- ---------- D. undo_last_round: 035 body + pool branch ----------
-- A re-entry made after the last saved round is its own undo step. undo_last_round is security
-- invoker (035), so the write and the log row live in this definer helper, which checks the admin.
create or replace function public.pool_undo_reentry(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_last integer;
  v_re public.game_players;
begin
  if auth.uid() is null then raise exception 'Sign in to undo a round.' using errcode = '42501'; end if;
  if not (public.is_app_admin() or public.is_game_admin(p_game_id)) then
    raise exception 'Only a game admin can undo a round.' using errcode = '42501';
  end if;
  if not public.is_pool_game(p_game_id) then return null; end if;
  select coalesce(max(round_number), 0) into v_last from public.rounds where game_id = p_game_id and undone_at is null and round_number < 1000;
  select * into v_re from public.game_players gp
   where gp.game_id = p_game_id and gp.reentered_round = v_last + 1 and gp.entries > 1
   order by gp.player_order limit 1;
  if v_re.id is null then return null; end if;
  update public.game_players
     set reentered_round = null, reentry_score = null, entries = greatest(1, entries - 1)
   where id = v_re.id;
  perform public.pool_recompute(p_game_id);
  perform public.log_event(p_game_id, null, 'reentry_undone', 'important',
    format('Re-entry undone · %s is out again · Round %s', public.player_snapshot(p_game_id, v_re.profile_id)->>'name', v_last + 1),
    jsonb_build_object('profileId', v_re.profile_id, 'round', v_last + 1, 'names', jsonb_build_array(public.player_snapshot(p_game_id, v_re.profile_id)->>'name')));
  return jsonb_build_object('reentryUndone', v_re.profile_id, 'roundNumber', v_last + 1);
end;
$$;
revoke all on function public.pool_undo_reentry(uuid) from public, anon;
grant execute on function public.pool_undo_reentry(uuid) to authenticated;

create or replace function public.undo_last_round(p_game_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_round public.rounds;
  v_re jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to undo a round.' using errcode = '42501';
  end if;
  if not (public.is_app_admin() or public.is_game_admin(p_game_id)) then
    raise exception 'Only a game admin can undo a round.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('game:' || p_game_id::text, 0));

  -- 041: a re-entry made after the last saved round is undone first, as its own step.
  v_re := public.pool_undo_reentry(p_game_id);
  if v_re is not null then return v_re; end if;

  select * into v_round
    from public.rounds
   where game_id = p_game_id and undone_at is null
   order by round_number desc
   limit 1
   for update;
  if v_round.id is null then
    return null;
  end if;

  update public.rounds
     set undone_at = now(), undone_by = auth.uid(), undo_reason = 'admin undo'
   where id = v_round.id;

  -- The undone number is the next one to play again.
  update public.games
     set current_round = v_round.round_number
   where id = p_game_id and coalesce(current_round, 1) > v_round.round_number;

  -- 041: a player this round put out is back in.
  perform public.pool_recompute(p_game_id);

  return jsonb_build_object('roundId', v_round.id, 'roundNumber', v_round.round_number);
end;
$$;
revoke all on function public.undo_last_round(uuid) from public, anon;
grant execute on function public.undo_last_round(uuid) to authenticated;

-- ---------- E. reenter_player / set_pool_awards / add_seated_player ----------
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
  if not coalesce((g.settings->>'reentry')::boolean, true) then
    raise exception 'Re-entry is off for this pool. Turn it on in Game settings first.';
  end if;
  select * into gp from public.game_players where game_id = p_game_id and profile_id = p_profile_id;
  if gp.id is null then raise exception 'They are not in this game.'; end if;
  if gp.out_round is null then raise exception 'They are still in the pool.'; end if;
  if gp.reentered_round is not null and gp.entries > 1 then raise exception 'They have already re-entered once.'; end if;
  v_in := public.pool_players_in(p_game_id);
  if coalesce(array_length(v_in, 1), 0) = 0 then raise exception 'Nobody is still in the pool.'; end if;
  select max(public.pool_total(p_game_id, u.id)) into v_high from unnest(v_in) u(id);
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

-- Awards for a Completed pool: {profile_id: award} (integers, any sum — D9), plus a note
-- {preset, entry, poolTotal, givenOut}. The second call is an edit; both are logged.
create or replace function public.set_pool_awards(p_game_id uuid, p_awards jsonb, p_note jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  g public.games%rowtype;
  v_bad text;
  v_old jsonb;
  v_summary text;
  v_changes jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in required.' using errcode = '42501'; end if;
  if not (public.is_app_admin() or public.is_game_admin(p_game_id)) then
    raise exception 'Only a game admin can give awards.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('game:' || p_game_id::text, 0));
  select * into g from public.games where id = p_game_id;
  if g.id is null or g.deleted_at is not null then raise exception 'This game is not available.'; end if;
  if g.game_type <> 'pool' then raise exception 'Awards are for pool games.'; end if;
  if g.status <> 'completed' then raise exception 'Complete the pool first, then give awards.'; end if;
  if g.closed_at is not null then raise exception 'Awards are locked: this pool is in a saved result. Delete the result first.'; end if;
  if p_awards is null or jsonb_typeof(p_awards) <> 'object' then raise exception 'Awards must name each player.'; end if;
  select string_agg(k.key, ', ') into v_bad
    from jsonb_each(p_awards) k
   where jsonb_typeof(k.value) <> 'number'
      or not exists (select 1 from public.game_players gp where gp.game_id = p_game_id and gp.profile_id::text = k.key and gp.role <> 'spectator');
  if v_bad is not null then raise exception 'Awards can only go to players in this game, as whole numbers.'; end if;

  v_old := g.prize_shares;
  update public.games
     set prize_shares = p_awards, awarded_at = now(), awarded_by = auth.uid(), award_note = coalesce(p_note, '{}'::jsonb)
   where id = p_game_id;

  select string_agg(format('%s %s', public.player_snapshot(p_game_id, k.key::uuid)->>'name', public.score_text((k.value)::integer)), ' · ' order by (k.value)::integer desc)
    into v_summary from jsonb_each_text(p_awards) k;

  if g.awarded_at is null then
    perform public.log_event(p_game_id, null, 'awards_set', 'important',
      format('Awards given · %s%s', coalesce(p_note->>'presetLabel', 'custom'), coalesce(' · ' || v_summary, '')),
      jsonb_build_object('awards', p_awards, 'note', coalesce(p_note, '{}'::jsonb),
                         'names', (select coalesce(jsonb_agg(public.player_snapshot(p_game_id, k.key::uuid)->>'name'), '[]'::jsonb) from jsonb_each_text(p_awards) k)));
  else
    select coalesce(jsonb_agg(jsonb_build_object('profileId', k, 'name', public.player_snapshot(p_game_id, k::uuid)->>'name',
                                                 'old', (coalesce(v_old, '{}'::jsonb)->>k)::integer, 'new', (p_awards->>k)::integer)), '[]'::jsonb)
      into v_changes
      from (select distinct key as k from (select key from jsonb_each(coalesce(v_old, '{}'::jsonb)) union select key from jsonb_each(p_awards)) x) keys
     where (coalesce(v_old, '{}'::jsonb)->>k) is distinct from (p_awards->>k);
    perform public.log_event(p_game_id, null, 'awards_changed', 'important',
      format('Awards changed · %s', coalesce((select string_agg(format('%s %s→%s', c->>'name', public.score_text(coalesce((c->>'old')::integer, 0)), public.score_text(coalesce((c->>'new')::integer, 0))), ' · ')
                                               from jsonb_array_elements(v_changes) c), 'no award changed')),
      jsonb_build_object('changes', v_changes, 'awards', p_awards, 'note', coalesce(p_note, '{}'::jsonb),
                         'names', (select coalesce(jsonb_agg(c->>'name'), '[]'::jsonb) from jsonb_array_elements(v_changes) c)));
  end if;
  return jsonb_build_object('awards', p_awards, 'awardedAt', now());
end;
$$;
revoke all on function public.set_pool_awards(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.set_pool_awards(uuid, jsonb, jsonb) to authenticated;

-- 036 body + pool branch: a late joiner starts at the highest score still in.
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
  insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated, label)
  values (p_game_id, p_profile_id, v_next, v_next + 1, 'player', true, nullif(upper(btrim(coalesce(p_label, ''))), ''));
  if public.is_pool_game(p_game_id) then
    -- 041: joining a pool mid-game starts at the highest score still in (one entry), no zero rows.
    select coalesce(max(round_number), 0) into v_round from public.rounds where game_id = p_game_id and undone_at is null and round_number < 1000;
    if v_round > 0 then
      v_in := array_remove(public.pool_players_in(p_game_id), p_profile_id);
      select coalesce(max(public.pool_total(p_game_id, u.id)), 0) into v_high from unnest(v_in) u(id);
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

-- ---------- F. readers: seat rows, public scorecard, results ----------
create or replace function public.seat_rows_json(p_games uuid[], p_member uuid[], p_profiles boolean)
returns table (game_id uuid, seats jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select gp.game_id,
         jsonb_agg(
           jsonb_build_object(
             'profile_id', gp.profile_id,
             'player_order', gp.player_order,
             'role', gp.role,
             'seated', gp.seated,
             'is_active', gp.is_active,
             'label', gp.label,
             'out_round', gp.out_round,
             'reentered_round', gp.reentered_round,
             'reentry_score', gp.reentry_score,
             'entries', gp.entries
           )
           || case
                when not p_profiles then '{}'::jsonb
                when gp.game_id = any(p_member) then jsonb_build_object('profiles', public.profile_fields_json(p))
                else jsonb_build_object('profiles', public.public_profile_json(p))
              end
           order by gp.player_order)
  from public.game_players gp
  left join public.profiles p on p.id = gp.profile_id
  where gp.game_id = any(p_games)
  group by gp.game_id;
$$;

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
    'poolLimit', case when g.game_type = 'pool' then public.pool_limit_of(g.id) end,
    'dropAmount', (g.settings->>'dropAmount')::integer,
    'awarded', g.awarded_at is not null,
    'dealers', (
      select coalesce(jsonb_object_agg(r.round_number::text, r.dealer_profile_id), '{}'::jsonb)
      from public.rounds r
      where r.game_id = g.id and r.undone_at is null
    ),
    'players', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'profileId', gp.profile_id,
        'name', pr.display_name,
        'order', gp.player_order,
        'label', gp.label,
        'outRound', gp.out_round,
        'reenteredRound', gp.reentered_round,
        'reentryScore', gp.reentry_score,
        'entries', gp.entries
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
revoke all on function public.public_scorecard(text) from public;
grant execute on function public.public_scorecard(text) to anon, authenticated;

-- 034 body + pools: awards count, a pool without awards is refused, games carry 'kind'.
create or replace function public.declare_game_result(p_game_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  gid uuid;
  distinct_ids uuid[];
  player_count integer;
  places jsonb;
  declared_ts timestamptz;
  v_pending text;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  select coalesce(array_agg(distinct x), array[]::uuid[])
  into distinct_ids
  from unnest(coalesce(p_game_ids, array[]::uuid[])) as u(x)
  where x is not null;

  if coalesce(array_length(distinct_ids, 1), 0) = 0 then
    raise exception 'Pick at least one finished game';
  end if;
  if array_length(distinct_ids, 1) > 30 then
    raise exception 'Results can include at most 30 games';
  end if;

  if (
    select count(*)
    from public.games g
    where g.id = any(distinct_ids)
      and g.status = 'completed'
      and g.deleted_at is null
  ) <> array_length(distinct_ids, 1) then
    raise exception 'Only finished games can be declared';
  end if;

  -- 041: a pool joins a result only once its awards are given.
  select string_agg(coalesce(public.game_label_text(g.game_label, g.game_number), g.share_code), ', ' order by g.created_at)
    into v_pending
    from public.games g
   where g.id = any(distinct_ids) and g.game_type = 'pool' and g.awarded_at is null;
  if v_pending is not null then
    raise exception 'Give awards first: %', v_pending;
  end if;

  if exists (
    select 1
    from unnest(distinct_ids) as u(game_id)
    where not public.is_game_admin(u.game_id)
  ) then
    raise exception 'Only an admin of every selected game can declare results';
  end if;

  -- Everyone who sat in a game counts, scored or not (034); scores without a seat still count.
  -- 041: a pool contributes its awards (prize_shares), not its round sums.
  with seated as (
    select gp.game_id, gp.profile_id
    from public.game_players gp
    where gp.game_id = any(distinct_ids)
      and gp.profile_id is not null
      and gp.role <> 'spectator'
      and coalesce(gp.seated, true)
  ),
  scored as (
    select s.game_id, s.profile_id, sum(s.value)::int as points
    from public.scores s
    join public.rounds r on r.id = s.round_id
    join public.games g on g.id = s.game_id
    where s.game_id = any(distinct_ids)
      and g.game_type <> 'pool'
      and r.undone_at is null
      and s.score_type <> 'expense'
      and s.profile_id is not null
    group by s.game_id, s.profile_id
    union all
    select g.id, (k.key)::uuid, (k.value)::int
    from public.games g, jsonb_each_text(coalesce(g.prize_shares, '{}'::jsonb)) k
    where g.id = any(distinct_ids) and g.game_type = 'pool' and k.key ~ '^[0-9a-f-]{36}$'
  ),
  per_game as (
    select st.game_id, st.profile_id, coalesce(sc.points, 0) as points
    from seated st
    left join scored sc on sc.game_id = st.game_id and sc.profile_id = st.profile_id
    union
    select sc.game_id, sc.profile_id, sc.points
    from scored sc
    where not exists (select 1 from seated st where st.game_id = sc.game_id and st.profile_id = sc.profile_id)
  ),
  per_player as (
    select profile_id, sum(points)::int as points, count(*)::int as games
    from per_game
    group by profile_id
  ),
  named as (
    select pp.profile_id, coalesce(nullif(p.display_name, ''), 'Player') as name, pp.points, pp.games
    from per_player pp
    left join public.profiles p on p.id = pp.profile_id
  ),
  ranked as (
    select *, rank() over (order by points desc)::int as place
    from named
  )
  select jsonb_build_object(
    'standings', coalesce((
      select jsonb_agg(jsonb_build_object('id', profile_id, 'name', name, 'points', points, 'games', games, 'place', place) order by place, name)
      from ranked
    ), '[]'::jsonb),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object('id', profile_id, 'name', name) order by place, name)
      from ranked
    ), '[]'::jsonb),
    'games', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'name', coalesce(g.share_code, upper(right(g.id::text, 6))),
        'date', g.created_at,
        'kind', case when g.game_type = 'pool' then 'pool' else 'points' end,
        'scores', coalesce((
          select jsonb_object_agg(pg.profile_id::text, pg.points)
          from per_game pg
          where pg.game_id = g.id
        ), '{}'::jsonb)
      ) order by g.created_at, g.id)
      from public.games g
      where g.id = any(distinct_ids)
    ), '[]'::jsonb)
  )
  into places
  from (select 1) as anchor;

  player_count := jsonb_array_length(places->'standings');
  if player_count > 50 then
    raise exception 'Results can include at most 50 players';
  end if;

  declared_ts := now();

  insert into public.game_results (declared_by, declared_at, places)
  values (auth.uid(), declared_ts, places)
  returning id into new_id;

  foreach gid in array distinct_ids loop
    insert into public.game_result_games (result_id, game_id)
    values (new_id, gid);
  end loop;

  perform public.close_games_in_result(distinct_ids, declared_ts);
  perform public.queue_result_saved_emails(new_id);

  return public.get_game_result(new_id);
end;
$$;
revoke all on function public.declare_game_result(uuid[]) from public, anon;
grant execute on function public.declare_game_result(uuid[]) to authenticated;

-- 034 body + 'kind' per game (pool columns are awards).
create or replace function public.public_result(p_id uuid, p_version integer default null)
returns jsonb
language sql
stable
security definer
set search_path = public
set jit = off
as $$
  with r as (select * from public.game_results where id = p_id),
  latest as (select coalesce(max(v.version), 1) as n from public.result_versions v where v.result_id = p_id),
  chosen as (
    select case when p_version is null or p_version < 1 then (select n from latest) else least(p_version, (select n from latest)) end as n
  ),
  pl as (
    select coalesce(
      (select v.places from public.result_versions v where v.result_id = p_id and v.version = (select n from chosen)),
      public.result_places_json(p_id)
    ) as v
  ),
  players as (
    select t.ord - 1 as pos, t.e->>'id' as id, coalesce(t.e->>'name', 'Player') as name, pr.public_player_no as player_no,
           (select gp.label from public.game_result_games grg join public.game_players gp on gp.game_id = grg.game_id and gp.profile_id::text = t.e->>'id'
             where grg.result_id = p_id and grg.removed_at is null and gp.label is not null order by grg.game_id limit 1) as label
    from pl, jsonb_array_elements(coalesce(pl.v->'players', '[]'::jsonb)) with ordinality t(e, ord)
    left join public.profiles pr on pr.id::text = t.e->>'id'
  ),
  removed as (select grg.game_id from public.game_result_games grg where grg.result_id = p_id and grg.removed_at is not null)
  select case
    when not exists (select 1 from r) then null
    else jsonb_build_object(
      'id', p_id,
      'declaredAt', (select declared_at from r),
      'declarerName', (select coalesce(nullif(p.display_name, ''), 'Player') from r join public.profiles p on p.id = r.declared_by),
      'deleted', (select deleted_at from r) is not null,
      'deletedAt', (select deleted_at from r),
      'version', (select n from chosen),
      'currentVersion', (select n from latest),
      'versions', coalesce((
        select jsonb_agg(jsonb_build_object('version', v.version, 'savedAt', v.saved_at, 'note', v.note,
                                            'by', (select coalesce(nullif(p.display_name, ''), 'Player') from public.profiles p where p.id = v.saved_by)) order by v.version)
        from public.result_versions v where v.result_id = p_id
      ), '[]'::jsonb),
      'players', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'playerNo', player_no, 'label', label) order by pos) from players), '[]'::jsonb),
      'standings', coalesce((
        select jsonb_agg(jsonb_build_object('player', p.pos, 'name', p.name, 'points', (s->>'points')::int, 'games', (s->>'games')::int, 'place', (s->>'place')::int) order by (s->>'place')::int, p.name)
        from pl, jsonb_array_elements(coalesce(pl.v->'standings', '[]'::jsonb)) s
        join players p on p.id = s->>'id'
      ), '[]'::jsonb),
      'games', coalesce((
        select jsonb_agg(jsonb_build_object(
          'label', coalesce(public.game_label_text(g.game_label, g.game_number), e->>'name', ''),
          'code', coalesce(g.share_code, e->>'name', ''),
          'date', e->>'date',
          'kind', coalesce(e->>'kind', case when g.game_type = 'pool' then 'pool' else 'points' end),
          'reused', (e->>'id')::uuid = any(array(select jsonb_array_elements_text(public.reused_game_ids(p_id))::uuid)),
          'removed', exists (select 1 from removed x where x.game_id::text = e->>'id'),
          'creatorName', (select coalesce(nullif(p.display_name, ''), 'Player') from public.profiles p where p.id = g.created_by),
          'adminNames', coalesce((
            select jsonb_agg(coalesce(nullif(p.display_name, ''), 'Player') order by gp.player_order)
            from public.game_players gp join public.profiles p on p.id = gp.profile_id
            where gp.game_id = g.id and gp.role = 'game_admin' and gp.profile_id <> g.created_by
          ), '[]'::jsonb),
          'roundCount', (select count(*) from public.rounds rd where rd.game_id = g.id and rd.undone_at is null),
          'scores', coalesce((select jsonb_object_agg(p.pos::text, k.value::int) from jsonb_each_text(coalesce(e->'scores', '{}'::jsonb)) k join players p on p.id = k.key), '{}'::jsonb)
        ) order by t.ord)
        from pl, jsonb_array_elements(coalesce(pl.v->'games', '[]'::jsonb)) with ordinality t(e, ord)
        left join public.games g on g.id::text = t.e->>'id'
      ), '[]'::jsonb),
      'reusedCount', jsonb_array_length(public.reused_game_ids(p_id)),
      'removedCount', (select count(*) from removed)
    )
  end;
$$;
revoke all on function public.public_result(uuid, integer) from public;
grant execute on function public.public_result(uuid, integer) to anon, authenticated;

notify pgrst, 'reload schema';

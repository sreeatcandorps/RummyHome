-- 044 — Seating order (PR 21, approved by Sree Nov 15, 1:34 AM PT, Q21.1–Q21.10 as recommended).
--
-- The order IS game_players.player_order (001); nothing new is stored. This migration adds:
--   A. the Log kind 'seating_changed' (constraint restated as 041 did);
--   B. set_seating_order(p_game_id, p_profile_ids): game admin only, Active games only, every seated
--      non-spectator player exactly once; one transaction (park +10000, then 0..N-1); one Log line
--      "Seating changed · 1 SK · 2 PT · …" (a seat with no stored label reads as the scorecard's default,
--      initials_candidates(name)[1] from 022) — routine with no rounds (the pop-up), important after;
--      details {from, to, rounds, nextDealer}. Players · Admins ▲ ▼ and the Seating sheet both call it.
--   C. event_log_games (043 body) ignores the settings key 'seatingPrompted' (the once-per-game pop-up
--      flag written by the app), so marking the pop-up seen never logs "Changed game settings".
-- save_round, nextDealer, bundles and the live page keep reading player_order: the deal follows the
-- current order with no new rule (D21.3 / Q21.6). Rollback: rollback/rollback_044_seating_order.sql.
-- pgTAP: tests/35_seating_order_044.sql.

-- ---------- A. Log kind ----------
alter table public.event_log drop constraint if exists event_log_kind;
alter table public.event_log add constraint event_log_kind check (kind in (
  'game_created', 'player_added', 'player_removed', 'viewer_added', 'viewer_removed',
  'admin_added', 'admin_removed', 'round_added', 'round_edited', 'round_undone',
  'settings_changed', 'initials_changed', 'player_renamed', 'completed', 'reopened',
  'closed', 'unclosed', 'deleted', 'restored',
  'result_saved', 'result_deleted', 'result_restored', 'result_changed',
  'player_out', 'player_reentered', 'reentry_undone', 'awards_set', 'awards_changed',
  'seating_changed'));

-- ---------- B. set_seating_order ----------
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

  -- Who deals next, under the rule the app and save_round already use: the seat after the last live
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
  if v_pos is not null then
    v_next := v_rotation[(v_pos % array_length(v_rotation, 1)) + 1];
  elsif v_last_dealer is not null and v_pool then
    select gp.profile_id into v_next
      from public.game_players gp
     where gp.game_id = p_game_id and gp.profile_id = any(v_rotation)
       and gp.player_order > (select x.player_order from public.game_players x where x.game_id = p_game_id and x.profile_id = v_last_dealer)
     order by gp.player_order limit 1;
    if v_next is null then v_next := v_rotation[1]; end if;
  else
    v_next := v_rotation[(v_rounds % array_length(v_rotation, 1)) + 1];
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

-- ---------- C. event_log_games: 043 body, the pop-up flag ignored ----------
create or replace function public.event_log_games()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_label text;
  v_result uuid;
  v_changes jsonb;
  v_rounds integer;
  v_leader jsonb;
begin
  v_label := coalesce(public.game_label_text(new.game_label, new.game_number), new.share_code);
  if tg_op = 'INSERT' then
    if coalesce(current_setting('ezscore.in_create_game', true), '') <> '1' then
      perform public.log_event(new.id, null, 'game_created', 'important',
        format('Created game %s · Game ID %s', v_label, new.share_code),
        jsonb_build_object('players', '[]'::jsonb, 'admins', '[]'::jsonb, 'settings', new.settings, 'shareCode', new.share_code));
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'completed' and old.status = 'active' then
      v_rounds := public.live_round_count(new.id);
      select jsonb_build_object('name', ps->>'name', 'total', t.total) into v_leader
        from (select s.profile_id, sum(s.value) as total
                from public.scores s join public.rounds r on r.id = s.round_id
               where s.game_id = new.id and r.undone_at is null
               group by s.profile_id order by total desc limit 1) t
        cross join lateral public.player_snapshot(new.id, t.profile_id) ps;
      perform public.log_event(new.id, null, 'completed', 'important',
        format('Completed the game after round %s%s', v_rounds,
               case when v_leader is not null then format(' · %s %s leads', v_leader->>'name', public.score_text((v_leader->>'total')::integer)) else '' end),
        jsonb_build_object('rounds', v_rounds, 'leader', v_leader, 'names', coalesce(jsonb_build_array(v_leader->>'name'), '[]'::jsonb)));
    elsif new.status = 'active' and old.status = 'completed' then
      perform public.log_event(new.id, null, 'reopened', 'important', 'Reopened the game · Back to Active from Completed', '{}'::jsonb);
    end if;
  end if;

  if new.closed_at is not null and old.closed_at is null then
    select grg.result_id into v_result
      from public.game_result_games grg join public.game_results r on r.id = grg.result_id
     where grg.game_id = new.id and grg.removed_at is null and r.deleted_at is null
     order by (r.declared_at = new.closed_at) desc, r.declared_at desc limit 1;
    perform public.log_event(new.id, v_result, 'closed', 'important',
      format('Closed — saved in result %s%s', coalesce(public.result_code_of(v_result), ''),
             coalesce((select case when count(*) > 1 then format(' with %s other game%s', count(*) - 1, case when count(*) = 2 then '' else 's' end) else '' end
                         from public.game_result_games x where x.result_id = v_result and x.removed_at is null), '')),
      jsonb_build_object('resultId', v_result, 'resultCode', public.result_code_of(v_result)));
  elsif new.closed_at is null and old.closed_at is not null then
    select grg.result_id into v_result
      from public.game_result_games grg join public.game_results r on r.id = grg.result_id
     where grg.game_id = new.id
     order by greatest(coalesce(r.deleted_at, '-infinity'), coalesce(grg.removed_at, '-infinity')) desc limit 1;
    perform public.log_event(new.id, v_result, 'unclosed', 'important',
      format('Back to Completed — result %s %s', coalesce(public.result_code_of(v_result), ''),
             case when new.deleted_at is not null then 'no longer counts this game' else 'deleted' end),
      jsonb_build_object('resultId', v_result));
  end if;

  if new.deleted_at is not null and old.deleted_at is null then
    perform public.log_event(new.id, null, 'deleted', 'important',
      'Deleted the game' || coalesce((select ' · Was in result ' || string_agg(public.result_code_of(grg.result_id), ', ') || ' — removed from it'
                                        from public.game_result_games grg
                                       where grg.game_id = new.id and grg.removed_at >= transaction_timestamp()), ''),
      jsonb_build_object('removedFromResults', (select coalesce(jsonb_agg(grg.result_id), '[]'::jsonb) from public.game_result_games grg where grg.game_id = new.id and grg.removed_at >= transaction_timestamp())));
  elsif new.deleted_at is null and old.deleted_at is not null then
    perform public.log_event(new.id, null, 'restored', 'important', 'Restored the game', '{}'::jsonb);
  end if;

  if new.settings is distinct from old.settings then
    with keys as (
      select k from jsonb_object_keys(coalesce(old.settings, '{}'::jsonb) || coalesce(new.settings, '{}'::jsonb)) k
       -- 044: the seating pop-up flag is bookkeeping, not a setting; it never makes a Log line.
       where k <> 'seatingPrompted'
    ), diff as (
      select k, old.settings->k as o, new.settings->k as n,
             case k when 'stakeDrop' then 'Drop' when 'dropAmount' then 'Drop' when 'poolDrop' then 'Pool drop'
                    when 'stakeMiddleDrop' then 'Middle drop' when 'mdAmount' then 'Middle drop' when 'poolMiddleDrop' then 'Pool middle drop'
                    when 'maxCount' then 'Full count' when 'poolAmount' then 'Pool' when 'poolDefaultDeposit' then 'Pool deposit'
                    when 'expenseAmount' then 'Table cost' when 'expenseEnabled' then 'Table cost on' when 'gameType' then 'Game type'
                    when 'poolLimit' then 'Pool limit' when 'reentryLimit' then 'Re-entries' when 'reentry' then 'Re-entry'
                    when 'multiplier' then 'Multiplier'
                    else k end as label
        from keys where (old.settings->k) is distinct from (new.settings->k)
    ), one as (select distinct on (label) label, o, n from diff order by label, k)
    select coalesce(jsonb_agg(jsonb_build_object('key', label, 'old', o, 'new', n) order by label), '[]'::jsonb) into v_changes from one;
    if jsonb_array_length(v_changes) > 0 then
      v_rounds := public.live_round_count(new.id);
      perform public.log_event(new.id, null, 'settings_changed', (case when v_rounds > 0 then 'important' else 'routine' end)::public.event_level,
        'Changed game settings · ' || (select string_agg(case when c->>'key' = 'Multiplier'
               then format('Multiplier ×%s→×%s · applies to the whole game%s', coalesce(c->>'old', '1'), coalesce(c->>'new', '1'),
                           case when v_rounds > 0 then format(' (%s round%s re-priced)', v_rounds, case when v_rounds = 1 then '' else 's' end) else '' end)
               else format('%s %s→%s', c->>'key', coalesce(c->>'old', '—'), coalesce(c->>'new', '—')) end, ' · ') from jsonb_array_elements(v_changes) c),
        jsonb_build_object('changes', v_changes, 'rounds', v_rounds));
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.event_log_games() from public, anon, authenticated;

notify pgrst, 'reload schema';

-- 042 (PR 13 follow-up, Sree's answers of Nov 14 10:27 PM PT). Two changes to the pool rules that
-- 041 put on the live project:
--
--  A. Re-entries become a setting. games.settings.reentryLimit: null / absent = Unlimited (the new
--     default), an integer N = Limited to N re-entries per player (0 = none). The 041 boolean
--     settings.reentry is still read for games saved before this: false → 0, true → unlimited.
--     reenter_player enforces the limit; the 041 "once per player" rule is gone.
--  B. The settings lock keeps only the pool limit fixed once a live round exists (Q14.23). Drop,
--     Middle drop and Full count may change mid-game — they only drive keypad shortcuts and the
--     "more than Full count?" confirm — and the 036 settings_changed Log line records the change.
--     That log line now labels poolLimit / reentryLimit / reentry in words.
--
-- Safe to run twice. Rollback: supabase/rollback/rollback_042_pool_reentries_and_limit_lock.sql.

-- ---------- A. re-entry limit ----------
create or replace function public.pool_reentry_limit(p_settings jsonb)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  -- null = unlimited
  select case
    when p_settings ? 'reentryLimit' then
      case when jsonb_typeof(p_settings->'reentryLimit') = 'number' then greatest(0, (p_settings->>'reentryLimit')::integer) else null end
    when (p_settings->>'reentry') = 'false' then 0
    else null
  end;
$$;
revoke all on function public.pool_reentry_limit(jsonb) from public, anon;
grant execute on function public.pool_reentry_limit(jsonb) to authenticated;

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

-- ---------- B. only the pool limit is locked ----------
create or replace function public.games_pool_settings_lock()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.game_type = 'pool' and new.settings is distinct from old.settings
     and exists (select 1 from public.rounds r where r.game_id = new.id and r.undone_at is null)
     and (new.settings->>'poolLimit') is distinct from (old.settings->>'poolLimit') then
    raise exception 'Rounds have been saved. The pool limit is locked — changing it would change who is out. Undo every round to edit it.'
      using errcode = 'PT423';
  end if;
  return new;
end;
$$;
revoke all on function public.games_pool_settings_lock() from public, anon, authenticated;
drop trigger if exists games_pool_settings_lock on public.games;
create trigger games_pool_settings_lock before update of settings on public.games
  for each row execute function public.games_pool_settings_lock();

-- ---------- the settings_changed Log line names the pool keys ----------
-- Same body as 036 event_log_games with three labels added (poolLimit, reentryLimit, reentry).
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
    ), diff as (
      select k, old.settings->k as o, new.settings->k as n,
             case k when 'stakeDrop' then 'Drop' when 'dropAmount' then 'Drop' when 'poolDrop' then 'Pool drop'
                    when 'stakeMiddleDrop' then 'Middle drop' when 'mdAmount' then 'Middle drop' when 'poolMiddleDrop' then 'Pool middle drop'
                    when 'maxCount' then 'Full count' when 'poolAmount' then 'Pool' when 'poolDefaultDeposit' then 'Pool deposit'
                    when 'expenseAmount' then 'Table cost' when 'expenseEnabled' then 'Table cost on' when 'gameType' then 'Game type'
                    when 'poolLimit' then 'Pool limit' when 'reentryLimit' then 'Re-entries' when 'reentry' then 'Re-entry'
                    else k end as label
        from keys where (old.settings->k) is distinct from (new.settings->k)
    ), one as (select distinct on (label) label, o, n from diff order by label, k)
    select coalesce(jsonb_agg(jsonb_build_object('key', label, 'old', o, 'new', n) order by label), '[]'::jsonb) into v_changes from one;
    if jsonb_array_length(v_changes) > 0 then
      v_rounds := public.live_round_count(new.id);
      perform public.log_event(new.id, null, 'settings_changed', (case when v_rounds > 0 then 'important' else 'routine' end)::public.event_level,
        'Changed game settings · ' || (select string_agg(format('%s %s→%s', c->>'key', coalesce(c->>'old', '—'), coalesce(c->>'new', '—')), ' · ') from jsonb_array_elements(v_changes) c),
        jsonb_build_object('changes', v_changes, 'rounds', v_rounds));
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.event_log_games() from public, anon, authenticated;

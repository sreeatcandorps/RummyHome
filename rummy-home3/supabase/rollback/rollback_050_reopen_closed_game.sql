-- Rollback for 050 (D49 B: reopening a Closed game). Puts the 028 / 043 results RPCs back under their
-- names, drops the reopen trigger and the rounds / scores guards, restores the 048 Log body and drops the
-- Out of date columns. A result already stamped loses the stamp (the column goes); its games stay as they
-- are (Completed / Active) — the rollback does not re-close anything. Log rows stay (event_log is append-only).
drop trigger if exists games_reopen_closed on public.games;
drop function if exists public.games_reopen_closed();
drop trigger if exists rounds_closed_guard on public.rounds;
drop trigger if exists scores_closed_guard on public.scores;
drop function if exists public.rounds_closed_guard();
drop function if exists public.closed_game_message();

drop function if exists public.get_game_result(uuid);
drop function if exists public.list_game_results_page(integer, integer);
drop function if exists public.result_stale_json(uuid);
drop function if exists public.result_for_game(uuid);
do $$
begin
  if to_regprocedure('public.get_game_result_v028(uuid)') is not null then
    alter function public.get_game_result_v028(uuid) rename to get_game_result;
  end if;
  if to_regprocedure('public.list_game_results_page_v043(integer, integer)') is not null then
    alter function public.list_game_results_page_v043(integer, integer) rename to list_game_results_page;
  end if;
end $$;
revoke all on function public.get_game_result(uuid) from public, anon;
grant execute on function public.get_game_result(uuid) to authenticated;
revoke all on function public.list_game_results_page(integer, integer) from public, anon;
grant execute on function public.list_game_results_page(integer, integer) to authenticated;

-- 048 body, byte-for-byte.
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
                    when 'reentryPlus' then 'Re-entry score' when 'lateEntryPlus' then 'Late entry score'
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
               when c->>'key' in ('Re-entry score', 'Late entry score')
               then format('%s %s→%s', c->>'key', public.entry_plus_text(c->'old'), public.entry_plus_text(c->'new'))
               else format('%s %s→%s', c->>'key', coalesce(c->>'old', '—'), coalesce(c->>'new', '—')) end, ' · ') from jsonb_array_elements(v_changes) c),
        jsonb_build_object('changes', v_changes, 'rounds', v_rounds));
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.event_log_games() from public, anon, authenticated;

alter table public.game_results drop column if exists stale_game_id;
alter table public.game_results drop column if exists stale_by;
alter table public.game_results drop column if exists stale_at;

notify pgrst, 'reload schema';

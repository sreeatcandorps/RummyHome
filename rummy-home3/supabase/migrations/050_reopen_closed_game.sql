-- 050 — D49 (Sree, Nov 19, option B): a Closed game can be reopened; its result stays, marked Out of date.
--
-- Sree: "I don't think we should force him to delete the result … someone looks at the score and says you
-- entered this wrong … let him just do what he wants … this game is going to become open … all of the other
-- games also be moved to completed from closed … the old result never changes … keep it simple."
--
-- One door. A Completed game already has no Add round / Undo / Edit round in the app; an admin must Reopen
-- first, and until now Reopen was refused on a Closed game. From 050 the reopen goes through, and the
-- database does the bookkeeping for any client, the app included:
--   1. every live result that counts the game is stamped Out of date (stale_at / stale_by / stale_game_id;
--      the first stamp wins, a second reopen does not move it);
--   2. every other game in those results goes Closed → Completed (closed_at cleared); this one goes Active;
--   3. the Log of each game gets an 'unclosed' row that says the result is Out of date (event_log_games,
--      048 body + that wording; the rest of the body is byte-for-byte 048);
--   4. the results RPCs return the stamp (`staleAt`, `staleBy`, `staleByName`, `staleGameId`,
--      `staleGameLabel`) — the 028 / 043 bodies are kept under `_v028` / `_v043` names and wrapped, so
--      nothing else in them changes.
-- The result's stored places never change (008 snapshot); the app shows a chip on the list and a banner on
-- the page, with "Make a new result" and "Delete this result".
--
-- Guard kept from the first draft of 050: rounds and scores of a game that is still Closed refuse to change
-- (PT423, "reopen it first") — so a direct API write cannot skip the door. Status changes are no longer
-- refused (that was the first draft's games_closed_guard; dropped here).
--
-- Safe to run twice.
alter table public.game_results add column if not exists stale_at timestamptz;
alter table public.game_results add column if not exists stale_by uuid references public.profiles(id) on delete set null;
alter table public.game_results add column if not exists stale_game_id uuid references public.games(id) on delete set null;

-- ---------- A. reopen a Closed game ----------
create or replace function public.games_reopen_closed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result uuid;
begin
  if old.closed_at is not null and old.status = 'completed' and new.status = 'active' then
    for v_result in
      select r.id
        from public.game_result_games grg
        join public.game_results r on r.id = grg.result_id
       where grg.game_id = old.id and grg.removed_at is null and r.deleted_at is null
    loop
      update public.game_results
         set stale_at = coalesce(stale_at, now()),
             stale_by = coalesce(stale_by, auth.uid()),
             stale_game_id = coalesce(stale_game_id, old.id)
       where id = v_result;
      update public.games g
         set closed_at = null
       where g.id <> old.id
         and g.closed_at is not null
         and g.id in (select x.game_id from public.game_result_games x where x.result_id = v_result and x.removed_at is null);
    end loop;
    new.closed_at := null;
  end if;
  return new;
end;
$$;
revoke all on function public.games_reopen_closed() from public, anon, authenticated;
drop trigger if exists games_closed_guard on public.games;
drop function if exists public.games_closed_guard();
drop trigger if exists games_reopen_closed on public.games;
create trigger games_reopen_closed before update of status on public.games
  for each row execute function public.games_reopen_closed();

-- ---------- B. rounds and scores of a game that is still Closed do not change ----------
create or replace function public.closed_game_message()
returns text
language sql
immutable
set search_path = public, pg_temp
as $$ select 'This game is Closed: it is part of a saved result. Reopen it first.'::text $$;

create or replace function public.rounds_closed_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.games g where g.id = new.game_id and g.closed_at is not null) then
    raise exception '%', public.closed_game_message() using errcode = 'PT423';
  end if;
  return new;
end;
$$;
revoke all on function public.rounds_closed_guard() from public, anon, authenticated;
drop trigger if exists rounds_closed_guard on public.rounds;
create trigger rounds_closed_guard before insert or update of undone_at, round_number, game_id on public.rounds
  for each row execute function public.rounds_closed_guard();
drop trigger if exists scores_closed_guard on public.scores;
create trigger scores_closed_guard before insert or update of value, score_type, round_id, game_id on public.scores
  for each row execute function public.rounds_closed_guard();

-- ---------- C. the Log row (048 body + the Out of date wording) ----------
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
     order by greatest(coalesce(r.deleted_at, '-infinity'), coalesce(grg.removed_at, '-infinity'), coalesce(r.stale_at, '-infinity')) desc limit 1;
    -- 050: a reopened Closed game (D49) leaves its result in place, Out of date; its other games un-close with it.
    perform public.log_event(new.id, v_result, 'unclosed', 'important',
      format('%s — result %s %s',
             case when new.status = 'active' then 'Reopened while Closed' else 'Back to Completed' end,
             coalesce(public.result_code_of(v_result), ''),
             case when new.deleted_at is not null then 'no longer counts this game'
                  when (select r.stale_at from public.game_results r where r.id = v_result) is not null
                    then 'is Out of date · its numbers do not change'
                  else 'deleted' end),
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

-- ---------- D. the results RPCs carry the stamp ----------
-- The 028 / 043 bodies stay as they are under a versioned name; the public name wraps them.
do $$
begin
  if to_regprocedure('public.get_game_result_v028(uuid)') is null then
    alter function public.get_game_result(uuid) rename to get_game_result_v028;
  end if;
  if to_regprocedure('public.list_game_results_page_v043(integer, integer)') is null then
    alter function public.list_game_results_page(integer, integer) rename to list_game_results_page_v043;
  end if;
end $$;
revoke all on function public.get_game_result_v028(uuid) from public, anon, authenticated;
revoke all on function public.list_game_results_page_v043(integer, integer) from public, anon, authenticated;

create or replace function public.result_stale_json(p_result_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select jsonb_build_object(
      'staleAt', r.stale_at,
      'staleBy', r.stale_by,
      'staleByName', coalesce(nullif(trim(p.display_name), ''), 'an admin'),
      'staleGameId', r.stale_game_id,
      'staleGameLabel', public.game_label_text(g.game_label, g.game_number)
    )
    from public.game_results r
    left join public.profiles p on p.id = r.stale_by
    left join public.games g on g.id = r.stale_game_id
    where r.id = p_result_id and r.stale_at is not null
  ), '{}'::jsonb);
$$;
revoke all on function public.result_stale_json(uuid) from public, anon, authenticated;

create or replace function public.get_game_result(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when v is null then null
    when coalesce((v->>'deleted')::boolean, false) then v
    else v || public.result_stale_json(p_id)
  end
  from (select public.get_game_result_v028(p_id) as v) x;
$$;
revoke all on function public.get_game_result(uuid) from public, anon;
grant execute on function public.get_game_result(uuid) to authenticated;

create or replace function public.list_game_results_page(p_limit integer default 5, p_offset integer default 0)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select jsonb_agg(t.e || public.result_stale_json((t.e->>'id')::uuid) order by t.ord)
    from jsonb_array_elements(public.list_game_results_page_v043(p_limit, p_offset)) with ordinality as t(e, ord)
  ), '[]'::jsonb);
$$;
revoke all on function public.list_game_results_page(integer, integer) from public, anon;
grant execute on function public.list_game_results_page(integer, integer) to authenticated;

notify pgrst, 'reload schema';

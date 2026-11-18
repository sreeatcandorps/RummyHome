-- 036: Game and result logs (the Logs PR of the Nov 12 feedback plan; D1–D13 approved)
--
-- One append-only table, public.event_log, written only on the server inside the change's own
-- transaction: by triggers on games / game_players / game_results / game_result_games / rounds /
-- profiles, by save_round (round_added / round_edited) and by the two new RPCs create_game and
-- add_seated_player. Names are snapshots (details.players / details.names), so a later rename
-- does not rewrite history. Every member of a game reads its log (can_read_game); everyone who
-- can see a result reads its History (can_see_game_result). Sharing is not logged (Rev. 2).
--
-- D4: direct inserts into rounds / scores are revoked from authenticated — every write goes
-- through save_round (now security definer) or add_seated_player. The app's pre-014 fallbacks
-- only run when the RPC is missing, which cannot be the case on a 036 database.
--
-- Re-runnable. Rollback: supabase/rollback/rollback_036_event_log.sql.

-- ---------------------------------------------------------------------------
-- A. table
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'event_level' and typnamespace = 'public'::regnamespace) then
    create type public.event_level as enum ('important', 'routine');
  end if;
end $$;

create table if not exists public.event_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  txid        bigint not null default txid_current(),
  game_id     uuid references public.games(id) on delete cascade,
  result_id   uuid references public.game_results(id) on delete cascade,
  kind        text not null,
  level       public.event_level not null,
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_name  text not null,
  summary     text not null,
  details     jsonb not null default '{}'::jsonb,
  constraint event_log_subject check (game_id is not null or result_id is not null),
  constraint event_log_kind check (kind in (
    'game_created', 'player_added', 'player_removed', 'viewer_added', 'viewer_removed',
    'admin_added', 'admin_removed', 'round_added', 'round_edited', 'round_undone',
    'settings_changed', 'initials_changed', 'player_renamed', 'completed', 'reopened',
    'closed', 'unclosed', 'deleted', 'restored',
    'result_saved', 'result_deleted', 'result_restored', 'result_changed'))
);
create index if not exists event_log_game_idx   on public.event_log (game_id, id desc)   where game_id is not null;
create index if not exists event_log_result_idx on public.event_log (result_id, id desc) where result_id is not null;
create index if not exists event_log_level_idx  on public.event_log (game_id, level, id desc) where game_id is not null;

revoke all on public.event_log from public, anon, authenticated;
grant select on public.event_log to authenticated;
alter table public.event_log enable row level security;
drop policy if exists event_log_read on public.event_log;
create policy event_log_read on public.event_log for select to authenticated
  using ((game_id is not null and public.can_read_game(game_id))
      or (result_id is not null and (public.can_see_game_result(result_id) or public.can_manage_result(result_id))));

-- append-only: no role may update or delete a row. The only allowed changes are the ones the
-- foreign keys make when a game / result is hard-deleted (cascade) or a profile is hard-deleted
-- (actor_id set null) — those never happen from the app, only from demo cleanup.
create or replace function public.event_log_refuse()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if (old.game_id is not null and not exists (select 1 from public.games g where g.id = old.game_id))
       or (old.result_id is not null and not exists (select 1 from public.game_results r where r.id = old.result_id)) then
      return old;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.actor_id is null and old.actor_id is not null
       and (to_jsonb(new) - 'actor_id') = (to_jsonb(old) - 'actor_id')
       and not exists (select 1 from public.profiles p where p.id = old.actor_id) then
      return new;
    end if;
  end if;
  raise exception 'The log cannot be changed.' using errcode = '42501';
end;
$$;
revoke all on function public.event_log_refuse() from public, anon, authenticated;
drop trigger if exists event_log_immutable on public.event_log;
create trigger event_log_immutable before update or delete on public.event_log
  for each row execute function public.event_log_refuse();

-- realtime (D8): the Log screen subscribes to inserts; RLS applies to the stream
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_log') then
    alter publication supabase_realtime add table public.event_log;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- B. helpers
-- ---------------------------------------------------------------------------
create or replace function public.score_text(p_value integer)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$ select case when p_value is null then '—' when p_value > 0 then '+' || p_value::text else p_value::text end; $$;
revoke all on function public.score_text(integer) from public, anon;

-- {id, name, no, ini} as they are right now (the caller stores the result, so it is a snapshot)
create or replace function public.player_snapshot(p_game_id uuid, p_profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when p_profile_id is null then null else jsonb_build_object(
    'id', p_profile_id,
    'name', coalesce(nullif(trim(p.display_name), ''), 'Player'),
    'no', p.public_player_no,
    'ini', (select gp.label from public.game_players gp where gp.game_id = p_game_id and gp.profile_id = p_profile_id))
  end
  from (select p_profile_id as id) x
  left join public.profiles p on p.id = x.id;
$$;
revoke all on function public.player_snapshot(uuid, uuid) from public, anon, authenticated;

create or replace function public.game_label_of(p_game_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.game_label_text(g.game_label, g.game_number), g.share_code, upper(right(g.id::text, 6)))
  from public.games g where g.id = p_game_id;
$$;
revoke all on function public.game_label_of(uuid) from public, anon, authenticated;

-- "R7": the declarer's n-th live result
create or replace function public.result_code_of(p_result_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select 'R' || (select count(*) from public.game_results x
                  where x.declared_by = r.declared_by and (x.deleted_at is null or x.id = r.id) and x.declared_at <= r.declared_at)::text
  from public.game_results r where r.id = p_result_id;
$$;
revoke all on function public.result_code_of(uuid) from public, anon, authenticated;

-- the one writer. Not callable by clients: only the (security definer) triggers and RPCs reach it.
create or replace function public.log_event(p_game_id uuid, p_result_id uuid, p_kind text, p_level public.event_level, p_summary text, p_details jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
  v_actor uuid := auth.uid();
  v_name text;
begin
  select coalesce(nullif(trim(p.display_name), ''), 'Player') into v_name from public.profiles p where p.id = v_actor;
  insert into public.event_log (game_id, result_id, kind, level, actor_id, actor_name, summary, details)
  values (p_game_id, p_result_id, p_kind, p_level, v_actor, coalesce(v_name, 'System'), p_summary, coalesce(p_details, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.log_event(uuid, uuid, text, public.event_level, text, jsonb) from public, anon, authenticated;

-- how many players a saved result lists (places is {games, players, standings})
create or replace function public.result_player_count(p_places jsonb)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select case when jsonb_typeof(p_places->'players') = 'array' then jsonb_array_length(p_places->'players')
              when jsonb_typeof(p_places->'standings') = 'array' then jsonb_array_length(p_places->'standings')
              when jsonb_typeof(p_places) = 'array' then jsonb_array_length(p_places) else 0 end;
$$;
revoke all on function public.result_player_count(jsonb) from public, anon;

create or replace function public.live_round_count(p_game_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select count(*)::int from public.rounds r where r.game_id = p_game_id and r.undone_at is null and r.round_number < 1000; $$;
revoke all on function public.live_round_count(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- C. triggers
-- ---------------------------------------------------------------------------
-- games: created (direct insert by an older app), completed / reopened, closed / unclosed,
-- deleted / restored, settings changed
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
drop trigger if exists event_log_games on public.games;
create trigger event_log_games after insert or update on public.games
  for each row execute function public.event_log_games();

-- game_players: added / removed / admin changes / initials
create or replace function public.event_log_game_players()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.game_players;
  v_snap jsonb;
  v_rounds integer;
  v_who text;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;
  v_snap := public.player_snapshot(v_row.game_id, v_row.profile_id);
  if tg_op = 'DELETE' then v_snap := coalesce(v_snap, '{}'::jsonb) || jsonb_build_object('ini', old.label); end if;
  v_who := format('%s (%s%s)', v_snap->>'name', coalesce('#' || (v_snap->>'no'), ''), coalesce(' · ' || (v_snap->>'ini'), ''));

  if tg_op = 'INSERT' then
    if coalesce(current_setting('ezscore.in_create_game', true), '') = '1' then return new; end if;
    if new.role = 'spectator' then
      perform public.log_event(new.game_id, null, 'viewer_added', 'routine', format('Added %s as view-only', v_who),
        jsonb_build_object('player', v_snap, 'names', jsonb_build_array(v_snap->>'name')));
    elsif new.role = 'game_admin' and not coalesce(new.seated, true) then
      perform public.log_event(new.game_id, null, 'admin_added', 'important', format('Made %s an admin · not playing', v_who),
        jsonb_build_object('player', v_snap, 'nonPlaying', true, 'names', jsonb_build_array(v_snap->>'name')));
    else
      v_rounds := public.live_round_count(new.game_id);
      perform public.log_event(new.game_id, null, 'player_added', 'important',
        format('Added %s as a player%s', v_who,
               case when v_rounds > 0 then format(' · Joined at round %s · round%s 1–%s set to 0', v_rounds + 1, case when v_rounds = 1 then '' else 's' end, v_rounds) else '' end),
        jsonb_build_object('player', v_snap, 'joinRound', v_rounds + 1, 'names', jsonb_build_array(v_snap->>'name')));
      if new.role = 'game_admin' then
        perform public.log_event(new.game_id, null, 'admin_added', 'important', format('Made %s an admin', v_who),
          jsonb_build_object('player', v_snap, 'names', jsonb_build_array(v_snap->>'name')));
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.role = 'spectator' then
      perform public.log_event(old.game_id, null, 'viewer_removed', 'routine', format('Removed view-only %s', v_who),
        jsonb_build_object('player', v_snap, 'names', jsonb_build_array(v_snap->>'name')));
    elsif old.role = 'game_admin' and not coalesce(old.seated, true) then
      perform public.log_event(old.game_id, null, 'admin_removed', 'important', format('Removed admin %s', v_who),
        jsonb_build_object('player', v_snap, 'nonPlaying', true, 'names', jsonb_build_array(v_snap->>'name')));
    else
      perform public.log_event(old.game_id, null, 'player_removed', 'important',
        format('Removed %s from the game · Had no scores yet', v_who),
        jsonb_build_object('player', v_snap, 'hadScores', false, 'names', jsonb_build_array(v_snap->>'name')));
    end if;
    return old;
  end if;

  -- UPDATE
  if new.role is distinct from old.role then
    if new.role = 'game_admin' then
      perform public.log_event(new.game_id, null, 'admin_added', 'important', format('Made %s an admin', v_who),
        jsonb_build_object('player', v_snap, 'fromRole', old.role, 'toRole', new.role, 'names', jsonb_build_array(v_snap->>'name')));
    elsif old.role = 'game_admin' then
      perform public.log_event(new.game_id, null, 'admin_removed', 'important', format('Removed admin from %s', v_who),
        jsonb_build_object('player', v_snap, 'fromRole', old.role, 'toRole', new.role, 'names', jsonb_build_array(v_snap->>'name')));
    end if;
  end if;
  if new.label is distinct from old.label and old.label is not null then
    perform public.log_event(new.game_id, null, 'initials_changed', 'routine',
      format('Changed initials for %s %s→%s', v_snap->>'name', old.label, new.label),
      jsonb_build_object('player', v_snap, 'old', old.label, 'new', new.label, 'names', jsonb_build_array(v_snap->>'name')));
  end if;
  return new;
end;
$$;
revoke all on function public.event_log_game_players() from public, anon, authenticated;
drop trigger if exists event_log_game_players on public.game_players;
create trigger event_log_game_players after insert or delete or update of role, label on public.game_players
  for each row execute function public.event_log_game_players();

-- rounds: undone (Undo, from the RPC or from an older app's direct update). Edit round retires
-- rows with undo_reason 'edited …' and is logged by save_round instead.
create or replace function public.event_log_rounds()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.undone_at is not null and old.undone_at is null and coalesce(new.undo_reason, '') not like 'edited%' then
    perform public.log_event(new.game_id, null, 'round_undone', 'important',
      format('Round %s undone · Removed scores: %s', old.round_number,
             coalesce((select string_agg(format('%s %s', public.player_snapshot(new.game_id, s.profile_id)->>'name', public.score_text(s.value)), ', ' order by s.value desc)
                         from public.scores s where s.round_id = new.id), 'none')),
      jsonb_build_object('round', old.round_number,
                         'scores', (select coalesce(jsonb_agg(public.player_snapshot(new.game_id, s.profile_id) || jsonb_build_object('value', s.value, 'type', s.score_type) order by s.value desc), '[]'::jsonb)
                                      from public.scores s where s.round_id = new.id),
                         'names', (select coalesce(jsonb_agg(public.player_snapshot(new.game_id, s.profile_id)->>'name'), '[]'::jsonb) from public.scores s where s.round_id = new.id)));
  end if;
  return new;
end;
$$;
revoke all on function public.event_log_rounds() from public, anon, authenticated;
drop trigger if exists event_log_rounds on public.rounds;
create trigger event_log_rounds after update of undone_at on public.rounds
  for each row execute function public.event_log_rounds();

-- profiles: rename → one routine row per Active game the player is in (D6)
create or replace function public.event_log_profiles()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare g record;
begin
  if new.display_name is distinct from old.display_name and nullif(trim(old.display_name), '') is not null then
    for g in select gp.game_id from public.game_players gp join public.games x on x.id = gp.game_id
              where gp.profile_id = new.id and x.status = 'active' and x.deleted_at is null loop
      perform public.log_event(g.game_id, null, 'player_renamed', 'routine',
        format('%s renamed to %s', old.display_name, new.display_name),
        jsonb_build_object('player', public.player_snapshot(g.game_id, new.id), 'old', old.display_name, 'new', new.display_name,
                           'names', jsonb_build_array(old.display_name, new.display_name)));
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function public.event_log_profiles() from public, anon, authenticated;
drop trigger if exists event_log_profiles on public.profiles;
create trigger event_log_profiles after update of display_name on public.profiles
  for each row execute function public.event_log_profiles();

-- game_results: saved / deleted / restored
create or replace function public.event_log_game_results()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_games text;
  v_n integer;
  v_players integer;
begin
  select string_agg(public.game_label_of(grg.game_id), ', ' order by g.created_at), count(*)
    into v_games, v_n
    from public.game_result_games grg join public.games g on g.id = grg.game_id
   where grg.result_id = new.id and grg.removed_at is null;
  v_players := public.result_player_count(new.places);
  if new.deleted_at is not null and old.deleted_at is null then
    perform public.log_event(null, new.id, 'result_deleted', 'important',
      format('Result deleted · %s game%s back to Completed · can be restored from Past results', coalesce(v_n, 0), case when v_n = 1 then '' else 's' end),
      jsonb_build_object('games', (select coalesce(jsonb_agg(grg.game_id), '[]'::jsonb) from public.game_result_games grg where grg.result_id = new.id and grg.removed_at is null)));
  elsif new.deleted_at is null and old.deleted_at is not null then
    perform public.log_event(null, new.id, 'result_restored', 'important',
      format('Result restored · %s back to Closed', coalesce(v_games, 'its games')),
      jsonb_build_object('games', (select coalesce(jsonb_agg(grg.game_id), '[]'::jsonb) from public.game_result_games grg where grg.result_id = new.id and grg.removed_at is null)));
  end if;
  return new;
end;
$$;
revoke all on function public.event_log_game_results() from public, anon, authenticated;
drop trigger if exists event_log_game_results on public.game_results;
create trigger event_log_game_results after update of deleted_at on public.game_results
  for each row execute function public.event_log_game_results();

-- result_saved is written at the end of the saving transaction (deferred), once the games are linked
create or replace function public.event_log_result_saved()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_games text;
  v_n integer;
  v_players integer;
begin
  if exists (select 1 from public.event_log e where e.result_id = new.id and e.kind = 'result_saved') then return null; end if;
  select string_agg(public.game_label_of(grg.game_id), ', ' order by g.created_at), count(*)
    into v_games, v_n
    from public.game_result_games grg join public.games g on g.id = grg.game_id
   where grg.result_id = new.id;
  v_players := public.result_player_count(new.places);
  perform public.log_event(null, new.id, 'result_saved', 'important',
    format('Result saved with %s · %s game%s moved to Closed · %s player%s', coalesce(v_games, 'no games'), coalesce(v_n, 0), case when v_n = 1 then '' else 's' end, coalesce(v_players, 0), case when v_players = 1 then '' else 's' end),
    jsonb_build_object('games', (select coalesce(jsonb_agg(grg.game_id), '[]'::jsonb) from public.game_result_games grg where grg.result_id = new.id), 'players', v_players, 'version', 1));
  return null;
end;
$$;
revoke all on function public.event_log_result_saved() from public, anon, authenticated;
drop trigger if exists event_log_result_saved on public.game_results;
create constraint trigger event_log_result_saved after insert on public.game_results
  deferrable initially deferred for each row execute function public.event_log_result_saved();

-- declare_game_result closes its games in one statement after the result and its game links
-- are written: that is the moment result_saved can list every game (visible inside the saving
-- transaction, which the pgTAP suite needs; the deferred trigger above is the fallback).
create or replace function public.event_log_result_saved_now()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare r record;
begin
  for r in select gr.* from public.game_results gr
            where gr.declared_at = transaction_timestamp()
              and not exists (select 1 from public.event_log e where e.result_id = gr.id and e.kind = 'result_saved') loop
    perform public.log_event(null, r.id, 'result_saved', 'important',
      format('Result saved with %s · %s game%s moved to Closed · %s player%s',
             coalesce((select string_agg(public.game_label_of(grg.game_id), ', ' order by g.created_at) from public.game_result_games grg join public.games g on g.id = grg.game_id where grg.result_id = r.id), 'no games'),
             (select count(*) from public.game_result_games grg where grg.result_id = r.id),
             case when (select count(*) from public.game_result_games grg where grg.result_id = r.id) = 1 then '' else 's' end,
             public.result_player_count(r.places),
             case when public.result_player_count(r.places) = 1 then '' else 's' end),
      jsonb_build_object('games', (select coalesce(jsonb_agg(grg.game_id), '[]'::jsonb) from public.game_result_games grg where grg.result_id = r.id),
                         'players', public.result_player_count(r.places), 'version', 1));
  end loop;
  return null;
end;
$$;
revoke all on function public.event_log_result_saved_now() from public, anon, authenticated;
drop trigger if exists event_log_result_saved_now on public.games;
create trigger event_log_result_saved_now after update of closed_at on public.games
  for each statement execute function public.event_log_result_saved_now();

-- game_result_games: a game taken out of a result (delete_game / account deletion)
create or replace function public.event_log_result_games()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_label text;
begin
  if new.removed_at is not null and old.removed_at is null then
    v_label := public.game_label_of(new.game_id);
    perform public.log_event(null, new.result_id, 'result_changed', 'important',
      format('Game %s deleted — no longer counted in this result · Totals changed', v_label),
      jsonb_build_object('gameId', new.game_id, 'gameLabel', v_label, 'cause', 'deleted', 'totalsChanged', true, 'names', jsonb_build_array(v_label)));
  end if;
  return new;
end;
$$;
revoke all on function public.event_log_result_games() from public, anon, authenticated;
drop trigger if exists event_log_result_games on public.game_result_games;
create trigger event_log_result_games after update of removed_at on public.game_result_games
  for each row execute function public.event_log_result_games();

-- event_log itself: a change to a game that sits in a saved result is mirrored into that
-- result's History as result_changed (a deleted result included, so a restore shows what
-- happened in between)
create or replace function public.event_log_mirror()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare r record; v_label text; v_what text;
begin
  if new.game_id is null or new.result_id is not null
     or new.kind not in ('round_edited', 'round_undone', 'reopened', 'restored', 'player_removed', 'player_added', 'settings_changed') then
    return null;
  end if;
  v_label := public.game_label_of(new.game_id);
  v_what := case new.kind
    when 'round_edited' then format('round %s edited', new.details->>'round')
    when 'round_undone' then format('round %s undone', new.details->>'round')
    when 'reopened' then 'reopened'
    when 'restored' then 'restored (not added back to this result)'
    when 'player_removed' then format('%s removed', new.details->'player'->>'name')
    when 'player_added' then format('%s added', new.details->'player'->>'name')
    else 'settings changed' end;
  for r in select grg.result_id, gr.deleted_at
             from public.game_result_games grg join public.game_results gr on gr.id = grg.result_id
            where grg.game_id = new.game_id and (grg.removed_at is null or new.kind = 'restored') loop
    perform public.log_event(null, r.result_id, 'result_changed', 'important',
      format('Game %s %s%s', v_label, v_what,
             case when r.deleted_at is not null then ' while this result was deleted'
                  when new.kind in ('round_edited', 'round_undone') then ' · Totals changed' else '' end),
      jsonb_build_object('gameId', new.game_id, 'gameLabel', v_label, 'cause', new.kind, 'causeEventId', new.id,
                         'totalsChanged', new.kind in ('round_edited', 'round_undone'), 'names', jsonb_build_array(v_label)));
  end loop;
  return null;
end;
$$;
revoke all on function public.event_log_mirror() from public, anon, authenticated;
drop trigger if exists event_log_mirror on public.event_log;
create trigger event_log_mirror after insert on public.event_log
  for each row execute function public.event_log_mirror();

-- ---------------------------------------------------------------------------
-- D. writers: create_game, add_seated_player, save_round (re-created from 035, now definer)
-- ---------------------------------------------------------------------------
create or replace function public.create_game(p_game_type text, p_settings jsonb, p_player_ids uuid[], p_labels jsonb default '{}'::jsonb, p_share_code text default null, p_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
  v_me uuid := auth.uid();
  v_players uuid[];
  v_i integer;
  v_code text := coalesce(nullif(p_share_code, ''), upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)));
  v_label text;
begin
  if v_me is null then raise exception 'Sign in to start a game.' using errcode = '42501'; end if;
  select array_agg(distinct x) into v_players from unnest(coalesce(p_player_ids, '{}'::uuid[])) x where x is not null;
  if coalesce(array_length(v_players, 1), 0) < 2 then
    raise exception 'A game needs at least two players.';
  end if;
  perform set_config('ezscore.in_create_game', '1', true);

  insert into public.games (id, created_by, game_type, settings, share_code)
  values (v_id, v_me, p_game_type::public.game_type, coalesce(p_settings, '{}'::jsonb), v_code);

  for v_i in 1 .. array_length(p_player_ids, 1) loop
    continue when p_player_ids[v_i] is null or exists (select 1 from public.game_players gp where gp.game_id = v_id and gp.profile_id = p_player_ids[v_i]);
    insert into public.game_players (game_id, profile_id, player_order, display_number, role, seated, label)
    values (v_id, p_player_ids[v_i], v_i - 1, v_i,
            case when p_player_ids[v_i] = v_me then 'game_admin'::public.game_member_role else 'player'::public.game_member_role end,
            true, nullif(p_labels->>(p_player_ids[v_i]::text), ''));
  end loop;
  if not (v_me = any(v_players)) then
    insert into public.game_players (game_id, profile_id, player_order, role, seated)
    values (v_id, v_me, 900, 'game_admin', false);
  end if;

  v_label := public.game_label_of(v_id);
  perform public.log_event(v_id, null, 'game_created', 'important',
    format('Created game %s · Players: %s · Admins: %s · Game ID %s', v_label,
           (select string_agg(ps->>'name', ', ' order by gp.player_order) from public.game_players gp cross join lateral public.player_snapshot(v_id, gp.profile_id) ps where gp.game_id = v_id and gp.role <> 'spectator' and gp.seated),
           (select string_agg(ps->>'name', ', ' order by gp.player_order) from public.game_players gp cross join lateral public.player_snapshot(v_id, gp.profile_id) ps where gp.game_id = v_id and gp.role = 'game_admin'),
           v_code),
    jsonb_build_object(
      'players', (select coalesce(jsonb_agg(ps order by gp.player_order), '[]'::jsonb) from public.game_players gp cross join lateral public.player_snapshot(v_id, gp.profile_id) ps where gp.game_id = v_id and gp.role <> 'spectator' and gp.seated),
      'admins', (select coalesce(jsonb_agg(ps->>'name' order by gp.player_order), '[]'::jsonb) from public.game_players gp cross join lateral public.player_snapshot(v_id, gp.profile_id) ps where gp.game_id = v_id and gp.role = 'game_admin'),
      'settings', coalesce(p_settings, '{}'::jsonb), 'shareCode', v_code,
      'names', (select coalesce(jsonb_agg(ps->>'name' order by gp.player_order), '[]'::jsonb) from public.game_players gp cross join lateral public.player_snapshot(v_id, gp.profile_id) ps where gp.game_id = v_id)));
  perform set_config('ezscore.in_create_game', '', true);
  return v_id;
end;
$$;
revoke all on function public.create_game(text, jsonb, uuid[], jsonb, text, uuid) from public, anon;
grant execute on function public.create_game(text, jsonb, uuid[], jsonb, text, uuid) to authenticated;

create or replace function public.add_seated_player(p_game_id uuid, p_profile_id uuid, p_label text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next integer;
  v_zeros integer;
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
  -- Joining mid-game: an explicit 0 in every round already played.
  insert into public.scores (round_id, game_id, profile_id, score_type, value)
  select r.id, p_game_id, p_profile_id, 'count', 0
    from public.rounds r where r.game_id = p_game_id and r.undone_at is null and r.round_number < 1000;
  get diagnostics v_zeros = row_count;
end;
$$;
revoke all on function public.add_seated_player(uuid, uuid, text) from public, anon;
grant execute on function public.add_seated_player(uuid, uuid, text) to authenticated;

-- D4: no direct inserts into rounds / scores from the app (save_round / add_seated_player only).
-- UPDATE stays granted (RLS: game admins) so the APK already on phones can still Undo through
-- its two direct writes until the new build ships; the rounds trigger logs that path too.
revoke insert, delete on public.rounds from authenticated;
revoke insert, delete on public.scores from authenticated;

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
             coalesce((select string_agg(format('%s %s', public.player_snapshot(p_game_id, s.profile_id)->>'name', public.score_text(s.value)), ', ' order by s.value desc)
                         from public.scores s where s.round_id = v_round_id and s.value > 0), 'no winner')),
      jsonb_build_object('round', p_round_number,
                         'dealer', public.player_snapshot(p_game_id, v_dealer),
                         'scores', (select coalesce(jsonb_agg(public.player_snapshot(p_game_id, s.profile_id) || jsonb_build_object('value', s.value, 'type', s.score_type) order by s.value desc), '[]'::jsonb)
                                      from public.scores s where s.round_id = v_round_id),
                         'names', (select coalesce(jsonb_agg(public.player_snapshot(p_game_id, s.profile_id)->>'name'), '[]'::jsonb)
                                      from public.scores s where s.round_id = v_round_id and s.value > 0)));
  end if;

  return v_round_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- E. readers
-- ---------------------------------------------------------------------------
create or replace function public.event_row_json(e public.event_log)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_build_object('id', e.id, 'at', e.at, 'kind', e.kind, 'level', e.level, 'actorId', e.actor_id, 'actorName', e.actor_name,
                            'summary', e.summary, 'details', e.details, 'gameId', e.game_id, 'resultId', e.result_id);
$$;
revoke all on function public.event_row_json(public.event_log) from public, anon;

create or replace function public.list_game_log(p_game_id uuid, p_level text default 'all', p_before bigint default null, p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_rows jsonb; v_more boolean; v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if not public.can_read_game(p_game_id) then
    raise exception 'This game is not available.' using errcode = '42501';
  end if;
  with page as (
    select e as row from public.event_log e
     where e.game_id = p_game_id
       and (p_level is null or p_level = 'all' or e.level::text = p_level)
       and (p_before is null or e.id < p_before)
     order by e.id desc limit v_limit + 1
  ), numbered as (select p.row, row_number() over (order by (p.row).id desc) as rn from page p)
  select coalesce(jsonb_agg(public.event_row_json(n.row) order by (n.row).id desc) filter (where n.rn <= v_limit), '[]'::jsonb), count(*) > v_limit
    into v_rows, v_more
    from numbered n;
  return jsonb_build_object('rows', v_rows, 'hasMore', v_more);
end;
$$;
revoke all on function public.list_game_log(uuid, text, bigint, integer) from public, anon;
grant execute on function public.list_game_log(uuid, text, bigint, integer) to authenticated;

-- History of a result: its own result_* rows (saved / deleted / restored / changed), newest first,
-- plus the result_versions list (034) so the app can link a change to the version it produced.
create or replace function public.list_result_history(p_result_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.can_see_game_result(p_result_id)
          or exists (select 1 from public.game_results r where r.id = p_result_id and r.declared_by = auth.uid())
          or public.can_manage_result(p_result_id)) then
    raise exception 'This result is not available.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'rows', (select coalesce(jsonb_agg(public.event_row_json(e) order by e.id desc), '[]'::jsonb) from public.event_log e where e.result_id = p_result_id and e.kind like 'result_%'),
    'versions', (select coalesce(jsonb_agg(jsonb_build_object('version', v.version, 'note', v.note, 'savedAt', v.saved_at) order by v.version), '[]'::jsonb)
                   from public.result_versions v where v.result_id = p_result_id),
    'changedNote', public.result_changed_note(p_result_id));
end;
$$;
revoke all on function public.list_result_history(uuid) from public, anon;
grant execute on function public.list_result_history(uuid) to authenticated;

-- the one-line "Changed after sharing" note = the latest result_changed row (null when none)
create or replace function public.result_changed_note(p_result_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('summary', e.summary, 'actorName', e.actor_name, 'at', e.at,
                            'count', (select count(*) from public.event_log x where x.result_id = p_result_id and x.kind = 'result_changed'))
  from public.event_log e where e.result_id = p_result_id and e.kind = 'result_changed'
  order by e.id desc limit 1;
$$;
revoke all on function public.result_changed_note(uuid) from public, anon, authenticated;

-- public pages (anon): the note for /r/<id>, the last 10 important changes for the live scorecard
create or replace function public.public_result_note(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select public.result_changed_note(p_id); $$;
grant execute on function public.public_result_note(uuid) to anon, authenticated;

create or replace function public.public_scorecard_changes(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select jsonb_agg(q.j order by q.id desc)
                     from (select x.id, public.event_row_json(x) - 'actorId' - 'details' as j
                             from public.event_log x where x.game_id = g.id and x.level = 'important' order by x.id desc limit 10) q), '[]'::jsonb)
  from public.games g
  where p_token ~ '^[0-9a-f]{48}$' and g.view_token = p_token and g.deleted_at is null;
$$;
grant execute on function public.public_scorecard_changes(text) to anon, authenticated;

notify pgrst, 'reload schema';

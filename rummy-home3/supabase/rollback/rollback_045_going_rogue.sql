-- Rollback for 045 (Going rogue). Removes the asks table, the two Log kinds and the purged-row columns
-- (rows that only a purged game anchors are dropped, as are restore_requested rows — both exist only
-- because of 045), the restore-request emails, the purge function and its pg_cron job, and puts the
-- 044-state bodies back: event_log_refuse and log_event (036), can_read_game (023), get_game_bundle
-- (031), get_home_bundle and list_hidden_and_deleted (028), restore_game (023).
do $$
begin
  -- cron.* is resolved at run time: the schema is absent without pg_cron
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $q$ select cron.unschedule(jobid) from cron.job where jobname = 'purge-deleted-games' $q$;
  end if;
end $$;

drop function if exists public.purge_deleted_games();
drop function if exists public.request_restore(uuid);

-- the Log: 045-only rows go, then the 036 shape comes back
alter table public.event_log disable trigger event_log_immutable;
delete from public.event_log where kind in ('restore_requested', 'game_purged') or (game_id is null and result_id is null);
alter table public.event_log enable trigger event_log_immutable;
alter table public.event_log drop constraint if exists event_log_subject;
alter table public.event_log add constraint event_log_subject check (game_id is not null or result_id is not null);
alter table public.event_log drop constraint if exists event_log_kind;
alter table public.event_log add constraint event_log_kind check (kind in (
  'game_created', 'player_added', 'player_removed', 'viewer_added', 'viewer_removed',
  'admin_added', 'admin_removed', 'round_added', 'round_edited', 'round_undone',
  'settings_changed', 'initials_changed', 'player_renamed', 'completed', 'reopened',
  'closed', 'unclosed', 'deleted', 'restored',
  'result_saved', 'result_deleted', 'result_restored', 'result_changed',
  'player_out', 'player_reentered', 'reentry_undone', 'awards_set', 'awards_changed',
  'seating_changed'));
drop index if exists public.event_log_purged_idx;
alter table public.event_log drop column if exists purged_game_id, drop column if exists purged_game_label;

-- emails
delete from public.email_outbox where kind = 'restore_requested';
alter table public.email_outbox drop constraint if exists email_outbox_kind_check;
alter table public.email_outbox add constraint email_outbox_kind_check
  check (kind in ('game_started', 'result_saved', 'link_request'));

-- 036 bodies
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

-- 023 body
create or replace function public.can_read_game(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.games g
    where g.id = p_game_id and g.deleted_at is null
      and (public.is_app_admin() or g.created_by = auth.uid() or public.is_game_member(g.id) or g.spectator_access = true)
  );
$$;

-- 031 body
CREATE OR REPLACE FUNCTION public.get_game_bundle(p_game_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET jit TO 'off'
AS $function$
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
$function$;


-- 028 bodies
CREATE OR REPLACE FUNCTION public.get_home_bundle(p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET jit TO 'off'
AS $function$
declare
  v_admin boolean;
  v_games jsonb;
  v_notices jsonb;
  v_claims jsonb;
  v_link_requests jsonb;
  v_roster jsonb;
begin
  if auth.uid() is null then
    return null;
  end if;
  v_admin := public.is_app_admin();

  with vg as (
    select (v.game).*, v.member from public.visible_games(p_limit, false) v
  ),
  detail as (
    select vg.id from vg where v_admin or vg.member
  ),
  seats as (
    select * from public.seat_rows_json((select coalesce(array_agg(id), '{}'::uuid[]) from detail), '{}'::uuid[], false)
  )
  select coalesce(jsonb_agg(
           to_jsonb(vg) - 'member' || jsonb_build_object('game_players', coalesce(s.seats, '[]'::jsonb))
           order by vg.created_at desc, vg.id desc), '[]'::jsonb)
    into v_games
  from vg
  left join seats s on s.game_id = vg.id;

  select coalesce(jsonb_agg(jsonb_build_object('player_id', n.player_id, 'text', n.text, 'kind', n.kind)), '[]'::jsonb)
    into v_notices
  from public.take_creator_notices() n;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.invited_at), '[]'::jsonb)
    into v_claims
  from public.list_claim_requests() c;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.invited_at), '[]'::jsonb)
    into v_link_requests
  from public.list_link_requests_for_me_v2() r;

  select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
    into v_roster
  from public.list_my_players() m;

  return jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'games', v_games,
    'notices', v_notices,
    'claim_requests', v_claims,
    'link_requests', v_link_requests,
    'my_players', v_roster,
    'hidden_count', (select count(*) from public.hidden_games h join public.games g on g.id = h.game_id where h.owner_id = auth.uid() and g.deleted_at is null)
  );
end;
$function$;


CREATE OR REPLACE FUNCTION public.list_hidden_and_deleted()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when auth.uid() is null then null else jsonb_build_object(
    'hidden', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'gameNumber', g.game_number, 'gameLabel', public.game_label_text(g.game_label, g.game_number), 'createdAt', g.created_at, 'status', g.status,
                                          'creatorName', coalesce(nullif(p.display_name, ''), 'Rummy Player'), 'hiddenAt', h.hidden_at,
                                          'playerCount', (select count(*) from public.game_players gp where gp.game_id = g.id and gp.is_active and gp.role <> 'spectator' and coalesce(gp.seated, true)))
                       order by h.hidden_at desc)
      from public.hidden_games h join public.games g on g.id = h.game_id left join public.profiles p on p.id = g.created_by
      where h.owner_id = auth.uid() and g.deleted_at is null
    ), '[]'::jsonb),
    'deletedGames', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'gameNumber', g.game_number, 'gameLabel', public.game_label_text(g.game_label, g.game_number), 'createdAt', g.created_at, 'status', g.status,
                                          'creatorName', coalesce(nullif(p.display_name, ''), 'Rummy Player'), 'deletedAt', g.deleted_at,
                                          'deletedByMe', g.deleted_by = auth.uid(),
                                          'deletedByName', coalesce(nullif(d.display_name, ''), 'Rummy Player'),
                                          'playerCount', (select count(*) from public.game_players gp where gp.game_id = g.id and gp.is_active and gp.role <> 'spectator' and coalesce(gp.seated, true)),
                                          'removedFromResults', (select count(*) from public.game_result_games grg join public.game_results r on r.id = grg.result_id where grg.game_id = g.id and grg.removed_at is not null and r.deleted_at is null))
                       order by g.deleted_at desc)
      from public.games g left join public.profiles p on p.id = g.created_by left join public.profiles d on d.id = g.deleted_by
      where g.deleted_at is not null and (g.deleted_by = auth.uid() or public.can_manage_game(g.id))
    ), '[]'::jsonb),
    'deletedResults', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'declaredAt', r.declared_at, 'deletedAt', r.deleted_at,
                                          'deletedByMe', r.deleted_by = auth.uid(),
                                          'deletedByName', coalesce(nullif(d.display_name, ''), 'Rummy Player'),
                                          'gameCount', (select count(*) from public.game_result_games g where g.result_id = r.id and g.removed_at is null),
                                          'playerCount', jsonb_array_length(coalesce(public.result_places_json(r.id)->'standings', '[]'::jsonb)))
                       order by r.deleted_at desc)
      from public.game_results r left join public.profiles d on d.id = r.deleted_by
      where r.deleted_at is not null and (r.deleted_by = auth.uid() or public.can_manage_result(r.id))
    ), '[]'::jsonb)
  ) end;
$function$;


-- 023 body
CREATE OR REPLACE FUNCTION public.restore_game(p_game_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_game public.games;
  v_removed jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into v_game from public.games g where g.id = p_game_id;
  if v_game.id is null then raise exception 'This game is not available.'; end if;
  if v_game.deleted_at is null then return jsonb_build_object('restored', true, 'removedFromResults', '[]'::jsonb); end if;
  if not (v_game.deleted_by = auth.uid() or public.can_manage_game(p_game_id)) then
    raise exception 'Only the person who deleted this game or a game admin can restore it.';
  end if;
  update public.games set deleted_at = null, deleted_by = null where id = p_game_id;
  perform public.adjust_games_together(p_game_id, 1);
  -- Results it was removed from stay as they are: say which, so the app can tell the user.
  select coalesce(jsonb_agg(jsonb_build_object('resultId', grg.result_id, 'declaredAt', r.declared_at) order by r.declared_at), '[]'::jsonb)
    into v_removed
  from public.game_result_games grg join public.game_results r on r.id = grg.result_id
  where grg.game_id = p_game_id and grg.removed_at is not null and r.deleted_at is null;
  return jsonb_build_object('restored', true, 'removedFromResults', v_removed);
end;
$function$;


-- 045 helpers and the asks table (after the readers that used them are gone)
drop function if exists public.game_deletion_json(uuid);
drop function if exists public.can_read_deleted_game(uuid);
drop function if exists public.has_saved_score(uuid, uuid);
drop function if exists public.deleted_game_retention();
drop table if exists public.restore_requests;

notify pgrst, 'reload schema';

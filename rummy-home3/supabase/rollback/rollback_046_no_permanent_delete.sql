-- Rollback for 046 (no permanent delete). Drops archive_deleted_games and games.archived_at (archived
-- games become plain deleted games again — nothing was removed, so nothing is lost), removes the
-- game_archived Log rows and kind, and puts the 045 bodies back: can_read_deleted_game, get_home_bundle,
-- list_hidden_and_deleted, restore_game and the DESTRUCTIVE purge_deleted_games.
--
-- The pg_cron job 'archive-deleted-games' is unscheduled. 'purge-deleted-games' is NOT rescheduled:
-- Sree's rule (Nov 15) is that the app never permanently deletes, and live has had no purge job since
-- 11:18 AM PT that day. Re-adding it is a hand decision, not a rollback side effect.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $q$ select cron.unschedule(jobid) from cron.job where jobname = 'archive-deleted-games' $q$;
  end if;
end $$;

drop function if exists public.archive_deleted_games();

-- the Log: 046-only rows go, then 045's kinds
alter table public.event_log disable trigger event_log_immutable;
delete from public.event_log where kind = 'game_archived';
alter table public.event_log enable trigger event_log_immutable;
alter table public.event_log drop constraint if exists event_log_kind;
alter table public.event_log add constraint event_log_kind check (kind in (
  'game_created', 'player_added', 'player_removed', 'viewer_added', 'viewer_removed',
  'admin_added', 'admin_removed', 'round_added', 'round_edited', 'round_undone',
  'settings_changed', 'initials_changed', 'player_renamed', 'completed', 'reopened',
  'closed', 'unclosed', 'deleted', 'restored',
  'result_saved', 'result_deleted', 'result_restored', 'result_changed',
  'player_out', 'player_reentered', 'reentry_undone', 'awards_set', 'awards_changed',
  'seating_changed',
  'restore_requested', 'game_purged'));

-- 045 bodies
create or replace function public.can_read_deleted_game(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.games g
    where g.id = p_game_id and g.deleted_at is not null
      and (public.can_manage_game(g.id) or g.deleted_by = auth.uid() or public.has_saved_score(g.id, auth.uid()))
  );
$$;

create or replace function public.get_home_bundle(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
set jit = off
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_games jsonb;
  v_deleted jsonb;
  v_notices jsonb;
  v_claims jsonb;
  v_link_requests jsonb;
  v_roster jsonb;
begin
  if v_uid is null then
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

  select coalesce(jsonb_agg(row_json order by deleted_at desc, id desc), '[]'::jsonb)
    into v_deleted
  from (
    select g.id, g.deleted_at,
           jsonb_build_object(
             'id', g.id, 'game_number', g.game_number, 'game_label', g.game_label, 'game_type', g.game_type,
             'status', g.status, 'created_at', g.created_at, 'share_code', g.share_code,
             'player_count', (select count(*) from public.game_players gp where gp.game_id = g.id and gp.is_active and gp.role <> 'spectator' and coalesce(gp.seated, true))
           ) || public.game_deletion_json(g.id) as row_json
    from public.games g
    where g.deleted_at is not null
      and g.deleted_at > now() - public.deleted_game_retention()
      and (v_admin or g.created_by = v_uid or g.deleted_by = v_uid
           or exists (select 1 from public.game_players gp where gp.game_id = g.id and gp.profile_id = v_uid and gp.role = 'game_admin' and gp.is_active)
           or exists (select 1 from public.scores s where s.game_id = g.id and s.profile_id = v_uid))
    order by g.deleted_at desc, g.id desc
    limit 50
  ) d;

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
    'profile', (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'games', v_games,
    'deleted_games', v_deleted,
    'notices', v_notices,
    'claim_requests', v_claims,
    'link_requests', v_link_requests,
    'my_players', v_roster,
    'hidden_count', (select count(*) from public.hidden_games h join public.games g on g.id = h.game_id where h.owner_id = v_uid and g.deleted_at is null)
  );
end;
$$;

create or replace function public.list_hidden_and_deleted()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'hidden', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'gameNumber', g.game_number, 'gameLabel', g.game_label, 'createdAt', g.created_at, 'status', g.status,
                                          'creatorName', coalesce(nullif(p.display_name, ''), 'Rummy Player'), 'hiddenAt', h.hidden_at,
                                          'playerCount', (select count(*) from public.game_players gp where gp.game_id = g.id and gp.is_active and gp.role <> 'spectator' and coalesce(gp.seated, true)))
                       order by h.hidden_at desc)
      from public.hidden_games h join public.games g on g.id = h.game_id left join public.profiles p on p.id = g.created_by
      where h.owner_id = auth.uid() and g.deleted_at is null
    ), '[]'::jsonb),
    'deletedGames', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'gameNumber', g.game_number, 'gameLabel', g.game_label, 'createdAt', g.created_at, 'status', g.status,
                                          'creatorName', coalesce(nullif(p.display_name, ''), 'Rummy Player'), 'deletedAt', g.deleted_at,
                                          'purgeAt', g.deleted_at + public.deleted_game_retention(),
                                          'deletedByMe', g.deleted_by = auth.uid(),
                                          'deletedByName', coalesce(nullif(d.display_name, ''), 'Rummy Player'),
                                          'playerCount', (select count(*) from public.game_players gp where gp.game_id = g.id and gp.is_active and gp.role <> 'spectator' and coalesce(gp.seated, true)),
                                          'requestCount', (select count(*) from public.restore_requests rr where rr.game_id = g.id),
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
$$;

create or replace function public.restore_game(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  delete from public.restore_requests where game_id = p_game_id;
  perform public.adjust_games_together(p_game_id, 1);
  select coalesce(jsonb_agg(jsonb_build_object('resultId', grg.result_id, 'declaredAt', r.declared_at) order by r.declared_at), '[]'::jsonb)
    into v_removed
  from public.game_result_games grg join public.game_results r on r.id = grg.result_id
  where grg.game_id = p_game_id and grg.removed_at is not null and r.deleted_at is null;
  return jsonb_build_object('restored', true, 'removedFromResults', v_removed);
end;
$$;

-- 045's destructive purge body (function only; no cron job)
create or replace function public.purge_deleted_games()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
  v_label text;
begin
  perform set_config('ezscore.purging', '1', true);
  for r in
    select g.id, g.game_label, g.game_number, g.share_code, g.deleted_at
    from public.games g
    where g.deleted_at is not null
      and g.deleted_at < now() - public.deleted_game_retention()
      and not exists (
        select 1 from public.game_result_games grg join public.game_results res on res.id = grg.result_id
        where grg.game_id = g.id and grg.removed_at is null and res.deleted_at is null)
      and not exists (select 1 from public.prize_session_games psg where psg.game_id = g.id)
    order by g.deleted_at
  loop
    v_label := coalesce(public.game_label_text(r.game_label, r.game_number), r.share_code);
    update public.game_results res
       set places = public.result_places_json(res.id)
     where res.id in (select grg.result_id from public.game_result_games grg where grg.game_id = r.id and grg.removed_at is not null);
    update public.event_log
       set game_id = null, purged_game_id = r.id, purged_game_label = v_label
     where game_id = r.id;
    insert into public.event_log (purged_game_id, purged_game_label, kind, level, actor_id, actor_name, summary, details)
    values (r.id, v_label, 'game_purged', 'important', null, 'System',
            format('Game %s was erased %s days after it was deleted', v_label, extract(day from public.deleted_game_retention())::int),
            jsonb_build_object('deletedAt', r.deleted_at, 'shareCode', r.share_code));
    delete from public.games where id = r.id;
    v_count := v_count + 1;
  end loop;
  perform set_config('ezscore.purging', '', true);
  return v_count;
end;
$$;
revoke all on function public.purge_deleted_games() from public, anon, authenticated;
grant execute on function public.purge_deleted_games() to service_role;
comment on function public.purge_deleted_games() is '045: erases games deleted more than deleted_game_retention() ago that no live result holds. Log rows survive as purged_game_id.';

drop index if exists public.games_archived_idx;
drop index if exists public.games_deleted_unarchived_idx;
alter table public.games drop column if exists archived_at;

notify pgrst, 'reload schema';

-- 045: Going rogue — the simplest robust option (docs/going-rogue-design.md §6 items 2 + 3) plus Q20.1.
-- Apply after 044. Safe to re-run. Rollback: rollback_045_going_rogue.sql.
--
-- Sree, Nov 15: items 2 + 3 of §6, Q20.1 = make the 30 days real, Q20.2 = creator + every admin,
-- Q20.3 = scorecard + Log read-only, Q20.6 = no (deleted games stay out of pickers and stats),
-- Q20.7 = support@ezscore.app, Q20.8 = one PR. Items 4 (round actions) and 5 (last-admin guard) are out.
--
-- A. restore_requests: one row per (game, person) — "Asked · Nov 10", never twice.
-- B. The Log: two kinds (restore_requested, game_purged); a purged game's rows keep their history line
--    with game_id nulled and purged_game_id / purged_game_label filled (event_log_subject allows it).
-- C. can_read_game: a deleted game is readable by the creator, its admins, app admins, the deleter and
--    every player with at least one saved score in it (undone rounds included). Everything that gates
--    on can_read_game follows: the Log (036 policy + list_game_log), hide_game, results_holding_game.
--    Pickers, stats and lists still go through deleted_at is null — Q20.6.
-- D. get_game_bundle for a deleted game answers the FULL bundle (seats, scores, dealers) plus
--    deleted:true and a `deletion` object, so the app draws the scorecard read-only with a red banner.
--    Readers who are not in C get null, as before. The public /s/ page still answers {deleted:true}.
-- E. get_home_bundle gains deleted_games: games deleted in the last 30 days the caller may read (C).
-- F. request_restore(p_game_id): one ask per person per game; Log row; in-app notice (creator_notices)
--    and email (email_outbox, kind restore_requested) to the creator and every active game admin.
-- G. restore_game clears the asks. list_hidden_and_deleted carries purgeAt.
-- H. purge_deleted_games(): hard-deletes games deleted more than 30 days ago that no live result holds.
--    Results the game was removed from get their recomputed places baked in first, so the cascade
--    changes nothing anyone sees. Scheduled nightly through pg_cron when the extension is present;
--    otherwise `select public.purge_deleted_games();` is the one line to run (dashboard or cron).

-- ---------- A. asks ----------
create table if not exists public.restore_requests (
  game_id uuid not null references public.games(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now(),
  primary key (game_id, profile_id)
);
alter table public.restore_requests enable row level security;
revoke all on public.restore_requests from public, anon, authenticated;
grant select on public.restore_requests to authenticated;
drop policy if exists restore_requests_read on public.restore_requests;
create policy restore_requests_read on public.restore_requests for select to authenticated
  using (public.can_read_game(game_id));
comment on table public.restore_requests is '045: "Ask an admin to restore" — one row per person per deleted game. Cleared on restore; cascades on purge.';

-- how long a deleted game is kept (Q20.1). One place to change.
create or replace function public.deleted_game_retention()
returns interval
language sql
immutable
set search_path = public, pg_temp
as $$ select interval '30 days' $$;

-- ---------- B. the Log ----------
alter table public.event_log
  add column if not exists purged_game_id uuid,
  add column if not exists purged_game_label text;
alter table public.event_log drop constraint if exists event_log_subject;
alter table public.event_log add constraint event_log_subject
  check (game_id is not null or result_id is not null or purged_game_id is not null);
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
create index if not exists event_log_purged_idx on public.event_log (purged_game_id, id desc) where purged_game_id is not null;
comment on column public.event_log.purged_game_id is '045: the game this row was about, after the game itself was erased by purge_deleted_games(). Readable from the dashboard only.';

-- 036 body plus one allowance: while purge_deleted_games() runs (ezscore.purging = 1) a row may move
-- its game_id into purged_game_id. Nothing else about it may change.
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
    if coalesce(current_setting('ezscore.purging', true), '') = '1'
       and old.game_id is not null and new.game_id is null and new.purged_game_id = old.game_id
       and (to_jsonb(new) - 'game_id' - 'purged_game_id' - 'purged_game_label') = (to_jsonb(old) - 'game_id' - 'purged_game_id' - 'purged_game_label') then
      return new;
    end if;
  end if;
  raise exception 'The log cannot be changed.' using errcode = '42501';
end;
$$;

-- 036 body plus: while a game is being purged, the cascade (seats, rounds) writes no Log lines —
-- the game_purged row written by purge_deleted_games() is the one line for that.
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
  if coalesce(current_setting('ezscore.purging', true), '') = '1' then return null; end if;
  select coalesce(nullif(trim(p.display_name), ''), 'Player') into v_name from public.profiles p where p.id = v_actor;
  insert into public.event_log (game_id, result_id, kind, level, actor_id, actor_name, summary, details)
  values (p_game_id, p_result_id, p_kind, p_level, v_actor, coalesce(v_name, 'System'), p_summary, coalesce(p_details, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.log_event(uuid, uuid, text, public.event_level, text, jsonb) from public, anon, authenticated;

-- ---------- C. who may read a deleted game ----------
-- At least one saved score in this game, undone rounds included (the rows are kept).
create or replace function public.has_saved_score(p_game_id uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_profile_id is not null and exists (
    select 1 from public.scores s where s.game_id = p_game_id and s.profile_id = p_profile_id
  );
$$;
revoke all on function public.has_saved_score(uuid, uuid) from public, anon, authenticated;

-- The deleted-game readers: creator, game admins, app admins (can_manage_game), the deleter, scored players.
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
revoke all on function public.can_read_deleted_game(uuid) from public, anon;
grant execute on function public.can_read_deleted_game(uuid) to authenticated;

-- 023 body plus the deleted branch.
create or replace function public.can_read_game(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    exists (
      select 1 from public.games g
      where g.id = p_game_id and g.deleted_at is null
        and (public.is_app_admin() or g.created_by = auth.uid() or public.is_game_member(g.id) or g.spectator_access = true)
    )
    or public.can_read_deleted_game(p_game_id)
  );
$$;

-- ---------- D. the deleted game's bundle ----------
-- What the banner says: who deleted it and when, when it is gone for good, who may restore, who asked.
create or replace function public.game_deletion_json(p_game_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'deleted_at', g.deleted_at,
    'deleted_by', g.deleted_by,
    'deleted_by_name', coalesce(nullif(d.display_name, ''), 'Rummy Player'),
    'deleted_by_me', g.deleted_by = auth.uid(),
    'purge_at', g.deleted_at + public.deleted_game_retention(),
    'can_restore', g.deleted_by = auth.uid() or public.can_manage_game(g.id),
    'my_request_at', (select rr.requested_at from public.restore_requests rr where rr.game_id = g.id and rr.profile_id = auth.uid()),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object('profile_id', rr.profile_id, 'name', coalesce(nullif(p.display_name, ''), 'Rummy Player'), 'requested_at', rr.requested_at)
                       order by rr.requested_at)
      from public.restore_requests rr left join public.profiles p on p.id = rr.profile_id
      where rr.game_id = g.id
    ), '[]'::jsonb)
  )
  from public.games g left join public.profiles d on d.id = g.deleted_by
  where g.id = p_game_id and g.deleted_at is not null;
$$;
revoke all on function public.game_deletion_json(uuid) from public, anon, authenticated;

-- 031 body; a deleted game answers the full bundle (read-only in the app) plus deleted:true and
-- `deletion` for the readers in C, null for everyone else.
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
  v_deleted_reader boolean := false;
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

  if v_game.deleted_at is not null then
    v_deleted_reader := public.can_read_deleted_game(p_game_id);
    if not v_deleted_reader then return null; end if;
  elsif not (v_admin or v_member or v_game.spectator_access) then
    return null;
  end if;

  if v_admin or v_member or v_deleted_reader then
    select coalesce(s.seats, '[]'::jsonb) into v_seats
    from public.seat_rows_json(array[p_game_id], case when v_member or v_deleted_reader then array[p_game_id] else '{}'::uuid[] end, true) s;
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

    -- 031: who dealt each live round, so the scorecard draws a divider each time the first dealer deals again.
    select coalesce(jsonb_object_agg(r.round_number::text, r.dealer_profile_id), '{}'::jsonb)
      into v_dealers
      from public.rounds r
     where r.game_id = p_game_id and r.undone_at is null;
  end if;

  -- deleted: game.can_restore stays for the 023 app; `deletion` is the 045 banner
  return jsonb_build_object(
    'game', to_jsonb(v_game) || case when v_game.deleted_at is not null
                                     then jsonb_build_object('can_restore', v_game.deleted_by = v_uid or public.can_manage_game(p_game_id))
                                     else '{}'::jsonb end,
    'game_players', v_seats,
    'scores', v_scores,
    'dealers', v_dealers
  ) || case when v_game.deleted_at is not null
            then jsonb_build_object('deleted', true, 'deletion', public.game_deletion_json(p_game_id))
            else '{}'::jsonb end;
end;
$$;

-- ---------- E. Home ----------
-- 028 body plus deleted_games: deleted within the retention window, readable by the caller (C), newest first.
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

-- ---------- F. Ask an admin to restore ----------
create or replace function public.request_restore(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games;
  v_label text;
  v_name text;
  v_existing timestamptz;
  v_now timestamptz := now();
  r record;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  select * into v_game from public.games g where g.id = p_game_id;
  if v_game.id is null or not public.can_read_game(p_game_id) then raise exception 'This game is not available.'; end if;
  if v_game.deleted_at is null then raise exception 'This game is not deleted.'; end if;
  if v_game.deleted_by = v_uid or public.can_manage_game(p_game_id) then
    raise exception 'You can restore this game yourself.';
  end if;

  select rr.requested_at into v_existing from public.restore_requests rr where rr.game_id = p_game_id and rr.profile_id = v_uid;
  if v_existing is not null then
    return jsonb_build_object('requested', true, 'already', true, 'requestedAt', v_existing);
  end if;

  insert into public.restore_requests (game_id, profile_id, requested_at) values (p_game_id, v_uid, v_now);

  v_label := coalesce(public.game_label_text(v_game.game_label, v_game.game_number), v_game.share_code);
  select coalesce(nullif(trim(p.display_name), ''), 'A player') into v_name from public.profiles p where p.id = v_uid;
  perform public.log_event(p_game_id, null, 'restore_requested', 'important',
    'Asked an admin to restore the game',
    jsonb_build_object('requesterId', v_uid, 'requesterName', v_name, 'gameLabel', v_label));

  -- Q20.2: the creator and every active game admin, each once, never the asker.
  for r in
    select p.id, p.email, coalesce(nullif(trim(p.display_name), ''), 'there') as name
    from public.profiles p
    where p.id <> v_uid and p.id in (
      select v_game.created_by
      union
      select gp.profile_id from public.game_players gp where gp.game_id = p_game_id and gp.role = 'game_admin' and gp.is_active
    )
  loop
    insert into public.creator_notices (owner_id, player_id, text, kind)
    values (r.id, v_uid, format('%s asked to restore game %s. Open it from Home › Deleted games to restore it.', v_name, v_label), 'notice');
    if r.email is not null and r.email <> '' then
      insert into public.email_outbox (event_key, kind, to_profile_id, to_email, payload)
      values ('restore_requested:' || p_game_id::text || ':' || v_uid::text || ':' || r.id::text, 'restore_requested', r.id, r.email,
              jsonb_build_object('adminName', r.name, 'requesterName', v_name, 'gameLabel', v_label,
                                 'deletedAt', v_game.deleted_at, 'purgeAt', v_game.deleted_at + public.deleted_game_retention(),
                                 'deletedByName', (select coalesce(nullif(d.display_name, ''), 'Rummy Player') from public.profiles d where d.id = v_game.deleted_by)))
      on conflict (event_key) do nothing;
    end if;
  end loop;

  return jsonb_build_object('requested', true, 'already', false, 'requestedAt', v_now);
end;
$$;

alter table public.email_outbox drop constraint if exists email_outbox_kind_check;
alter table public.email_outbox add constraint email_outbox_kind_check
  check (kind in ('game_started', 'result_saved', 'link_request', 'restore_requested'));

-- ---------- G. restore clears the asks; Settings shows the purge date ----------
-- 023 body plus the restore_requests delete.
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
  -- Results it was removed from stay as they are: say which, so the app can tell the user.
  select coalesce(jsonb_agg(jsonb_build_object('resultId', grg.result_id, 'declaredAt', r.declared_at) order by r.declared_at), '[]'::jsonb)
    into v_removed
  from public.game_result_games grg join public.game_results r on r.id = grg.result_id
  where grg.game_id = p_game_id and grg.removed_at is not null and r.deleted_at is null;
  return jsonb_build_object('restored', true, 'removedFromResults', v_removed);
end;
$$;

-- 028 body plus purgeAt and requestCount on deletedGames.
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

-- ---------- H. the purge (Q20.1) ----------
-- Not callable by the app. Returns how many games were erased.
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
      -- Settle (behind a flag) keeps its own hold on a game; never fail the whole run on one
      and not exists (select 1 from public.prize_session_games psg where psg.game_id = g.id)
    order by g.deleted_at
  loop
    v_label := coalesce(public.game_label_text(r.game_label, r.game_number), r.share_code);

    -- results it was removed from: bake the recomputed standings in, so the cascade changes nothing visible
    update public.game_results res
       set places = public.result_places_json(res.id)
     where res.id in (select grg.result_id from public.game_result_games grg where grg.game_id = r.id and grg.removed_at is not null);

    -- the history line survives: rows move from game_id to purged_game_id, then one game_purged row
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

-- nightly at 03:15 UTC when pg_cron is on (Supabase: Database › Extensions › pg_cron). Without it, run
-- `select public.purge_deleted_games();` from a dashboard cron or by hand.
do $$
begin
  -- cron.* is resolved at run time: the schema is absent without pg_cron
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $q$ select cron.unschedule(jobid) from cron.job where jobname = 'purge-deleted-games' $q$;
    execute $q$ select cron.schedule('purge-deleted-games', '15 3 * * *', 'select public.purge_deleted_games();') $q$;
  end if;
end $$;

-- ---------- grants ----------
do $$
declare f text;
begin
  foreach f in array array[
    'can_read_game(uuid)', 'get_game_bundle(uuid)', 'get_home_bundle(integer)', 'request_restore(uuid)',
    'restore_game(uuid)', 'list_hidden_and_deleted()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

comment on function public.request_restore(uuid) is '045: a scored player asks the creator and admins to restore a deleted game. One ask per person per game.';
comment on function public.purge_deleted_games() is '045: erases games deleted more than deleted_game_retention() ago that no live result holds. Log rows survive as purged_game_id.';

notify pgrst, 'reload schema';

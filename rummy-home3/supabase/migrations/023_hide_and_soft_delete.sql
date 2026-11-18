-- 023: hide and soft delete (Sree, Nov 11 10:59 PM PT, item 1). Apply after 022. Safe to re-run.
-- Rollback: rollback_023_hide_and_soft_delete.sql.
--
-- A. Hide: a per-user list (hidden_games). Hiding takes a game off that user's Home and
--    nothing else: it still counts in stats, still shows in Results pickers, still opens.
-- B. Delete game (creator or game admin): games.deleted_at / deleted_by. Gone for everyone:
--    Home, pickers, bundles, the live share page, stats (games_together is decremented for
--    the creator's My players), declare. A deleted game that sits in a saved result is also
--    removed from that result (game_result_games.removed_at); the result's standings are
--    recomputed from the games that remain (result_places_json). The app warns first.
-- C. Delete result (declarer, or an admin of every game in it): game_results.deleted_at /
--    deleted_by. Its games are uncounted again (closed_at cleared unless another live
--    result still holds them) and can go into a new result.
-- D. Restore (the deleter, or an admin of that game / result): clears deleted_at. Restoring
--    a game never re-adds it to a result it was removed from; restore_game reports those
--    results so the app can say so.
-- E. list_hidden_and_deleted(): the three lists for Settings > Hidden & deleted.
-- F. Every reader excludes deleted rows: the games read policy, list_visible_game_ids,
--    visible_games (+ p_include_hidden), get_home_bundle (hidden too), list_result_candidates,
--    get_game_bundle (returns {deleted:true,...}), can_read_game, public_scorecard
--    ({deleted:true}), list_new_game_candidates stats, can_see_game_result, get_game_result
--    ({deleted:true,...}), list_game_results_page, reused_game_ids, declare_game_result.

-- ---------- A/B/C. columns and the hidden list ----------
alter table public.games
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;
alter table public.game_results
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;
alter table public.game_result_games
  add column if not exists removed_at timestamptz;

create index if not exists games_deleted_at_idx on public.games (deleted_by) where deleted_at is not null;
create index if not exists game_results_deleted_at_idx on public.game_results (deleted_by) where deleted_at is not null;

create table if not exists public.hidden_games (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (owner_id, game_id)
);
alter table public.hidden_games enable row level security;
drop policy if exists "owners read hidden games" on public.hidden_games;
create policy "owners read hidden games" on public.hidden_games for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.hidden_games from public, anon;
grant select on public.hidden_games to authenticated;

-- ---------- helpers ----------
-- Creator, game admin, or app admin: who may delete or restore a game.
create or replace function public.can_manage_game(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    public.is_app_admin()
    or exists (select 1 from public.games g where g.id = p_game_id and g.created_by = auth.uid())
    or exists (select 1 from public.game_players gp where gp.game_id = p_game_id and gp.profile_id = auth.uid() and gp.role = 'game_admin' and gp.is_active)
  );
$$;

-- Declarer, app admin, or an admin of every game in the result.
create or replace function public.can_manage_result(p_result_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    public.is_app_admin()
    or exists (select 1 from public.game_results r where r.id = p_result_id and r.declared_by = auth.uid())
    or (
      exists (select 1 from public.game_result_games g where g.result_id = p_result_id)
      and not exists (
        select 1 from public.game_result_games g
        where g.result_id = p_result_id and not public.can_manage_game(g.game_id)
      )
    )
  );
$$;

-- The result's places with removed games taken out: standings and players are recomputed
-- from the per-game scores that remain (same rule as declare_game_result: rank by points,
-- ties share a place). Unchanged results return their stored places as they are.
create or replace function public.result_places_json(p_result_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with r as (select * from public.game_results where id = p_result_id),
  removed as (
    select g.game_id::text as id from public.game_result_games g where g.result_id = p_result_id and g.removed_at is not null
  ),
  kept_games as (
    select t.e, t.ord from r, jsonb_array_elements(coalesce(r.places->'games', '[]'::jsonb)) with ordinality t(e, ord)
    where not exists (select 1 from removed x where x.id = t.e->>'id')
  ),
  per_player as (
    select k.key as id, sum((k.value)::int)::int as points, count(*)::int as games
    from kept_games kg, jsonb_each_text(coalesce(kg.e->'scores', '{}'::jsonb)) k
    group by k.key
  ),
  named as (
    select pp.id, coalesce(p->>'name', 'Player') as name, pp.points, pp.games
    from per_player pp
    left join lateral (select e as p from r, jsonb_array_elements(coalesce(r.places->'players', '[]'::jsonb)) e where e->>'id' = pp.id limit 1) n on true
  ),
  ranked as (select *, rank() over (order by points desc)::int as place from named)
  select case
    when not exists (select 1 from removed) then (select places from r)
    else jsonb_build_object(
      'standings', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'points', points, 'games', games, 'place', place) order by place, name) from ranked), '[]'::jsonb),
      'players', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by place, name) from ranked), '[]'::jsonb),
      'games', coalesce((select jsonb_agg(e order by ord) from kept_games), '[]'::jsonb)
    )
  end;
$$;

-- Keep closed_at honest: set when a live result (not removed) holds the game, else null.
create or replace function public.sync_closed_at(p_game_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.games g
  set closed_at = (
    select min(r.declared_at)
    from public.game_result_games grg
    join public.game_results r on r.id = grg.result_id
    where grg.game_id = g.id and grg.removed_at is null and r.deleted_at is null
  )
  where g.id = any(p_game_ids);
$$;

-- The creator's my_players counters follow the game: -1 on delete, +1 on restore.
create or replace function public.adjust_games_together(p_game_id uuid, p_delta integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.my_players m
  set games_together = greatest(0, m.games_together + p_delta)
  from public.games g
  join public.game_players gp on gp.game_id = g.id
  where g.id = p_game_id
    and m.owner_id = g.created_by
    and m.player_id = gp.profile_id
    and gp.profile_id <> g.created_by
    and gp.is_active and gp.role <> 'spectator' and coalesce(gp.seated, true);
$$;

-- ---------- A. hide / unhide ----------
create or replace function public.hide_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not public.can_read_game(p_game_id) then raise exception 'This game is not available.'; end if;
  insert into public.hidden_games (owner_id, game_id) values (auth.uid(), p_game_id)
  on conflict (owner_id, game_id) do nothing;
end;
$$;

create or replace function public.unhide_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  delete from public.hidden_games where owner_id = auth.uid() and game_id = p_game_id;
end;
$$;

-- ---------- B. delete / restore a game ----------
-- Live results that hold this game, for the app's warning before Delete game.
create or replace function public.results_holding_game(p_game_id uuid)
returns table (result_id uuid, declared_at timestamptz, result_no integer)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.declared_at,
         (select count(*)::int from public.game_results x where x.declared_by = r.declared_by and x.deleted_at is null and x.declared_at <= r.declared_at) as result_no
  from public.game_result_games grg
  join public.game_results r on r.id = grg.result_id
  where grg.game_id = p_game_id and grg.removed_at is null and r.deleted_at is null
    and public.can_read_game(p_game_id)
  order by r.declared_at;
$$;

create or replace function public.delete_game(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_removed uuid[];
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not exists (select 1 from public.games g where g.id = p_game_id) then raise exception 'This game is not available.'; end if;
  if not public.can_manage_game(p_game_id) then raise exception 'Only the creator or a game admin can delete this game.'; end if;
  if exists (select 1 from public.games g where g.id = p_game_id and g.deleted_at is not null) then
    return jsonb_build_object('deleted', true, 'removedFromResults', '[]'::jsonb);
  end if;

  perform pg_advisory_xact_lock(hashtext('game:' || p_game_id::text));
  update public.game_result_games grg
  set removed_at = now()
  from public.game_results r
  where grg.game_id = p_game_id and grg.removed_at is null and r.id = grg.result_id and r.deleted_at is null;
  select coalesce(array_agg(grg.result_id), '{}'::uuid[]) into v_removed
  from public.game_result_games grg where grg.game_id = p_game_id and grg.removed_at is not null;

  update public.games set deleted_at = now(), deleted_by = auth.uid() where id = p_game_id;
  perform public.sync_closed_at(array[p_game_id]);
  perform public.adjust_games_together(p_game_id, -1);
  return jsonb_build_object('deleted', true, 'removedFromResults', to_jsonb(v_removed));
end;
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
  perform public.adjust_games_together(p_game_id, 1);
  -- Results it was removed from stay as they are: say which, so the app can tell the user.
  select coalesce(jsonb_agg(jsonb_build_object('resultId', grg.result_id, 'declaredAt', r.declared_at) order by r.declared_at), '[]'::jsonb)
    into v_removed
  from public.game_result_games grg join public.game_results r on r.id = grg.result_id
  where grg.game_id = p_game_id and grg.removed_at is not null and r.deleted_at is null;
  return jsonb_build_object('restored', true, 'removedFromResults', v_removed);
end;
$$;

-- ---------- C. delete / restore a result ----------
create or replace function public.delete_result(p_result_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_games uuid[];
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not exists (select 1 from public.game_results r where r.id = p_result_id) then raise exception 'This result is not available.'; end if;
  if not public.can_manage_result(p_result_id) then raise exception 'Only the person who saved this result or an admin of its games can delete it.'; end if;
  update public.game_results set deleted_at = now(), deleted_by = auth.uid() where id = p_result_id and deleted_at is null;
  select coalesce(array_agg(game_id), '{}'::uuid[]) into v_games from public.game_result_games where result_id = p_result_id;
  perform public.sync_closed_at(v_games);
  return jsonb_build_object('deleted', true, 'gameIds', to_jsonb(v_games));
end;
$$;

create or replace function public.restore_result(p_result_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_r public.game_results; v_games uuid[];
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into v_r from public.game_results r where r.id = p_result_id;
  if v_r.id is null then raise exception 'This result is not available.'; end if;
  if v_r.deleted_at is not null and not (v_r.deleted_by = auth.uid() or public.can_manage_result(p_result_id)) then
    raise exception 'Only the person who deleted this result or an admin of its games can restore it.';
  end if;
  update public.game_results set deleted_at = null, deleted_by = null where id = p_result_id;
  select coalesce(array_agg(game_id), '{}'::uuid[]) into v_games from public.game_result_games where result_id = p_result_id;
  perform public.sync_closed_at(v_games);
  return jsonb_build_object('restored', true, 'gameIds', to_jsonb(v_games));
end;
$$;

-- ---------- E. Settings > Hidden & deleted ----------
create or replace function public.list_hidden_and_deleted()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'hidden', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'gameNumber', g.game_number, 'createdAt', g.created_at, 'status', g.status,
                                          'creatorName', coalesce(nullif(p.display_name, ''), 'Rummy Player'), 'hiddenAt', h.hidden_at,
                                          'playerCount', (select count(*) from public.game_players gp where gp.game_id = g.id and gp.is_active and gp.role <> 'spectator' and coalesce(gp.seated, true)))
                       order by h.hidden_at desc)
      from public.hidden_games h join public.games g on g.id = h.game_id left join public.profiles p on p.id = g.created_by
      where h.owner_id = auth.uid() and g.deleted_at is null
    ), '[]'::jsonb),
    'deletedGames', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'gameNumber', g.game_number, 'createdAt', g.created_at, 'status', g.status,
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
$$;

-- ---------- F. readers exclude deleted (and Home excludes hidden) ----------
drop policy if exists "members read games" on public.games;
create policy "members read games"
on public.games for select
to authenticated
using (
  deleted_at is null and (
    (select public.is_app_admin())
    or created_by = (select auth.uid())
    or (select public.is_game_member(games.id))
    or spectator_access = true
  )
);

create or replace function public.list_visible_game_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select g.id
  from public.games g
  where auth.uid() is not null and g.deleted_at is null
    and g.created_by = auth.uid()
  union
  select gp.game_id
  from public.game_players gp
  join public.games g on g.id = gp.game_id
  where auth.uid() is not null and g.deleted_at is null
    and gp.profile_id = auth.uid()
    and gp.is_active = true
  union
  select gp.game_id
  from public.game_players gp
  join public.games g on g.id = gp.game_id
  join public.profiles p on p.id = gp.profile_id
  where auth.uid() is not null and g.deleted_at is null
    and gp.is_active = true
    and p.email is not null
    and lower(p.email) = lower(auth.jwt() ->> 'email');
$$;

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

drop function if exists public.visible_games(integer);
create or replace function public.visible_games(p_limit integer default 50, p_include_hidden boolean default true)
returns table (game public.games, member boolean)
language sql
stable
security definer
set search_path = public
as $$
  select g, (g.created_by = auth.uid() or exists (
             select 1 from public.game_players gp where gp.game_id = g.id and gp.profile_id = auth.uid() and gp.is_active)) as member
  from public.games g
  where auth.uid() is not null
    and g.deleted_at is null
    and g.id in (select public.list_visible_game_ids())
    and (public.is_app_admin() or g.created_by = auth.uid() or public.is_game_member(g.id) or g.spectator_access = true)
    and (p_include_hidden or not exists (select 1 from public.hidden_games h where h.owner_id = auth.uid() and h.game_id = g.id))
  order by g.created_at desc, g.id desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

-- 020 body; Home leaves out the caller's hidden games and carries the count so Settings can say "3 hidden".
create or replace function public.get_home_bundle(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
set jit = off
as $$
declare
  v_admin boolean;
  v_games jsonb;
  v_notices jsonb;
  v_claims jsonb;
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

  select coalesce(jsonb_agg(jsonb_build_object('player_id', n.player_id, 'text', n.text)), '[]'::jsonb)
    into v_notices
  from public.take_creator_notices() n;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.invited_at), '[]'::jsonb)
    into v_claims
  from public.list_claim_requests() c;

  select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
    into v_roster
  from public.list_my_players() m;

  return jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'games', v_games,
    'notices', v_notices,
    'claim_requests', v_claims,
    'my_players', v_roster,
    'hidden_count', (select count(*) from public.hidden_games h join public.games g on g.id = h.game_id where h.owner_id = auth.uid() and g.deleted_at is null)
  );
end;
$$;

-- 020 body: a deleted game answers {deleted:true} (with what the app needs to say so), not the game.
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
      'game', jsonb_build_object('id', v_game.id, 'game_number', v_game.game_number, 'deleted_at', v_game.deleted_at,
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

  return jsonb_build_object(
    'game', to_jsonb(v_game),
    'game_players', v_seats,
    'scores', v_scores
  );
end;
$$;

-- 006 body plus the deleted answer.
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
    'startedAt', g.created_at,
    'gameType', g.game_type,
    'status', g.status,
    'currentRound', g.current_round,
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

-- 020 body: deleted games leave the stats.
create or replace function public.list_new_game_candidates(p_limit integer default 100)
returns table (id uuid, display_name text, player_code text, player_status text, total_games integer, last_played_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with my_games as (
    select g.id, g.created_at
    from public.games g
    where g.created_by = auth.uid() and g.deleted_at is null
    union
    select g.id, g.created_at
    from public.game_players a
    join public.games g on g.id = a.game_id
    where a.profile_id = auth.uid()
      and a.role = 'game_admin'
      and g.deleted_at is null
  ),
  stats as (
    select gp.profile_id, count(*)::int as total_games, max(mg.created_at) as last_played_at
    from my_games mg join public.game_players gp on gp.game_id = mg.id
    where gp.profile_id <> auth.uid() and gp.role <> 'spectator' and coalesce(gp.seated, true)
    group by gp.profile_id
  ),
  everyone as (
    select s.profile_id, s.total_games, s.last_played_at from stats s
    union all
    select m.player_id, 0, null from public.my_players m
    where m.owner_id = auth.uid() and not exists (select 1 from stats s where s.profile_id = m.player_id)
  )
  select p.id, coalesce(nullif(p.display_name, ''), 'Rummy Player'), public.player_label(p), p.player_status, e.total_games, e.last_played_at
  from everyone e join public.profiles p on p.id = e.profile_id
  where coalesce(p.player_status, 'registered') not in ('deleted_before_registering','deleted_after_registering','merged')
  order by (e.last_played_at >= now() - interval '14 days') desc nulls last, e.total_games desc, e.last_played_at desc nulls last, p.display_name
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$$;

-- 013 body plus deleted_at.
create or replace function public.can_see_game_result(p_result_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (select 1 from public.game_results r where r.id = p_result_id and r.deleted_at is null)
    and (
      public.is_app_admin()
      or exists (select 1 from public.game_results r where r.id = p_result_id and r.declared_by = auth.uid())
      or exists (
        select 1 from public.game_result_games grg
        where grg.result_id = p_result_id and public.is_game_member(grg.game_id)
      )
      or exists (
        select 1 from public.game_result_games grg
        join public.games g on g.id = grg.game_id
        where grg.result_id = p_result_id and g.created_by = auth.uid()
      )
    );
$$;

-- 018 body: deleted results and removed games do not make a game "reused".
create or replace function public.reused_game_ids(p_result_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_agg(g.game_id order by g.game_id)
    from public.game_result_games g
    join public.game_results r on r.id = g.result_id
    where g.result_id = p_result_id and g.removed_at is null
      and exists (
        select 1
        from public.game_result_games earlier
        join public.game_results er on er.id = earlier.result_id
        where earlier.game_id = g.game_id
          and earlier.result_id <> g.result_id
          and earlier.removed_at is null
          and er.deleted_at is null
          and er.declared_at < r.declared_at
      )
  ), '[]'::jsonb);
$$;

-- 020 body over result_places_json; a deleted result the caller could otherwise see answers
-- {deleted:true,...} so the app can say "This result was deleted".
create or replace function public.get_game_result(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
set jit = off
as $$
  select case
    when auth.uid() is null then null
    when exists (select 1 from public.game_results r where r.id = p_id and r.deleted_at is not null)
         and (public.is_app_admin()
              or exists (select 1 from public.game_results r where r.id = p_id and (r.declared_by = auth.uid() or r.deleted_by = auth.uid()))
              or exists (select 1 from public.game_result_games grg where grg.result_id = p_id and public.is_game_member(grg.game_id))
              or exists (select 1 from public.game_result_games grg join public.games g on g.id = grg.game_id where grg.result_id = p_id and g.created_by = auth.uid()))
      then (select jsonb_build_object('id', r.id, 'deleted', true, 'deletedAt', r.deleted_at, 'declaredAt', r.declared_at,
                                      'canRestore', r.deleted_by = auth.uid() or public.can_manage_result(r.id))
            from public.game_results r where r.id = p_id)
    when not public.can_see_game_result(p_id) then null
    else (
      select jsonb_build_object(
        'id', r.id,
        'declaredAt', r.declared_at,
        'declaredBy', r.declared_by,
        'gameIds', coalesce((
          select jsonb_agg(g.game_id)
          from public.game_result_games g
          where g.result_id = r.id and g.removed_at is null
        ), '[]'::jsonb),
        'removedGameIds', coalesce((
          select jsonb_agg(g.game_id)
          from public.game_result_games g
          where g.result_id = r.id and g.removed_at is not null
        ), '[]'::jsonb),
        'reusedGameIds', public.reused_game_ids(r.id),
        'canManage', public.can_manage_result(r.id),
        'standings', coalesce(pl->'standings', '[]'::jsonb),
        'sheet', jsonb_build_object(
          'players', coalesce((
            select jsonb_agg(
              e || jsonb_build_object('playerNo', pr.public_player_no)
              order by t.ord)
            from jsonb_array_elements(coalesce(pl->'players', '[]'::jsonb)) with ordinality as t(e, ord)
            left join public.profiles pr on pr.id::text = t.e->>'id'
          ), '[]'::jsonb),
          'games', coalesce((
            select jsonb_agg(
              e
              || case when g.game_number is not null then jsonb_build_object('label', 'G' || g.game_number::text) else '{}'::jsonb end
              || case when g.id is not null and public.can_read_game(g.id)
                      then jsonb_build_object('rounds', public.game_rounds_json(g.id, e->'scores'))
                      else '{}'::jsonb end
              order by t.ord)
            from jsonb_array_elements(coalesce(pl->'games', '[]'::jsonb)) with ordinality as t(e, ord)
            left join public.games g on g.id::text = t.e->>'id'
          ), '[]'::jsonb)
        )
      )
      from public.game_results r, lateral (select public.result_places_json(r.id) as pl) x
      where r.id = p_id
    )
  end;
$$;

-- 020 body: deleted results are not listed; standings come from result_places_json.
create or replace function public.list_game_results_page(p_limit integer default 5, p_offset integer default 0)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then '[]'::jsonb
    else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'declaredAt', r.declared_at,
        'gameCount', (select count(*) from public.game_result_games g where g.result_id = r.id and g.removed_at is null),
        'reusedGameIds', public.reused_game_ids(r.id),
        'playerCount', jsonb_array_length(coalesce(r.pl->'standings', '[]'::jsonb)),
        'top', coalesce((
          select jsonb_agg(jsonb_build_object(
            'name', p->>'name',
            'points', (p->>'points')::integer,
            'place', (p->>'place')::integer
          ) order by (p->>'place')::integer, p->>'name')
          from jsonb_array_elements(coalesce(r.pl->'standings', '[]'::jsonb)) p
          where (p->>'place')::integer <= 3
        ), '[]'::jsonb),
        'firstNames', coalesce((
          select jsonb_agg(p->>'name' order by p->>'name')
          from jsonb_array_elements(coalesce(r.pl->'standings', '[]'::jsonb)) p
          where (p->>'place')::integer = 1
        ), '[]'::jsonb)
      ) order by r.declared_at desc)
      from (
        select gr.*, public.result_places_json(gr.id) as pl
        from public.game_results gr
        where gr.deleted_at is null
          and (public.is_app_admin()
           or gr.id in (
             select mine.id from public.game_results mine where mine.declared_by = auth.uid()
             union
             select grg.result_id
             from public.game_result_games grg
             join public.game_players gp on gp.game_id = grg.game_id
             where gp.profile_id = auth.uid() and gp.is_active = true
             union
             select grg.result_id
             from public.game_result_games grg
             join public.games g on g.id = grg.game_id
             where g.created_by = auth.uid()
           ))
        order by gr.declared_at desc
        limit greatest(1, least(coalesce(p_limit, 5), 50))
        offset greatest(0, coalesce(p_offset, 0))
      ) r
    ), '[]'::jsonb)
  end;
$$;

-- 009 body with one more guard: a deleted game cannot be declared.
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

  if exists (
    select 1
    from unnest(distinct_ids) as target(id)
    where not public.is_game_admin(target.id)
  ) then
    raise exception 'Only an admin of every selected game can declare results';
  end if;

  with seated as (
    select gp.game_id, gp.profile_id
    from public.game_players gp
    where gp.game_id = any(distinct_ids)
      and gp.is_active
      and gp.role <> 'spectator'
      and gp.seated
  )
  select count(distinct profile_id)::integer
  into player_count
  from seated;

  if coalesce(player_count, 0) > 50 then
    raise exception 'Results can include at most 50 players';
  end if;

  with seated as (
    select gp.game_id, gp.profile_id, pr.display_name as name
    from public.game_players gp
    join public.profiles pr on pr.id = gp.profile_id
    where gp.game_id = any(distinct_ids)
      and gp.is_active
      and gp.role <> 'spectator'
      and gp.seated
  ),
  points as (
    select s.game_id, s.profile_id, sum(s.value)::integer as points
    from public.scores s
    join public.rounds r on r.id = s.round_id and r.undone_at is null
    where s.game_id = any(distinct_ids)
      and s.profile_id is not null
    group by s.game_id, s.profile_id
  ),
  totals as (
    select
      seated.profile_id,
      max(seated.name) as name,
      coalesce(sum(points.points), 0)::integer as points,
      count(distinct seated.game_id)::integer as games
    from seated
    left join points
      on points.game_id = seated.game_id
     and points.profile_id = seated.profile_id
    group by seated.profile_id
  ),
  ranked as (
    select
      profile_id,
      name,
      points,
      games,
      rank() over (order by points desc)::integer as place
    from totals
  ),
  per_game as (
    select
      g.id,
      g.created_at,
      coalesce(nullif(g.share_code, ''), upper(right(g.id::text, 6))) as name,
      coalesce((
        select jsonb_object_agg(x.profile_id::text, x.points)
        from (
          select s.profile_id, coalesce(max(p.points), 0)::integer as points
          from seated s
          left join points p
            on p.game_id = s.game_id
           and p.profile_id = s.profile_id
          where s.game_id = g.id
          group by s.profile_id
        ) x
      ), '{}'::jsonb) as scores
    from public.games g
    where g.id = any(distinct_ids)
  )
  select jsonb_build_object(
    'standings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', profile_id,
        'name', name,
        'points', points,
        'games', games,
        'place', place
      ) order by place, name)
      from ranked
    ), '[]'::jsonb),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object('id', profile_id, 'name', name) order by place, name)
      from ranked
    ), '[]'::jsonb),
    'games', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'date', created_at,
        'scores', scores
      ) order by created_at, name)
      from per_game
    ), '[]'::jsonb)
  )
  into places
  from (select 1) as anchor;

  declared_ts := now();

  insert into public.game_results (declared_by, declared_at, places)
  values (auth.uid(), declared_ts, places)
  returning id into new_id;

  foreach gid in array distinct_ids loop
    insert into public.game_result_games (result_id, game_id)
    values (new_id, gid);
  end loop;

  perform public.close_games_in_result(distinct_ids, declared_ts);

  return public.get_game_result(new_id);
end;
$$;

-- ---------- grants ----------
do $$
declare f text;
begin
  foreach f in array array[
    'can_manage_game(uuid)', 'can_manage_result(uuid)', 'result_places_json(uuid)',
    'hide_game(uuid)', 'unhide_game(uuid)', 'results_holding_game(uuid)', 'delete_game(uuid)', 'restore_game(uuid)',
    'delete_result(uuid)', 'restore_result(uuid)', 'list_hidden_and_deleted()',
    'list_visible_game_ids()', 'can_read_game(uuid)', 'visible_games(integer,boolean)', 'get_home_bundle(integer)',
    'get_game_bundle(uuid)', 'list_new_game_candidates(integer)', 'can_see_game_result(uuid)', 'reused_game_ids(uuid)',
    'get_game_result(uuid)', 'list_game_results_page(integer,integer)', 'declare_game_result(uuid[])'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- internal only
  revoke all on function public.sync_closed_at(uuid[]) from public, anon, authenticated;
  revoke all on function public.adjust_games_together(uuid, integer) from public, anon, authenticated;
  -- the live share page runs as anon
  revoke all on function public.public_scorecard(text) from public;
  grant execute on function public.public_scorecard(text) to anon, authenticated;
end $$;

comment on column public.games.deleted_at is '023: soft delete by the creator or a game admin. Gone for everyone until restored.';
comment on column public.game_results.deleted_at is '023: soft delete by the declarer or an admin of its games. Its games are uncounted again.';
comment on column public.game_result_games.removed_at is '023: the game was deleted while in this result; the result is recomputed without it and the game is never re-added by a restore.';
comment on table public.hidden_games is '023: games a user hid from their own Home. Nothing else changes.';

notify pgrst, 'reload schema';

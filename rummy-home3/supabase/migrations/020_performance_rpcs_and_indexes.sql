-- 020: performance. Apply after 017, 018 and 019. Safe to re-run.
-- Rollback: rollback_020_performance_rpcs_and_indexes.sql.
--
-- Measured on a 2 000-user / 30 000-game copy (docs/performance/README.md): every Home
-- focus spent ~0.5 s of database time in list_visible_game_ids() alone, New game ~0.3 s in
-- list_new_game_candidates(), Results ~0.2 s in list_game_results_page(). All three walked
-- every game or every result in the database. This file:
--
-- A. Indexes the lookups the app makes that had no index (results by declarer, pending
--    claim requests and unread notices by owner, profiles by lower(email)).
-- B. Rewrites the three RPCs as index-driven unions. Same names, same arguments, same
--    return types, same rows: who sees what does not change. The email-match branch of
--    list_visible_game_ids (a seat linked to the signed-in email but not yet to the account)
--    is kept.
-- C. Re-creates the games / game_players / rounds / scores policies with the helper calls
--    wrapped in (select ...). Postgres then evaluates is_app_admin() once per statement
--    instead of once per row. Policy names and conditions are unchanged.
-- D. Three bundle RPCs so a screen loads in one round-trip instead of four to fifty:
--      get_game_bundle(game_id)      scorecard: game row + seats + live scores
--      get_home_bundle(limit)        Home: own profile + visible games with seats + notices
--                                    + claim requests + My players roster
--      list_result_candidates(limit) Results picker: visible games + seats + per-player totals
--    and get_game_result now embeds each game's per-round values (sheet.games[].rounds) for
--    viewers who may read that game, so the results page no longer re-reads every game.
--
-- Privacy. Every bundle is SECURITY DEFINER and applies the same rules as the row policies
-- it replaces: a game is included only when the "members read games" policy would show it;
-- its seats and scores only when "members read game players" / "members read scores"
-- would; a seat's profile fields only when can_see_profile() (011) allows, and then only
-- the columns 019 grants to signed-in users (never email, phone or zip_code). The only
-- contact data a bundle carries is the caller's own profile row, exactly what my_profile
-- returns. The 019 role lock and column grants are not touched.
--
-- The app keeps working on a database without this file: every new RPC has a client
-- fallback to the previous request sequence.

-- ---------------------------------------------------------------------------
-- A. Missing indexes
-- ---------------------------------------------------------------------------
create index if not exists game_results_declared_by_idx on public.game_results (declared_by);
create index if not exists player_links_owner_pending_idx on public.player_links (owner_id) where status = 'pending';
create index if not exists creator_notices_owner_open_idx on public.creator_notices (owner_id) where read_at is null;
-- list_visible_game_ids matches seats by lower(email); 011's unique key is on lower(btrim(email))
-- and excludes guest profiles, so it cannot serve the exact predicate the function uses.
create index if not exists profiles_email_lower_idx on public.profiles (lower(email)) where email is not null;

-- ---------------------------------------------------------------------------
-- B. Index-driven rewrites of the three visibility RPCs (same signatures)
-- ---------------------------------------------------------------------------

-- Games the signed-in account should see: creator, active seat, or a seat whose profile
-- carries the signed-in email (006 semantics). Three index scans instead of a scan of games.
create or replace function public.list_visible_game_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select g.id
  from public.games g
  where auth.uid() is not null
    and g.created_by = auth.uid()
  union
  select gp.game_id
  from public.game_players gp
  where auth.uid() is not null
    and gp.profile_id = auth.uid()
    and gp.is_active = true
  union
  select gp.game_id
  from public.game_players gp
  join public.profiles p on p.id = gp.profile_id
  where auth.uid() is not null
    and gp.is_active = true
    and p.email is not null
    and lower(p.email) = lower(auth.jwt() ->> 'email');
$$;

-- 012 body with my_games as a union of two indexed branches instead of "created_by = me OR
-- exists(...)" over every game.
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
    where g.created_by = auth.uid()
    union
    select g.id, g.created_at
    from public.game_players a
    join public.games g on g.id = a.game_id
    where a.profile_id = auth.uid()
      and a.role = 'game_admin'
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

-- Results the caller may see, found from the caller's side (declared by me, a game I am
-- seated in, a game I created, or everything for an app admin) instead of testing every
-- result with can_see_game_result(). Same rule as 013; same page shape as 018.
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
        'gameCount', (select count(*) from public.game_result_games g where g.result_id = r.id),
        'reusedGameIds', public.reused_game_ids(r.id),
        'playerCount', jsonb_array_length(coalesce(r.places->'standings', '[]'::jsonb)),
        'top', coalesce((
          select jsonb_agg(jsonb_build_object(
            'name', p->>'name',
            'points', (p->>'points')::integer,
            'place', (p->>'place')::integer
          ) order by (p->>'place')::integer, p->>'name')
          from jsonb_array_elements(coalesce(r.places->'standings', '[]'::jsonb)) p
          where (p->>'place')::integer <= 3
        ), '[]'::jsonb),
        'firstNames', coalesce((
          select jsonb_agg(p->>'name' order by p->>'name')
          from jsonb_array_elements(coalesce(r.places->'standings', '[]'::jsonb)) p
          where (p->>'place')::integer = 1
        ), '[]'::jsonb)
      ) order by r.declared_at desc)
      from (
        select *
        from public.game_results gr
        where public.is_app_admin()
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
           )
        order by gr.declared_at desc
        limit greatest(1, least(coalesce(p_limit, 5), 50))
        offset greatest(0, coalesce(p_offset, 0))
      ) r
    ), '[]'::jsonb)
  end;
$$;

revoke all on function public.list_visible_game_ids() from public, anon;
revoke all on function public.list_new_game_candidates(integer) from public, anon;
revoke all on function public.list_game_results_page(integer, integer) from public, anon;
grant execute on function public.list_visible_game_ids() to authenticated;
grant execute on function public.list_new_game_candidates(integer) to authenticated;
grant execute on function public.list_game_results_page(integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- C. Row policies: same conditions, helper calls wrapped in (select ...)
-- ---------------------------------------------------------------------------
drop policy if exists "members read games" on public.games;
create policy "members read games"
on public.games for select
to authenticated
using (
  (select public.is_app_admin())
  or created_by = (select auth.uid())
  or (select public.is_game_member(games.id))
  or spectator_access = true
);

drop policy if exists "members read game players" on public.game_players;
create policy "members read game players"
on public.game_players for select
to authenticated
using (
  (select public.is_app_admin())
  or (select public.is_game_member(game_players.game_id))
  or exists (
    select 1 from public.games
    where games.id = game_players.game_id
      and games.created_by = (select auth.uid())
  )
);

drop policy if exists "game admins manage game players" on public.game_players;
create policy "game admins manage game players"
on public.game_players for all
to authenticated
using (
  (select public.is_app_admin())
  or (select public.is_game_admin(game_players.game_id))
  or exists (
    select 1 from public.games
    where games.id = game_players.game_id
      and games.created_by = (select auth.uid())
  )
)
with check (
  (select public.is_app_admin())
  or (select public.is_game_admin(game_players.game_id))
  or exists (
    select 1 from public.games
    where games.id = game_players.game_id
      and games.created_by = (select auth.uid())
  )
);

drop policy if exists "members read rounds" on public.rounds;
create policy "members read rounds"
on public.rounds for select
to authenticated
using ((select public.is_app_admin()) or (select public.is_game_member(rounds.game_id)));

drop policy if exists "game admins insert rounds" on public.rounds;
create policy "game admins insert rounds"
on public.rounds for insert
to authenticated
with check ((select public.is_app_admin()) or (select public.is_game_admin(rounds.game_id)));

drop policy if exists "game admins update rounds" on public.rounds;
create policy "game admins update rounds"
on public.rounds for update
to authenticated
using ((select public.is_app_admin()) or (select public.is_game_admin(rounds.game_id)))
with check ((select public.is_app_admin()) or (select public.is_game_admin(rounds.game_id)));

drop policy if exists "members read scores" on public.scores;
create policy "members read scores"
on public.scores for select
to authenticated
using ((select public.is_app_admin()) or (select public.is_game_member(scores.game_id)));

drop policy if exists "game admins insert scores" on public.scores;
create policy "game admins insert scores"
on public.scores for insert
to authenticated
with check ((select public.is_app_admin()) or (select public.is_game_admin(scores.game_id)));

-- ---------------------------------------------------------------------------
-- D. Bundles
-- ---------------------------------------------------------------------------
-- The heavy bundles pin jit = off: their one-statement plans are costed far above
-- jit_above_cost, and compiling them took 130 ms of a 220 ms call on the bench copy
-- while the query itself ran in 30 ms. Supabase projects ship with JIT off already;
-- the setting makes the timing the same everywhere.

-- What "members read games" lets the caller see. Creator and active seat are inside
-- is_game_member (006).
create or replace function public.can_read_game(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.games g
    where g.id = p_game_id
      and (public.is_app_admin() or g.created_by = auth.uid() or public.is_game_member(g.id) or g.spectator_access = true)
  );
$$;

-- What "members read game players" / "members read rounds" / "members read scores" let the
-- caller see: a spectator_access viewer reads the game row but not its seats or scores.
create or replace function public.can_read_game_detail(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (public.is_app_admin() or public.is_game_member(p_game_id));
$$;

-- The profile columns signed-in users may read (019 grant list minus bookkeeping). Never
-- email, phone or zip_code. No visibility check: callers decide with can_see_profile().
create or replace function public.profile_fields_json(p public.profiles)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case
    when p.id is null then null
    else jsonb_build_object(
      'display_name', p.display_name,
      'player_code', p.player_code,
      'public_player_no', p.public_player_no,
      'player_status', p.player_status,
      'managed_by', p.managed_by,
      'first_name', p.first_name,
      'last_name', p.last_name
    )
  end;
$$;

-- profile_fields_json, or null when can_see_profile() (011) would hide the row.
create or replace function public.public_profile_json(p public.profiles)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p.id is null or not public.can_see_profile(p) then null
    else public.profile_fields_json(p)
  end;
$$;

-- Seat rows of the given games in the PostgREST shape the app already parses, one jsonb
-- array per game. Only games the caller may read in detail should be passed in; p_member
-- says whether the caller is creator/seat of each game (then every seat profile is visible
-- by can_see_profile's own rule, so the per-row check is skipped) or only an app admin
-- (then can_see_profile decides per seat, as the profiles policy would).
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
             'is_active', gp.is_active
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

-- Scorecard in one call. Null when the game does not exist or is not the caller's to see;
-- seats and scores [] when the caller may read the game row only (spectator_access).
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

-- The games the Home list and the Results picker show: list_visible_game_ids() filtered by
-- the games read policy, newest first. `member` is true when the caller is creator or an
-- active seat (so seats and scores are readable too), false for spectator_access-only rows.
drop function if exists public.visible_games(integer);
create or replace function public.visible_games(p_limit integer default 50)
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
    and g.id in (select public.list_visible_game_ids())
    and (public.is_app_admin() or g.created_by = auth.uid() or public.is_game_member(g.id) or g.spectator_access = true)
  order by g.created_at desc, g.id desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

-- Home in one call: own profile row (what my_profile returns), visible games with their
-- seat rows, unread creator notices (marked read, as take_creator_notices does), pending
-- claim requests and the My players roster. Null when not signed in.
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
    select (v.game).*, v.member from public.visible_games(p_limit) v
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
    'my_players', v_roster
  );
end;
$$;

-- Results picker in one call: each visible game with its seats (profile fields included)
-- and the per-player sum of live scores, newest first. Seats and totals are {} / [] for a
-- game the caller may read but not in detail.
create or replace function public.list_result_candidates(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set jit = off
as $$
declare
  v_admin boolean;
  v_out jsonb;
begin
  if auth.uid() is null then
    return '[]'::jsonb;
  end if;
  v_admin := public.is_app_admin();

  with vg as (
    select (v.game).*, v.member from public.visible_games(p_limit) v
  ),
  detail as (
    select vg.id, vg.member from vg where v_admin or vg.member
  ),
  seats as (
    select * from public.seat_rows_json(
      (select coalesce(array_agg(id), '{}'::uuid[]) from detail),
      (select coalesce(array_agg(id), '{}'::uuid[]) from detail where member),
      true)
  ),
  totals as (
    select x.game_id, jsonb_object_agg(x.profile_id::text, x.total) as totals
    from (
      -- rounds first (rounds_game_idx), then scores by round (scores_round_idx): with the
      -- join the other way round the planner picked a sequential scan of rounds.
      select r.game_id, s.profile_id, sum(s.value)::integer as total
      from public.rounds r
      join public.scores s on s.round_id = r.id
      where r.game_id in (select id from detail)
        and r.undone_at is null
        and s.profile_id is not null
        and s.score_type <> 'expense'
      group by r.game_id, s.profile_id
    ) x
    group by x.game_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'game', to_jsonb(vg) - 'member',
           'game_players', coalesce(s.seats, '[]'::jsonb),
           'totals', coalesce(t.totals, '{}'::jsonb)
         ) order by vg.created_at desc, vg.id desc), '[]'::jsonb)
    into v_out
  from vg
  left join seats s on s.game_id = vg.id
  left join totals t on t.game_id = vg.id;

  return v_out;
end;
$$;

-- Per-round values of one game for the results sheet: {profile id: [round 1, round 2, ...]}
-- with null where a player has no score in a live round. Only players named in p_scores
-- (the sheet's per-game totals object) are included. Null when the caller may not read the
-- game at all; arrays empty when they may read the game row but not its scores (the same
-- as getGame() returns under the row policies).
create or replace function public.game_rounds_json(p_game_id uuid, p_scores jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.can_read_game(p_game_id) then null
    else coalesce((
      select jsonb_object_agg(k.pid, coalesce(v.vals, '[]'::jsonb))
      from jsonb_object_keys(coalesce(p_scores, '{}'::jsonb)) k(pid)
      left join lateral (
        select jsonb_agg(sc.value order by rn.n) as vals
        from generate_series(1, (
          select max(r.round_number) from public.rounds r
          where r.game_id = p_game_id and r.undone_at is null
            and public.can_read_game_detail(p_game_id)
        )) rn(n)
        left join lateral (
          select s.value
          from public.scores s
          join public.rounds r on r.id = s.round_id
          where s.game_id = p_game_id
            and r.undone_at is null
            and r.round_number = rn.n
            and s.profile_id::text = k.pid
            and s.score_type <> 'expense'
          order by s.created_at desc
          limit 1
        ) sc on true
      ) v on true
      where k.pid <> 'EX'
    ), '{}'::jsonb)
  end;
$$;

-- 018 body plus sheet.games[].rounds (see game_rounds_json). Games the viewer may not read
-- keep totals only, exactly as before.
create or replace function public.get_game_result(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
set jit = off
as $$
  select case
    when auth.uid() is null or not public.can_see_game_result(p_id) then null
    else (
      select jsonb_build_object(
        'id', r.id,
        'declaredAt', r.declared_at,
        'declaredBy', r.declared_by,
        'gameIds', coalesce((
          select jsonb_agg(g.game_id)
          from public.game_result_games g
          where g.result_id = r.id
        ), '[]'::jsonb),
        'reusedGameIds', public.reused_game_ids(r.id),
        'standings', coalesce(r.places->'standings', '[]'::jsonb),
        'sheet', jsonb_build_object(
          'players', coalesce((
            select jsonb_agg(
              e || jsonb_build_object('playerNo', pr.public_player_no)
              order by t.ord)
            from jsonb_array_elements(coalesce(r.places->'players', '[]'::jsonb)) with ordinality as t(e, ord)
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
            from jsonb_array_elements(coalesce(r.places->'games', '[]'::jsonb)) with ordinality as t(e, ord)
            left join public.games g on g.id::text = t.e->>'id'
          ), '[]'::jsonb)
        )
      )
      from public.game_results r
      where r.id = p_id
    )
  end;
$$;

revoke all on function public.can_read_game(uuid) from public, anon;
revoke all on function public.can_read_game_detail(uuid) from public, anon;
revoke all on function public.profile_fields_json(public.profiles) from public, anon;
revoke all on function public.public_profile_json(public.profiles) from public, anon;
revoke all on function public.seat_rows_json(uuid[], uuid[], boolean) from public, anon;
revoke all on function public.game_rounds_json(uuid, jsonb) from public, anon;
revoke all on function public.visible_games(integer) from public, anon;
revoke all on function public.get_game_bundle(uuid) from public, anon;
revoke all on function public.get_home_bundle(integer) from public, anon;
revoke all on function public.list_result_candidates(integer) from public, anon;
revoke all on function public.get_game_result(uuid) from public, anon;
grant execute on function public.can_read_game(uuid) to authenticated;
grant execute on function public.can_read_game_detail(uuid) to authenticated;
grant execute on function public.profile_fields_json(public.profiles) to authenticated;
grant execute on function public.public_profile_json(public.profiles) to authenticated;
grant execute on function public.seat_rows_json(uuid[], uuid[], boolean) to authenticated;
grant execute on function public.game_rounds_json(uuid, jsonb) to authenticated;
grant execute on function public.visible_games(integer) to authenticated;
grant execute on function public.get_game_bundle(uuid) to authenticated;
grant execute on function public.get_home_bundle(integer) to authenticated;
grant execute on function public.list_result_candidates(integer) to authenticated;
grant execute on function public.get_game_result(uuid) to authenticated;

comment on function public.get_game_bundle(uuid) is
  'Scorecard in one call: {game, game_players[+profiles], scores[live rows]}. Null unless the games read policy would show the row; seats/scores [] unless the member policies would.';
comment on function public.get_home_bundle(integer) is
  'Home in one call: {profile (own row), games[+game_players], notices (consumed), claim_requests, my_players}. Null when not signed in.';
comment on function public.list_result_candidates(integer) is
  'Results picker in one call: [{game, game_players[+profiles], totals{profile id: sum of live scores}}], newest first.';

-- PostgREST picks up the new functions (hosted projects do this on DDL already; harmless elsewhere).
notify pgrst, 'reload schema';

-- ROLLBACK for 020_performance_rpcs_and_indexes.sql.
-- Puts back the 006 list_visible_game_ids, the 012 list_new_game_candidates, the 018
-- list_game_results_page and get_game_result bodies and the 002 row policies, and drops the
-- bundle RPCs, their helpers and the four indexes. No data was changed by 020, so nothing
-- else needs undoing. 019 (role lock, column grants, my_profile, save_round) is untouched.
--
-- App builds from Nov 11 on keep working: they try the bundle RPCs first and fall back to
-- the previous request sequence when a function is missing (PGRST202). Home, New game and
-- Results return to their pre-020 database cost.

-- ---------------------------------------------------------------------------
-- D. Bundles and helpers
-- ---------------------------------------------------------------------------
drop function if exists public.get_home_bundle(integer);
drop function if exists public.list_result_candidates(integer);
drop function if exists public.get_game_bundle(uuid);
drop function if exists public.visible_games(integer);
drop function if exists public.seat_rows_json(uuid[], uuid[], boolean);
drop function if exists public.public_profile_json(public.profiles);
drop function if exists public.profile_fields_json(public.profiles);
drop function if exists public.can_read_game_detail(uuid);

-- get_game_result: the 018 body (no sheet.games[].rounds).
create or replace function public.get_game_result(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
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
              case
                when g.game_number is not null then e || jsonb_build_object('label', 'G' || g.game_number::text)
                else e
              end
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

drop function if exists public.game_rounds_json(uuid, jsonb);
drop function if exists public.can_read_game(uuid);

revoke all on function public.get_game_result(uuid) from public, anon;
grant execute on function public.get_game_result(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- C. Row policies: the 002 text
-- ---------------------------------------------------------------------------
drop policy if exists "members read games" on public.games;
create policy "members read games"
on public.games for select
to authenticated
using (
  public.is_app_admin()
  or created_by = auth.uid()
  or public.is_game_member(id)
  or spectator_access = true
);

drop policy if exists "members read game players" on public.game_players;
create policy "members read game players"
on public.game_players for select
to authenticated
using (
  public.is_app_admin()
  or public.is_game_member(game_id)
  or exists (
    select 1 from public.games
    where games.id = game_players.game_id
      and games.created_by = auth.uid()
  )
);

drop policy if exists "game admins manage game players" on public.game_players;
create policy "game admins manage game players"
on public.game_players for all
to authenticated
using (
  public.is_app_admin()
  or public.is_game_admin(game_id)
  or exists (
    select 1 from public.games
    where games.id = game_players.game_id
      and games.created_by = auth.uid()
  )
)
with check (
  public.is_app_admin()
  or public.is_game_admin(game_id)
  or exists (
    select 1 from public.games
    where games.id = game_players.game_id
      and games.created_by = auth.uid()
  )
);

drop policy if exists "members read rounds" on public.rounds;
create policy "members read rounds"
on public.rounds for select
to authenticated
using (public.is_app_admin() or public.is_game_member(game_id));

drop policy if exists "game admins insert rounds" on public.rounds;
create policy "game admins insert rounds"
on public.rounds for insert
to authenticated
with check (public.is_app_admin() or public.is_game_admin(game_id));

drop policy if exists "game admins update rounds" on public.rounds;
create policy "game admins update rounds"
on public.rounds for update
to authenticated
using (public.is_app_admin() or public.is_game_admin(game_id))
with check (public.is_app_admin() or public.is_game_admin(game_id));

drop policy if exists "members read scores" on public.scores;
create policy "members read scores"
on public.scores for select
to authenticated
using (public.is_app_admin() or public.is_game_member(game_id));

drop policy if exists "game admins insert scores" on public.scores;
create policy "game admins insert scores"
on public.scores for insert
to authenticated
with check (public.is_app_admin() or public.is_game_admin(game_id));

-- ---------------------------------------------------------------------------
-- B. The three RPC bodies as they were
-- ---------------------------------------------------------------------------

-- 006
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
    and (
      g.created_by = auth.uid()
      or exists (
        select 1
        from public.game_players gp
        join public.profiles p on p.id = gp.profile_id
        where gp.game_id = g.id
          and gp.is_active = true
          and (
            gp.profile_id = auth.uid()
            or lower(p.email) = lower(auth.jwt() ->> 'email')
          )
      )
    );
$$;

-- 012
create or replace function public.list_new_game_candidates(p_limit integer default 100)
returns table (id uuid, display_name text, player_code text, player_status text, total_games integer, last_played_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with my_games as (
    select g.id, g.created_at from public.games g
    where g.created_by = auth.uid()
       or exists (select 1 from public.game_players a where a.game_id = g.id and a.profile_id = auth.uid() and a.role = 'game_admin')
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

-- 018
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
        where public.can_see_game_result(gr.id)
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
-- A. Indexes
-- ---------------------------------------------------------------------------
drop index if exists public.game_results_declared_by_idx;
drop index if exists public.player_links_owner_pending_idx;
drop index if exists public.creator_notices_owner_open_idx;
drop index if exists public.profiles_email_lower_idx;

notify pgrst, 'reload schema';

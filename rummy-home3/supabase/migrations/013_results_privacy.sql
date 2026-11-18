-- Results privacy: a result is visible only to people connected to it.
--
-- Run after 010 (and 011/012 if applied). Safe to re-run. Not applied automatically.
--
-- Before this file, get_game_result, list_game_results and list_game_results_page were
-- security definer functions whose only check was "signed in". Any account, including a
-- brand-new one with no games, could list and open every result in the project.
--
-- After this file a result is visible when the caller is any of:
--   * app admin (profiles.role = 'app_admin')
--   * the person who declared the result (game_results.declared_by)
--   * a seated player (active game_players row) in at least one game in the result
--   * the creator (games.created_by) of at least one game in the result, even if they
--     did not play — the non-playing scorekeeper case
-- Spectator-only access to a game (games.spectator_access, the public live link) does
-- NOT make its results visible: the live page is for watching one game, not a history.
--
-- A combined result (several games) shows every game's sheet to anyone connected to
-- at least one of them. That is intentional: the declarer chose to publish those games
-- together as one result. If a stricter "every game" rule is ever wanted, change
-- can_see_game_result only; the three readers below all go through it.
--
-- The declarer must already be an admin of every included game (declare_game_result),
-- so the explicit declared_by check is a safety net, not new reach.

create or replace function public.can_see_game_result(p_result_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    public.is_app_admin()
    or exists (
      select 1 from public.game_results r
      where r.id = p_result_id and r.declared_by = auth.uid()
    )
    or exists (
      select 1
      from public.game_result_games grg
      where grg.result_id = p_result_id
        and public.is_game_member(grg.game_id)
    )
    -- games.created_by directly: the creator normally also has a game_players row
    -- (unseated admin), but games made before 007 or where that row failed to insert
    -- would otherwise lock the organiser out of their own result.
    or exists (
      select 1
      from public.game_result_games grg
      join public.games g on g.id = grg.game_id
      where grg.result_id = p_result_id
        and g.created_by = auth.uid()
    )
  );
$$;

revoke all on function public.can_see_game_result(uuid) from public, anon;
grant execute on function public.can_see_game_result(uuid) to authenticated;

-- One result. Returns null (not an error) when it does not exist or is not yours to see,
-- so the app cannot tell the two apart.
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
        'standings', coalesce(r.places->'standings', '[]'::jsonb),
        'sheet', jsonb_build_object(
          'players', coalesce(r.places->'players', '[]'::jsonb),
          -- Each stored game element gains 'label' ("G7") from the live games row, so a game
          -- keeps its own number in every result. Stored rows are read, never rewritten;
          -- a game with no number (pre-009 closed games) keeps its short code.
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

-- Older full list (kept for older app builds), now filtered the same way.
create or replace function public.list_game_results()
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
        'firstNames', coalesce((
          select jsonb_agg(p->>'name' order by p->>'name')
          from jsonb_array_elements(coalesce(r.places->'standings', '[]'::jsonb)) p
          where (p->>'place')::integer = 1
        ), '[]'::jsonb)
      ) order by r.declared_at desc)
      from public.game_results r
      where public.can_see_game_result(r.id)
    ), '[]'::jsonb)
  end;
$$;

-- Paged list. The visibility filter runs before limit/offset so pages stay dense.
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

revoke all on function public.get_game_result(uuid) from public, anon;
revoke all on function public.list_game_results() from public, anon;
revoke all on function public.list_game_results_page(integer, integer) from public, anon;
grant execute on function public.get_game_result(uuid) to authenticated;
grant execute on function public.list_game_results() to authenticated;
grant execute on function public.list_game_results_page(integer, integer) to authenticated;

-- Quick check (run as any signed-in user in the SQL editor with a JWT, or compare
-- counts from two test accounts in the app):
--   select count(*) from jsonb_array_elements(public.list_game_results());
-- An account with no games, no created games and no declared results must get 0.

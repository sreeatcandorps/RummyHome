-- 018: results carry two more facts so the app can show them without re-reading every game.
--
-- 1. reusedGameIds — games in this result that an EARLIER result already contained. Their
--    points count in both results; the app shows a small warning on such a result.
-- 2. sheet.players[].playerNo — the public Player ID (#39) for each player in the result,
--    read from profiles.public_player_no (012) at read time. Nothing stored changes.
--
-- Both are read-only enrichments of get_game_result and list_game_results_page (013).
-- No table or stored row changes. Safe to re-run. Rollback: rollback_018_results_reuse_and_player_ids.sql.
-- Apply after 017.

-- Games of result p_result_id that are also in a result declared before it.
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
    where g.result_id = p_result_id
      and exists (
        select 1
        from public.game_result_games earlier
        join public.game_results er on er.id = earlier.result_id
        where earlier.game_id = g.game_id
          and earlier.result_id <> g.result_id
          and er.declared_at < r.declared_at
      )
  ), '[]'::jsonb);
$$;

revoke all on function public.reused_game_ids(uuid) from public, anon;
grant execute on function public.reused_game_ids(uuid) to authenticated;

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
          -- Each stored player element gains 'playerNo' from the live profile (null when none).
          'players', coalesce((
            select jsonb_agg(
              e || jsonb_build_object('playerNo', pr.public_player_no)
              order by t.ord)
            from jsonb_array_elements(coalesce(r.places->'players', '[]'::jsonb)) with ordinality as t(e, ord)
            left join public.profiles pr on pr.id::text = t.e->>'id'
          ), '[]'::jsonb),
          -- Each stored game element gains 'label' ("G7") from the live games row (as in 013).
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

revoke all on function public.get_game_result(uuid) from public, anon;
revoke all on function public.list_game_results_page(integer, integer) from public, anon;
grant execute on function public.get_game_result(uuid) to authenticated;
grant execute on function public.list_game_results_page(integer, integer) to authenticated;

-- Quick check (SQL editor, as a signed-in user who can see a result):
--   select public.get_game_result('<result id>')->'reusedGameIds';
--   select public.get_game_result('<result id>')->'sheet'->'players'->0->'playerNo';

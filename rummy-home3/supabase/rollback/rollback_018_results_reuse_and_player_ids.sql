-- ROLLBACK for 018_results_reuse_and_player_ids.sql.
-- Puts the 013 versions of get_game_result and list_game_results_page back (no reusedGameIds,
-- no playerNo) and drops the reused_game_ids helper. No data was changed by 018, so nothing
-- else needs undoing. App builds from Nov 10 on fall back to reading the games when these
-- fields are absent.

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

drop function if exists public.reused_game_ids(uuid);

revoke all on function public.get_game_result(uuid) from public, anon;
revoke all on function public.list_game_results_page(integer, integer) from public, anon;
grant execute on function public.get_game_result(uuid) to authenticated;
grant execute on function public.list_game_results_page(integer, integer) to authenticated;

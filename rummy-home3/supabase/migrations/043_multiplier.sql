-- 043 (PR 14, Multiplier for Points games — docs/multiplier-design.md, Sree's final answer of Nov 15
-- 12:35 AM PT). The app stores entered points per score and one multiplier per game in
-- games.settings.multiplier (integer 1–10,000, absent = 1, Points games only; a pool always reads 1).
-- The multiplier can change at any time and always applies to the whole game, so nothing per round
-- is stored and nothing here locks it.
--
--  A. game_multiplier(settings, game_type): the one reader of the key (clamped 1–10,000; 1 for pools).
--  B. declare_game_result: a points game contributes sum(entered) × multiplier, as bigint, so a result
--     is always actual points whichever app build declared it (D14.9); each game entry carries
--     'multiplier'. result_places_json, public_result, list_game_results_page and
--     queue_result_saved_emails sum / read bigint; the result carries the key.
--  C. public_scorecard (live page) returns 'multiplier'.
--  D. event_log_games: the settings_changed line labels the key — "Multiplier ×10→×5 · applies to the
--     whole game (3 rounds re-priced)".
--  E. games_multiplier_check: a games row may not carry a multiplier outside 1–10,000 or a
--     non-integer (the app validates the same way).
--
-- Safe to re-run. Rollback: supabase/rollback/rollback_043_multiplier.sql (restores the 041 / 042 / 023
-- bodies, drops the helper and the check trigger). Adds no column, changes no row.

-- ---------- A. the one reader ----------
create or replace function public.game_multiplier(p_settings jsonb, p_game_type text default 'stake')
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when p_game_type = 'pool' then 1
    when jsonb_typeof(p_settings->'multiplier') = 'number'
      then greatest(1, least(10000, floor((p_settings->>'multiplier')::numeric)::integer))
    else 1
  end;
$$;
revoke all on function public.game_multiplier(jsonb, text) from public;
grant execute on function public.game_multiplier(jsonb, text) to anon, authenticated;

-- ---------- E. range check ----------
create or replace function public.games_multiplier_check()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.settings ? 'multiplier' and jsonb_typeof(new.settings->'multiplier') <> 'null' then
    if jsonb_typeof(new.settings->'multiplier') <> 'number'
       or (new.settings->>'multiplier')::numeric <> floor((new.settings->>'multiplier')::numeric)
       or (new.settings->>'multiplier')::numeric < 1 or (new.settings->>'multiplier')::numeric > 10000 then
      raise exception 'Multiplier is 1 to 10,000.' using errcode = 'PT430';
    end if;
    if new.game_type = 'pool' and (new.settings->>'multiplier')::numeric <> 1 then
      raise exception 'A pool has no multiplier.' using errcode = 'PT431';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists games_multiplier_check on public.games;
create trigger games_multiplier_check before insert or update of settings, game_type on public.games
  for each row execute function public.games_multiplier_check();

-- ---------- B. results: entered × multiplier, bigint ----------
-- 041 body (034 + pools) with the multiplier applied in SQL.
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
  v_pending text;
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

  -- 041: a pool joins a result only once its awards are given.
  select string_agg(coalesce(public.game_label_text(g.game_label, g.game_number), g.share_code), ', ' order by g.created_at)
    into v_pending
    from public.games g
   where g.id = any(distinct_ids) and g.game_type = 'pool' and g.awarded_at is null;
  if v_pending is not null then
    raise exception 'Give awards first: %', v_pending;
  end if;

  if exists (
    select 1
    from unnest(distinct_ids) as u(game_id)
    where not public.is_game_admin(u.game_id)
  ) then
    raise exception 'Only an admin of every selected game can declare results';
  end if;

  -- Everyone who sat in a game counts, scored or not (034); scores without a seat still count.
  -- 041: a pool contributes its awards (prize_shares), not its round sums.
  -- 043: a points game contributes entered points × its multiplier, as bigint (D14.9: a result is
  -- always actual points, whatever app build declared it; 6 extreme ×10,000 nights pass int4).
  with seated as (
    select gp.game_id, gp.profile_id
    from public.game_players gp
    where gp.game_id = any(distinct_ids)
      and gp.profile_id is not null
      and gp.role <> 'spectator'
      and coalesce(gp.seated, true)
  ),
  scored as (
    select s.game_id, s.profile_id, (sum(s.value)::bigint * public.game_multiplier(g.settings, g.game_type::text))::bigint as points
    from public.scores s
    join public.rounds r on r.id = s.round_id
    join public.games g on g.id = s.game_id
    where s.game_id = any(distinct_ids)
      and g.game_type <> 'pool'
      and r.undone_at is null
      and s.score_type <> 'expense'
      and s.profile_id is not null
    group by s.game_id, s.profile_id, g.settings, g.game_type
    union all
    select g.id, (k.key)::uuid, (k.value)::bigint
    from public.games g, jsonb_each_text(coalesce(g.prize_shares, '{}'::jsonb)) k
    where g.id = any(distinct_ids) and g.game_type = 'pool' and k.key ~ '^[0-9a-f-]{36}$'
  ),
  per_game as (
    select st.game_id, st.profile_id, coalesce(sc.points, 0) as points
    from seated st
    left join scored sc on sc.game_id = st.game_id and sc.profile_id = st.profile_id
    union
    select sc.game_id, sc.profile_id, sc.points
    from scored sc
    where not exists (select 1 from seated st where st.game_id = sc.game_id and st.profile_id = sc.profile_id)
  ),
  per_player as (
    select profile_id, sum(points)::bigint as points, count(*)::int as games
    from per_game
    group by profile_id
  ),
  named as (
    select pp.profile_id, coalesce(nullif(p.display_name, ''), 'Player') as name, pp.points, pp.games
    from per_player pp
    left join public.profiles p on p.id = pp.profile_id
  ),
  ranked as (
    select *, rank() over (order by points desc)::int as place
    from named
  )
  select jsonb_build_object(
    'standings', coalesce((
      select jsonb_agg(jsonb_build_object('id', profile_id, 'name', name, 'points', points, 'games', games, 'place', place) order by place, name)
      from ranked
    ), '[]'::jsonb),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object('id', profile_id, 'name', name) order by place, name)
      from ranked
    ), '[]'::jsonb),
    'games', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'name', coalesce(g.share_code, upper(right(g.id::text, 6))),
        'date', g.created_at,
        'kind', case when g.game_type = 'pool' then 'pool' else 'points' end,
        'multiplier', public.game_multiplier(g.settings, g.game_type::text),
        'scores', coalesce((
          select jsonb_object_agg(pg.profile_id::text, pg.points)
          from per_game pg
          where pg.game_id = g.id
        ), '{}'::jsonb)
      ) order by g.created_at, g.id)
      from public.games g
      where g.id = any(distinct_ids)
    ), '[]'::jsonb)
  )
  into places
  from (select 1) as anchor;

  player_count := jsonb_array_length(places->'standings');
  if player_count > 50 then
    raise exception 'Results can include at most 50 players';
  end if;

  declared_ts := now();

  insert into public.game_results (declared_by, declared_at, places)
  values (auth.uid(), declared_ts, places)
  returning id into new_id;

  foreach gid in array distinct_ids loop
    insert into public.game_result_games (result_id, game_id)
    values (new_id, gid);
  end loop;

  perform public.close_games_in_result(distinct_ids, declared_ts);
  perform public.queue_result_saved_emails(new_id);

  return public.get_game_result(new_id);
end;
$$;
revoke all on function public.declare_game_result(uuid[]) from public, anon;
grant execute on function public.declare_game_result(uuid[]) to authenticated;

-- 023 body with bigint sums (a result past 2,147,483,647 recomputes without error).
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
    select k.key as id, sum((k.value)::bigint)::bigint as points, count(*)::int as games
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

-- 041 body + 'multiplier' per game, bigint points.
create or replace function public.public_result(p_id uuid, p_version integer default null)
returns jsonb
language sql
stable
security definer
set search_path = public
set jit = off
as $$
  with r as (select * from public.game_results where id = p_id),
  latest as (select coalesce(max(v.version), 1) as n from public.result_versions v where v.result_id = p_id),
  chosen as (
    select case when p_version is null or p_version < 1 then (select n from latest) else least(p_version, (select n from latest)) end as n
  ),
  pl as (
    select coalesce(
      (select v.places from public.result_versions v where v.result_id = p_id and v.version = (select n from chosen)),
      public.result_places_json(p_id)
    ) as v
  ),
  players as (
    select t.ord - 1 as pos, t.e->>'id' as id, coalesce(t.e->>'name', 'Player') as name, pr.public_player_no as player_no,
           (select gp.label from public.game_result_games grg join public.game_players gp on gp.game_id = grg.game_id and gp.profile_id::text = t.e->>'id'
             where grg.result_id = p_id and grg.removed_at is null and gp.label is not null order by grg.game_id limit 1) as label
    from pl, jsonb_array_elements(coalesce(pl.v->'players', '[]'::jsonb)) with ordinality t(e, ord)
    left join public.profiles pr on pr.id::text = t.e->>'id'
  ),
  removed as (select grg.game_id from public.game_result_games grg where grg.result_id = p_id and grg.removed_at is not null)
  select case
    when not exists (select 1 from r) then null
    else jsonb_build_object(
      'id', p_id,
      'declaredAt', (select declared_at from r),
      'declarerName', (select coalesce(nullif(p.display_name, ''), 'Player') from r join public.profiles p on p.id = r.declared_by),
      'deleted', (select deleted_at from r) is not null,
      'deletedAt', (select deleted_at from r),
      'version', (select n from chosen),
      'currentVersion', (select n from latest),
      'versions', coalesce((
        select jsonb_agg(jsonb_build_object('version', v.version, 'savedAt', v.saved_at, 'note', v.note,
                                            'by', (select coalesce(nullif(p.display_name, ''), 'Player') from public.profiles p where p.id = v.saved_by)) order by v.version)
        from public.result_versions v where v.result_id = p_id
      ), '[]'::jsonb),
      'players', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'playerNo', player_no, 'label', label) order by pos) from players), '[]'::jsonb),
      'standings', coalesce((
        select jsonb_agg(jsonb_build_object('player', p.pos, 'name', p.name, 'points', (s->>'points')::bigint, 'games', (s->>'games')::int, 'place', (s->>'place')::int) order by (s->>'place')::int, p.name)
        from pl, jsonb_array_elements(coalesce(pl.v->'standings', '[]'::jsonb)) s
        join players p on p.id = s->>'id'
      ), '[]'::jsonb),
      'games', coalesce((
        select jsonb_agg(jsonb_build_object(
          'label', coalesce(public.game_label_text(g.game_label, g.game_number), e->>'name', ''),
          'code', coalesce(g.share_code, e->>'name', ''),
          'date', e->>'date',
          'kind', coalesce(e->>'kind', case when g.game_type = 'pool' then 'pool' else 'points' end),
          'multiplier', coalesce((e->>'multiplier')::integer, 1),
          'reused', (e->>'id')::uuid = any(array(select jsonb_array_elements_text(public.reused_game_ids(p_id))::uuid)),
          'removed', exists (select 1 from removed x where x.game_id::text = e->>'id'),
          'creatorName', (select coalesce(nullif(p.display_name, ''), 'Player') from public.profiles p where p.id = g.created_by),
          'adminNames', coalesce((
            select jsonb_agg(coalesce(nullif(p.display_name, ''), 'Player') order by gp.player_order)
            from public.game_players gp join public.profiles p on p.id = gp.profile_id
            where gp.game_id = g.id and gp.role = 'game_admin' and gp.profile_id <> g.created_by
          ), '[]'::jsonb),
          'roundCount', (select count(*) from public.rounds rd where rd.game_id = g.id and rd.undone_at is null),
          'scores', coalesce((select jsonb_object_agg(p.pos::text, k.value::bigint) from jsonb_each_text(coalesce(e->'scores', '{}'::jsonb)) k join players p on p.id = k.key), '{}'::jsonb)
        ) order by t.ord)
        from pl, jsonb_array_elements(coalesce(pl.v->'games', '[]'::jsonb)) with ordinality t(e, ord)
        left join public.games g on g.id::text = t.e->>'id'
      ), '[]'::jsonb),
      'reusedCount', jsonb_array_length(public.reused_game_ids(p_id)),
      'removedCount', (select count(*) from removed)
    )
  end;
$$;
revoke all on function public.public_result(uuid, integer) from public;
grant execute on function public.public_result(uuid, integer) to anon, authenticated;

-- 024 body: the result email reads the standings as bigint.
create or replace function public.queue_result_saved_emails(p_result_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r public.game_results%rowtype;
  v_added integer := 0;
  v_declarer text;
  v_places jsonb;
  v_game_count integer;
begin
  select * into v_r from public.game_results r where r.id = p_result_id and r.deleted_at is null;
  if v_r.id is null then return 0; end if;
  if auth.uid() is not null and not public.can_manage_result(p_result_id) then
    raise exception 'Only the person who saved this result can send the result email.';
  end if;
  v_places := public.result_places_json(p_result_id);
  select count(*) into v_game_count from public.game_result_games g where g.result_id = p_result_id and g.removed_at is null;
  select coalesce(nullif(p.display_name, ''), 'A player') into v_declarer from public.profiles p where p.id = v_r.declared_by;

  with standing as (
    select (s->>'id')::uuid as id, (s->>'points')::bigint as points, (s->>'place')::int as place
    from jsonb_array_elements(coalesce(v_places->'standings', '[]'::jsonb)) s
    where (s->>'id') ~ '^[0-9a-f-]{36}$'
  ), recipients as (
    select p.id, p.email, p.display_name, p.email_token, s.points, s.place
    from standing s
    join public.profiles p on p.id = s.id
    where p.player_status = 'registered' and p.deleted_at is null
      and p.email is not null and p.email <> ''
      and p.email_results
  ), ins as (
    insert into public.email_outbox (event_key, kind, to_profile_id, to_email, payload)
    select 'result_saved:' || p_result_id::text || ':' || r.id::text, 'result_saved', r.id, r.email,
           jsonb_build_object(
             'resultId', p_result_id, 'url', public.site_base_url() || '/r/' || p_result_id::text,
             'declaredAt', v_r.declared_at, 'declarerName', v_declarer,
             'playerName', coalesce(nullif(r.display_name, ''), 'there'), 'points', r.points, 'place', r.place,
             'playerCount', jsonb_array_length(coalesce(v_places->'standings', '[]'::jsonb)), 'gameCount', v_game_count,
             'unsubscribeToken', r.email_token)
    from recipients r
    on conflict (event_key) do nothing
    returning 1
  )
  select count(*) into v_added from ins;
  return v_added;
end;
$$;
revoke all on function public.queue_result_saved_emails(uuid) from public, anon;
grant execute on function public.queue_result_saved_emails(uuid) to authenticated;

-- 023 body: the Results list reads standings as bigint.
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
            'points', (p->>'points')::bigint,
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
revoke all on function public.list_game_results_page(integer, integer) from public, anon;
grant execute on function public.list_game_results_page(integer, integer) to authenticated;

-- ---------- C. live page ----------
-- 041 body + 'multiplier'.
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
    'gameLabel', public.game_label_text(g.game_label, g.game_number),
    'startedAt', g.created_at,
    'gameType', g.game_type,
    'status', g.status,
    'currentRound', g.current_round,
    'maxCount', (g.settings->>'maxCount')::integer,
    'poolLimit', case when g.game_type = 'pool' then public.pool_limit_of(g.id) end,
    'dropAmount', (g.settings->>'dropAmount')::integer,
    'multiplier', public.game_multiplier(g.settings, g.game_type::text),
    'awarded', g.awarded_at is not null,
    'dealers', (
      select coalesce(jsonb_object_agg(r.round_number::text, r.dealer_profile_id), '{}'::jsonb)
      from public.rounds r
      where r.game_id = g.id and r.undone_at is null
    ),
    'players', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'profileId', gp.profile_id,
        'name', pr.display_name,
        'order', gp.player_order,
        'label', gp.label,
        'outRound', gp.out_round,
        'reenteredRound', gp.reentered_round,
        'reentryScore', gp.reentry_score,
        'entries', gp.entries
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
revoke all on function public.public_scorecard(text) from public;
grant execute on function public.public_scorecard(text) to anon, authenticated;

-- ---------- D. the Log label ----------
-- 042 body + the Multiplier label and wording.
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
                    when 'poolLimit' then 'Pool limit' when 'reentryLimit' then 'Re-entries' when 'reentry' then 'Re-entry'
                    when 'multiplier' then 'Multiplier'
                    else k end as label
        from keys where (old.settings->k) is distinct from (new.settings->k)
    ), one as (select distinct on (label) label, o, n from diff order by label, k)
    select coalesce(jsonb_agg(jsonb_build_object('key', label, 'old', o, 'new', n) order by label), '[]'::jsonb) into v_changes from one;
    if jsonb_array_length(v_changes) > 0 then
      v_rounds := public.live_round_count(new.id);
      perform public.log_event(new.id, null, 'settings_changed', (case when v_rounds > 0 then 'important' else 'routine' end)::public.event_level,
        'Changed game settings · ' || (select string_agg(case when c->>'key' = 'Multiplier'
               then format('Multiplier ×%s→×%s · applies to the whole game%s', coalesce(c->>'old', '1'), coalesce(c->>'new', '1'),
                           case when v_rounds > 0 then format(' (%s round%s re-priced)', v_rounds, case when v_rounds = 1 then '' else 's' end) else '' end)
               else format('%s %s→%s', c->>'key', coalesce(c->>'old', '—'), coalesce(c->>'new', '—')) end, ' · ') from jsonb_array_elements(v_changes) c),
        jsonb_build_object('changes', v_changes, 'rounds', v_rounds));
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.event_log_games() from public, anon, authenticated;
revoke all on function public.event_log_games() from public, anon, authenticated;

notify pgrst, 'reload schema';

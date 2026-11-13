-- 034: Results design (PR 8). Three things, all behind the results screens:
--
-- 1. 0-players fix. declare_game_result built the standings from score rows only, so a
--    completed game whose players never had a round saved said "1 game · 0 players" once
--    saved (the preview, which reads the seats, said 6). The per-game totals now start from
--    the seated players (game_players, role <> spectator, seated) LEFT JOIN their live scores,
--    so everyone who sat in the game is in the result with 0 points when nothing was scored.
--    Players with scores but no seat row any more (left mid-game) keep their points as before.
--
-- 2. Result versions. Every save writes version 1 of the result (its places JSON as saved);
--    every later change to what the result shows — today that is a game in it being deleted,
--    which removes the game and re-totals — writes the next version with a one-line note
--    ("S14 removed · game deleted"). The versions are append-only and are read through
--    public_result only. Existing results get a backfilled version 1 (their stored places) and,
--    when games were already removed before this ran, a version 2 with the current totals.
--
-- 3. public_result(p_id, p_version default null) for the /r/<id> page: the chosen (default
--    latest) version's players, standings and per-game scores, the list of versions
--    (number, when, note), a deleted result's summary kept read-only with its deleted date,
--    and per game the share code, creator, admins and round count for "Games in this result".
--    The one-argument signature is dropped so PostgREST resolves the call without ambiguity;
--    the page still posts {p_id} alone and gets the latest version.
--
-- Safe to run again. No data is deleted. Rollback: rollback/rollback_034_results_design.sql.

-- ---------- A. result_versions ----------
create table if not exists public.result_versions (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.game_results(id) on delete cascade,
  version integer not null check (version >= 1),
  places jsonb not null,
  note text not null default 'Saved',
  saved_by uuid references public.profiles(id) on delete set null,
  saved_at timestamptz not null default now(),
  unique (result_id, version)
);
comment on table public.result_versions is
  '034: one row per saved state of a result (1 = as saved; later rows after a game in it was deleted). Read through public_result; never updated or deleted.';

alter table public.result_versions enable row level security;
revoke all on public.result_versions from public, anon, authenticated;
-- Nobody reads or writes the table directly; the security definer functions below do.

create index if not exists result_versions_result_idx on public.result_versions (result_id, version desc);

-- Next version of a result from the places it shows right now (removed games taken out).
create or replace function public.snapshot_result_version(p_result_id uuid, p_note text, p_actor uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next integer;
begin
  select coalesce(max(v.version), 0) + 1 into v_next from public.result_versions v where v.result_id = p_result_id;
  insert into public.result_versions (result_id, version, places, note, saved_by)
  values (p_result_id, v_next, public.result_places_json(p_result_id), coalesce(nullif(trim(p_note), ''), 'Changed'), p_actor);
  return v_next;
end;
$$;
revoke all on function public.snapshot_result_version(uuid, text, uuid) from public, anon, authenticated;

-- Version 1 the moment a result is saved (declare_game_result inserts game_results first).
create or replace function public.result_versions_on_save()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.result_versions (result_id, version, places, note, saved_by, saved_at)
  values (new.id, 1, new.places, 'Saved', new.declared_by, new.declared_at)
  on conflict (result_id, version) do nothing;
  return new;
end;
$$;
revoke all on function public.result_versions_on_save() from public, anon, authenticated;

drop trigger if exists result_versions_on_save on public.game_results;
create trigger result_versions_on_save
  after insert on public.game_results
  for each row execute function public.result_versions_on_save();

-- The next version when a game leaves a result (delete_game / delete-account set removed_at).
create or replace function public.result_versions_on_remove()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_label text;
begin
  if new.removed_at is null or new.removed_at is not distinct from old.removed_at then return new; end if;
  select coalesce(public.game_label_text(g.game_label, g.game_number), g.share_code, upper(right(g.id::text, 6)))
    into v_label
  from public.games g where g.id = new.game_id;
  perform public.snapshot_result_version(new.result_id, format('%s removed · game deleted', coalesce(v_label, 'A game')), auth.uid());
  return new;
end;
$$;
revoke all on function public.result_versions_on_remove() from public, anon, authenticated;

drop trigger if exists result_versions_on_remove on public.game_result_games;
create trigger result_versions_on_remove
  after update of removed_at on public.game_result_games
  for each row execute function public.result_versions_on_remove();

-- Backfill: version 1 for every result that has none; version 2 where games were already removed.
insert into public.result_versions (result_id, version, places, note, saved_by, saved_at)
select r.id, 1, r.places, 'Saved', r.declared_by, r.declared_at
from public.game_results r
where not exists (select 1 from public.result_versions v where v.result_id = r.id);

insert into public.result_versions (result_id, version, places, note, saved_by, saved_at)
select r.id, 2, public.result_places_json(r.id),
       (select string_agg(coalesce(public.game_label_text(g.game_label, g.game_number), g.share_code, upper(right(g.id::text, 6))), ', ' order by grg.removed_at)
          from public.game_result_games grg join public.games g on g.id = grg.game_id
         where grg.result_id = r.id and grg.removed_at is not null) || ' removed · game deleted',
       null,
       (select max(grg.removed_at) from public.game_result_games grg where grg.result_id = r.id and grg.removed_at is not null)
from public.game_results r
where exists (select 1 from public.game_result_games grg where grg.result_id = r.id and grg.removed_at is not null)
  and not exists (select 1 from public.result_versions v where v.result_id = r.id and v.version >= 2);

-- ---------- B. declare_game_result: seated players first, scores left-joined ----------
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
    from unnest(distinct_ids) as u(game_id)
    where not public.is_game_admin(u.game_id)
  ) then
    raise exception 'Only an admin of every selected game can declare results';
  end if;

  -- Everyone who sat in a game counts, scored or not (034); scores without a seat still count.
  create temp table if not exists tmp_declare_per_game (game_id uuid, profile_id uuid, points integer) on commit drop;
  delete from tmp_declare_per_game;
  insert into tmp_declare_per_game (game_id, profile_id, points)
  with seated as (
    select gp.game_id, gp.profile_id
    from public.game_players gp
    where gp.game_id = any(distinct_ids)
      and gp.profile_id is not null
      and gp.role <> 'spectator'
      and coalesce(gp.seated, true)
  ),
  scored as (
    select s.game_id, s.profile_id, sum(s.value)::int as points
    from public.scores s
    join public.rounds r on r.id = s.round_id
    where s.game_id = any(distinct_ids)
      and r.undone_at is null
      and s.score_type <> 'expense'
      and s.profile_id is not null
    group by s.game_id, s.profile_id
  )
  select st.game_id, st.profile_id, coalesce(sc.points, 0)
  from seated st
  left join scored sc on sc.game_id = st.game_id and sc.profile_id = st.profile_id
  union
  select sc.game_id, sc.profile_id, sc.points
  from scored sc
  where not exists (select 1 from seated st where st.game_id = sc.game_id and st.profile_id = sc.profile_id);

  select count(distinct profile_id) into player_count from tmp_declare_per_game;

  if player_count > 50 then
    raise exception 'Results can include at most 50 players';
  end if;

  with per_player as (
    select profile_id, sum(points)::int as points, count(*)::int as games
    from tmp_declare_per_game
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
        'scores', coalesce((
          select jsonb_object_agg(pg.profile_id::text, pg.points)
          from tmp_declare_per_game pg
          where pg.game_id = g.id
        ), '{}'::jsonb)
      ) order by g.created_at, g.id)
      from public.games g
      where g.id = any(distinct_ids)
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
  perform public.queue_result_saved_emails(new_id);

  return public.get_game_result(new_id);
end;
$$;

-- ---------- C. public_result with versions, deleted summary and game details ----------
drop function if exists public.public_result(uuid);

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
        select jsonb_agg(jsonb_build_object('player', p.pos, 'name', p.name, 'points', (s->>'points')::int, 'games', (s->>'games')::int, 'place', (s->>'place')::int) order by (s->>'place')::int, p.name)
        from pl, jsonb_array_elements(coalesce(pl.v->'standings', '[]'::jsonb)) s
        join players p on p.id = s->>'id'
      ), '[]'::jsonb),
      'games', coalesce((
        select jsonb_agg(jsonb_build_object(
          'label', coalesce(public.game_label_text(g.game_label, g.game_number), e->>'name', ''),
          'code', coalesce(g.share_code, e->>'name', ''),
          'date', e->>'date',
          'reused', (e->>'id')::uuid = any(array(select jsonb_array_elements_text(public.reused_game_ids(p_id))::uuid)),
          'removed', exists (select 1 from removed x where x.game_id::text = e->>'id'),
          'creatorName', (select coalesce(nullif(p.display_name, ''), 'Player') from public.profiles p where p.id = g.created_by),
          'adminNames', coalesce((
            select jsonb_agg(coalesce(nullif(p.display_name, ''), 'Player') order by gp.player_order)
            from public.game_players gp join public.profiles p on p.id = gp.profile_id
            where gp.game_id = g.id and gp.role = 'game_admin' and gp.profile_id <> g.created_by
          ), '[]'::jsonb),
          'roundCount', (select count(*) from public.rounds rd where rd.game_id = g.id and rd.undone_at is null),
          'scores', coalesce((select jsonb_object_agg(p.pos::text, k.value::int) from jsonb_each_text(coalesce(e->'scores', '{}'::jsonb)) k join players p on p.id = k.key), '{}'::jsonb)
        ) order by t.ord)
        from pl, jsonb_array_elements(coalesce(pl.v->'games', '[]'::jsonb)) with ordinality t(e, ord)
        left join public.games g on g.id::text = t.e->>'id'
      ), '[]'::jsonb),
      'reusedCount', jsonb_array_length(public.reused_game_ids(p_id)),
      'removedCount', (select count(*) from removed)
    )
  end;
$$;

-- ---------- grants ----------
revoke all on function public.declare_game_result(uuid[]) from public, anon;
grant execute on function public.declare_game_result(uuid[]) to authenticated;
revoke all on function public.public_result(uuid, integer) from public;
grant execute on function public.public_result(uuid, integer) to anon, authenticated;

notify pgrst, 'reload schema';

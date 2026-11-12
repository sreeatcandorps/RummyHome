-- 024: game-started and result-saved emails (server-side, idempotent per event), email
-- preferences with an unsubscribe token, and the public web results page.
--
-- Approved Nov 11, 10:59 PM PT (item 3) and amended 11:03 PM PT: no game-completed email,
-- no per-round emails. The result email links to /r/<result id> on the share site, which
-- shows the saved result read-only through public_result(uuid).
--
-- How sending works: RPCs here write one email_outbox row per (event, recipient), keyed by
-- event_key, so a retry or a second admin never queues a duplicate. The send-email edge
-- function (kind 'flush', service role) delivers the unsent rows through Resend with the
-- event_key as the Resend Idempotency-Key, then stamps sent_at. Nothing here calls out.
-- Safe to re-run. Rollback: supabase/rollback/rollback_024_emails_and_public_results.sql.

-- ---------- A. preferences and the unsubscribe token ----------
alter table public.profiles add column if not exists email_game_started boolean not null default true;
alter table public.profiles add column if not exists email_results boolean not null default true;
alter table public.profiles add column if not exists email_token text;
alter table public.profiles alter column email_token set default encode(gen_random_bytes(24), 'hex');
update public.profiles set email_token = encode(gen_random_bytes(24), 'hex') where email_token is null;
create unique index if not exists profiles_email_token_key on public.profiles (email_token);

-- The owner's own row (019) is `select p.*`, expanded when the view was created: re-create it so the new columns show.
create or replace view public.my_profile as
  select p.* from public.profiles p where p.id = auth.uid();
alter view public.my_profile set (security_barrier = true);
revoke all on public.my_profile from public;
revoke all on public.my_profile from anon;
grant select on public.my_profile to authenticated;

-- Other accounts never see the token or the preferences: the per-column select grant of 019 is unchanged.
revoke select (email_game_started, email_results, email_token) on public.profiles from authenticated;

create or replace function public.set_email_prefs(p_game_started boolean, p_results boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  update public.profiles
  set email_game_started = coalesce(p_game_started, email_game_started),
      email_results = coalesce(p_results, email_results)
  where id = auth.uid();
  return (select jsonb_build_object('gameStarted', email_game_started, 'results', email_results) from public.profiles where id = auth.uid());
end;
$$;

-- From the link at the bottom of every email. Keyed by the token only, so it works signed out.
create or replace function public.unsubscribe_email(p_token text, p_kind text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if p_token is null or length(p_token) < 20 then return false; end if;
  if p_kind = 'game_started' then
    update public.profiles set email_game_started = false where email_token = p_token;
  elsif p_kind = 'result_saved' then
    update public.profiles set email_results = false where email_token = p_token;
  elsif p_kind = 'all' then
    update public.profiles set email_game_started = false, email_results = false where email_token = p_token;
  else
    return false;
  end if;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- ---------- B. outbox ----------
create table if not exists public.email_outbox (
  id bigserial primary key,
  event_key text not null unique,
  kind text not null check (kind in ('game_started', 'result_saved')),
  to_profile_id uuid not null references public.profiles(id) on delete cascade,
  to_email text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 0,
  last_error text
);
create index if not exists email_outbox_unsent_idx on public.email_outbox (created_at) where sent_at is null;
alter table public.email_outbox enable row level security;
-- No policies on purpose: only the service role (the edge function) and the definer functions below touch it.
revoke all on public.email_outbox from public, anon, authenticated;

comment on table public.email_outbox is
  'One row per (event, recipient). event_key makes queuing idempotent; the send-email edge function (flush) delivers unsent rows and stamps sent_at.';

-- Where the share site lives. One place to change.
create or replace function public.site_base_url()
returns text
language sql
immutable
as $$ select 'https://ezscore.mindweavetech.com'::text $$;

-- ---------- C. game started ----------
-- Called by the app right after Start game (creator or a game admin). Every seated,
-- registered player with an email and the preference on gets one row; the creator too
-- (they may be seated). Returns how many rows were added this call (0 on a retry).
create or replace function public.queue_game_started_emails(p_game_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_game public.games%rowtype;
  v_added integer := 0;
  v_creator text;
  v_url text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into v_game from public.games g where g.id = p_game_id and g.deleted_at is null;
  if v_game.id is null then raise exception 'This game is not available.'; end if;
  if not public.can_manage_game(p_game_id) then raise exception 'Only the creator or a game admin can send the game-started email.'; end if;
  if v_game.status <> 'active' then return 0; end if;

  if v_game.view_token is null then
    update public.games set view_token = encode(gen_random_bytes(24), 'hex') where id = p_game_id returning view_token into v_game.view_token;
  end if;
  v_url := public.site_base_url() || '/scorecard.html?t=' || v_game.view_token
           || case when v_game.game_number is not null then '&g=' || v_game.game_number::text else '' end;
  select coalesce(nullif(p.display_name, ''), 'A player') into v_creator from public.profiles p where p.id = v_game.created_by;

  with recipients as (
    select p.id, p.email, p.display_name, p.email_token
    from public.game_players gp
    join public.profiles p on p.id = gp.profile_id
    where gp.game_id = p_game_id and gp.is_active and gp.role <> 'spectator' and coalesce(gp.seated, true)
      and p.player_status = 'registered' and p.deleted_at is null
      and p.email is not null and p.email <> ''
      and p.email_game_started
  ), ins as (
    insert into public.email_outbox (event_key, kind, to_profile_id, to_email, payload)
    select 'game_started:' || p_game_id::text || ':' || r.id::text, 'game_started', r.id, r.email,
           jsonb_build_object(
             'gameId', p_game_id, 'gameNumber', v_game.game_number, 'creatorName', v_creator,
             'playerName', coalesce(nullif(r.display_name, ''), 'there'), 'url', v_url,
             'startedAt', v_game.created_at, 'unsubscribeToken', r.email_token)
    from recipients r
    on conflict (event_key) do nothing
    returning 1
  )
  select count(*) into v_added from ins;
  return v_added;
end;
$$;

-- ---------- D. result saved ----------
-- Every registered player in the result's standings with the preference on. Called by
-- declare_game_result; the declarer may call it again (same keys, nothing doubles).
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
    select (s->>'id')::uuid as id, (s->>'points')::int as points, (s->>'place')::int as place
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

-- 023 body + one line: queue the result emails inside the same transaction as the save.
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

  select count(distinct s.profile_id)
  into player_count
  from public.scores s
  join public.rounds r on r.id = s.round_id
  where s.game_id = any(distinct_ids)
    and r.undone_at is null
    and s.score_type <> 'expense'
    and s.profile_id is not null;

  if player_count > 50 then
    raise exception 'Results can include at most 50 players';
  end if;

  with live_scores as (
    select s.game_id, s.profile_id, s.value
    from public.scores s
    join public.rounds r on r.id = s.round_id
    where s.game_id = any(distinct_ids)
      and r.undone_at is null
      and s.score_type <> 'expense'
      and s.profile_id is not null
  ),
  per_game as (
    select game_id, profile_id, sum(value)::int as points
    from live_scores
    group by game_id, profile_id
  ),
  per_player as (
    select profile_id, sum(points)::int as points, count(*)::int as games
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

-- ---------- E. public results page ----------
-- What /r/<id> shows: exactly the saved result as the PDF has it (standings, players with
-- their Player IDs and column letters, per-game totals, the reused and removed flags),
-- keyed by position, so no account id or contact detail leaves the server.
create or replace function public.public_result(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with r as (select * from public.game_results where id = p_id),
  pl as (select public.result_places_json(p_id) as v),
  players as (
    select t.ord - 1 as pos, t.e->>'id' as id, coalesce(t.e->>'name', 'Player') as name, pr.public_player_no as player_no,
           (select gp.label from public.game_result_games grg join public.game_players gp on gp.game_id = grg.game_id and gp.profile_id::text = t.e->>'id'
             where grg.result_id = p_id and grg.removed_at is null and gp.label is not null order by grg.game_id limit 1) as label
    from pl, jsonb_array_elements(coalesce(pl.v->'players', '[]'::jsonb)) with ordinality t(e, ord)
    left join public.profiles pr on pr.id::text = t.e->>'id'
  )
  select case
    when not exists (select 1 from r) then null
    when (select deleted_at from r) is not null then jsonb_build_object('id', p_id, 'deleted', true)
    else jsonb_build_object(
      'id', p_id,
      'declaredAt', (select declared_at from r),
      'declarerName', (select coalesce(nullif(p.display_name, ''), 'Player') from r join public.profiles p on p.id = r.declared_by),
      'players', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'playerNo', player_no, 'label', label) order by pos) from players), '[]'::jsonb),
      'standings', coalesce((
        select jsonb_agg(jsonb_build_object('player', p.pos, 'name', p.name, 'points', (s->>'points')::int, 'games', (s->>'games')::int, 'place', (s->>'place')::int) order by (s->>'place')::int, p.name)
        from pl, jsonb_array_elements(coalesce(pl.v->'standings', '[]'::jsonb)) s
        join players p on p.id = s->>'id'
      ), '[]'::jsonb),
      'games', coalesce((
        select jsonb_agg(jsonb_build_object(
          'label', case when g.game_number is not null then 'G' || g.game_number::text else coalesce(e->>'name', '') end,
          'date', e->>'date',
          'reused', (e->>'id')::uuid = any(array(select jsonb_array_elements_text(public.reused_game_ids(p_id))::uuid)),
          'scores', coalesce((select jsonb_object_agg(p.pos::text, k.value::int) from jsonb_each_text(coalesce(e->'scores', '{}'::jsonb)) k join players p on p.id = k.key), '{}'::jsonb)
        ) order by t.ord)
        from pl, jsonb_array_elements(coalesce(pl.v->'games', '[]'::jsonb)) with ordinality t(e, ord)
        left join public.games g on g.id::text = t.e->>'id'
      ), '[]'::jsonb),
      'reusedCount', jsonb_array_length(public.reused_game_ids(p_id)),
      'removedCount', (select count(*) from public.game_result_games g where g.result_id = p_id and g.removed_at is not null)
    )
  end;
$$;

-- ---------- grants ----------
revoke all on function public.set_email_prefs(boolean, boolean) from public, anon;
grant execute on function public.set_email_prefs(boolean, boolean) to authenticated;
revoke all on function public.unsubscribe_email(text, text) from public;
grant execute on function public.unsubscribe_email(text, text) to anon, authenticated;
revoke all on function public.queue_game_started_emails(uuid) from public, anon;
grant execute on function public.queue_game_started_emails(uuid) to authenticated;
revoke all on function public.queue_result_saved_emails(uuid) from public, anon;
grant execute on function public.queue_result_saved_emails(uuid) to authenticated;
revoke all on function public.declare_game_result(uuid[]) from public, anon;
grant execute on function public.declare_game_result(uuid[]) to authenticated;
revoke all on function public.public_result(uuid) from public;
grant execute on function public.public_result(uuid) to anon, authenticated;
revoke all on function public.site_base_url() from public;
grant execute on function public.site_base_url() to anon, authenticated;

notify pgrst, 'reload schema';

-- Friday game night: who can see a game, public scorecard links, and prize sessions.
-- Does not depend on 005_demo_data.sql. Apply this file in the Supabase SQL editor
-- (or `supabase db push`) before sharing or settling games from the APK.
--
-- Coin math for pool games matches rummy-home3/utils/prizeSession.ts.

-- ---------------------------------------------------------------------------
-- Scorekeeper who is not seated can still read and write the game.
-- ---------------------------------------------------------------------------

create or replace function public.is_game_member(target_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.game_players
    where game_id = target_game_id
      and profile_id = auth.uid()
      and is_active = true
  )
  or exists (
    select 1 from public.games
    where id = target_game_id
      and created_by = auth.uid()
  );
$$;

create or replace function public.is_game_admin(target_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.game_players
    where game_id = target_game_id
      and profile_id = auth.uid()
      and role = 'game_admin'
      and is_active = true
  )
  or exists (
    select 1 from public.games
    where id = target_game_id
      and created_by = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Unguessable public link + confirmed prize.
-- ---------------------------------------------------------------------------

alter table public.games add column if not exists view_token text;
alter table public.games add column if not exists prize integer;
alter table public.games add column if not exists prize_shares jsonb;

update public.games
set view_token = encode(gen_random_bytes(24), 'hex')
where view_token is null;

alter table public.games alter column view_token set default encode(gen_random_bytes(24), 'hex');
alter table public.games alter column view_token set not null;

create unique index if not exists games_view_token_key on public.games (view_token);

-- Games the signed-in account should see: seated, view-only, creator, or same email.
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

-- Live read-only scorecard. The token is the only secret; no login required.
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
        'value', s.value,
        'type', s.score_type
      ) order by r.round_number), '[]'::jsonb)
      from public.scores s
      join public.rounds r on r.id = s.round_id
      left join public.profiles pr on pr.id = s.profile_id
      where s.game_id = g.id
        and r.undone_at is null
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Prize distribution sessions. "Coins" / "prize", never money.
-- ---------------------------------------------------------------------------

create table if not exists public.prize_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null default 'Prize distribution',
  status text not null default 'open' check (status in ('open', 'settled')),
  settled_at timestamptz
);

create table if not exists public.prize_session_games (
  session_id uuid not null references public.prize_sessions(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete restrict,
  primary key (session_id, game_id)
);

create table if not exists public.prize_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.prize_sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  note text,
  legs jsonb not null
);

create index if not exists prize_session_games_game_idx on public.prize_session_games (game_id);
create index if not exists prize_entries_session_idx on public.prize_entries (session_id);

alter table public.prize_sessions enable row level security;
alter table public.prize_session_games enable row level security;
alter table public.prize_entries enable row level security;

-- Coins for one game. Stake uses points (or the confirmed prize_shares).
-- Pool pays the prize to the leader and splits the cost across the others.
create or replace function public.game_coin_shares(target_game_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
  rec record;
  ordered uuid[] := '{}';
  pts_map jsonb := '{}'::jsonb;
  best integer := null;
  winner_ids uuid[] := '{}';
  payer_ids uuid[] := '{}';
  winner_count integer;
  payer_count integer;
  prize integer;
  base integer;
  remainder integer;
  result jsonb := '{}'::jsonb;
  pid uuid;
  i integer;
begin
  select * into g from public.games where id = target_game_id;
  if not found then
    return '{}'::jsonb;
  end if;

  if g.prize_shares is not null then
    return g.prize_shares;
  end if;

  for rec in
    select gp.profile_id,
           coalesce((
             select sum(sc.value)::integer
             from public.scores sc
             join public.rounds rd on rd.id = sc.round_id
             where sc.game_id = g.id
               and sc.profile_id = gp.profile_id
               and rd.undone_at is null
           ), 0) as pts
    from public.game_players gp
    where gp.game_id = g.id
      and gp.is_active
      and gp.role <> 'spectator'
    order by gp.player_order
  loop
    ordered := array_append(ordered, rec.profile_id);
    pts_map := pts_map || jsonb_build_object(rec.profile_id::text, rec.pts);
    if best is null or rec.pts > best then
      best := rec.pts;
    end if;
  end loop;

  if g.game_type = 'stake' or g.prize is null then
    return pts_map;
  end if;

  prize := g.prize;
  foreach pid in array ordered loop
    if (pts_map ->> pid::text)::integer = best then
      winner_ids := array_append(winner_ids, pid);
    else
      payer_ids := array_append(payer_ids, pid);
    end if;
  end loop;

  winner_count := coalesce(array_length(winner_ids, 1), 0);
  payer_count := coalesce(array_length(payer_ids, 1), 0);
  if winner_count = 0 or payer_count = 0 then
    foreach pid in array ordered loop
      result := result || jsonb_build_object(pid::text, 0);
    end loop;
    return result;
  end if;

  base := prize / winner_count;
  remainder := prize - base * winner_count;
  i := 1;
  foreach pid in array winner_ids loop
    result := result || jsonb_build_object(pid::text, base + case when i <= remainder then 1 else 0 end);
    i := i + 1;
  end loop;

  base := (-prize) / payer_count;
  remainder := (-prize) - base * payer_count;
  i := 0;
  foreach pid in array payer_ids loop
    result := result || jsonb_build_object(pid::text, base + case when i < abs(remainder) then -1 else 0 end);
    i := i + 1;
  end loop;

  return result;
end;
$$;

create or replace function public.session_visible(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.prize_sessions s
    where s.id = p_session_id
      and (
        s.created_by = auth.uid()
        or exists (
          select 1
          from public.prize_session_games sg
          join public.games g on g.id = sg.game_id
          where sg.session_id = s.id
            and (
              g.created_by = auth.uid()
              or exists (
                select 1 from public.game_players gp
                where gp.game_id = g.id
                  and gp.profile_id = auth.uid()
                  and gp.is_active
              )
            )
        )
      )
  );
$$;

create or replace function public.get_prize_session(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.prize_sessions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  if not public.session_visible(p_session_id) then
    raise exception 'You are not in this session';
  end if;

  select * into s from public.prize_sessions where id = p_session_id;

  return jsonb_build_object(
    'id', s.id,
    'title', s.title,
    'status', s.status,
    'createdAt', s.created_at,
    'games', (
      select coalesce(jsonb_agg(game_json), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', g.id,
          'shareCode', g.share_code,
          'gameType', g.game_type,
          'date', g.created_at,
          'prize', g.prize,
          'prizeShares', g.prize_shares,
          'players', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'id', gp.profile_id,
              'name', pr.display_name,
              'points', coalesce((
                select sum(sc.value)::integer
                from public.scores sc
                join public.rounds rd on rd.id = sc.round_id
                where sc.game_id = g.id
                  and sc.profile_id = gp.profile_id
                  and rd.undone_at is null
              ), 0)
            ) order by gp.player_order), '[]'::jsonb)
            from public.game_players gp
            join public.profiles pr on pr.id = gp.profile_id
            where gp.game_id = g.id
              and gp.is_active
              and gp.role <> 'spectator'
          )
        ) as game_json
        from public.prize_session_games sg
        join public.games g on g.id = sg.game_id
        where sg.session_id = s.id
        order by g.created_at
      ) listed
    ),
    'entries', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id,
        'note', e.note,
        'createdAt', e.created_at,
        'legs', e.legs
      ) order by e.created_at), '[]'::jsonb)
      from public.prize_entries e
      where e.session_id = s.id
    )
  );
end;
$$;

create or replace function public.recompute_session_status(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  shares jsonb;
  balances jsonb := '{}'::jsonb;
  entry record;
  leg record;
  game_id uuid;
  key text;
  all_zero boolean;
  any_player boolean := false;
begin
  for game_id in
    select sg.game_id from public.prize_session_games sg where sg.session_id = p_session_id
  loop
    shares := public.game_coin_shares(game_id);
    for key in select jsonb_object_keys(shares) loop
      any_player := true;
      balances := jsonb_set(
        balances,
        array[key],
        to_jsonb(coalesce((balances ->> key)::integer, 0) + (shares ->> key)::integer)
      );
    end loop;
  end loop;

  for entry in
    select legs from public.prize_entries where session_id = p_session_id order by created_at
  loop
    for leg in
      select value from jsonb_array_elements(entry.legs)
    loop
      key := leg.value ->> 'profileId';
      if key is null then
        continue;
      end if;
      any_player := true;
      balances := jsonb_set(
        balances,
        array[key],
        to_jsonb(coalesce((balances ->> key)::integer, 0) + coalesce((leg.value ->> 'amount')::integer, 0))
      );
    end loop;
  end loop;

  select coalesce(bool_and(value::integer = 0), false)
  into all_zero
  from jsonb_each_text(balances);

  if any_player and all_zero then
    update public.prize_sessions
    set status = 'settled', settled_at = coalesce(settled_at, now())
    where id = p_session_id;
  else
    update public.prize_sessions
    set status = 'open', settled_at = null
    where id = p_session_id;
  end if;
end;
$$;

create or replace function public.create_prize_session(p_game_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  game_id uuid;
  visible_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  if p_game_ids is null or array_length(p_game_ids, 1) is null then
    raise exception 'Pick at least one completed game';
  end if;
  if array_length(p_game_ids, 1) > 30 then
    raise exception 'A session can include at most 30 games';
  end if;

  select count(*) into visible_count
  from public.games g
  where g.id = any(p_game_ids)
    and g.status = 'completed'
    and (
      g.created_by = auth.uid()
      or exists (
        select 1 from public.game_players gp
        where gp.game_id = g.id and gp.profile_id = auth.uid() and gp.is_active
      )
    );

  if visible_count <> array_length(p_game_ids, 1) then
    raise exception 'You can only settle completed games you are in';
  end if;

  insert into public.prize_sessions (created_by)
  values (auth.uid())
  returning id into new_id;

  foreach game_id in array p_game_ids loop
    insert into public.prize_session_games (session_id, game_id)
    values (new_id, game_id)
    on conflict do nothing;
  end loop;

  perform public.recompute_session_status(new_id);
  return new_id;
end;
$$;

create or replace function public.add_prize_entry(p_session_id uuid, p_legs jsonb, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  leg record;
  total integer := 0;
  leg_count integer := 0;
  allowed boolean;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  if not public.session_visible(p_session_id) then
    raise exception 'You are not in this session';
  end if;

  allowed := exists (
    select 1 from public.prize_sessions s
    where s.id = p_session_id and s.created_by = auth.uid()
  ) or exists (
    select 1
    from public.prize_session_games sg
    where sg.session_id = p_session_id
      and public.is_game_admin(sg.game_id)
  );
  if not allowed then
    raise exception 'Only a game admin can add a prize entry';
  end if;

  if jsonb_typeof(p_legs) <> 'array' then
    raise exception 'Legs must be a list';
  end if;

  for leg in select value from jsonb_array_elements(p_legs) loop
    leg_count := leg_count + 1;
    if (leg.value ->> 'profileId') is null then
      raise exception 'Every leg needs a player';
    end if;
    if (leg.value ->> 'amount') !~ '^-?[0-9]+$' then
      raise exception 'Use whole coins';
    end if;
    total := total + (leg.value ->> 'amount')::integer;
  end loop;

  if leg_count < 2 then
    raise exception 'Add at least two people to this entry';
  end if;
  if total <> 0 then
    raise exception 'Legs must add to 0. They add to %', total;
  end if;

  insert into public.prize_entries (session_id, created_by, note, legs)
  values (p_session_id, auth.uid(), nullif(p_note, ''), p_legs);

  perform public.recompute_session_status(p_session_id);
  return public.get_prize_session(p_session_id);
end;
$$;

create or replace function public.list_prize_sessions()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'title', s.title,
    'status', s.status,
    'createdAt', s.created_at,
    'gameCount', (select count(*) from public.prize_session_games sg where sg.session_id = s.id)
  ) order by s.created_at desc), '[]'::jsonb)
  from public.prize_sessions s
  where public.session_visible(s.id);
$$;

revoke all on function public.list_visible_game_ids() from public;
revoke all on function public.public_scorecard(text) from public;
revoke all on function public.game_coin_shares(uuid) from public;
revoke all on function public.session_visible(uuid) from public;
revoke all on function public.get_prize_session(uuid) from public;
revoke all on function public.recompute_session_status(uuid) from public;
revoke all on function public.create_prize_session(uuid[]) from public;
revoke all on function public.add_prize_entry(uuid, jsonb, text) from public;
revoke all on function public.list_prize_sessions() from public;

grant execute on function public.list_visible_game_ids() to authenticated;
grant execute on function public.public_scorecard(text) to anon, authenticated;
grant execute on function public.get_prize_session(uuid) to authenticated;
grant execute on function public.create_prize_session(uuid[]) to authenticated;
grant execute on function public.add_prize_entry(uuid, jsonb, text) to authenticated;
grant execute on function public.list_prize_sessions() to authenticated;

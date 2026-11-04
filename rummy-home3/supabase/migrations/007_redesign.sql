-- Redesign: my players, unseated admins, and settle-only-if-you-run-every-game.
-- Does not depend on 005_demo_data.sql. Apply after 006_friday_game_night.sql
-- in the Supabase SQL editor. Do not run this from the app.

-- ---------------------------------------------------------------------------
-- Personal roster. One row per account, not the whole profiles directory.
-- ---------------------------------------------------------------------------

create table if not exists public.my_players (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  games_together integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (owner_id, player_id)
);

alter table public.my_players enable row level security;

drop policy if exists my_players_owner on public.my_players;
create policy my_players_owner on public.my_players
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- A game admin who is not a score column. Existing rows stay seated.
alter table public.game_players
  add column if not exists seated boolean not null default true;

alter table public.prize_sessions alter column title set default 'Settle';

-- Hang the games list instead of spinning the client forever on a bad plan.
alter function public.list_visible_game_ids() set statement_timeout = '8s';

-- ---------------------------------------------------------------------------
-- Find. Returns name and player ID only. Email match is the full address.
-- ---------------------------------------------------------------------------

create or replace function public.search_players(p_query text)
returns table (id uuid, display_name text, player_code text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := btrim(coalesce(p_query, ''));
  pattern text;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  if length(q) < 2 then
    return;
  end if;

  -- Phone numbers are not searched.
  if q !~ '[A-Za-z@]' and length(regexp_replace(q, '\D', '', 'g')) >= 6 then
    return;
  end if;

  if q ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return query
      select p.id,
             coalesce(nullif(p.display_name, ''), 'Rummy Player'),
             p.player_code
      from public.profiles p
      where lower(p.email) = lower(q)
      limit 5;
    return;
  end if;

  -- A partial address matches nobody, and the address is never returned.
  if position('@' in q) > 0 then
    return;
  end if;

  pattern := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query
    select p.id,
           coalesce(nullif(p.display_name, ''), 'Rummy Player'),
           p.player_code
    from public.profiles p
    where p.display_name ilike pattern escape '\'
       or p.first_name ilike pattern escape '\'
       or p.last_name ilike pattern escape '\'
       or p.player_code ilike pattern escape '\'
    order by p.display_name
    limit 20;
end;
$$;

create or replace function public.list_my_players()
returns table (id uuid, display_name text, player_code text, games_together integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         coalesce(nullif(p.display_name, ''), 'Rummy Player'),
         p.player_code,
         m.games_together
  from public.my_players m
  join public.profiles p on p.id = m.player_id
  where m.owner_id = auth.uid()
  order by m.games_together desc, p.display_name;
$$;

create or replace function public.add_my_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  if p_player_id is null or not exists (select 1 from public.profiles where id = p_player_id) then
    raise exception 'That player was not found';
  end if;
  insert into public.my_players (owner_id, player_id)
  values (auth.uid(), p_player_id)
  on conflict (owner_id, player_id) do nothing;
end;
$$;

create or replace function public.remove_my_player(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  delete from public.my_players
  where owner_id = auth.uid() and player_id = p_player_id;
end;
$$;

create or replace function public.touch_my_players(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  if auth.uid() is null or p_ids is null then
    return;
  end if;
  foreach pid in array p_ids loop
    if pid is null or pid = auth.uid() then
      continue;
    end if;
    if not exists (select 1 from public.profiles where id = pid) then
      continue;
    end if;
    insert into public.my_players (owner_id, player_id, games_together)
    values (auth.uid(), pid, 1)
    on conflict (owner_id, player_id)
    do update set games_together = public.my_players.games_together + 1;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Coin columns skip admins who are not sitting in the game.
-- ---------------------------------------------------------------------------

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
      and gp.seated
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

-- ---------------------------------------------------------------------------
-- Settle: admin of every selected game. Payments can be replaced until settled.
-- ---------------------------------------------------------------------------

create or replace function public.create_prize_session(p_game_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  game_id uuid;
  admin_count integer;
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

  select count(*) into admin_count
  from public.games g
  where g.id = any(p_game_ids)
    and g.status = 'completed'
    and public.is_game_admin(g.id);

  if admin_count <> array_length(p_game_ids, 1) then
    raise exception 'You can only settle completed games you run';
  end if;

  insert into public.prize_sessions (created_by, title)
  values (auth.uid(), 'Settle')
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
  current_status text;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  if not public.session_visible(p_session_id) then
    raise exception 'You are not in this session';
  end if;

  select status into current_status from public.prize_sessions where id = p_session_id;
  if current_status = 'settled' then
    raise exception 'This settlement is completed and cannot be edited';
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
    raise exception 'Only an admin of these games can record a payment';
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
    raise exception 'Add at least two people to this payment';
  end if;
  if total <> 0 then
    raise exception 'These coins must add to 0. They add to %', total;
  end if;

  insert into public.prize_entries (session_id, created_by, note, legs)
  values (p_session_id, auth.uid(), nullif(p_note, ''), p_legs);

  perform public.recompute_session_status(p_session_id);
  return public.get_prize_session(p_session_id);
end;
$$;

create or replace function public.update_prize_entry(p_entry_id uuid, p_legs jsonb, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session uuid;
  current_status text;
  leg record;
  total integer := 0;
  leg_count integer := 0;
  allowed boolean;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  select session_id into target_session from public.prize_entries where id = p_entry_id;
  if target_session is null then
    raise exception 'That payment was not found';
  end if;
  if not public.session_visible(target_session) then
    raise exception 'You are not in this session';
  end if;

  select status into current_status from public.prize_sessions where id = target_session;
  if current_status = 'settled' then
    raise exception 'This settlement is completed and cannot be edited';
  end if;

  allowed := exists (
    select 1 from public.prize_sessions s
    where s.id = target_session and s.created_by = auth.uid()
  ) or exists (
    select 1
    from public.prize_session_games sg
    where sg.session_id = target_session
      and public.is_game_admin(sg.game_id)
  );
  if not allowed then
    raise exception 'Only an admin of these games can change a payment';
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
    raise exception 'Add at least two people to this payment';
  end if;
  if total <> 0 then
    raise exception 'These coins must add to 0. They add to %', total;
  end if;

  update public.prize_entries
  set legs = p_legs, note = nullif(p_note, '')
  where id = p_entry_id;

  perform public.recompute_session_status(target_session);
  return public.get_prize_session(target_session);
end;
$$;

revoke all on function public.search_players(text) from public;
revoke all on function public.list_my_players() from public;
revoke all on function public.add_my_player(uuid) from public;
revoke all on function public.remove_my_player(uuid) from public;
revoke all on function public.touch_my_players(uuid[]) from public;
revoke all on function public.update_prize_entry(uuid, jsonb, text) from public;

grant execute on function public.search_players(text) to authenticated;
grant execute on function public.list_my_players() to authenticated;
grant execute on function public.add_my_player(uuid) to authenticated;
grant execute on function public.remove_my_player(uuid) to authenticated;
grant execute on function public.touch_my_players(uuid[]) to authenticated;
grant execute on function public.update_prize_entry(uuid, jsonb, text) to authenticated;

-- Hide unseated admins from the coin list returned with a settlement.
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
    'title', 'Settle',
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
              and gp.seated
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

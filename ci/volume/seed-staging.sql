-- Staging population helpers (docs/test-environment-plan.md §3, Q12). Applied by ci/volume/seed-staging.mjs to
-- the LOCAL CI database or to the ezscore-staging project — never to live (the driver refuses the live ref).
--
-- Everything lives in the `staging` schema. Rows are inserted directly where volume demands it (games, rounds,
-- scores, My players) and through the real RPCs where the data shape depends on them (results). The app's
-- triggers run (initials, game numbers, event log, multiplier check); the 029 guardrail triggers are switched off
-- by the driver while it seeds, because a believable 18-month history breaks every per-day cap by design.
--
-- Deterministic ids:  people   c0000000-0000-4000-8000-00000000NNNN   (NNNN = person number, hex)
--                     guests   d0oooooo-0000-4000-8000-0000GGGGGGGG   (owner number, guest number)
-- Every person signs in with the passcode 123456 at <first>.<last>.<n>@staging.test.

create schema if not exists staging;

create or replace function staging.person_id(p_n integer) returns uuid
language sql immutable as $$ select ('c0000000-0000-4000-8000-' || lpad(to_hex(p_n), 12, '0'))::uuid $$;

create or replace function staging.guest_id(p_owner_n integer, p_g integer) returns uuid
language sql immutable as $$
  select ('d' || lpad(to_hex(p_owner_n), 7, '0') || '-0000-4000-8000-' || lpad(to_hex(p_g), 12, '0'))::uuid $$;

-- Real-looking names: Indian and US first names, mixed surnames, chosen by number so a rerun is identical.
create or replace function staging.first_name(p_n integer) returns text
language sql immutable as $$
  select case when p_n = 1 then 'Sree' else (array['Hari','Harish','Priya','Anil','Lakshmi','Ravi','Kiran','Deepa','Suresh','Meena','Venkat','Padma','Rajesh','Swathi',
                'Arjun','Kavya','Mohan','Sita','Ganesh','Radha','Michael','Sarah','David','Emily','James','Jessica','Robert','Ashley',
                'John','Amanda','Chris','Megan','Daniel','Laura','Mark','Rachel','Kevin','Nicole','Brian','Anna'])[1 + (p_n * 7) % 40] end $$;

create or replace function staging.last_name(p_n integer) returns text
language sql immutable as $$
  select case when p_n = 1 then 'Koneru' else (array['Kondapalli','Reddy','Rao','Naidu','Sharma','Gupta','Iyer','Patel','Nair','Menon','Chowdary','Varma','Pillai','Bhat',
                'Smith','Johnson','Williams','Brown','Jones','Miller','Davis','Wilson','Anderson','Taylor','Thomas','Moore','Martin',
                'Jackson','Lee','Clark'])[1 + (p_n * 11) % 30] end $$;

-- A registered person (auth.users row → profile through handle_new_user). Idempotent. created_at spread over 18 months.
create or replace function staging.ensure_person(p_n integer) returns uuid
language plpgsql as $$
declare
  v_id uuid := staging.person_id(p_n);
  v_first text := staging.first_name(p_n);
  v_last text := staging.last_name(p_n);
begin
  if not exists (select 1 from auth.users where id = v_id) then
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
            lower(v_first || '.' || v_last || '.' || p_n || '@staging.test'), crypt('123456', gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('display_name', v_first || ' ' || v_last, 'first_name', v_first, 'last_name', v_last),
            now() - ((30 + (p_n * 37) % 510) || ' days')::interval, now());
  end if;
  return v_id;
end $$;

-- GoTrue needs non-null token columns (same fix-up as seed-e2e.sql); the plain-Postgres stub has no such columns.
create or replace function staging.fix_auth_tokens() returns void
language plpgsql as $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'confirmation_token') then
    update auth.users
       set confirmation_token = coalesce(confirmation_token, ''), recovery_token = coalesce(recovery_token, ''),
           email_change_token_new = coalesce(email_change_token_new, ''), email_change = coalesce(email_change, ''),
           email_change_token_current = coalesce(email_change_token_current, ''), phone_change = coalesce(phone_change, ''),
           phone_change_token = coalesce(phone_change_token, ''), reauthentication_token = coalesce(reauthentication_token, '')
     where email like '%@staging.test';
  end if;
end $$;

-- Guests (unregistered placeholders) in owner p_owner_n's My players. Names look like the roster, not "Guest 00042".
create or replace function staging.add_guests(p_owner_n integer, p_n integer) returns integer
language plpgsql as $$
declare v_owner uuid := staging.person_id(p_owner_n);
begin
  insert into public.profiles (id, display_name, first_name, last_name, player_status, managed_by, player_code, created_at)
  select staging.guest_id(p_owner_n, g), staging.first_name(g * 3 + p_owner_n) || ' ' || staging.last_name(g * 5 + p_owner_n),
         staging.first_name(g * 3 + p_owner_n), staging.last_name(g * 5 + p_owner_n),
         'unregistered', v_owner, 'SG' || lpad(to_hex(p_owner_n * 100000 + g), 8, '0'),
         now() - ((g * 3) % 540 || ' days')::interval
    from generate_series(1, p_n) g
  on conflict (id) do nothing;
  insert into public.my_players (owner_id, player_id, games_together, created_at)
  select v_owner, staging.guest_id(p_owner_n, g), 0, now() - ((g * 3) % 540 || ' days')::interval
    from generate_series(1, p_n) g
  on conflict (owner_id, player_id) do nothing;
  return p_n;
end $$;

-- Everyone in a circle knows everyone (My players both ways). Initials are filled by the app's trigger.
create or replace function staging.know_each_other(p_members uuid[]) returns void
language sql as $$
  insert into public.my_players (owner_id, player_id, games_together, created_at)
  select a, b, 0, now() - interval '400 days' from unnest(p_members) a cross join unnest(p_members) b where a <> b
  on conflict (owner_id, player_id) do nothing;
$$;

-- One game with a full history. p_players[1] is the creator (seated admin). Scores: one winner per round, the others
-- take 5..75; pool games are plus points with the winner on 0 and who-is-out derived afterwards (041).
-- p_joined_round > 1 makes the last player a mid-game joiner (047: starts at the highest score still in).
create or replace function staging.make_game(
  p_players uuid[], p_rounds integer, p_game_type text, p_status text, p_created_at timestamptz,
  p_multiplier integer default 1, p_pool_limit integer default 101, p_joined_round integer default 1,
  p_deleted boolean default false, p_hidden_by uuid default null, p_archived boolean default false
) returns uuid
language plpgsql as $$
declare
  v_game uuid := gen_random_uuid();
  v_n integer := array_length(p_players, 1);
  v_creator uuid := p_players[1];
  v_settings jsonb;
  v_high integer;
begin
  v_settings := case when p_game_type = 'pool'
    then jsonb_build_object('gameType', 'pool', 'poolLimit', p_pool_limit, 'poolDrop', 25, 'poolMiddleDrop', 50, 'poolAmount', 100,
                            'poolDefaultDeposit', -100, 'expenseEnabled', false,
                            'reentryLimit', case when p_pool_limit % 3 = 0 then 1 else null end)
    else jsonb_build_object('gameType', 'stake', 'maxCount', -80, 'stakeDrop', -10, 'stakeMiddleDrop', -30, 'expenseEnabled', false)
         || case when p_multiplier > 1 then jsonb_build_object('multiplier', p_multiplier) else '{}'::jsonb end end;

  insert into public.games (id, created_by, status, game_type, settings, share_code, created_at, current_round, completed_at, prize,
                            deleted_at, deleted_by, archived_at)
  values (v_game, v_creator, p_status::public.game_status, p_game_type::public.game_type, v_settings,
          upper(substr(md5(v_game::text), 1, 10)), p_created_at, p_rounds + 1,
          case when p_status = 'completed' then p_created_at + ((p_rounds * 4) || ' minutes')::interval end,
          case when p_game_type = 'pool' then 100 end,
          case when p_deleted then p_created_at + interval '2 days' end, case when p_deleted then v_creator end,
          case when p_archived and p_status = 'completed' then p_created_at + interval '30 days' end);

  insert into public.game_players (game_id, profile_id, player_order, role, seated, joined_at)
  select v_game, p_players[i], i - 1, (case when i = 1 then 'game_admin' else 'player' end)::public.game_member_role, true,
         p_created_at + case when i = v_n and p_joined_round > 1 then ((p_joined_round * 4) || ' minutes')::interval else interval '0' end
    from generate_series(1, v_n) i;

  insert into public.rounds (game_id, round_number, dealer_profile_id, created_by, created_at)
  select v_game, r, p_players[((r - 1) % v_n) + 1], v_creator, p_created_at + ((r * 4) || ' minutes')::interval
    from generate_series(1, p_rounds) r;

  insert into public.scores (round_id, game_id, profile_id, score_type, value)
  select rd.id, v_game, p_players[i],
         case when i - 1 = (r * 7) % v_n then 'rummy'::public.score_type else 'count'::public.score_type end,
         case when i - 1 = (r * 7) % v_n
              then case when p_game_type = 'pool' then 0
                        else (select sum(5 + ((r * 31 + j * 17) % 15) * 5) from generate_series(1, v_n) j
                               where j - 1 <> (r * 7) % v_n and not (j = v_n and r < p_joined_round)) end
              else case when p_game_type = 'pool' then 1 else -1 end * (5 + ((r * 31 + i * 17) % 15) * 5) end
    from generate_series(1, p_rounds) r
    join public.rounds rd on rd.game_id = v_game and rd.round_number = r
    cross join generate_series(1, v_n) i
   where not (i = v_n and r < p_joined_round);

  if p_joined_round > 1 then
    select coalesce(max(t.s), 0) into v_high from (
      select sum(s.value)::integer as s from public.scores s join public.rounds r on r.id = s.round_id
       where s.game_id = v_game and r.round_number < p_joined_round and s.profile_id <> p_players[v_n] group by s.profile_id) t;
    update public.game_players set reentered_round = p_joined_round,
           reentry_score = case when p_game_type = 'pool' then v_high else 0 end
     where game_id = v_game and profile_id = p_players[v_n];
  end if;

  if p_game_type = 'pool' then perform public.pool_recompute(v_game); end if;
  if p_hidden_by is not null then
    insert into public.hidden_games (owner_id, game_id) values (p_hidden_by, v_game) on conflict do nothing;
  end if;
  return v_game;
end $$;

-- Run a statement as a signed-in person, the way PostgREST does, inside the caller's transaction.
create or replace function staging.login(p_uid uuid) returns void
language plpgsql as $$
declare v_email text;
begin
  select email into v_email from auth.users where id = p_uid;
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'email', v_email)::text, true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('role', 'authenticated', true);
end $$;

-- A deterministic pseudo-random in [0, 1) from two integers, so the population is the same on every machine.
create or replace function staging.rnd(p_a integer, p_b integer) returns double precision
language sql immutable as $$ select (('x' || substr(md5(p_a::text || ':' || p_b::text), 1, 8))::bit(32)::bigint % 1000000) / 1000000.0 $$;

-- Remove everything this generator made (people, their guests, games, results, links, log rows), in FK order.
-- Only rows with the staging id prefixes or @staging.test e-mails are touched.
create or replace function staging.wipe() returns integer
language plpgsql as $$
declare v_people uuid[]; v_profiles uuid[]; v_n integer;
begin
  select array_agg(id) into v_people from auth.users where email like '%@staging.test';
  select array_agg(id) into v_profiles from public.profiles where id = any(coalesce(v_people, '{}')) or id::text like 'd_______-0000-4000-8000-%';
  if v_profiles is null then return 0; end if;
  -- Hard deletes are not an app path (the app soft-deletes; archive_deleted_games purges), so the event-log
  -- triggers that write "game removed" rows are off while the population goes away.
  alter table public.games disable trigger games_0_guard;
  alter table public.my_players disable trigger my_players_0_guard;
  alter table public.games disable trigger event_log_games;
  alter table public.games disable trigger event_log_result_saved_now;
  alter table public.game_players disable trigger event_log_game_players;
  alter table public.rounds disable trigger event_log_rounds;
  alter table public.game_results disable trigger event_log_game_results;
  alter table public.game_results disable trigger event_log_result_saved;
  alter table public.game_result_games disable trigger event_log_result_games;
  alter table public.profiles disable trigger event_log_profiles;
  alter table public.event_log disable trigger event_log_immutable;
  delete from public.event_log where game_id in (select id from public.games where created_by = any(v_profiles))
     or result_id in (select id from public.game_results where declared_by = any(v_profiles));
  delete from public.game_result_games rg using public.game_results r where r.id = rg.result_id and r.declared_by = any(v_profiles);
  delete from public.result_versions rv where not exists (select 1 from public.game_result_games g where g.result_id = rv.result_id)
     and rv.result_id in (select id from public.game_results where declared_by = any(v_profiles));
  delete from public.game_results where declared_by = any(v_profiles);
  delete from public.player_links where owner_id = any(v_profiles) or player_id = any(v_profiles);
  delete from public.games where created_by = any(v_profiles);
  delete from public.my_players where owner_id = any(v_profiles) or player_id = any(v_profiles);
  delete from public.hidden_games where owner_id = any(v_profiles);
  delete from public.event_log where actor_id = any(v_profiles);
  get diagnostics v_n = row_count;
  delete from public.profiles where id = any(v_profiles);
  delete from auth.users where id = any(coalesce(v_people, '{}'));
  alter table public.games enable trigger games_0_guard;
  alter table public.my_players enable trigger my_players_0_guard;
  alter table public.games enable trigger event_log_games;
  alter table public.games enable trigger event_log_result_saved_now;
  alter table public.game_players enable trigger event_log_game_players;
  alter table public.rounds enable trigger event_log_rounds;
  alter table public.game_results enable trigger event_log_game_results;
  alter table public.game_results enable trigger event_log_result_saved;
  alter table public.game_result_games enable trigger event_log_result_games;
  alter table public.profiles enable trigger event_log_profiles;
  alter table public.event_log enable trigger event_log_immutable;
  return coalesce(array_length(v_profiles, 1), 0);
end $$;

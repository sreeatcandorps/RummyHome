-- Volume-test seed helpers for the LOCAL / CI database only. Never run on the hosted project.
--
-- Applied by ci/volume/run-volume.mjs after ci/db/local-run.sh has built the database
-- (every migration + seed.sql). Everything lives in the `volume` schema so nothing here can
-- be mistaken for app code. Rows are inserted directly (not through the RPCs) so a 10,000-row
-- roster or a 500-round game takes seconds; the app's triggers still run (initials, game
-- numbers, guardrails) unless a case switches a guard off on purpose to go past a cap.
--
-- Deterministic ids: users  v0000000-0000-4000-8000-00000000NNNN  (NNNN = user number, hex)
--                    guests  owner's number in the middle: v1oooooo-....-GGGGGGGG

create schema if not exists volume;

-- A registered user (auth.users row -> profile via handle_new_user). Idempotent.
create or replace function volume.user_id(p_n integer) returns uuid
language sql immutable as $$
  select ('a0000000-0000-4000-8000-' || lpad(to_hex(p_n), 12, '0'))::uuid
$$;

create or replace function volume.ensure_user(p_n integer, p_name text default null) returns uuid
language plpgsql as $$
declare
  v_id uuid := volume.user_id(p_n);
  v_name text := coalesce(p_name, 'Volume User ' || p_n);
begin
  if not exists (select 1 from auth.users where id = v_id) then
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
            'volume' || p_n || '@test.local', 'not-a-real-hash', now(), '{"provider":"email","providers":["email"]}',
            jsonb_build_object('display_name', v_name, 'first_name', split_part(v_name, ' ', 1), 'last_name', 'U' || p_n),
            now() - interval '60 days', now());
  end if;
  return v_id;
end $$;

-- Deterministic guest (unregistered) profile id for owner n, guest g.
create or replace function volume.guest_id(p_owner_n integer, p_g integer) returns uuid
language sql immutable as $$
  select ('b' || lpad(to_hex(p_owner_n), 7, '0') || '-0000-4000-8000-' || lpad(to_hex(p_g), 12, '0'))::uuid
$$;

-- Initials that never collide: A..Z then two base-36 digits (26 * 36 * 36 = 33,696 labels).
create or replace function volume.initials_for(p_g integer) returns text
language sql immutable as $$
  select chr(65 + (p_g / 1296) % 26)
      || substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', ((p_g / 36) % 36) + 1, 1)
      || substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', (p_g % 36) + 1, 1)
$$;

-- Add p_n guests to owner p_owner_n's My players (names "Guest 00042 <Surname>", spread over
-- the alphabet so A-Z sections fill). p_spread_days spreads created_at so the per-day cap
-- is not hit; p_bypass_guard switches the 029 trigger off to go past the 2,000 cap on purpose.
create or replace function volume.add_my_players(p_owner_n integer, p_n integer, p_bypass_guard boolean default false)
returns integer
language plpgsql as $$
declare
  v_owner uuid := volume.ensure_user(p_owner_n);
  v_from integer;
begin
  select coalesce(max((regexp_match(p.display_name, '^Guest (\d+)'))[1]::int), 0) + 1 into v_from
    from public.my_players mp join public.profiles p on p.id = mp.player_id
   where mp.owner_id = v_owner;
  if p_bypass_guard then
    alter table public.my_players disable trigger my_players_0_guard;
  end if;
  insert into public.profiles (id, display_name, first_name, last_name, player_status, managed_by, player_code)
  select volume.guest_id(p_owner_n, g),
         'Guest ' || lpad(g::text, 5, '0') || ' ' || chr(65 + (g * 7) % 26) || 'name',
         'Guest ' || lpad(g::text, 5, '0'), chr(65 + (g * 7) % 26) || 'name',
         'unregistered', v_owner, 'VG' || lpad(to_hex(p_owner_n * 100000 + g), 8, '0')
    from generate_series(v_from, v_from + p_n - 1) g
  on conflict (id) do nothing;
  insert into public.my_players (owner_id, player_id, games_together, created_at, initials)
  select v_owner, volume.guest_id(p_owner_n, g), (g * 13) % 40, now() - ((g % 365) || ' days')::interval, volume.initials_for(g)
    from generate_series(v_from, v_from + p_n - 1) g
  on conflict (owner_id, player_id) do nothing;
  if p_bypass_guard then
    alter table public.my_players enable trigger my_players_0_guard;
  end if;
  return p_n;
end $$;

-- One game: creator p_creator_n (seated admin), the first p_players-1 of their guests, p_rounds
-- live rounds with one score per seat (one rummy winner per round, the others negative counts),
-- dealer rotating by seat order. Status 'active' or 'completed'. Returns the game id.
create or replace function volume.make_game(
  p_creator_n integer, p_players integer, p_rounds integer,
  p_status text default 'completed', p_created_at timestamptz default now() - interval '2 days',
  p_game_type text default 'stake'
) returns uuid
language plpgsql as $$
declare
  v_creator uuid := volume.ensure_user(p_creator_n);
  v_game uuid := gen_random_uuid();
  v_players uuid[];
  v_n integer;
begin
  -- enough guests for the seats
  if (select count(*) from public.my_players where owner_id = v_creator) < p_players - 1 then
    perform volume.add_my_players(p_creator_n, p_players - 1 - (select count(*) from public.my_players where owner_id = v_creator)::int);
  end if;
  select array_agg(mp.player_id order by mp.player_id) into v_players
    from (select player_id from public.my_players where owner_id = v_creator order by player_id limit p_players - 1) mp;
  v_players := array[v_creator] || coalesce(v_players, '{}'::uuid[]);
  v_n := array_length(v_players, 1);

  insert into public.games (id, created_by, status, game_type, settings, share_code, created_at, current_round,
                            completed_at, prize)
  values (v_game, v_creator, p_status::public.game_status, p_game_type::public.game_type,
          case when p_game_type = 'pool' then '{"gameType":"pool","maxCount":-80,"poolDrop":-25,"poolMiddleDrop":-50,"poolAmount":100,"poolDefaultDeposit":-100,"expenseEnabled":false}'::jsonb
               else '{"gameType":"stake","maxCount":-80,"stakeDrop":-10,"stakeMiddleDrop":-30,"expenseEnabled":false}'::jsonb end,
          upper(substr(md5(v_game::text), 1, 10)), p_created_at, p_rounds + 1,
          case when p_status = 'completed' then p_created_at + (p_rounds || ' minutes')::interval end,
          case when p_game_type = 'pool' then 100 end);

  insert into public.game_players (game_id, profile_id, player_order, role, seated)
  select v_game, v_players[i], i - 1, (case when i = 1 then 'game_admin' else 'player' end)::public.game_member_role, true
    from generate_series(1, v_n) i;

  insert into public.rounds (game_id, round_number, dealer_profile_id, created_by, created_at)
  select v_game, r, v_players[((r - 1) % v_n) + 1], v_creator, p_created_at + (r || ' minutes')::interval
    from generate_series(1, p_rounds) r;

  -- winner of round r is seat ((r * 7) % n); everyone else loses 5..75 (every multiple of 5), winner gets the sum
  insert into public.scores (round_id, game_id, profile_id, score_type, value)
  select rd.id, v_game, v_players[i],
         case when i - 1 = (r * 7) % v_n then 'rummy'::public.score_type else 'count'::public.score_type end,
         case when i - 1 = (r * 7) % v_n
              then (select sum(5 + ((r * 31 + j * 17) % 15) * 5) from generate_series(1, v_n) j where j - 1 <> (r * 7) % v_n)
              else -(5 + ((r * 31 + i * 17) % 15) * 5) end
    from generate_series(1, p_rounds) r
    join public.rounds rd on rd.game_id = v_game and rd.round_number = r
    cross join generate_series(1, v_n) i;

  return v_game;
end $$;

-- p_n completed games for user p_creator_n, p_players seats and p_rounds rounds each, spread
-- one per hour back in time so the per-day creation cap is never the thing being measured.
create or replace function volume.add_games(p_creator_n integer, p_n integer, p_players integer default 4, p_rounds integer default 10)
returns integer
language plpgsql as $$
declare i integer;
begin
  for i in 1..p_n loop
    perform volume.make_game(p_creator_n, p_players, p_rounds, 'completed', now() - (i || ' hours')::interval - interval '1 day');
  end loop;
  return p_n;
end $$;

-- Run a statement as a signed-in user, the way PostgREST does (role + JWT claims), inside the caller's transaction.
-- (The caller is the superuser connection of the volume runner, so auth.users is readable.)
create or replace function volume.login(p_uid uuid) returns void
language plpgsql as $$
declare v_email text;
begin
  select email into v_email from auth.users where id = p_uid;
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'email', v_email)::text, true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('role', 'authenticated', true);
end $$;

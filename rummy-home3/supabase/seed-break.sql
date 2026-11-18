-- Break-the-app fixtures (PR 17, docs/test-plan/break-the-app.md §2). Applied by the CI device jobs on
-- the throw-away local Supabase AFTER seed.sql and seed-e2e.sql. Never run this on the hosted project:
-- it disables the games guard while it seeds and creates ~70 accounts with the passcode 123456.
--
-- Roster (every account signs in with 123456; emails end in @test.local):
--   creators   c1 Chandra Creator      …000101  seated creator of BP1, BP2, BP4
--              c2 Chitra Nonplaying    …000102  non-playing creator of BP5 (she is not seated)
--              c3 Charan Poolmaster    …000103  seated creator of the pools BQ1, BQ2, BQ3
--              c4 Chaya Manygames      …000104  creator of 38 small games (30 completed, 8 active): Home paging, Results picker
--   admins     a1 Arun Admin           …000111  seated game_admin in BP1 and BQ1
--              a2 Asha Coadmin         …000112  non-playing game_admin in BP2 and BQ2 (second device for the races)
--              a3 Amit Twoboards       …000113  seated game_admin in BP4 and BQ3 (admin of two games at once)
--   players    p01–p20 Player One … Player Twenty  …000201–…000214 (hex)  fill the 20-seat games
--              p07 has a pending link request from c1's placeholder "Pending Seven"
--   others     s1 Sita Spectator       …000301  spectator in BP1 and BQ1
--              o1 Omar Outsider        …000302  signed in, in no game
--              o2 Olga Outsider        …000303  signed in, in no game
--   unregistered 40 placeholders: 20 managed by c1 (BRK01–BRK20, incl. "Mo Khan" and "Mo Kumar" who share
--              initials, and "R2 D2" with a digit), 10 by c2 (BRK21–30), 10 by c3 (BRK31–40)
--
-- Games (share codes BREAK..):
--   BP1 …00b001 Points, active, 5 seats (c1 admin, a1 admin, p01, p02, Mo Khan), 3 live rounds with every
--               score type + one undone round; s1 spectator. Chaos target: the two-device races run here.
--   BP2 …00b002 Points, active, 20 seats (c1 + p01–p19) × 60 rounds, a2 non-playing admin. Volume on a device.
--   BP4 …00b004 Points, completed, 4 seats (c1, a3 admin, p03, p04), 2 rounds, in result BR1 → closed.
--   BP5 …00b005 Points, active, created by c2 who is NOT seated (a1, p05, p06, p07), no rounds.
--   BP6 …00b006 Points, active, 4 seats (c1 admin, p11, p12, p13), no rounds: offline-save chaos target.
--   BP7 …00b007 Points, active, same seats, no rounds: kill-mid-save chaos target.
--   BQ1 …00b011 Pool 101, active, 6 seats (c3 admin, a1 admin, p03–p06), re-entry on: p05 OUT in round 4,
--               p06 OUT in round 3 and re-entered for round 4 (blue). s1 spectator.
--   BQ2 …00b012 Pool 201, active, 20 seats (c3 + p01–p19), a2 non-playing admin, 30 rounds: everyone but c3
--               is OUT (Complete is offered).
--   BQ3 …00b013 Pool 400 custom, re-entry off, completed and AWARDED (c3 admin, a3 admin, p08, p09).
--   c4's 38 games …00c001–…00c026: 2 seats each (c4 + p10), 30 completed over the past 30 days, 8 active.
--   BR1 …00e0b1 result over BP4, declared by c1.
--
-- Fixed UUIDs so flows, pgTAP and the chaos scripts can refer to them. Suffix map: the last 6 hex digits.

-- ---------------------------------------------------------------------------
-- Accounts (auth.users → profiles via handle_new_user)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('000101', 'c1@test.local',  'Chandra', 'Creator'),
      ('000102', 'c2@test.local',  'Chitra',  'Nonplaying'),
      ('000103', 'c3@test.local',  'Charan',  'Poolmaster'),
      ('000104', 'c4@test.local',  'Chaya',   'Manygames'),
      ('000111', 'a1@test.local',  'Arun',    'Admin'),
      ('000112', 'a2@test.local',  'Asha',    'Coadmin'),
      ('000113', 'a3@test.local',  'Amit',    'Twoboards'),
      ('000301', 's1@test.local',  'Sita',    'Spectator'),
      ('000302', 'o1@test.local',  'Omar',    'Outsider'),
      ('000303', 'o2@test.local',  'Olga',    'Outsider')
    ) as t(suffix, email, first_name, last_name)
  loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', ('00000000-0000-4000-8000-000000' || r.suffix)::uuid,
            'authenticated', 'authenticated', r.email, crypt('123456', gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('display_name', r.first_name || ' ' || r.last_name, 'first_name', r.first_name, 'last_name', r.last_name),
            now() - interval '40 days', now());
  end loop;

  -- p01 … p20
  for r in
    select i, lpad(to_hex(512 + i), 6, '0') as suffix,
           (array['One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen',
                  'Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen','Twenty'])[i] as last_name
      from generate_series(1, 20) i
  loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', ('00000000-0000-4000-8000-000000' || r.suffix)::uuid,
            'authenticated', 'authenticated', 'p' || lpad(r.i::text, 2, '0') || '@test.local',
            crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
            jsonb_build_object('display_name', 'Player ' || r.last_name, 'first_name', 'Player', 'last_name', r.last_name),
            now() - interval '39 days' + (r.i || ' minutes')::interval, now());
  end loop;
end $$;

-- GoTrue needs non-null token columns (same fix-up as seed-e2e.sql). On the plain-Postgres stub used by
-- ci/db/local-run.sh these columns do not exist, so guard the update.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'confirmation_token') then
    update auth.users
       set confirmation_token = coalesce(confirmation_token, ''),
           recovery_token = coalesce(recovery_token, ''),
           email_change = coalesce(email_change, ''),
           email_change_token_new = coalesce(email_change_token_new, ''),
           email_change_token_current = coalesce(email_change_token_current, ''),
           phone_change = coalesce(phone_change, ''),
           phone_change_token = coalesce(phone_change_token, ''),
           reauthentication_token = coalesce(reauthentication_token, ''),
           is_sso_user = coalesce(is_sso_user, false),
           is_anonymous = coalesce(is_anonymous, false)
     where email like '%@test.local';
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'identities') then
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    select gen_random_uuid(), u.id, u.id::text, 'email',
           jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
           now(), u.created_at, now()
      from auth.users u
     where u.email like '%@test.local'
       and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Unregistered placeholders: 20 for c1, 10 for c2, 10 for c3 (BRK01–BRK40)
-- ---------------------------------------------------------------------------
do $$
declare
  v_c1 uuid := '00000000-0000-4000-8000-000000000101';
  v_c2 uuid := '00000000-0000-4000-8000-000000000102';
  v_c3 uuid := '00000000-0000-4000-8000-000000000103';
  v_owner uuid;
  v_pid uuid;
  v_first text;
  v_last text;
  v_firsts text[] := array['Mo','Mo','R2','Uma','Vik','Wen','Xin','Yas','Zak','Ana','Bo','Cy','Dev','Eli','Fay','Gus','Hal','Ivy','Jo','Kai',
                           'Lea','Max','Nia','Ott','Pia','Quin','Rex','Sol','Tam','Uli','Val','Wes','Xia','Yul','Zed','Ash','Bri','Cal','Dee','Eva'];
  v_lasts  text[] := array['Khan','Kumar','D2','Uppal','Verma','Wong','Xu','Yadav','Zaidi','Arora','Bose','Chen','Das','Eng','Fox','Gill','Hui','Iyer','Jain','Kaur',
                           'Lal','Mehta','Nair','Ortiz','Pillai','Quon','Rao','Sen','Tan','Unni','Vyas','Wu','Xie','Yoon','Zhou','Ahuja','Bali','Chawla','Dutt','Ezra'];
  i integer;
begin
  for i in 1..40 loop
    v_owner := case when i <= 20 then v_c1 when i <= 30 then v_c2 else v_c3 end;
    v_pid := ('00000000-0000-4000-8000-000000' || lpad(to_hex(1024 + i), 6, '0'))::uuid;
    v_first := v_firsts[i]; v_last := v_lasts[i];
    insert into public.profiles (id, display_name, first_name, last_name, player_status, managed_by, player_code)
    values (v_pid, v_first || ' ' || v_last, v_first, v_last, 'unregistered', v_owner, 'BRK' || lpad(i::text, 2, '0'));
    insert into public.my_players (owner_id, player_id, games_together) values (v_owner, v_pid, 1);
  end loop;
end $$;

-- Rosters: c1 knows the admins and every player; c3 knows p01–p19; c4 knows p10.
insert into public.my_players (owner_id, player_id, games_together)
select '00000000-0000-4000-8000-000000000101', ('00000000-0000-4000-8000-000000' || lpad(to_hex(512 + i), 6, '0'))::uuid, 2
  from generate_series(1, 20) i
on conflict do nothing;
insert into public.my_players (owner_id, player_id, games_together) values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000111', 3),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000112', 3),
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000113', 1),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-00000000020a', 38)
on conflict do nothing;
insert into public.my_players (owner_id, player_id, games_together)
select '00000000-0000-4000-8000-000000000103', ('00000000-0000-4000-8000-000000' || lpad(to_hex(512 + i), 6, '0'))::uuid, 1
  from generate_series(1, 19) i
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Games
-- ---------------------------------------------------------------------------
-- The 029 guard counts live games and games per day per creator; c4's 38 games and the dated fixtures
-- are seeded with it off, then it goes back on so the flows still hit GRD01 where they should.
alter table public.games disable trigger games_0_guard;

do $$
declare
  v_c1 uuid := '00000000-0000-4000-8000-000000000101';
  v_c2 uuid := '00000000-0000-4000-8000-000000000102';
  v_c3 uuid := '00000000-0000-4000-8000-000000000103';
  v_c4 uuid := '00000000-0000-4000-8000-000000000104';
  v_a1 uuid := '00000000-0000-4000-8000-000000000111';
  v_a2 uuid := '00000000-0000-4000-8000-000000000112';
  v_a3 uuid := '00000000-0000-4000-8000-000000000113';
  v_s1 uuid := '00000000-0000-4000-8000-000000000301';
  v_mokhan uuid := '00000000-0000-4000-8000-000000000401';
  v_points jsonb := '{"gameType":"stake","expenseEnabled":false,"expenseAmount":0,"stakeDrop":-10,"stakeMiddleDrop":-30,"maxCount":-80,"dropAmount":-10,"mdAmount":-30}';
  v_pool101 jsonb := '{"gameType":"pool","expenseEnabled":false,"stakeDrop":25,"stakeMiddleDrop":50,"dropAmount":25,"mdAmount":50,"maxCount":130,"poolLimit":101,"reentry":true}';
  v_pool201 jsonb := '{"gameType":"pool","expenseEnabled":false,"stakeDrop":25,"stakeMiddleDrop":50,"dropAmount":25,"mdAmount":50,"maxCount":130,"poolLimit":201,"reentry":true}';
  v_pool400 jsonb := '{"gameType":"pool","expenseEnabled":false,"stakeDrop":25,"stakeMiddleDrop":50,"dropAmount":25,"mdAmount":50,"maxCount":130,"poolLimit":400,"reentry":false}';
  v_game uuid;
  v_round uuid;
  v_players uuid[];
  v_total integer[];
  v_out integer[];
  v_n integer;
  v_i integer;
  v_winner integer;
  v_score integer;
  v_in integer;
  p uuid;
begin
  -- player p(i) is ('00000000-0000-4000-8000-000000' || lpad(to_hex(512 + i), 6, '0'))::uuid

  -- ---- BP1: Points, active, 5 seats, 3 live rounds + 1 undone ----------------------------------
  v_game := '00000000-0000-4000-8000-00000000b001';
  insert into public.games (id, created_by, status, game_type, settings, share_code, created_at)
  values (v_game, v_c1, 'active', 'stake', v_points, 'BREAKP1', now() - interval '4 hours');
  insert into public.game_players (game_id, profile_id, player_order, role, seated) values
    (v_game, v_c1, 0, 'game_admin', true),
    (v_game, v_a1, 1, 'game_admin', true),
    (v_game, '00000000-0000-4000-8000-000000000201', 2, 'player', true),
    (v_game, '00000000-0000-4000-8000-000000000202', 3, 'player', true),
    (v_game, v_mokhan, 4, 'player', true),
    (v_game, v_s1, 5, 'spectator', false);
  -- round 1: c1 rummy +60, a1 drop -10, p01 middle -30, p02 count -20, Mo 0
  insert into public.rounds (game_id, round_number, dealer_profile_id, created_by) values (v_game, 1, v_c1, v_c1) returning id into v_round;
  insert into public.scores (round_id, game_id, profile_id, score_type, value) values
    (v_round, v_game, v_c1, 'rummy', 60), (v_round, v_game, v_a1, 'drop', -10),
    (v_round, v_game, '00000000-0000-4000-8000-000000000201', 'middle_drop', -30),
    (v_round, v_game, '00000000-0000-4000-8000-000000000202', 'count', -20), (v_round, v_game, v_mokhan, 'count', 0);
  -- round 2: p02 rummy +80 (full count on c1), others
  insert into public.rounds (game_id, round_number, dealer_profile_id, created_by) values (v_game, 2, v_a1, v_a1) returning id into v_round;
  insert into public.scores (round_id, game_id, profile_id, score_type, value) values
    (v_round, v_game, v_c1, 'count', -80), (v_round, v_game, v_a1, 'count', 0),
    (v_round, v_game, '00000000-0000-4000-8000-000000000201', 'count', -15),
    (v_round, v_game, '00000000-0000-4000-8000-000000000202', 'rummy', 105), (v_round, v_game, v_mokhan, 'drop', -10);
  -- round 3: Mo rummy
  insert into public.rounds (game_id, round_number, dealer_profile_id, created_by) values (v_game, 3, '00000000-0000-4000-8000-000000000201', v_c1) returning id into v_round;
  insert into public.scores (round_id, game_id, profile_id, score_type, value) values
    (v_round, v_game, v_c1, 'count', -5), (v_round, v_game, v_a1, 'count', -25),
    (v_round, v_game, '00000000-0000-4000-8000-000000000201', 'drop', -10),
    (v_round, v_game, '00000000-0000-4000-8000-000000000202', 'count', -40), (v_round, v_game, v_mokhan, 'rummy', 80);
  -- an undone round 4
  insert into public.rounds (game_id, round_number, dealer_profile_id, created_by, undone_at, undone_by, undo_reason)
  values (v_game, 4, '00000000-0000-4000-8000-000000000202', v_a1, now() - interval '30 minutes', v_a1, 'admin undo') returning id into v_round;
  insert into public.scores (round_id, game_id, profile_id, score_type, value) values
    (v_round, v_game, v_c1, 'rummy', 20), (v_round, v_game, v_a1, 'count', -20);
  update public.games set current_round = 4 where id = v_game;

  -- ---- BP2: Points, active, 20 seats × 60 rounds, a2 non-playing admin ---------------------------
  v_game := '00000000-0000-4000-8000-00000000b002';
  insert into public.games (id, created_by, status, game_type, settings, share_code, created_at)
  values (v_game, v_c1, 'active', 'stake', v_points, 'BREAKP2', now() - interval '6 hours');
  v_players := array[v_c1];
  for v_i in 1..19 loop
    v_players := v_players || ('00000000-0000-4000-8000-000000' || lpad(to_hex(512 + v_i), 6, '0'))::uuid;
  end loop;
  for v_i in 1..20 loop
    insert into public.game_players (game_id, profile_id, player_order, role, seated)
    values (v_game, v_players[v_i], v_i - 1, case when v_i = 1 then 'game_admin' else 'player' end::public.game_member_role, true);
  end loop;
  insert into public.game_players (game_id, profile_id, player_order, role, seated) values (v_game, v_a2, 20, 'game_admin', false);
  for v_n in 1..60 loop
    v_winner := ((v_n * 7) % 20) + 1;
    insert into public.rounds (game_id, round_number, dealer_profile_id, created_by)
    values (v_game, v_n, v_players[((v_n - 1) % 20) + 1], case when v_n % 2 = 0 then v_a2 else v_c1 end) returning id into v_round;
    for v_i in 1..20 loop
      -- scores vary so the grid is not uniform: counts -5 … -80 in steps, drops every 7th seat
      v_score := case when v_i = v_winner then 0
                      when (v_i + v_n) % 7 = 0 then -10
                      when (v_i + v_n) % 11 = 0 then -30
                      else -(5 + ((v_i * v_n) % 16) * 5) end;
      if v_i = v_winner then
        insert into public.scores (round_id, game_id, profile_id, score_type, value) values (v_round, v_game, v_players[v_i], 'rummy', 0);
      else
        insert into public.scores (round_id, game_id, profile_id, score_type, value)
        values (v_round, v_game, v_players[v_i],
                case when v_score = -10 then 'drop' when v_score = -30 then 'middle_drop' else 'count' end::public.score_type, v_score);
      end if;
    end loop;
    -- the winner takes the pot
    update public.scores s set value = -(select sum(value) from public.scores x where x.round_id = v_round and x.profile_id <> v_players[v_winner])
     where s.round_id = v_round and s.profile_id = v_players[v_winner];
  end loop;
  update public.games set current_round = 61 where id = v_game;

  -- ---- BP4: Points, completed, 4 seats, 2 rounds; in result BR1 -------------------------------
  v_game := '00000000-0000-4000-8000-00000000b004';
  insert into public.games (id, created_by, status, game_type, settings, share_code, created_at, completed_at)
  values (v_game, v_c1, 'completed', 'stake', v_points, 'BREAKP4', now() - interval '3 days', now() - interval '3 days' + interval '2 hours');
  insert into public.game_players (game_id, profile_id, player_order, role, seated) values
    (v_game, v_c1, 0, 'game_admin', true), (v_game, v_a3, 1, 'game_admin', true),
    (v_game, '00000000-0000-4000-8000-000000000203', 2, 'player', true),
    (v_game, '00000000-0000-4000-8000-000000000204', 3, 'player', true);
  insert into public.rounds (game_id, round_number, dealer_profile_id, created_by) values (v_game, 1, v_c1, v_c1) returning id into v_round;
  insert into public.scores (round_id, game_id, profile_id, score_type, value) values
    (v_round, v_game, v_c1, 'rummy', 70), (v_round, v_game, v_a3, 'count', -30),
    (v_round, v_game, '00000000-0000-4000-8000-000000000203', 'drop', -10),
    (v_round, v_game, '00000000-0000-4000-8000-000000000204', 'middle_drop', -30);
  insert into public.rounds (game_id, round_number, dealer_profile_id, created_by) values (v_game, 2, v_a3, v_a3) returning id into v_round;
  insert into public.scores (round_id, game_id, profile_id, score_type, value) values
    (v_round, v_game, v_c1, 'count', -40), (v_round, v_game, v_a3, 'rummy', 90),
    (v_round, v_game, '00000000-0000-4000-8000-000000000203', 'count', -20),
    (v_round, v_game, '00000000-0000-4000-8000-000000000204', 'middle_drop', -30);
  update public.games set current_round = 3 where id = v_game;
  insert into public.game_results (id, declared_by, declared_at, places)
  values ('00000000-0000-4000-8000-00000000e0b1', v_c1, now() - interval '2 days',
          jsonb_build_object(
            'standings', jsonb_build_array(
              jsonb_build_object('id', v_a3, 'name', 'Amit Twoboards', 'points', 60, 'games', 1, 'place', 1),
              jsonb_build_object('id', v_c1, 'name', 'Chandra Creator', 'points', 30, 'games', 1, 'place', 2),
              jsonb_build_object('id', '00000000-0000-4000-8000-000000000203', 'name', 'Player Three', 'points', -30, 'games', 1, 'place', 3),
              jsonb_build_object('id', '00000000-0000-4000-8000-000000000204', 'name', 'Player Four', 'points', -60, 'games', 1, 'place', 4)),
            'players', jsonb_build_array(
              jsonb_build_object('id', v_c1, 'name', 'Chandra Creator'), jsonb_build_object('id', v_a3, 'name', 'Amit Twoboards'),
              jsonb_build_object('id', '00000000-0000-4000-8000-000000000203', 'name', 'Player Three'),
              jsonb_build_object('id', '00000000-0000-4000-8000-000000000204', 'name', 'Player Four')),
            'games', jsonb_build_array(jsonb_build_object('id', v_game, 'name', 'Game', 'date', to_char(now() - interval '3 days', 'YYYY-MM-DD'), 'scores', '{}'::jsonb))));
  insert into public.game_result_games (result_id, game_id) values ('00000000-0000-4000-8000-00000000e0b1', v_game);
  update public.games set closed_at = now() - interval '2 days' where id = v_game;

  -- ---- BP5: Points, active, creator c2 not seated, no rounds ----------------------------------
  v_game := '00000000-0000-4000-8000-00000000b005';
  insert into public.games (id, created_by, status, game_type, settings, share_code, created_at)
  values (v_game, v_c2, 'active', 'stake', v_points, 'BREAKP5', now() - interval '1 hour');
  insert into public.game_players (game_id, profile_id, player_order, role, seated) values
    (v_game, v_a1, 0, 'game_admin', true),
    (v_game, '00000000-0000-4000-8000-000000000205', 1, 'player', true),
    (v_game, '00000000-0000-4000-8000-000000000206', 2, 'player', true),
    (v_game, '00000000-0000-4000-8000-000000000207', 3, 'player', true),
    (v_game, v_c2, 4, 'game_admin', false);

  -- ---- BP6 / BP7: Points, active, 4 seats (c1 admin + p11 p12 p13), no rounds: offline and kill-mid-save targets --
  foreach v_game in array array['00000000-0000-4000-8000-00000000b006'::uuid, '00000000-0000-4000-8000-00000000b007'::uuid] loop
    insert into public.games (id, created_by, status, game_type, settings, share_code, created_at)
    values (v_game, v_c1, 'active', 'stake', v_points, case when v_game::text like '%b006' then 'BREAKP6' else 'BREAKP7' end, now() - interval '50 minutes');
    insert into public.game_players (game_id, profile_id, player_order, role, seated) values
      (v_game, v_c1, 0, 'game_admin', true),
      (v_game, '00000000-0000-4000-8000-00000000020b', 1, 'player', true),
      (v_game, '00000000-0000-4000-8000-00000000020c', 2, 'player', true),
      (v_game, '00000000-0000-4000-8000-00000000020d', 3, 'player', true);
  end loop;

  -- ---- BQ1: Pool 101, active, 6 seats, p06 OUT in round 2 then re-entered for round 4, p05 OUT in round 3 --
  -- Pool scores are stored positive. Totals after each round (limit 101):
  --   round   c3  a1  p03  p04  p05  p06
  --     1      0  25   30   40   45   80
  --     2      0  50   60   65   90  105  -> p06 OUT
  --     3     15  50   70   90  110    -  -> p05 OUT; p06 re-enters for round 4 at 90 (highest still in)
  v_game := '00000000-0000-4000-8000-00000000b011';
  insert into public.games (id, created_by, status, game_type, settings, share_code, created_at)
  values (v_game, v_c3, 'active', 'pool', v_pool101, 'BREAKQ1', now() - interval '3 hours');
  insert into public.game_players (game_id, profile_id, player_order, role, seated, out_round, reentered_round, reentry_score, entries) values
    (v_game, v_c3, 0, 'game_admin', true, null, null, null, 1),
    (v_game, v_a1, 1, 'game_admin', true, null, null, null, 1),
    (v_game, '00000000-0000-4000-8000-000000000203', 2, 'player', true, null, null, null, 1),
    (v_game, '00000000-0000-4000-8000-000000000204', 3, 'player', true, null, null, null, 1),
    (v_game, '00000000-0000-4000-8000-000000000205', 4, 'player', true, 3, null, null, 1),
    (v_game, '00000000-0000-4000-8000-000000000206', 5, 'player', true, null, 4, 90, 2),
    (v_game, v_s1, 6, 'spectator', false, null, null, null, 1);
  insert into public.rounds (game_id, round_number, dealer_profile_id, created_by) values (v_game, 1, v_c3, v_c3) returning id into v_round;
  insert into public.scores (round_id, game_id, profile_id, score_type, value) values
    (v_round, v_game, v_c3, 'rummy', 0), (v_round, v_game, v_a1, 'drop', 25),
    (v_round, v_game, '00000000-0000-4000-8000-000000000203', 'count', 30), (v_round, v_game, '00000000-0000-4000-8000-000000000204', 'count', 40),
    (v_round, v_game, '00000000-0000-4000-8000-000000000205', 'count', 45), (v_round, v_game, '00000000-0000-4000-8000-000000000206', 'count', 80);
  insert into public.rounds (game_id, round_number, dealer_profile_id, created_by) values (v_game, 2, v_a1, v_c3) returning id into v_round;
  insert into public.scores (round_id, game_id, profile_id, score_type, value) values
    (v_round, v_game, v_c3, 'rummy', 0), (v_round, v_game, v_a1, 'drop', 25),
    (v_round, v_game, '00000000-0000-4000-8000-000000000203', 'count', 30), (v_round, v_game, '00000000-0000-4000-8000-000000000204', 'drop', 25),
    (v_round, v_game, '00000000-0000-4000-8000-000000000205', 'count', 45), (v_round, v_game, '00000000-0000-4000-8000-000000000206', 'drop', 25);
  insert into public.rounds (game_id, round_number, dealer_profile_id, created_by) values (v_game, 3, '00000000-0000-4000-8000-000000000203', v_a1) returning id into v_round;
  insert into public.scores (round_id, game_id, profile_id, score_type, value) values
    (v_round, v_game, v_c3, 'count', 15), (v_round, v_game, v_a1, 'rummy', 0),
    (v_round, v_game, '00000000-0000-4000-8000-000000000203', 'count', 10), (v_round, v_game, '00000000-0000-4000-8000-000000000204', 'drop', 25),
    (v_round, v_game, '00000000-0000-4000-8000-000000000205', 'count', 20);
  update public.games set current_round = 4 where id = v_game;

  -- ---- BQ2: Pool 201, active, 20 seats, 30 rounds, everyone but c3 is OUT -----------------------
  v_game := '00000000-0000-4000-8000-00000000b012';
  insert into public.games (id, created_by, status, game_type, settings, share_code, created_at)
  values (v_game, v_c3, 'active', 'pool', v_pool201, 'BREAKQ2', now() - interval '7 hours');
  v_players := array[v_c3];
  for v_i in 1..19 loop
    v_players := v_players || ('00000000-0000-4000-8000-000000' || lpad(to_hex(512 + v_i), 6, '0'))::uuid;
  end loop;
  v_total := array_fill(0, array[20]);
  v_out := array_fill(0, array[20]);
  for v_i in 1..20 loop
    insert into public.game_players (game_id, profile_id, player_order, role, seated)
    values (v_game, v_players[v_i], v_i - 1, case when v_i = 1 then 'game_admin' else 'player' end::public.game_member_role, true);
  end loop;
  insert into public.game_players (game_id, profile_id, player_order, role, seated) values (v_game, v_a2, 20, 'game_admin', false);
  for v_n in 1..30 loop
    v_in := 0;
    for v_i in 1..20 loop if v_out[v_i] = 0 then v_in := v_in + 1; end if; end loop;
    exit when v_in <= 1;
    insert into public.rounds (game_id, round_number, dealer_profile_id, created_by) values (v_game, v_n, v_players[((v_n - 1) % 20) + 1], v_c3) returning id into v_round;
    for v_i in 1..20 loop
      continue when v_out[v_i] <> 0;
      v_score := case when v_i = 1 then 0 else 5 + v_i end;  -- c3 wins every round; seat i scores 5+i
      insert into public.scores (round_id, game_id, profile_id, score_type, value)
      values (v_round, v_game, v_players[v_i], case when v_i = 1 then 'rummy' else 'count' end::public.score_type, v_score);
      v_total[v_i] := v_total[v_i] + v_score;
      if v_total[v_i] >= 201 then
        v_out[v_i] := v_n;
        update public.game_players set out_round = v_n where game_id = v_game and profile_id = v_players[v_i];
      end if;
    end loop;
    update public.games set current_round = v_n + 1 where id = v_game;
  end loop;

  -- ---- BQ3: Pool 400, re-entry off, completed + awarded (winner takes all) ----------------------
  v_game := '00000000-0000-4000-8000-00000000b013';
  insert into public.games (id, created_by, status, game_type, settings, share_code, created_at, completed_at, awarded_at, awarded_by, prize_shares, award_note)
  values (v_game, v_c3, 'completed', 'pool', v_pool400, 'BREAKQ3', now() - interval '2 days', now() - interval '2 days' + interval '3 hours',
          now() - interval '2 days' + interval '3 hours' + interval '5 minutes', v_c3,
          jsonb_build_object(v_c3::text, 300, v_a3::text, -100, '00000000-0000-4000-8000-000000000208', -100, '00000000-0000-4000-8000-000000000209', -100),
          '{"preset":"winner","presetLabel":"Winner takes all","entry":100,"pool":400}');
  insert into public.game_players (game_id, profile_id, player_order, role, seated, out_round) values
    (v_game, v_c3, 0, 'game_admin', true, null), (v_game, v_a3, 1, 'game_admin', true, 2),
    (v_game, '00000000-0000-4000-8000-000000000208', 2, 'player', true, 2),
    (v_game, '00000000-0000-4000-8000-000000000209', 3, 'player', true, 1);
  insert into public.rounds (game_id, round_number, dealer_profile_id, created_by) values (v_game, 1, v_c3, v_c3) returning id into v_round;
  insert into public.scores (round_id, game_id, profile_id, score_type, value) values
    (v_round, v_game, v_c3, 'rummy', 0), (v_round, v_game, v_a3, 'count', 130), (v_round, v_game, '00000000-0000-4000-8000-000000000208', 'count', 130),
    (v_round, v_game, '00000000-0000-4000-8000-000000000209', 'count', 400);
  insert into public.rounds (game_id, round_number, dealer_profile_id, created_by) values (v_game, 2, v_a3, v_c3) returning id into v_round;
  insert into public.scores (round_id, game_id, profile_id, score_type, value) values
    (v_round, v_game, v_c3, 'rummy', 0), (v_round, v_game, v_a3, 'count', 290), (v_round, v_game, '00000000-0000-4000-8000-000000000208', 'count', 275);
  update public.games set current_round = 3 where id = v_game;

  -- ---- c4: 30 completed + 8 active small games over the past 30 days ------------------------------
  for v_i in 1..38 loop
    v_game := ('00000000-0000-4000-8000-00000000c0' || lpad(to_hex(v_i), 2, '0'))::uuid;
    insert into public.games (id, created_by, status, game_type, settings, share_code, created_at, completed_at)
    values (v_game, v_c4, case when v_i <= 30 then 'completed' else 'active' end::public.game_status, 'stake', v_points,
            'BRKC' || lpad(v_i::text, 2, '0'), now() - ((40 - v_i) || ' days')::interval,
            case when v_i <= 30 then now() - ((40 - v_i) || ' days')::interval + interval '2 hours' end);
    insert into public.game_players (game_id, profile_id, player_order, role, seated) values
      (v_game, v_c4, 0, 'game_admin', true), (v_game, '00000000-0000-4000-8000-00000000020a', 1, 'player', true);
    insert into public.rounds (game_id, round_number, dealer_profile_id, created_by) values (v_game, 1, v_c4, v_c4) returning id into v_round;
    insert into public.scores (round_id, game_id, profile_id, score_type, value) values
      (v_round, v_game, v_c4, 'rummy', 10 + v_i), (v_round, v_game, '00000000-0000-4000-8000-00000000020a', 'count', -(10 + v_i));
    update public.games set current_round = 2 where id = v_game;
  end loop;
end $$;

alter table public.games enable trigger games_0_guard;

-- Pending link request: c1's placeholder "Pending Seven" asks p07 to take the seat (claim flow fixture).
insert into public.profiles (id, display_name, first_name, last_name, player_status, managed_by, player_code)
values ('00000000-0000-4000-8000-000000000451', 'Pending Seven', 'Pending', 'Seven', 'unregistered', '00000000-0000-4000-8000-000000000101', 'BRK51')
on conflict do nothing;
insert into public.my_players (owner_id, player_id, games_together)
values ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000451', 1) on conflict do nothing;
insert into public.player_links (owner_id, player_id, email, kind, status)
values ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000451', 'p07@test.local', 'existing', 'pending');

-- Sanity counts a CI step prints (never secrets).
select 'break seed: ' || (select count(*) from auth.users where email like '%@test.local') || ' accounts, '
       || (select count(*) from public.profiles where player_status = 'unregistered') || ' placeholders, '
       || (select count(*) from public.games where share_code like 'BREAK%' or share_code like 'BRKC%') || ' break games, '
       || (select count(*) from public.scores) || ' scores' as summary;

-- Test seed for the local / CI database only. Never run this on the hosted project.
--
-- Applied by `supabase db reset` after migrations 001–017, and by ci/db/local-run.sh.
-- Fixed UUIDs so pgTAP files and ci/db/concurrency-save-round.mjs can refer to them.
--
-- People (auth.users → profiles via handle_new_user):
--   sree      00000000-0000-4000-8000-000000000001  creator of game A and game C, NOT seated in A (non-playing organiser)
--   harish    ...0002  seated player in A; creator, seated admin and declarer of game B
--   priya     ...0003  seated player in A (non-zero scores) and in B
--   viewer    ...0004  spectator (view only) in A
--   outsider  ...0005  no games at all
--   coadmin   ...0006  game_admin in A, not seated (non-playing co-admin)
--   appadmin  ...0007  profiles.role = app_admin, in no game
--   zero      ...0008  seated in A with a 0 in every played round; seated in C
-- Unregistered placeholders (profiles without auth.users rows):
--   rk        ...00a1  managed by sree, seated in A, has non-zero scores
--   ab        ...00a2  managed by harish, seated in B
--   cd        ...00a3  managed by sree, seated in C (closed game)
--
-- Games:
--   A  10000000-0000-4000-8000-00000000000a  active, 2 live rounds + 2 undone rounds (one at 1003, one still at 2)
--   B  ...00b  completed, declared in result R1
--   C  ...00c  completed and closed (closed_at set), not in a result
-- Result:
--   R1 20000000-0000-4000-8000-0000000000e1  declared by harish, games [B]

create schema if not exists tests;

-- auth.users is not readable by anon/authenticated; the helpers switch roles, so read it as the owner.
create or replace function tests.email_of(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select email from auth.users where id = p_uid;
$$;

-- Pretend to be a signed-in user for the rest of the current transaction.
create or replace function tests.login(p_uid uuid)
returns void
language plpgsql
as $$
declare
  v_email text;
begin
  perform set_config('role', 'none', true);
  v_email := tests.email_of(p_uid);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'email', v_email)::text, true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.email', coalesce(v_email, ''), true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- The public, signed-out caller (anon key, no JWT).
create or replace function tests.anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  perform set_config('request.jwt.claim.email', '', true);
  perform set_config('role', 'anon', true);
end;
$$;

-- Back to the superuser-ish owner for setup/inspection.
create or replace function tests.logout()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claim.email', '', true);
  perform set_config('role', 'none', true);
end;
$$;

-- The helpers are called while already switched to anon / authenticated.
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'sree@test.local', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Sree Test","first_name":"Sree","last_name":"Test"}', now() - interval '30 days', now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'harish@test.local', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Harish Test","first_name":"Harish","last_name":"Test"}', now() - interval '29 days', now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'priya@test.local', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Priya Test","first_name":"Priya","last_name":"Test"}', now() - interval '28 days', now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'viewer@test.local', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Vee Viewer","first_name":"Vee","last_name":"Viewer"}', now() - interval '27 days', now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated',
   'outsider@test.local', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Otto Outsider","first_name":"Otto","last_name":"Outsider"}', now() - interval '26 days', now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated',
   'coadmin@test.local', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Cora Coadmin","first_name":"Cora","last_name":"Coadmin"}', now() - interval '25 days', now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated',
   'appadmin@test.local', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Ada Appadmin","first_name":"Ada","last_name":"Appadmin"}', now() - interval '24 days', now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000008', 'authenticated', 'authenticated',
   'zero@test.local', crypt('123456', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
   '{"display_name":"Zed Zero","first_name":"Zed","last_name":"Zero"}', now() - interval '23 days', now());

update public.profiles set role = 'app_admin' where id = '00000000-0000-4000-8000-000000000007';

-- Unregistered placeholders (no account; tied to the organiser who typed them)
insert into public.profiles (id, display_name, first_name, last_name, player_status, managed_by, player_code)
values
  ('00000000-0000-4000-8000-0000000000a1', 'R K', 'R', 'K', 'unregistered', '00000000-0000-4000-8000-000000000001', 'RK0001'),
  ('00000000-0000-4000-8000-0000000000a2', 'A B', 'A', 'B', 'unregistered', '00000000-0000-4000-8000-000000000002', 'AB0002'),
  ('00000000-0000-4000-8000-0000000000a3', 'C D', 'C', 'D', 'unregistered', '00000000-0000-4000-8000-000000000001', 'CD0003');

-- Rosters (my_players): sree knows harish, priya, zero and his placeholders; harish knows priya and ab.
insert into public.my_players (owner_id, player_id, games_together) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 3),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 2),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000008', 1),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1', 1),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a3', 1),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', 2),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000a2', 1);

-- ---------------------------------------------------------------------------
-- Game A: active, created by sree who is not seated
-- ---------------------------------------------------------------------------
insert into public.games (id, created_by, status, game_type, settings, share_code, created_at)
values ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000001', 'active', 'stake',
        '{"gameType":"stake","expenseEnabled":false,"expenseAmount":0,"stakeDrop":-10,"stakeMiddleDrop":-30,"maxCount":-80}',
        'GAMEA1', now() - interval '2 days');

insert into public.game_players (game_id, profile_id, player_order, role, seated) values
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000002', 0, 'player', true),      -- harish
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000003', 1, 'player', true),      -- priya
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1', 2, 'player', true),      -- rk (unregistered)
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000008', 3, 'player', true),      -- zero
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000004', 4, 'spectator', false),  -- viewer
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000006', 5, 'game_admin', false); -- coadmin, not playing

-- Round 1: harish -10, priya -20, rk +30 (rummy), zero 0
insert into public.rounds (id, game_id, round_number, dealer_profile_id, created_by)
values ('30000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-00000000000a', 1,
        '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001');
insert into public.scores (round_id, game_id, profile_id, score_type, value) values
  ('30000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000002', 'drop', -10),
  ('30000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000003', 'count', -20),
  ('30000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1', 'rummy', 30),
  ('30000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000008', 'count', 0);

-- Round 2: harish +40 (rummy), priya -40, rk 0, zero 0
insert into public.rounds (id, game_id, round_number, dealer_profile_id, created_by)
values ('30000000-0000-4000-8000-0000000000a2', '10000000-0000-4000-8000-00000000000a', 2,
        '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001');
insert into public.scores (round_id, game_id, profile_id, score_type, value) values
  ('30000000-0000-4000-8000-0000000000a2', '10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000002', 'rummy', 40),
  ('30000000-0000-4000-8000-0000000000a2', '10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000003', 'count', -40),
  ('30000000-0000-4000-8000-0000000000a2', '10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1', 'count', 0),
  ('30000000-0000-4000-8000-0000000000a2', '10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000008', 'count', 0);

-- An undone round 3 (retired to 1003 by Edit round): zero had a -50 here. Undone scores never count.
insert into public.rounds (id, game_id, round_number, dealer_profile_id, created_by, undone_at, undone_by, undo_reason)
values ('30000000-0000-4000-8000-0000000000a3', '10000000-0000-4000-8000-00000000000a', 1003,
        '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', now() - interval '1 hour',
        '00000000-0000-4000-8000-000000000001', 'edited round 3');
insert into public.scores (round_id, game_id, profile_id, score_type, value) values
  ('30000000-0000-4000-8000-0000000000a3', '10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000008', 'count', -50),
  ('30000000-0000-4000-8000-0000000000a3', '10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000002', 'rummy', 50);

-- An undone round 2 that still holds number 2 (Undo, then round 2 was played again): since 035
-- only live rounds are unique per number, so this row and the live round 2 coexist.
insert into public.rounds (id, game_id, round_number, dealer_profile_id, created_by, undone_at, undone_by, undo_reason)
values ('30000000-0000-4000-8000-0000000000a4', '10000000-0000-4000-8000-00000000000a', 2,
        '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', now() - interval '90 minutes',
        '00000000-0000-4000-8000-000000000001', 'admin undo');
insert into public.scores (round_id, game_id, profile_id, score_type, value) values
  ('30000000-0000-4000-8000-0000000000a4', '10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000002', 'count', -20),
  ('30000000-0000-4000-8000-0000000000a4', '10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000003', 'rummy', 20);

update public.games set current_round = 3 where id = '10000000-0000-4000-8000-00000000000a';

-- ---------------------------------------------------------------------------
-- Game B: completed, created by harish (seated admin), declared as result R1
-- ---------------------------------------------------------------------------
insert into public.games (id, created_by, status, game_type, settings, share_code, created_at, completed_at)
values ('10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-000000000002', 'completed', 'stake',
        '{"gameType":"stake","expenseEnabled":false,"expenseAmount":0,"stakeDrop":-10,"stakeMiddleDrop":-30,"maxCount":-80}',
        'GAMEB1', now() - interval '5 days', now() - interval '4 days');

insert into public.game_players (game_id, profile_id, player_order, role, seated) values
  ('10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-000000000002', 0, 'game_admin', true), -- harish
  ('10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-000000000003', 1, 'player', true),     -- priya
  ('10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000a2', 2, 'player', true);     -- ab (unregistered)

insert into public.rounds (id, game_id, round_number, dealer_profile_id, created_by)
values ('30000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-00000000000b', 1,
        '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002');
insert into public.scores (round_id, game_id, profile_id, score_type, value) values
  ('30000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-000000000002', 'rummy', 60),
  ('30000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-000000000003', 'count', -25),
  ('30000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000a2', 'count', -35);

insert into public.game_results (id, declared_by, declared_at, places)
values ('20000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000002', now() - interval '3 days',
        '{"standings":[{"id":"00000000-0000-4000-8000-000000000002","name":"Harish Test","points":60,"games":1,"place":1},
                       {"id":"00000000-0000-4000-8000-000000000003","name":"Priya Test","points":-25,"games":1,"place":2},
                       {"id":"00000000-0000-4000-8000-0000000000a2","name":"A B","points":-35,"games":1,"place":3}],
          "players":[{"id":"00000000-0000-4000-8000-000000000002","name":"Harish Test"},
                     {"id":"00000000-0000-4000-8000-000000000003","name":"Priya Test"},
                     {"id":"00000000-0000-4000-8000-0000000000a2","name":"A B"}],
          "games":[{"id":"10000000-0000-4000-8000-00000000000b","name":"Game","date":"2026-11-06","scores":{}}]}');
insert into public.game_result_games (result_id, game_id)
values ('20000000-0000-4000-8000-0000000000e1', '10000000-0000-4000-8000-00000000000b');
update public.games set closed_at = now() - interval '3 days' where id = '10000000-0000-4000-8000-00000000000b';

-- ---------------------------------------------------------------------------
-- Game C: completed and closed, created by sree; used for the 016 closed-game guard
-- ---------------------------------------------------------------------------
insert into public.games (id, created_by, status, game_type, settings, share_code, created_at, completed_at, closed_at)
values ('10000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-000000000001', 'completed', 'stake',
        '{"gameType":"stake","expenseEnabled":false,"expenseAmount":0,"stakeDrop":-10,"stakeMiddleDrop":-30,"maxCount":-80}',
        'GAMEC1', now() - interval '10 days', now() - interval '9 days', now() - interval '8 days');

insert into public.game_players (game_id, profile_id, player_order, role, seated) values
  ('10000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-000000000002', 0, 'player', true), -- harish
  ('10000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-000000000008', 1, 'player', true), -- zero
  ('10000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-0000000000a3', 2, 'player', true); -- cd (unregistered)

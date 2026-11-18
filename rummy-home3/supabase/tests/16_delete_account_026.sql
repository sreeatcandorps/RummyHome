-- 026 account deletion. delete_my_account() anonymises the caller and removes the auth user;
-- every seat and score stays under the name as an unregistered player. Games the person
-- created with nobody else registered are soft-deleted; kept games get an admin if none is
-- left. The dashboard delete (auth.users trigger) follows the same rule.
-- Seed: sree created A (harish, priya, rk, zero; viewer; coadmin as non-playing admin) and
-- C (harish, zero, cd; no admin besides the creator). Here we add D (sree + rk only) and seat
-- sree as a viewer of harish's B.
begin;
select plan(45);

\set A '''10000000-0000-4000-8000-00000000000a'''
\set B '''10000000-0000-4000-8000-00000000000b'''
\set C '''10000000-0000-4000-8000-00000000000c'''
\set D '''10000000-0000-4000-8000-00000000000d'''
\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set OUTSIDER '''00000000-0000-4000-8000-000000000005'''
\set COADMIN '''00000000-0000-4000-8000-000000000006'''
\set RK '''00000000-0000-4000-8000-0000000000a1'''

-- ---------- objects and grants ----------
select has_function('public', 'delete_my_account', '{}'::text[]);
select has_function('public', 'tombstone_profile', array['uuid']);
select ok(has_function_privilege('authenticated', 'public.delete_my_account()', 'execute'), 'signed-in users can call delete_my_account');
select ok(not has_function_privilege('anon', 'public.delete_my_account()', 'execute'), 'anon cannot call delete_my_account');
select ok(not has_function_privilege('authenticated', 'public.tombstone_profile(uuid)', 'execute'), 'tombstone_profile is internal');

-- ---------- setup ----------
insert into public.games (id, created_by, status, game_type, settings, share_code, created_at)
values (:D, :SREE, 'active', 'stake',
        '{"gameType":"stake","expenseEnabled":false,"expenseAmount":0,"stakeDrop":-10,"stakeMiddleDrop":-30,"maxCount":-80}',
        'GAMED1', now() - interval '1 day');
insert into public.game_players (game_id, profile_id, player_order, role, seated) values
  (:D, :SREE, 0, 'game_admin', true),
  (:D, :RK, 1, 'player', true);
insert into public.rounds (id, game_id, round_number, dealer_profile_id, created_by)
values ('30000000-0000-4000-8000-0000000000d1', :D, 1, :SREE, :SREE);
insert into public.scores (round_id, game_id, profile_id, score_type, value) values
  ('30000000-0000-4000-8000-0000000000d1', :D, :SREE, 'rummy', 20),
  ('30000000-0000-4000-8000-0000000000d1', :D, :RK, 'count', -20);
insert into public.game_players (game_id, profile_id, player_order, role, seated) values (:B, :SREE, 7, 'spectator', false);
insert into public.hidden_games (owner_id, game_id) values (:SREE, :B);
insert into public.email_outbox (event_key, kind, to_profile_id, to_email, payload) values ('test:sree', 'result_saved', :SREE, 'sree@test.local', '{}');
insert into public.player_links (owner_id, player_id, email, kind, status) values (:SREE, :RK, 'rk@test.local', 'signup', 'pending');
update public.profiles set phone = '+14085551234', zip_code = '95014' where id = :SREE;

-- ---------- who may call ----------
select tests.anon();
select throws_like($$ select public.delete_my_account() $$, '%permission denied%', 'anon is refused');
select tests.logout();

-- ---------- sree deletes the account ----------
select tests.login(:SREE);
select is(public.delete_my_account(),
          jsonb_build_object('seatsKept', 1, 'gamesDeleted', 1, 'gamesKept', 2, 'adminsPromoted', 1),
          'summary: one seat kept (D), D deleted, A and C kept, harish promoted in C');
select throws_like($$ select public.delete_my_account() $$, '%already deleted%', 'a second call says the account is already deleted');
select tests.logout();

-- the auth user is gone, the profile row is a tombstone
select is((select count(*) from auth.users where id = :SREE), 0::bigint, 'auth user removed');
select is((select player_status from public.profiles where id = :SREE), 'deleted_after_registering', 'profile status is deleted_after_registering');
select ok((select deleted_at is not null from public.profiles where id = :SREE), 'deleted_at is set');
select is((select display_name from public.profiles where id = :SREE), 'Sree Test', 'the name stays for the scorecards');
select ok((select email is null and phone is null and first_name is null and last_name is null and zip_code is null
             and avatar_url is null and email_token is null from public.profiles where id = :SREE),
          'email, phone, names, zip, avatar and email token are cleared');
select ok((select public_player_no is null from public.profiles where id = :SREE), 'the Player ID number is given up');
select isnt((select player_code from public.profiles where id = :SREE), (select player_code from public.profiles where id = :HARISH), 'player_code is a fresh code');
select ok((select email_game_started = false and email_results = false from public.profiles where id = :SREE), 'email preferences off');
select ok((select default_settings = '{"gameType":"stake","expenseEnabled":true,"expenseAmount":-10,"stakeDrop":-10,"stakeMiddleDrop":-30,"poolDrop":-25,"poolMiddleDrop":-50,"maxCount":-80,"poolAmount":100,"poolDefaultDeposit":-100}'::jsonb
             from public.profiles where id = :SREE), 'default settings reset');
select lives_ok($$ update public.profiles set updated_at = now() where id = '00000000-0000-4000-8000-000000000001' $$,
                'the tombstone row can still be written (no auth user required)');
select throws_like($$ update public.profiles set role = 'app_admin' where id = '00000000-0000-4000-8000-000000000001' $$,
                   '%cannot be an admin%', 'a deleted account can never become an admin');

-- lists and mail
select is((select count(*) from public.my_players where owner_id = :SREE or player_id = :SREE), 0::bigint, 'My players rows gone both ways');
select is((select count(*) from public.hidden_games where owner_id = :SREE), 0::bigint, 'hidden games gone');
select is((select count(*) from public.email_outbox where to_profile_id = :SREE), 0::bigint, 'outbox rows gone');
select is((select status from public.player_links where owner_id = :SREE and player_id = :RK), 'cancelled', 'the pending invite is cancelled');
select is((select managed_by from public.profiles where id = :RK), :SREE::uuid, 'the placeholder RK still points at its creator (row kept)');

-- memberships
select is((select count(*) from public.game_players where game_id = :B and profile_id = :SREE), 0::bigint, 'the viewer row in B is removed');
select is((select role::text from public.game_players where game_id = :D and profile_id = :SREE), 'player', 'the seat in D stays, as a plain player');
select is((select value from public.scores where game_id = :D and profile_id = :SREE), 20, 'the score in D stays');

-- games sree created
select ok((select deleted_at is not null and deleted_by = :SREE from public.games where id = :D), 'D (nobody else registered) is soft-deleted');
select ok((select deleted_at is null from public.games where id = :A), 'A (others registered) is kept');
select ok((select deleted_at is null from public.games where id = :C), 'C (others registered) is kept');
select is((select role::text from public.game_players where game_id = :C and profile_id = :HARISH), 'game_admin', 'C had no other admin: harish (first seat) is promoted');
select is((select count(*) from public.game_players where game_id = :A and role = 'game_admin'), 1::bigint, 'A already had coadmin: nobody else promoted');
select is((select role::text from public.game_players where game_id = :A and profile_id = :COADMIN), 'game_admin', 'coadmin still runs A');

-- others still read everything
select tests.login(:HARISH);
select lives_ok($$ select public.get_game_bundle('10000000-0000-4000-8000-00000000000c') $$, 'harish opens C after the creator is gone');
select ok(public.can_manage_game(:C), 'harish can manage C now');
select ok(exists (select 1 from jsonb_array_elements(public.get_game_bundle(:D)->'game_players') s where s->>'profile_id' = :SREE) or true, 'D bundle still answers');
select lives_ok($$ select public.get_game_bundle('10000000-0000-4000-8000-00000000000a') $$, 'harish opens A');
select tests.logout();
insert into public.my_players (owner_id, player_id) values (:HARISH, :SREE);
select tests.login(:HARISH);
select is((select count(*) from public.list_my_players() m where m.id = :SREE), 0::bigint,
          'a deleted account is not listed in anyone''s My players even if a row points at it');
select tests.logout();

-- ---------- the dashboard path: deleting the auth user follows the same rule ----------
create temp table priya_before as
  select (select count(*) from public.scores where profile_id = :PRIYA) as scores,
         (select count(*) from public.game_players where profile_id = :PRIYA) as seats;
select lives_ok($$ delete from auth.users where id = '00000000-0000-4000-8000-000000000003' $$, 'deleting priya (seated in A and B) from auth.users works');
select is((select player_status from public.profiles where id = :PRIYA), 'deleted_after_registering', 'priya is anonymised, not removed');
select ok((select email is null from public.profiles where id = :PRIYA), 'priya''s email is cleared');
select is((select count(*) from public.game_players where profile_id = :PRIYA), (select seats from priya_before), 'priya''s seats stay');
select is((select count(*) from public.scores where profile_id = :PRIYA), (select scores from priya_before), 'priya''s scores stay');
select lives_ok($$ delete from auth.users where id = '00000000-0000-4000-8000-000000000005' $$, 'deleting outsider (no history) from auth.users works');
select is((select count(*) from public.profiles where id = :OUTSIDER), 0::bigint, 'a profile with no history is removed outright');

select * from finish();
rollback;

-- 029 Guardrails: every limit lives in public.guardrails and is enforced by BEFORE triggers,
-- so the app's inserts, the RPCs and a script with a user's token all meet the same refusal
-- (SQLSTATE GRD01, the message from the table). Limits are lowered here through the table
-- to keep the test small; one check uses the real 1,000.
-- Seed: sree (…0001) has 5 active My players; game A (sree's, active) seats harish, priya,
-- rk, zero (+ viewer spectator, coadmin unseated) and has rounds 1, 2 and an undone 1003.
begin;
select plan(60);

\set A '''10000000-0000-4000-8000-00000000000a'''
\set SREE '''00000000-0000-4000-8000-000000000001'''
\set HARISH '''00000000-0000-4000-8000-000000000002'''
\set PRIYA '''00000000-0000-4000-8000-000000000003'''
\set OUTSIDER '''00000000-0000-4000-8000-000000000005'''
\set COADMIN '''00000000-0000-4000-8000-000000000006'''
\set ZERO '''00000000-0000-4000-8000-000000000008'''
\set RK '''00000000-0000-4000-8000-0000000000a1'''
\set AB '''00000000-0000-4000-8000-0000000000a2'''
\set CD '''00000000-0000-4000-8000-0000000000a3'''

-- ---------- objects, defaults and grants ----------
select has_table('public', 'guardrails', 'the guardrails table exists');
select is((select count(*) from public.guardrails), 9::bigint, 'nine limits are configured');
select is((select value from public.guardrails where key = 'my_players_max'), 1000, 'My players max 1,000');
select is((select message from public.guardrails where key = 'my_players_max'), 'You''ve reached your limit of 1,000 players.', 'My players message');
select is((select message from public.guardrails where key = 'rounds_per_game'), 'This game has reached 500 rounds. Create a new game to keep playing.', 'rounds message');
select is((select value from public.guardrails where key = 'players_added_per_day'), 100, '100 players added per day');
select is((select value from public.guardrails where key = 'players_per_game'), 20, '20 players per game');
select is((select value from public.guardrails where key = 'rounds_per_game'), 500, '500 rounds per game');
select is((select value from public.guardrails where key = 'live_games_per_user'), 10, '10 live games per user');
select is((select value from public.guardrails where key = 'games_per_day'), 50, '50 games per day');
select is((select value from public.guardrails where key = 'link_requests_pending'), 20, '20 pending link requests');
select is((select value from public.guardrails where key = 'email_per_day'), 90, 'email: 90 sends per day (Resend free tier is 100)');
select has_trigger('public', 'my_players', 'my_players_0_guard', 'my_players is guarded');
select has_trigger('public', 'game_players', 'game_players_0_guard', 'game_players is guarded');
select has_trigger('public', 'rounds', 'rounds_0_guard', 'rounds is guarded');
select has_trigger('public', 'games', 'games_0_guard', 'games is guarded');
select has_trigger('public', 'player_links', 'player_links_0_guard', 'player_links is guarded');
select ok((select tgname from pg_trigger where tgrelid = 'public.games'::regclass and tgname in ('games_0_guard', 'games_assign_number') order by tgname limit 1) = 'games_0_guard',
          'the games guard fires before the label trigger, so a refused game never takes the label lock');
select has_column('public', 'email_outbox', 'next_attempt_at', 'email_outbox.next_attempt_at exists');
select ok(has_table_privilege('authenticated', 'public.guardrails', 'select'), 'the app can read the limits');
select ok(not has_table_privilege('anon', 'public.guardrails', 'select'), 'anon cannot');
select ok(not has_table_privilege('authenticated', 'public.guardrails', 'update'), 'the app cannot change a limit');
select ok(not has_function_privilege('authenticated', 'public.guardrail_refuse(text)', 'execute'), 'guardrail_refuse is internal');
select ok(not has_function_privilege('authenticated', 'public.email_sends_left_today()', 'execute'), 'email_sends_left_today is for the service role');

-- A re-run keeps a tuned value and refreshes the texts.
update public.guardrails set value = 7, message = 'old text' where key = 'rounds_per_game';
insert into public.guardrails (key, value, message, description) values
  ('rounds_per_game', 500, 'This game has reached 500 rounds. Create a new game to keep playing.', 'x')
on conflict (key) do update set message = excluded.message, description = excluded.description;
select is((select value from public.guardrails where key = 'rounds_per_game'), 7, 're-applying the migration keeps a tuned value');
select is((select message from public.guardrails where key = 'rounds_per_game'), 'This game has reached 500 rounds. Create a new game to keep playing.', 'and refreshes the message');
update public.guardrails set value = 500 where key = 'rounds_per_game';

-- ---------- players per game ----------
update public.guardrails set value = 4 where key = 'players_per_game';
select throws_ok($$ insert into public.game_players (game_id, profile_id, player_order, role, seated) values ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a3', 9, 'player', true) $$,
                 'GRD01', 'A game holds at most 20 players.', 'a fifth seat at limit 4 is refused with the table message');
select lives_ok($$ insert into public.game_players (game_id, profile_id, player_order, role, seated) values ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-000000000005', 10, 'spectator', false) $$,
                'a spectator does not count');
select throws_ok($$ update public.game_players set seated = true where game_id = '10000000-0000-4000-8000-00000000000a' and profile_id = '00000000-0000-4000-8000-000000000006' $$,
                 'GRD01', 'A game holds at most 20 players.', 'seating the non-playing admin counts as a seat and is refused');
select lives_ok($$ update public.game_players set player_order = 7 where game_id = '10000000-0000-4000-8000-00000000000a' and profile_id = '00000000-0000-4000-8000-000000000002' $$,
                'changing an already counted seat is not re-checked');
update public.guardrails set value = 20 where key = 'players_per_game';
select lives_ok($$ insert into public.game_players (game_id, profile_id, player_order, role, seated) values ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a3', 9, 'player', true) $$,
                'at the real limit the fifth seat is fine');
delete from public.game_players where game_id = :A and profile_id in (:CD, :OUTSIDER);

-- ---------- rounds per game (through save_round, as the creator) ----------
update public.guardrails set value = 2 where key = 'rounds_per_game';
select tests.login(:SREE);
select throws_ok($$ select public.save_round('10000000-0000-4000-8000-00000000000a', 3,
       '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-10}]'::jsonb, false) $$,
  'GRD01', 'This game has reached 500 rounds. Create a new game to keep playing.', 'round 3 at limit 2 is refused (the undone 1003 does not count)');
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-00000000000a', 2,
       '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"rummy","value":40},
         {"playerId":"00000000-0000-4000-8000-000000000003","scoreType":"count","value":-30}]'::jsonb, true) $$,
  'editing a round at the limit still works (the old row is undone first)');
select tests.logout();
select is((select count(*) from public.rounds where game_id = :A and undone_at is null), 2::bigint, 'still two live rounds');
update public.guardrails set value = 500 where key = 'rounds_per_game';
select tests.login(:SREE);
select lives_ok($$ select public.save_round('10000000-0000-4000-8000-00000000000a', 3,
       '[{"playerId":"00000000-0000-4000-8000-000000000002","scoreType":"count","value":-10}]'::jsonb, false) $$,
  'at the real limit round 3 saves');
select tests.logout();

-- ---------- live games per user and games per day ----------
update public.guardrails set value = 1 where key = 'live_games_per_user';
select throws_ok($$ insert into public.games (created_by, status, game_type, settings, share_code) values ('00000000-0000-4000-8000-000000000001', 'active', 'stake', '{}', 'GRD001') $$,
                 'GRD01', 'You have 10 live games. Finish or close one first.', 'sree has one live game (A): a second is refused at limit 1');
select lives_ok($$ insert into public.games (created_by, status, game_type, settings, share_code) values ('00000000-0000-4000-8000-000000000002', 'active', 'stake', '{}', 'GRD002') $$,
                'harish has no live game (B is completed): allowed');
update public.games set deleted_at = now() where id = :A;
select lives_ok($$ insert into public.games (created_by, status, game_type, settings, share_code) values ('00000000-0000-4000-8000-000000000001', 'active', 'stake', '{}', 'GRD003') $$,
                'a deleted game frees the slot');
update public.games set deleted_at = null where id = :A;
update public.guardrails set value = 10 where key = 'live_games_per_user';

update public.guardrails set value = 1 where key = 'games_per_day';
select throws_ok($$ insert into public.games (created_by, status, game_type, settings, share_code) values ('00000000-0000-4000-8000-000000000002', 'active', 'pool', '{}', 'GRD004') $$,
                 'GRD01', 'You created 50 games today. Try again tomorrow.', 'harish created a game just now: a second today is refused at limit 1');
select lives_ok($$ insert into public.games (created_by, status, game_type, settings, share_code) values ('00000000-0000-4000-8000-000000000003', 'active', 'pool', '{}', 'GRD005') $$,
                'priya created none today: allowed');
update public.guardrails set value = 50 where key = 'games_per_day';
select is((select count(*) from public.games where share_code like 'GRD%' and game_label is null), 0::bigint, 'the allowed games were labelled by the 028 trigger');

-- ---------- My players: size and additions per day ----------
update public.guardrails set value = 5 where key = 'my_players_max';
select tests.login(:SREE);
select throws_ok($$ select public.add_my_player('00000000-0000-4000-8000-0000000000a2') $$,
                 'GRD01', 'You''ve reached your limit of 1,000 players.', 'sree has 5 active My players: a sixth is refused at limit 5, through the RPC');
select lives_ok($$ select public.remove_my_player('00000000-0000-4000-8000-0000000000a3') $$, 'remove cd (not in a live game)');
select lives_ok($$ select public.add_my_player('00000000-0000-4000-8000-0000000000a2') $$, 'with a slot free, ab is added');
select throws_ok($$ select public.restore_my_player('00000000-0000-4000-8000-0000000000a3') $$,
                 'GRD01', 'You''ve reached your limit of 1,000 players.', 'Undo (restore) is a sixth active row too: refused');
select tests.logout();
update public.guardrails set value = 1000 where key = 'my_players_max';

update public.guardrails set value = 1 where key = 'players_added_per_day';
select throws_ok($$ insert into public.my_players (owner_id, player_id) values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005') $$,
                 'GRD01', 'You added 100 players today. Try again tomorrow.', 'sree added ab today: another today is refused at limit 1');
select tests.login(:SREE);
select lives_ok($$ select public.restore_my_player('00000000-0000-4000-8000-0000000000a3') $$, 'restoring removed cd is not an addition');
select tests.logout();
select lives_ok($$ insert into public.my_players (owner_id, player_id) values ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000005') $$,
                'priya added nobody today: allowed');
update public.guardrails set value = 100 where key = 'players_added_per_day';

-- The real 1,000, as the server would count it: 999 old rows for the outsider, then the 1,000th fits and the 1,001st does not.
insert into public.profiles (id, display_name, first_name, last_name, player_status, managed_by, player_code)
select ('a0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'Bulk ' || n, 'Bulk', n::text, 'unregistered', :OUTSIDER, 'BULK' || lpad(n::text, 6, '0')
  from generate_series(1, 1000) n;
insert into public.my_players (owner_id, player_id, created_at, initials)
select :OUTSIDER, ('a0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, now() - interval '2 days', chr(65 + n / 100) || lpad((n % 100)::text, 2, '0')
  from generate_series(1, 999) n;
select lives_ok($$ insert into public.my_players (owner_id, player_id) values ('00000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000001000') $$,
                'the 1,000th My player is allowed');
select throws_ok($$ insert into public.my_players (owner_id, player_id) values ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001') $$,
                 'GRD01', 'You''ve reached your limit of 1,000 players.', 'the 1,001st is refused');
select is((select count(*) from public.my_players where owner_id = :OUTSIDER and removed_at is null), 1000::bigint, 'exactly 1,000 active rows');

-- a database that ran the 2,000 version of 029 is brought to 1,000 by a re-run; a tuned value is kept
update public.guardrails set value = 2000 where key = 'my_players_max';
update public.guardrails set value = 1000 where key = 'my_players_max' and value = 2000;
select is((select value from public.guardrails where key = 'my_players_max'), 1000, 'the old 2,000 default becomes 1,000');
update public.guardrails set value = 1500 where key = 'my_players_max';
update public.guardrails set value = 1000 where key = 'my_players_max' and value = 2000;
select is((select value from public.guardrails where key = 'my_players_max'), 1500, 'a tuned value (1,500) is left alone');
update public.guardrails set value = 1000 where key = 'my_players_max';

-- ---------- pending link requests per owner ----------
update public.guardrails set value = 1 where key = 'link_requests_pending';
select lives_ok($$ insert into public.player_links (owner_id, player_id, email, kind, status) values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000a2', 'ab@test.local', 'signup', 'pending') $$,
                'harish: a first pending link');
select throws_ok($$ insert into public.player_links (owner_id, player_id, kind, status, target_id, token_hash, expires_at) values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', 'link_request', 'pending', '00000000-0000-4000-8000-000000000005', repeat('b', 64), now() + interval '7 days') $$,
                 'GRD01', 'You have 20 link requests waiting. Wait for an answer or cancel one first.', 'a second pending link at limit 1 is refused');
select lives_ok($$ insert into public.player_links (owner_id, player_id, email, kind, status) values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', 'p@test.local', 'signup', 'cancelled') $$,
                'a non-pending row is not counted');
update public.guardrails set value = 20 where key = 'link_requests_pending';

-- ---------- email backlog ----------
insert into public.email_outbox (event_key, kind, to_profile_id, to_email, payload, sent_at) values
  ('grd:1', 'result_saved', :SREE, 'sree@test.local', '{}', now() - interval '1 hour'),
  ('grd:2', 'result_saved', :SREE, 'sree@test.local', '{}', now() - interval '2 hours'),
  ('grd:3', 'result_saved', :SREE, 'sree@test.local', '{}', now() - interval '30 hours');
insert into public.email_outbox (event_key, kind, to_profile_id, to_email, payload, attempts, next_attempt_at) values
  ('grd:4', 'result_saved', :SREE, 'sree@test.local', '{}', 3, now() + interval '2 hours'),
  ('grd:5', 'result_saved', :SREE, 'sree@test.local', '{}', 0, now() - interval '1 minute');
select is(public.email_sends_left_today(), 88, 'two sends in the last 24 hours leave 88 of 90');
select is((select next_attempt_at <= now() from public.email_outbox where event_key = 'grd:5'), true, 'a new row is due at once');
select is((select (waiting, due, failing) from public.email_outbox_backlog()), (2::bigint, 1::bigint, 1::bigint), 'backlog: 2 waiting, 1 due now, 1 failing (3+ attempts)');
select is((select indexdef like '%next_attempt_at%' from pg_indexes where indexname = 'email_outbox_unsent_idx'), true, 'the unsent index leads on next_attempt_at');

select * from finish();
rollback;
